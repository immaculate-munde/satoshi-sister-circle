import { id, many, one, run, tx } from "../db";
import { type Asset, convertFiatMinor } from "../money";
import { type InvoiceStatus, ProviderRejectedError } from "../payments/provider";
import { requireMember } from "./chamas";
import { type Ctx, DomainError, notFound } from "./context";
import { config } from "../config";
import { createQuote, getQuote } from "./fx";
import { ensureFreshRates } from "./live-rates";
import { appendEvent, sha256 } from "./ledger";
import { createContributionReceipt } from "./receipts";
import type { ContributionRow, CycleRow, DestinationSnapshot, GroupRow, InvoiceRow, MemberRow } from "./rows";

/** USD-stable invoices lock an FX rate, so they expire faster (research: short FX lock; confirm with Flash). */
export const INVOICE_TTL_SECONDS: Record<Asset, number> = { BTC_SAT: 15 * 60, USD_CENT: 5 * 60 };
/** Keep reconciling expired invoices this long so late settlements are caught and not double credited. */
export const LATE_SETTLEMENT_WINDOW_MS = 24 * 3600_000;
const REUSE_MIN_REMAINING_MS = 60_000;

export interface InvoiceRequest {
  userId: string;
  groupId: string;
  /** Member whose obligation is being paid. Defaults to the caller's own seat. */
  memberId?: string;
  kind: "CONTRIBUTION" | "DIASPORA";
  payerLabel?: string;
  diaspora?: { sourceMinor: bigint; sourceCurrency: "GBP" };
  forceNew?: boolean;
}

async function invoiceView(ctx: Ctx, inv: InvoiceRow) {
  const c = await (await one<ContributionRow>(ctx.db, "SELECT * FROM contributions WHERE id = :id", { id: inv.contribution_id }))!;
  const cycle = await (await one<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE id = :id", { id: c.cycle_id }))!;
  const group = await (await one<GroupRow>(ctx.db, "SELECT * FROM groups WHERE id = :id", { id: cycle.group_id }))!;
  const member = await (await one<MemberRow>(ctx.db, "SELECT * FROM members WHERE id = :id", { id: c.member_id }))!;
  const q = await getQuote(ctx.db, inv.quote_id);
  const paidCount = (await (await one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM contributions WHERE cycle_id = :c AND status = 'PAID'", {
    c: cycle.id,
  }))?.n ?? 0) as number;
  const totalCount = (await (await one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM contributions WHERE cycle_id = :c", { c: cycle.id }))
    ?.n ?? 0) as number;
  const receipt = await one<{ id: string }>(ctx.db, "SELECT id FROM receipts WHERE contribution_id = :c", { c: c.id });
  const payout = await one<{ id: string; status: string }>(ctx.db, "SELECT id, status FROM payouts WHERE cycle_id = :c", {
    c: cycle.id,
  });
  const dq = inv.diaspora_quote_id ? await getQuote(ctx.db, inv.diaspora_quote_id) : null;
  const winning = c.winning_invoice_id === inv.id;
  return {
    id: inv.id,
    groupId: group.id,
    groupName: group.name,
    round: cycle.round_number,
    kind: inv.kind,
    memberName: member.display_name,
    payerLabel: inv.payer_label,
    status: inv.status,
    // A paid invoice that did not win (late duplicate) is an overpayment liability, not a contribution.
    creditedToContribution: inv.status === "PAID" ? winning : null,
    asset: inv.asset,
    amountUnits: String(inv.amount_units),
    settledUnits: inv.settled_units != null ? String(inv.settled_units) : null,
    kesMinor: String(c.due_kes_minor),
    quote: { rate: q.rate_decimal, mode: q.mode, source: q.source, pair: `${q.base_currency}/${q.quote_currency}` },
    diaspora: dq
      ? {
          sourceMinor: String(inv.diaspora_source_minor),
          sourceCurrency: inv.diaspora_source_currency,
          rate: dq.rate_decimal,
          mode: dq.mode,
          source: dq.source,
        }
      : null,
    paymentRequest: inv.bolt11,
    paymentHash: inv.payment_hash,
    provider: inv.provider,
    network: inv.network,
    expiresAt: inv.expires_at,
    createdAt: inv.created_at,
    paidAt: inv.paid_at,
    cycle: { paidCount, totalCount, status: cycle.status },
    receiptId: receipt?.id ?? null,
    payout: payout ?? null,
  };
}

export type InvoiceView = Awaited<ReturnType<typeof invoiceView>>;

/** Create or reuse the invoice for the current open obligation. The server decides the amount. */
export async function requestInvoice(ctx: Ctx, req: InvoiceRequest): Promise<InvoiceView> {
  if (config().fxProvider === "live") await ensureFreshRates(ctx.db, ctx.now());
  const { group, member: me } = await requireMember(ctx.db, req.groupId, req.userId);
  const cycle = await one<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE group_id = :g AND status = 'OPEN' ORDER BY round_number DESC LIMIT 1", {
    g: group.id,
  });
  if (!cycle) throw new DomainError("NO_OPEN_ROUND", "This round is fully funded. The payout is being processed.", 409);
  const memberId = req.kind === "CONTRIBUTION" ? (req.memberId ?? me.id) : req.memberId;
  if (!memberId) throw new DomainError("CHOOSE_MEMBER", "Choose whose contribution is being covered");
  if (req.kind === "CONTRIBUTION" && memberId !== me.id) {
    throw new DomainError("FORBIDDEN", "You can only open your own contribution invoice. Use Pay from abroad for someone else.", 403);
  }
  const c = await one<ContributionRow>(ctx.db, "SELECT * FROM contributions WHERE cycle_id = :c AND member_id = :m", {
    c: cycle.id,
    m: memberId,
  });
  if (!c) throw notFound("Contribution not found");
  if (c.status === "PAID") throw new DomainError("ALREADY_PAID", "This contribution is already paid for this round", 409);
  const dest = JSON.parse(cycle.recipient_destination_snapshot) as DestinationSnapshot;
  if (!dest.walletId) throw new DomainError("DESTINATION_UNVERIFIED", "The recipient has no verified wallet", 409);

  const now = ctx.now();
  if (!req.forceNew) {
    const open = await one<InvoiceRow>(
      ctx.db,
      `SELECT * FROM invoices WHERE contribution_id = :c AND kind = :k AND status IN ('PENDING','CREATING')
         AND COALESCE(payer_label, '') = :pl ORDER BY created_at DESC LIMIT 1`,
      { c: c.id, k: req.kind, pl: req.payerLabel ?? "" },
    );
    if (open?.status === "PENDING" && new Date(open.expires_at).getTime() - now.getTime() > REUSE_MIN_REMAINING_MS) {
      return invoiceView(ctx, open);
    }
    if (open?.status === "CREATING" && now.getTime() - new Date(open.created_at).getTime() < 30_000) {
      throw new DomainError("INVOICE_CREATING", "Your invoice is being created. Try again in a moment.", 409, true);
    }
  }

  const amount = BigInt(c.due_settlement_units) - BigInt(c.settled_settlement_units);
  if (amount <= 0n) throw new DomainError("ALREADY_PAID", "Nothing left to pay", 409);
  if (amount > ctx.limits.maxPrincipalUnits) throw new DomainError("AMOUNT_CAP", "Amount exceeds the test environment cap", 400);

  const asset = cycle.settlement_asset;
  const walletRef = ctx.provider.collectionWalletId(group.provider_account_ref, asset);
  const invoiceId = id();
  const requestId = `inv-${invoiceId}`;
  let diasporaQuoteId: string | null = null;
  await tx(ctx.db, async () => {
    if (req.diaspora) {
      const dq = await createQuote(ctx.db, now, "GBP/KES", INVOICE_TTL_SECONDS[asset]);
      diasporaQuoteId = dq.id;
      const kesFromGbp = convertFiatMinor(req.diaspora.sourceMinor, dq.rate_decimal);
      // £30 * 166.6667 = KES 5,000.00; allow a 1 KES rounding tolerance, never less than the obligation.
      if (kesFromGbp + 100n < BigInt(c.due_kes_minor)) {
        throw new DomainError("DIASPORA_SHORT", "That amount does not cover this contribution");
      }
    }
    await run(
      ctx.db,
      `INSERT INTO invoices (id, contribution_id, kind, requested_by_user_id, payer_label, provider, wallet_ref, network, asset,
         amount_units, quote_id, diaspora_quote_id, diaspora_source_minor, diaspora_source_currency, status, expires_at,
         create_request_id, created_at)
       VALUES (:id, :c, :kind, :u, :pl, :prov, :w, :net, :asset, :amt, :q, :dq, :dsm, :dsc, 'CREATING', :exp, :rid, :now)`,
      {
        id: invoiceId,
        c: c.id,
        kind: req.kind,
        u: req.userId,
        pl: req.payerLabel ?? null,
        prov: ctx.provider.name,
        w: walletRef,
        net: ctx.provider.network,
        asset,
        amt: Number(amount),
        q: cycle.quote_id,
        dq: diasporaQuoteId,
        dsm: req.diaspora ? Number(req.diaspora.sourceMinor) : null,
        dsc: req.diaspora?.sourceCurrency ?? null,
        exp: new Date(now.getTime() + INVOICE_TTL_SECONDS[asset] * 1000).toISOString(),
        rid: requestId,
        now: now.toISOString(),
      },
    );
  });

  try {
    const created = await ctx.provider.createInvoice({
      walletId: walletRef,
      asset,
      amount: amount.toString(),
      memo: `${group.name} R${cycle.round_number} ${req.kind === "DIASPORA" ? "diaspora" : "contribution"}`,
      expiresInSeconds: INVOICE_TTL_SECONDS[asset],
      requestId,
    });
    if (created.asset !== asset || BigInt(created.amount) !== amount) {
      throw new ProviderRejectedError("Provider returned an invoice with a different amount or asset", false);
    }
    await tx(ctx.db, async () => {
      await run(
        ctx.db,
        `UPDATE invoices SET status = 'PENDING', provider_invoice_id = :pid, payment_hash = :h, bolt11 = :b, expires_at = :exp
         WHERE id = :id AND status = 'CREATING'`,
        { pid: created.providerId, h: created.paymentHash, b: created.bolt11, exp: created.expiresAt, id: invoiceId },
      );
      await appendEvent(ctx.db, {
        groupId: group.id,
        cycleId: cycle.id,
        type: "INVOICE_CREATED",
        payload: { kind: req.kind, member: memberId, amountUnits: amount, asset, hash: created.paymentHash.slice(0, 16) },
        actor: `user:${req.userId}`,
        at: now,
      });
    });
  } catch (e) {
    if (e instanceof ProviderRejectedError && !e.retryable) {
      await run(ctx.db, "UPDATE invoices SET status = 'FAILED' WHERE id = :id", { id: invoiceId });
      throw new DomainError("PROVIDER_REJECTED", e.message, 502);
    }
    // Uncertain: leave CREATING; the reconciler recovers it via findInvoiceByRequestId instead of duplicating.
    throw new DomainError("PROVIDER_UNAVAILABLE", "The payment provider did not respond. Try again shortly.", 503, true);
  }
  return invoiceView(ctx, await (await one<InvoiceRow>(ctx.db, "SELECT * FROM invoices WHERE id = :id", { id: invoiceId }))!);
}

/** Authorized read. Only members of the invoice's chama can see it. */
export async function getInvoice(ctx: Ctx, invoiceId: string, userId: string): Promise<InvoiceView> {
  const inv = await one<InvoiceRow>(ctx.db, "SELECT * FROM invoices WHERE id = :id", { id: invoiceId });
  if (!inv) throw notFound("Invoice not found");
  const groupId = await (await one<{ group_id: string }>(
    ctx.db,
    "SELECT cy.group_id FROM contributions c JOIN cycles cy ON cy.id = c.cycle_id WHERE c.id = :c",
    { c: inv.contribution_id },
  ))!.group_id;
  await requireMember(ctx.db, groupId, userId);
  return invoiceView(ctx, inv);
}

/** Ask the provider for the truth about one invoice and apply it. Safe to call repeatedly and concurrently. */
export async function reconcileInvoice(ctx: Ctx, invoiceId: string): Promise<InvoiceRow["status"]> {
  const inv = await one<InvoiceRow>(ctx.db, "SELECT * FROM invoices WHERE id = :id", { id: invoiceId });
  if (!inv) throw notFound("Invoice not found");
  if (inv.status === "PAID" || inv.status === "FAILED") return inv.status;
  if (inv.status === "CREATING") return recoverCreating(ctx, inv);
  if (!inv.payment_hash || !inv.bolt11) return inv.status;
  const st = await ctx.provider.getInvoiceStatus({ paymentHash: inv.payment_hash, bolt11: inv.bolt11, walletId: inv.wallet_ref });
  return applyProviderStatus(ctx, inv.id, st);
}

async function recoverCreating(ctx: Ctx, inv: InvoiceRow): Promise<InvoiceRow["status"]> {
  if (ctx.now().getTime() - new Date(inv.created_at).getTime() < 30_000) return "CREATING";
  const found = ctx.provider.findInvoiceByRequestId ? await ctx.provider.findInvoiceByRequestId(inv.create_request_id) : null;
  if (found) {
    await run(
      ctx.db,
      `UPDATE invoices SET status = 'PENDING', provider_invoice_id = :pid, payment_hash = :h, bolt11 = :b, expires_at = :exp
       WHERE id = :id AND status = 'CREATING'`,
      { pid: found.providerId, h: found.paymentHash, b: found.bolt11, exp: found.expiresAt, id: inv.id },
    );
    return "PENDING";
  }
  if (ctx.now().getTime() - new Date(inv.created_at).getTime() > 10 * 60_000) {
    await run(ctx.db, "UPDATE invoices SET status = 'FAILED' WHERE id = :id AND status = 'CREATING'", { id: inv.id });
    return "FAILED";
  }
  return "CREATING";
}

/**
 * The only path that marks money as received. Runs in one write transaction: dedupe the provider
 * event, verify amount/asset/wallet, mark the obligation paid, append audit events, write the
 * receipt and insert the uniquely-keyed payout intent when the round becomes fully funded.
 */
export async function applyProviderStatus(ctx: Ctx, invoiceId: string, st: InvoiceStatus): Promise<InvoiceRow["status"]> {
  const now = ctx.now();
  return await tx(ctx.db, async () => {
    const inv = await (await one<InvoiceRow>(ctx.db, "SELECT * FROM invoices WHERE id = :id", { id: invoiceId }))!;
    await run(ctx.db, "UPDATE invoices SET last_checked_at = :now WHERE id = :id", { now: now.toISOString(), id: inv.id });
    if (inv.status === "PAID") return "PAID";
    if (st.state === "EXPIRED") {
      if (inv.status === "PENDING") await run(ctx.db, "UPDATE invoices SET status = 'EXPIRED' WHERE id = :id", { id: inv.id });
      return inv.status === "PENDING" ? "EXPIRED" : inv.status;
    }
    if (st.state !== "PAID") return inv.status;

    if (st.walletId && st.walletId !== inv.wallet_ref) {
      throw new DomainError("SETTLEMENT_MISMATCH", "Provider reported payment to a different wallet", 500);
    }
    const paid = BigInt(st.paidAmount ?? String(inv.amount_units));
    const dedupeKey = `invoice-paid:${inv.payment_hash}`;
    const ins = await run(
      ctx.db,
      `INSERT INTO provider_events (id, provider, dedupe_key, payment_hash, payload_digest, received_at, processed_at)
       VALUES (:id, :p, :k, :h, :d, :now, :now) ON CONFLICT(provider, dedupe_key) DO NOTHING`,
      {
        id: id(),
        p: inv.provider,
        k: dedupeKey,
        h: inv.payment_hash,
        d: sha256(JSON.stringify({ ...st, paidAmount: paid.toString() })),
        now: now.toISOString(),
      },
    );
    if (Number(ins.changes) === 0) return inv.status; // duplicate event already applied

    const paidAt = st.paidAt ?? now.toISOString();
    await run(ctx.db, "UPDATE invoices SET status = 'PAID', paid_at = :at, settled_units = :u WHERE id = :id", {
      at: paidAt,
      u: Number(paid),
      id: inv.id,
    });
    const c = await (await one<ContributionRow>(ctx.db, "SELECT * FROM contributions WHERE id = :id", { id: inv.contribution_id }))!;
    const cycle = await (await one<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE id = :id", { id: c.cycle_id }))!;
    const groupId = cycle.group_id;
    const proof = st.proofRef ?? `${inv.provider}:${inv.payment_hash}`;

    if (c.status === "PAID") {
      // Late settlement of an older/duplicate invoice: track as a liability, never a second credit.
      await run(
        ctx.db,
        `INSERT INTO overpayments (id, group_id, invoice_id, asset, units, reason, created_at)
         VALUES (:id, :g, :inv, :a, :u, 'DUPLICATE_SETTLEMENT', :now)`,
        { id: id(), g: groupId, inv: inv.id, a: inv.asset, u: Number(paid), now: now.toISOString() },
      );
      await appendEvent(ctx.db, {
        groupId,
        cycleId: cycle.id,
        type: "OVERPAYMENT_RECORDED",
        payload: { invoice: inv.id, units: paid, asset: inv.asset, reason: "DUPLICATE_SETTLEMENT" },
        actor: `provider:${inv.provider}`,
        at: now,
      });
      return "PAID";
    }

    const due = BigInt(c.due_settlement_units);
    const settled = BigInt(c.settled_settlement_units) + paid;
    if (settled < due) {
      await run(ctx.db, "UPDATE contributions SET settled_settlement_units = :s WHERE id = :id", { s: Number(settled), id: c.id });
      await appendEvent(ctx.db, {
        groupId,
        cycleId: cycle.id,
        type: "CONTRIBUTION_UNDERPAID",
        payload: { contribution: c.id, settledUnits: settled, dueUnits: due },
        actor: `provider:${inv.provider}`,
        at: now,
      });
      return "PAID";
    }
    if (settled > due) {
      await run(
        ctx.db,
        `INSERT INTO overpayments (id, group_id, invoice_id, asset, units, reason, created_at)
         VALUES (:id, :g, :inv, :a, :u, 'OVERPAYMENT', :now)`,
        { id: id(), g: groupId, inv: inv.id, a: inv.asset, u: Number(settled - due), now: now.toISOString() },
      );
      await appendEvent(ctx.db, {
        groupId,
        cycleId: cycle.id,
        type: "OVERPAYMENT_RECORDED",
        payload: { invoice: inv.id, units: settled - due, asset: inv.asset, reason: "OVERPAYMENT" },
        actor: `provider:${inv.provider}`,
        at: now,
      });
    }
    await run(
      ctx.db,
      `UPDATE contributions SET status = 'PAID', settled_settlement_units = :s, paid_at = :at, winning_invoice_id = :inv,
         payer_user_id = :pu, payer_label = :pl WHERE id = :id`,
      {
        s: Number(due),
        at: paidAt,
        inv: inv.id,
        pu: inv.kind === "CONTRIBUTION" ? inv.requested_by_user_id : null,
        pl: inv.payer_label,
        id: c.id,
      },
    );
    const group = await (await one<GroupRow>(ctx.db, "SELECT * FROM groups WHERE id = :id", { id: groupId }))!;
    if (!group.rules_locked_at) {
      await run(ctx.db, "UPDATE groups SET rules_locked_at = :now WHERE id = :id", { now: now.toISOString(), id: groupId });
      await appendEvent(ctx.db, { groupId, type: "RULES_LOCKED", payload: { rulesVersion: group.rules_version }, actor: "system", at: now });
    }
    const member = await (await one<MemberRow>(ctx.db, "SELECT display_name FROM members WHERE id = :id", { id: c.member_id }))!;
    await appendEvent(ctx.db, {
      groupId,
      cycleId: cycle.id,
      type: "CONTRIBUTION_SETTLED",
      payload: {
        member: member.display_name,
        payer: inv.payer_label ?? member.display_name,
        kind: inv.kind,
        units: due,
        asset: inv.asset,
        kesMinor: c.due_kes_minor,
        proof,
      },
      actor: `provider:${inv.provider}`,
      at: now,
    });
    await createContributionReceipt(ctx, { ...inv, settled_units: Number(paid) }, paidAt, proof);
    await maybeQueuePayout(ctx, cycle.id, now);
    return "PAID";
  });
}

/** Inside await tx(): if every obligation is paid, mark funded and insert the single payout intent. */
async function maybeQueuePayout(ctx: Ctx, cycleId: string, now: Date) {
  const cycle = await (await one<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE id = :id", { id: cycleId }))!;
  if (cycle.status !== "OPEN") return;
  const rows = await many<ContributionRow>(ctx.db, "SELECT * FROM contributions WHERE cycle_id = :c", { c: cycleId });
  if (rows.some((r) => r.status !== "PAID")) return;
  const funded = rows.reduce((a, r) => a + BigInt(r.settled_settlement_units), 0n);
  if (funded < BigInt(cycle.target_settlement_units)) return;
  const group = await (await one<GroupRow>(ctx.db, "SELECT * FROM groups WHERE id = :id", { id: cycle.group_id }))!;
  await run(ctx.db, "UPDATE cycles SET status = 'PAYOUT_PENDING', funded_at = :now WHERE id = :id AND status = 'OPEN'", {
    now: now.toISOString(),
    id: cycleId,
  });
  await appendEvent(ctx.db, {
    groupId: group.id,
    cycleId,
    type: "CYCLE_FUNDED",
    payload: { round: cycle.round_number, fundedUnits: funded, asset: cycle.settlement_asset },
    actor: "system",
    at: now,
  });
  const payoutId = id();
  const ins = await run(
    ctx.db,
    `INSERT INTO payouts (id, cycle_id, recipient_member_id, destination_snapshot, source_wallet_ref, asset, principal_units,
       fee_asset, status, request_id, created_at)
     VALUES (:id, :c, :r, :dest, :src, :asset, :p, :asset, 'QUEUED', :rid, :now) ON CONFLICT(cycle_id) DO NOTHING`,
    {
      id: payoutId,
      c: cycleId,
      r: cycle.recipient_member_id,
      dest: cycle.recipient_destination_snapshot,
      src: ctx.provider.collectionWalletId(group.provider_account_ref, cycle.settlement_asset),
      asset: cycle.settlement_asset,
      p: cycle.target_settlement_units,
      rid: `payout-${cycleId}`,
      now: now.toISOString(),
    },
  );
  if (Number(ins.changes) === 1) {
    await appendEvent(ctx.db, {
      groupId: group.id,
      cycleId,
      type: "PAYOUT_QUEUED",
      payload: { payout: payoutId, principalUnits: cycle.target_settlement_units, asset: cycle.settlement_asset },
      actor: "system",
      at: now,
    });
  }
}

/** Invoices that still need provider checks: open, uncertain, or recently expired (late settlement). */
export async function invoicesToReconcile(ctx: Ctx): Promise<string[]> {
  const since = new Date(ctx.now().getTime() - LATE_SETTLEMENT_WINDOW_MS).toISOString();
  return await (await many<{ id: string }>(
    ctx.db,
    `SELECT id FROM invoices WHERE status IN ('CREATING','PENDING','UNKNOWN') OR (status = 'EXPIRED' AND expires_at > :since)
     ORDER BY created_at`,
    { since },
  )).map((r) => r.id);
}

/** Mark overdue pending obligations LATE (display + audit), once. */
export async function markLateContributions(ctx: Ctx) {
  const now = ctx.now();
  const rows = await many<{ id: string; cycle_id: string; group_id: string; display_name: string }>(
    ctx.db,
    `SELECT c.id, c.cycle_id, cy.group_id, m.display_name FROM contributions c JOIN cycles cy ON cy.id = c.cycle_id
       JOIN members m ON m.id = c.member_id
      WHERE c.status = 'PENDING' AND cy.status = 'OPEN' AND cy.due_at < :now`,
    { now: now.toISOString() },
  );
  for (const r of rows) {
    await tx(ctx.db, async () => {
      const res = await run(ctx.db, "UPDATE contributions SET status = 'LATE' WHERE id = :id AND status = 'PENDING'", { id: r.id });
      if (Number(res.changes) === 1) {
        await appendEvent(ctx.db, {
          groupId: r.group_id,
          cycleId: r.cycle_id,
          type: "CONTRIBUTION_LATE",
          payload: { member: r.display_name },
          actor: "system",
          at: now,
        });
      }
    });
  }
  return rows.length;
}
