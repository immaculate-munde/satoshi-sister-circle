import { randomBytes } from "node:crypto";
import { type Db, id, many, one, run, tx } from "../db";
import { type Asset, fiatMinorToUnits, sum } from "../money";
import { DemoProvider } from "../payments/demo";
import { type Ctx, DomainError, notFound } from "./context";
import { createQuote, getQuote, rateFor, settlementPair } from "./fx";
import { appendEvent, sha256 } from "./ledger";
import type { ContributionRow, CycleRow, DestinationSnapshot, GroupRow, MemberRow, PayoutRow } from "./rows";
import { dueAtForRound, eatDateToDueInstant, type Frequency } from "./schedule";

export const MIN_MEMBERS = 3;
export const MAX_MEMBERS = 20;

export interface CreateChamaInput {
  name: string;
  contributionKes: string; // whole KES, integer string
  frequency: Frequency;
  customIntervalDays?: number;
  settlementAsset: Asset;
  firstDueDate: string; // YYYY-MM-DD in EAT
  members: { displayName: string; isMe: boolean; payoutPreference: "BTC" | "USD"; destinationRef?: string }[];
}

/** Every read of group data goes through this. Non-members get 404 so ids cannot be probed. */
export function requireMember(db: Db, groupId: string, userId: string): { group: GroupRow; member: MemberRow } {
  const group = one<GroupRow>(db, "SELECT * FROM groups WHERE id = :id", { id: groupId });
  const member = group
    ? one<MemberRow>(db, "SELECT * FROM members WHERE group_id = :g AND user_id = :u", { g: groupId, u: userId })
    : undefined;
  if (!group || !member) throw notFound("Chama not found");
  return { group, member };
}

export function currentCycle(db: Db, groupId: string): CycleRow | undefined {
  return one<CycleRow>(db, "SELECT * FROM cycles WHERE group_id = :g ORDER BY round_number DESC LIMIT 1", { g: groupId });
}

function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashInviteCode(code: string) {
  return sha256(`invite:${normalizeCode(code)}`);
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function createInvite(ctx: Ctx, groupId: string, actorUserId: string, opts: { maxUses?: number; ttlDays?: number } = {}) {
  const bytes = randomBytes(10);
  const raw = Array.from(bytes, (b) => CROCKFORD[b % 32]).join("");
  const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
  const now = ctx.now();
  tx(ctx.db, () => {
    run(
      ctx.db,
      `INSERT INTO invites (id, group_id, token_hash, code_hint, expires_at, max_uses, created_at)
       VALUES (:id, :g, :h, :hint, :exp, :max, :now)`,
      {
        id: id(),
        g: groupId,
        h: hashInviteCode(code),
        hint: raw.slice(-4),
        exp: new Date(now.getTime() + (opts.ttlDays ?? 14) * 86400_000).toISOString(),
        max: opts.maxUses ?? MAX_MEMBERS,
        now: now.toISOString(),
      },
    );
    appendEvent(ctx.db, { groupId, type: "INVITE_CREATED", payload: { hint: raw.slice(-4) }, actor: `user:${actorUserId}`, at: now });
  });
  return { code, expiresAt: new Date(now.getTime() + (opts.ttlDays ?? 14) * 86400_000).toISOString() };
}

export async function createChama(ctx: Ctx, userId: string, input: CreateChamaInput) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) throw new DomainError("INVALID_NAME", "Name must be 2 to 60 characters");
  if (!/^\d{1,7}$/.test(input.contributionKes) || BigInt(input.contributionKes) <= 0n) {
    throw new DomainError("INVALID_AMOUNT", "Contribution must be a positive whole KES amount");
  }
  if (input.members.length < MIN_MEMBERS || input.members.length > MAX_MEMBERS) {
    throw new DomainError("INVALID_ROSTER", `A chama needs ${MIN_MEMBERS} to ${MAX_MEMBERS} members`);
  }
  const names = input.members.map((m) => m.displayName.trim());
  if (names.some((n) => n.length < 1 || n.length > 40)) throw new DomainError("INVALID_ROSTER", "Every member needs a name");
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
    throw new DomainError("INVALID_ROSTER", "Member names must be unique");
  }
  if (input.members.filter((m) => m.isMe).length !== 1) throw new DomainError("INVALID_ROSTER", "Mark exactly one member as you");
  if (input.frequency === "CUSTOM" && !(input.customIntervalDays && input.customIntervalDays >= 1 && input.customIntervalDays <= 365)) {
    throw new DomainError("INVALID_INTERVAL", "Custom interval must be 1 to 365 days");
  }
  let firstDue: Date;
  try {
    firstDue = eatDateToDueInstant(input.firstDueDate);
  } catch {
    throw new DomainError("INVALID_DATE", "Choose a valid first payout date");
  }
  if (firstDue.getTime() < ctx.now().getTime() - 86400_000) {
    throw new DomainError("INVALID_DATE", "First payout date cannot be in the past");
  }

  const contributionMinor = BigInt(input.contributionKes) * 100n;
  const pair = settlementPair(input.settlementAsset);
  // Pre-check caps with a provisional quote so we fail before writing anything.
  const provisionalUnits = fiatMinorToUnits(
    contributionMinor,
    rateFor(pair, ctx.now().getTime()).rate,
  );
  const potUnits = provisionalUnits * BigInt(input.members.length);
  if (provisionalUnits <= 0n) throw new DomainError("INVALID_AMOUNT", "Contribution is too small to settle");
  if (potUnits > ctx.limits.maxPrincipalUnits) {
    throw new DomainError(
      "AMOUNT_CAP",
      `This test environment caps a pot at ${ctx.limits.maxPrincipalUnits} settlement units. Lower the contribution or member count.`,
    );
  }

  const groupId = id();
  const now = ctx.now();
  const isDemo = ctx.provider instanceof DemoProvider;
  const memberIds = input.members.map(() => id());

  // Resolve destinations before opening the write transaction (provider calls are async).
  const destinations: (DestinationSnapshot | null)[] = await Promise.all(
    input.members.map(async (m, i) => {
      if (isDemo) {
        const walletId = `member:${memberIds[i]}:${input.settlementAsset}`;
        (ctx.provider as DemoProvider).ensureWallet(walletId, m.displayName.trim(), input.settlementAsset);
        return { walletId, label: `${m.displayName.trim()} test wallet (demo)`, type: "DEMO_WALLET", verifiedAt: now.toISOString() };
      }
      if (!m.destinationRef) return null;
      try {
        const r = await ctx.provider.resolveDestination({ reference: m.destinationRef, asset: input.settlementAsset });
        return { walletId: r.walletId, label: r.label, type: "FLASH_WALLET", verifiedAt: now.toISOString() };
      } catch (e) {
        throw new DomainError("DESTINATION_UNVERIFIED", `${m.displayName}: ${(e as Error).message}`);
      }
    }),
  );
  if (!destinations[0]) {
    throw new DomainError("DESTINATION_UNVERIFIED", "The first recipient needs a verified payout wallet before collecting");
  }

  const providerAccountRef = isDemo ? `grp:${groupId}` : "flash:operator-default";
  if (isDemo) {
    (ctx.provider as DemoProvider).ensureWallet(
      ctx.provider.collectionWalletId(providerAccountRef, input.settlementAsset),
      `${name} pot`,
      input.settlementAsset,
    );
  }

  const result = tx(ctx.db, () => {
    const number = (one<{ n: number }>(ctx.db, "SELECT COALESCE(MAX(number), 0) + 1 AS n FROM groups")?.n ?? 1) as number;
    run(
      ctx.db,
      `INSERT INTO groups (id, number, name, owner_user_id, contribution_kes_minor, settlement_asset, frequency,
         custom_interval_days, first_due_at, provider, provider_account_ref, created_at)
       VALUES (:id, :num, :name, :owner, :amt, :asset, :freq, :custom, :first, :provider, :acct, :now)`,
      {
        id: groupId,
        num: number,
        name,
        owner: userId,
        amt: Number(contributionMinor),
        asset: input.settlementAsset,
        freq: input.frequency,
        custom: input.frequency === "CUSTOM" ? input.customIntervalDays! : null,
        first: firstDue.toISOString(),
        provider: ctx.provider.name,
        acct: providerAccountRef,
        now: now.toISOString(),
      },
    );
    input.members.forEach((m, i) => {
      const d = destinations[i];
      run(
        ctx.db,
        `INSERT INTO members (id, group_id, user_id, display_name, role, invite_state, rotation_position, payout_preference,
           destination_type, verified_destination_ref, destination_label, destination_verified_at, created_at)
         VALUES (:id, :g, :u, :name, :role, :state, :pos, :pref, :dtype, :dref, :dlabel, :dat, :now)`,
        {
          id: memberIds[i],
          g: groupId,
          u: m.isMe ? userId : null,
          name: m.displayName.trim(),
          role: m.isMe ? "OWNER" : "MEMBER",
          state: m.isMe ? "JOINED" : "INVITED",
          pos: i + 1,
          pref: m.payoutPreference,
          dtype: isDemo ? "DEMO_WALLET" : "FLASH_WALLET",
          dref: d?.walletId ?? null,
          dlabel: d?.label ?? null,
          dat: d?.verifiedAt ?? null,
          now: now.toISOString(),
        },
      );
    });
    appendEvent(ctx.db, {
      groupId,
      type: "GROUP_CREATED",
      payload: {
        name,
        contributionKesMinor: contributionMinor,
        frequency: input.frequency,
        settlementAsset: input.settlementAsset,
        rotation: input.members.map((m) => m.displayName.trim()),
        payoutPolicy: "ALL_PAID",
      },
      actor: `user:${userId}`,
      at: now,
    });
    const group = one<GroupRow>(ctx.db, "SELECT * FROM groups WHERE id = :id", { id: groupId })!;
    openCycle(ctx, group, 1, now, `user:${userId}`);
    return group;
  });
  const invite = createInvite(ctx, groupId, userId);
  return { group: result, invite };
}

/** Open round `round`: freeze roster, recipient, asset, quote and obligations. Call inside tx(). */
export function openCycle(ctx: Ctx, group: GroupRow, round: number, at: Date, actor: string): CycleRow {
  const members = many<MemberRow>(ctx.db, "SELECT * FROM members WHERE group_id = :g ORDER BY rotation_position", {
    g: group.id,
  });
  const recipient = members[(round - 1) % members.length];
  if (!recipient.verified_destination_ref || !recipient.destination_verified_at) {
    throw new DomainError("DESTINATION_UNVERIFIED", `${recipient.display_name} has no verified payout wallet`);
  }
  const destination: DestinationSnapshot = {
    walletId: recipient.verified_destination_ref,
    label: recipient.destination_label ?? recipient.verified_destination_ref,
    type: recipient.destination_type,
    verifiedAt: recipient.destination_verified_at,
  };
  const due = dueAtForRound(group.first_due_at, group.frequency, round, group.custom_interval_days);
  const quote = createQuote(ctx.db, at, settlementPair(group.settlement_asset), Math.max(86400, (due.getTime() - at.getTime()) / 1000 + 7 * 86400));
  const per = members.map(() => fiatMinorToUnits(BigInt(group.contribution_kes_minor), quote.rate_decimal));
  const target = sum(per);
  const cycleId = id();
  run(
    ctx.db,
    `INSERT INTO cycles (id, group_id, round_number, roster_snapshot, recipient_member_id, recipient_destination_snapshot,
       settlement_asset, target_settlement_units, display_target_kes_minor, quote_id, opens_at, due_at, status)
     VALUES (:id, :g, :round, :roster, :rec, :dest, :asset, :target, :kes, :q, :opens, :due, 'OPEN')`,
    {
      id: cycleId,
      g: group.id,
      round,
      roster: JSON.stringify(members.map((m) => ({ id: m.id, name: m.display_name, position: m.rotation_position }))),
      rec: recipient.id,
      dest: JSON.stringify(destination),
      asset: group.settlement_asset,
      target: Number(target),
      kes: group.contribution_kes_minor * members.length,
      q: quote.id,
      opens: at.toISOString(),
      due: due.toISOString(),
    },
  );
  members.forEach((m, i) => {
    run(
      ctx.db,
      `INSERT INTO contributions (id, cycle_id, member_id, due_kes_minor, due_settlement_units, status)
       VALUES (:id, :c, :m, :kes, :units, 'PENDING')`,
      { id: id(), c: cycleId, m: m.id, kes: group.contribution_kes_minor, units: Number(per[i]) },
    );
  });
  appendEvent(ctx.db, {
    groupId: group.id,
    cycleId,
    type: "CYCLE_OPENED",
    payload: {
      round,
      recipient: recipient.display_name,
      targetUnits: target,
      asset: group.settlement_asset,
      quote: { rate: quote.rate_decimal, mode: quote.mode, source: quote.source },
      dueAt: due.toISOString(),
    },
    actor,
    at,
  });
  return one<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE id = :id", { id: cycleId })!;
}

export function displayStatus(c: ContributionRow, cycle: CycleRow, now: Date): "PAID" | "PENDING" | "LATE" {
  if (c.status === "PAID") return "PAID";
  if (c.status === "LATE" || new Date(cycle.due_at) < now) return "LATE";
  return "PENDING";
}

export function listChamas(ctx: Ctx, userId: string) {
  const groups = many<GroupRow & { my_member_id: string }>(
    ctx.db,
    `SELECT g.*, m.id AS my_member_id FROM groups g JOIN members m ON m.group_id = g.id AND m.user_id = :u
     ORDER BY g.created_at DESC`,
    { u: userId },
  );
  const now = ctx.now();
  const items = groups.map((g) => {
    const cycle = currentCycle(ctx.db, g.id)!;
    const contribs = many<ContributionRow>(ctx.db, "SELECT * FROM contributions WHERE cycle_id = :c", { c: cycle.id });
    const memberCount = (one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM members WHERE group_id = :g", { g: g.id })?.n ??
      0) as number;
    const mine = contribs.find((c) => c.member_id === g.my_member_id);
    const recipient = one<{ display_name: string }>(ctx.db, "SELECT display_name FROM members WHERE id = :id", {
      id: cycle.recipient_member_id,
    });
    return {
      id: g.id,
      name: g.name,
      memberCount,
      frequency: g.frequency,
      contributionKesMinor: String(g.contribution_kes_minor),
      settlementAsset: g.settlement_asset,
      status: g.status,
      round: cycle.round_number,
      cycleStatus: cycle.status,
      paidCount: contribs.filter((c) => c.status === "PAID").length,
      totalCount: contribs.length,
      myStatus: mine ? displayStatus(mine, cycle, now) : null,
      recipientName: recipient?.display_name ?? "",
      dueAt: cycle.due_at,
    };
  });
  // Lifetime totals from persisted settled contributions only. Assets are never added together.
  const paid = many<{ due_kes_minor: number; settled_settlement_units: number; settlement_asset: Asset }>(
    ctx.db,
    `SELECT c.due_kes_minor, c.settled_settlement_units, cy.settlement_asset
       FROM contributions c JOIN cycles cy ON cy.id = c.cycle_id JOIN members m ON m.id = c.member_id
      WHERE m.user_id = :u AND c.status = 'PAID'`,
    { u: userId },
  );
  const byAsset: Record<Asset, bigint> = { BTC_SAT: 0n, USD_CENT: 0n };
  let kes = 0n;
  for (const p of paid) {
    kes += BigInt(p.due_kes_minor);
    byAsset[p.settlement_asset] += BigInt(p.settled_settlement_units);
  }
  return {
    chamas: items,
    totals: {
      kesMinorAtContribution: kes.toString(),
      btcSats: byAsset.BTC_SAT.toString(),
      usdCents: byAsset.USD_CENT.toString(),
      contributionCount: paid.length,
    },
  };
}

export function getLedger(ctx: Ctx, groupId: string, userId: string) {
  const { group, member } = requireMember(ctx.db, groupId, userId);
  const now = ctx.now();
  const members = many<MemberRow>(ctx.db, "SELECT * FROM members WHERE group_id = :g ORDER BY rotation_position", {
    g: groupId,
  });
  const byId = new Map(members.map((m) => [m.id, m]));
  const cycles = many<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE group_id = :g ORDER BY round_number", { g: groupId });
  const cycle = cycles[cycles.length - 1];
  const contribs = many<ContributionRow>(ctx.db, "SELECT * FROM contributions WHERE cycle_id = :c", { c: cycle.id });
  const receipts = many<{ id: string; contribution_id: string }>(
    ctx.db,
    "SELECT id, contribution_id FROM receipts WHERE contribution_id IN (SELECT id FROM contributions WHERE cycle_id = :c)",
    { c: cycle.id },
  );
  const receiptByContribution = new Map(receipts.map((r) => [r.contribution_id, r.id]));
  const payouts = many<PayoutRow>(
    ctx.db,
    "SELECT * FROM payouts WHERE cycle_id IN (SELECT id FROM cycles WHERE group_id = :g)",
    { g: groupId },
  );
  const payoutByCycle = new Map(payouts.map((p) => [p.cycle_id, p]));
  const quote = getQuote(ctx.db, cycle.quote_id);
  const paid = contribs.filter((c) => c.status === "PAID");
  const contributions = contribs
    .map((c) => {
      const m = byId.get(c.member_id)!;
      return {
        id: c.id,
        memberId: m.id,
        name: m.display_name,
        position: m.rotation_position,
        isMe: m.id === member.id,
        status: displayStatus(c, cycle, now),
        dueKesMinor: String(c.due_kes_minor),
        dueUnits: String(c.due_settlement_units),
        settledUnits: String(c.settled_settlement_units),
        paidAt: c.paid_at,
        payerLabel: c.payer_label,
        receiptId: receiptByContribution.get(c.id) ?? null,
      };
    })
    .sort((a, b) => a.position - b.position);
  const rotation = members.map((m, i) => {
    const round = i + 1;
    const cy = cycles.find((c) => c.round_number === round);
    const p = cy ? payoutByCycle.get(cy.id) : undefined;
    const due = cy ? cy.due_at : dueAtForRound(group.first_due_at, group.frequency, round, group.custom_interval_days).toISOString();
    return {
      memberId: m.id,
      name: m.display_name,
      position: m.rotation_position,
      round,
      dueAt: due,
      state: cy?.status === "PAID_OUT" ? "PAID_OUT" : cy && cy.id === cycle.id ? "CURRENT" : "UPCOMING",
      payoutId: p?.id ?? null,
      payoutStatus: p?.status ?? null,
      destinationVerified: Boolean(m.destination_verified_at),
      joined: m.invite_state === "JOINED",
    };
  });
  const currentPayout = payoutByCycle.get(cycle.id);
  const events = many<{ sequence: number; type: string; canonical_payload: string; occurred_at: string; event_hash: string }>(
    ctx.db,
    "SELECT sequence, type, canonical_payload, occurred_at, event_hash FROM ledger_events WHERE group_id = :g ORDER BY sequence DESC LIMIT 25",
    { g: groupId },
  );
  const recipient = byId.get(cycle.recipient_member_id)!;
  return {
    group: {
      id: group.id,
      number: group.number,
      name: group.name,
      contributionKesMinor: String(group.contribution_kes_minor),
      settlementAsset: group.settlement_asset,
      frequency: group.frequency,
      customIntervalDays: group.custom_interval_days,
      status: group.status,
      rulesLocked: Boolean(group.rules_locked_at),
      memberCount: members.length,
      provider: group.provider,
    },
    me: { memberId: member.id, role: member.role, displayName: member.display_name },
    cycle: {
      id: cycle.id,
      round: cycle.round_number,
      totalRounds: members.length,
      status: cycle.status,
      recipient: { memberId: recipient.id, name: recipient.display_name },
      targetUnits: String(cycle.target_settlement_units),
      displayTargetKesMinor: String(cycle.display_target_kes_minor),
      fundedUnits: paid.reduce((a, c) => a + BigInt(c.settled_settlement_units), 0n).toString(),
      fundedKesMinor: paid.reduce((a, c) => a + BigInt(c.due_kes_minor), 0n).toString(),
      paidCount: paid.length,
      totalCount: contribs.length,
      opensAt: cycle.opens_at,
      dueAt: cycle.due_at,
      quote: { rate: quote.rate_decimal, mode: quote.mode, source: quote.source, pair: `${quote.base_currency}/${quote.quote_currency}` },
    },
    contributions,
    rotation,
    payout: currentPayout ? { id: currentPayout.id, status: currentPayout.status } : null,
    history: cycles
      .filter((c) => c.id !== cycle.id)
      .map((c) => ({
        round: c.round_number,
        status: c.status,
        recipient: byId.get(c.recipient_member_id)?.display_name ?? "",
        payoutId: payoutByCycle.get(c.id)?.id ?? null,
        paidOutAt: c.paid_out_at,
      })),
    activity: events.map((e) => ({
      sequence: e.sequence,
      type: e.type,
      payload: JSON.parse(e.canonical_payload) as Record<string, unknown>,
      occurredAt: e.occurred_at,
      hash: e.event_hash.slice(0, 12),
    })),
    lastSequence: events[0]?.sequence ?? 0,
  };
}

export function lastSequence(db: Db, groupId: string): number {
  return (one<{ s: number }>(db, "SELECT COALESCE(MAX(sequence), 0) AS s FROM ledger_events WHERE group_id = :g", { g: groupId })
    ?.s ?? 0) as number;
}
