import { many, one, run, tx } from "../db";
import { ProviderRejectedError } from "../payments/provider";
import { openCycle, requireMember } from "./chamas";
import { type Ctx, DomainError, notFound } from "./context";
import { getQuote } from "./fx";
import { appendEvent } from "./ledger";
import { createPayoutReceipt } from "./receipts";
import { dueAtForRound } from "./schedule";
import type { ContributionRow, CycleRow, DestinationSnapshot, GroupRow, MemberRow, PayoutRow } from "./rows";

export const LEASE_MS = 60_000;
export const MAX_RETRYABLE_ATTEMPTS = 5;

const backoffMs = (attempt: number, retryAfterSeconds?: number) =>
  Math.max((retryAfterSeconds ?? 0) * 1000, Math.min(5 * 60_000, 2 ** attempt * 5_000));

async function getPayout(ctx: Ctx, payoutId: string) {
  return await one<PayoutRow>(ctx.db, "SELECT * FROM payouts WHERE id = :id", { id: payoutId });
}

/**
 * Claim one due payout under a lease. A PROCESSING payout whose lease expired may have been sent by
 * a crashed worker, so it becomes UNKNOWN (reconcile) rather than being re-sent.
 */
async function claim(ctx: Ctx, workerId: string): Promise<PayoutRow | null> {
  const now = ctx.now();
  return await tx(ctx.db, async () => {
    const stale = await many<PayoutRow>(
      ctx.db,
      "SELECT * FROM payouts WHERE status = 'PROCESSING' AND lease_until < :now",
      { now: now.toISOString() },
    );
    for (const p of stale) await markUnknown(ctx, p, "Worker lease expired while payout was in flight", now);

    const p = await one<PayoutRow>(
      ctx.db,
      `SELECT * FROM payouts WHERE status = 'QUEUED' AND (next_attempt_at IS NULL OR next_attempt_at <= :now)
       ORDER BY created_at LIMIT 1`,
      { now: now.toISOString() },
    );
    if (!p) return null;

    // Re-validate everything inside the lock before money moves.
    const cycle = await (await one<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE id = :id", { id: p.cycle_id }))!;
    const contribs = await many<ContributionRow>(ctx.db, "SELECT * FROM contributions WHERE cycle_id = :c", { c: cycle.id });
    const funded = contribs.reduce((a, c) => a + BigInt(c.settled_settlement_units), 0n);
    const dest = JSON.parse(p.destination_snapshot) as DestinationSnapshot;
    const problems: string[] = [];
    if (cycle.status !== "PAYOUT_PENDING") problems.push(`cycle is ${cycle.status}`);
    if (contribs.some((c) => c.status !== "PAID")) problems.push("not every obligation is paid");
    if (funded < BigInt(p.principal_units)) problems.push("settled total is below payout principal");
    if (BigInt(p.principal_units) !== BigInt(cycle.target_settlement_units)) problems.push("principal differs from pot target");
    if (p.asset !== cycle.settlement_asset) problems.push("asset mismatch");
    if (!dest.walletId || !dest.verifiedAt) problems.push("destination not verified");
    if (p.recipient_member_id !== cycle.recipient_member_id) problems.push("recipient changed");
    if (BigInt(p.principal_units) > ctx.limits.maxPrincipalUnits) problems.push("principal above environment cap");
    if (problems.length) {
      await run(
        ctx.db,
        "UPDATE payouts SET status = 'FAILED', needs_operator_review = 1, last_error = :e WHERE id = :id",
        { e: `Pre-send validation failed: ${problems.join("; ")}`, id: p.id },
      );
      await appendEvent(ctx.db, {
        groupId: cycle.group_id,
        cycleId: cycle.id,
        type: "PAYOUT_OPERATOR_REVIEW",
        payload: { payout: p.id, problems },
        actor: `worker:${workerId}`,
        at: now,
      });
      return null;
    }
    const res = await run(
      ctx.db,
      `UPDATE payouts SET status = 'PROCESSING', lease_owner = :w, lease_until = :lease, attempts = attempts + 1,
         submitted_at = :now WHERE id = :id AND status = 'QUEUED'`,
      { w: workerId, lease: new Date(now.getTime() + LEASE_MS).toISOString(), now: now.toISOString(), id: p.id },
    );
    if (Number(res.changes) !== 1) return null;
    await appendEvent(ctx.db, {
      groupId: cycle.group_id,
      cycleId: cycle.id,
      type: "PAYOUT_SUBMITTED",
      payload: { payout: p.id, attempt: p.attempts + 1, requestId: p.request_id },
      actor: `worker:${workerId}`,
      at: now,
    });
    return (await getPayout(ctx, p.id))!;
  });
}

async function markUnknown(ctx: Ctx, p: PayoutRow, reason: string, now: Date) {
  const cycle = await (await one<CycleRow>(ctx.db, "SELECT group_id FROM cycles WHERE id = :id", { id: p.cycle_id }))!;
  await run(ctx.db, "UPDATE payouts SET status = 'UNKNOWN', lease_owner = NULL, lease_until = NULL, last_error = :e WHERE id = :id", {
    e: reason,
    id: p.id,
  });
  await appendEvent(ctx.db, {
    groupId: cycle.group_id,
    cycleId: p.cycle_id,
    type: "PAYOUT_UNKNOWN",
    payload: { payout: p.id, reason },
    actor: "system",
    at: now,
  });
}

/** Inside await tx(): record a confirmed payout, write its receipt, then advance rotation. */
async function recordSuccess(ctx: Ctx, payoutId: string, providerPaymentId: string, fee: bigint, actor: string) {
  const now = ctx.now();
  const p = (await getPayout(ctx, payoutId))!;
  if (p.status === "SUCCEEDED") return;
  await run(
    ctx.db,
    `UPDATE payouts SET status = 'SUCCEEDED', provider_payment_id = :pid, fee_units = :fee, sent_at = :now,
       lease_owner = NULL, lease_until = NULL, last_error = NULL WHERE id = :id`,
    { pid: providerPaymentId, fee: Number(fee), now: now.toISOString(), id: p.id },
  );
  await run(ctx.db, "UPDATE cycles SET status = 'PAID_OUT', paid_out_at = :now WHERE id = :id", { now: now.toISOString(), id: p.cycle_id });
  const cycle = await (await one<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE id = :id", { id: p.cycle_id }))!;
  const group = await (await one<GroupRow>(ctx.db, "SELECT * FROM groups WHERE id = :id", { id: cycle.group_id }))!;
  const recipient = await (await one<MemberRow>(ctx.db, "SELECT display_name FROM members WHERE id = :id", { id: p.recipient_member_id }))!;
  await appendEvent(ctx.db, {
    groupId: group.id,
    cycleId: cycle.id,
    type: "PAYOUT_SUCCEEDED",
    payload: {
      payout: p.id,
      recipient: recipient.display_name,
      principalUnits: p.principal_units,
      feeUnits: fee,
      asset: p.asset,
      providerPaymentId,
    },
    actor,
    at: now,
  });
  if (fee > ctx.limits.maxFeeUnits) {
    await appendEvent(ctx.db, {
      groupId: group.id,
      cycleId: cycle.id,
      type: "PAYOUT_OPERATOR_REVIEW",
      payload: { payout: p.id, problems: [`measured fee ${fee} above cap ${ctx.limits.maxFeeUnits}`] },
      actor,
      at: now,
    });
  }
  await createPayoutReceipt(ctx, (await getPayout(ctx, p.id))!);
  // Rotation advances only after confirmed success.
  const memberCount = (await (await one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM members WHERE group_id = :g", { g: group.id }))?.n ??
    0) as number;
  if (cycle.round_number >= memberCount) {
    await run(ctx.db, "UPDATE groups SET status = 'COMPLETED' WHERE id = :id", { id: group.id });
    await appendEvent(ctx.db, { groupId: group.id, type: "GROUP_COMPLETED", payload: { rounds: memberCount }, actor: "system", at: now });
  } else {
    await openCycle(ctx, group, cycle.round_number + 1, now, "system");
  }
}

/** Process due payouts. Returns how many were attempted. Safe with several workers. */
export async function processPayouts(ctx: Ctx, workerId: string, max = 10): Promise<number> {
  let n = 0;
  for (; n < max; n++) {
    const p = await claim(ctx, workerId);
    if (!p) break;
    const dest = JSON.parse(p.destination_snapshot) as DestinationSnapshot;
    try {
      const res = await ctx.provider.payInternal({
        sourceWalletId: p.source_wallet_ref,
        destinationWalletId: dest.walletId,
        asset: p.asset,
        amount: String(p.principal_units),
        requestId: p.request_id,
        memo: `Chama payout ${p.request_id}`,
      });
      if (res.status === "SUCCEEDED") {
        await tx(ctx.db, async () => recordSuccess(ctx, p.id, res.providerPaymentId, BigInt(res.fee), `worker:${workerId}`));
      } else if (res.status === "PENDING") {
        await tx(ctx.db, async () => markUnknown(ctx, (await getPayout(ctx, p.id))!, "Provider reported PENDING; reconciling", ctx.now()));
      } else {
        // Provider says FAILED with no error: treat as uncertain rather than assume nothing moved.
        await tx(ctx.db, async () => markUnknown(ctx, (await getPayout(ctx, p.id))!, "Provider reported FAILED status; reconciling", ctx.now()));
      }
    } catch (e) {
      const now = ctx.now();
      await tx(ctx.db, async () => {
        const cur = (await getPayout(ctx, p.id))!;
        const cycle = await (await one<CycleRow>(ctx.db, "SELECT group_id FROM cycles WHERE id = :id", { id: p.cycle_id }))!;
        if (e instanceof ProviderRejectedError) {
          if (e.retryable && cur.attempts < MAX_RETRYABLE_ATTEMPTS) {
            const next = new Date(now.getTime() + backoffMs(cur.attempts, e.retryAfterSeconds));
            await run(
              ctx.db,
              `UPDATE payouts SET status = 'QUEUED', lease_owner = NULL, lease_until = NULL, next_attempt_at = :next,
                 last_error = :err WHERE id = :id`,
              { next: next.toISOString(), err: e.message, id: p.id },
            );
            await appendEvent(ctx.db, {
              groupId: cycle.group_id,
              cycleId: p.cycle_id,
              type: "PAYOUT_RETRY_SCHEDULED",
              payload: { payout: p.id, attempt: cur.attempts, nextAttemptAt: next.toISOString(), reason: e.message },
              actor: `worker:${workerId}`,
              at: now,
            });
          } else {
            await run(
              ctx.db,
              `UPDATE payouts SET status = 'FAILED', lease_owner = NULL, lease_until = NULL, last_error = :err,
                 needs_operator_review = 1 WHERE id = :id`,
              { err: e.message, id: p.id },
            );
            await appendEvent(ctx.db, {
              groupId: cycle.group_id,
              cycleId: p.cycle_id,
              type: "PAYOUT_FAILED",
              payload: { payout: p.id, reason: e.message },
              actor: `worker:${workerId}`,
              at: now,
            });
          }
        } else {
          await markUnknown(ctx, cur, `Outcome unknown: ${(e as Error).message}`, now);
        }
      });
    }
  }
  return n;
}

/**
 * Resolve UNKNOWN payouts by looking up provider history. Never resends blindly: only a definitive
 * "not found" from a provider that guarantees lookups re-queues; otherwise stop for operator review.
 */
export async function reconcileUnknownPayouts(ctx: Ctx, workerId: string): Promise<number> {
  const unknown = await many<PayoutRow>(ctx.db, "SELECT * FROM payouts WHERE status = 'UNKNOWN' AND needs_operator_review = 0");
  for (const p of unknown) {
    let found;
    try {
      found = await ctx.provider.findPaymentByRequestId({
        sourceWalletId: p.source_wallet_ref,
        requestId: p.request_id,
        since: p.submitted_at ?? p.created_at,
      });
    } catch {
      continue; // try again next tick
    }
    const now = ctx.now();
    await tx(ctx.db, async () => {
      const cur = (await getPayout(ctx, p.id))!;
      if (cur.status !== "UNKNOWN") return;
      const dest = JSON.parse(cur.destination_snapshot) as DestinationSnapshot;
      const cycle = await (await one<CycleRow>(ctx.db, "SELECT group_id FROM cycles WHERE id = :id", { id: cur.cycle_id }))!;
      if (found?.status === "SUCCEEDED") {
        if (BigInt(found.amount) !== BigInt(cur.principal_units) || (found.destinationWalletId && found.destinationWalletId !== dest.walletId)) {
          await run(ctx.db, "UPDATE payouts SET needs_operator_review = 1, last_error = :e WHERE id = :id", {
            e: "Found provider transfer does not match payout amount/destination",
            id: cur.id,
          });
          await appendEvent(ctx.db, {
            groupId: cycle.group_id,
            cycleId: cur.cycle_id,
            type: "PAYOUT_OPERATOR_REVIEW",
            payload: { payout: cur.id, problems: ["provider transfer mismatch"] },
            actor: `worker:${workerId}`,
            at: now,
          });
          return;
        }
        await recordSuccess(ctx, cur.id, found.providerPaymentId, BigInt(found.fee), `reconciler:${workerId}`);
      } else if (found?.status === "PENDING") {
        // still settling; check again next tick
      } else if (found?.status === "FAILED" || (!found && ctx.provider.definitiveLookup)) {
        await run(
          ctx.db,
          `UPDATE payouts SET status = 'QUEUED', next_attempt_at = :now, last_error = :e WHERE id = :id`,
          { now: now.toISOString(), e: "Confirmed not sent by provider lookup; safe to retry", id: cur.id },
        );
        await appendEvent(ctx.db, {
          groupId: cycle.group_id,
          cycleId: cur.cycle_id,
          type: "PAYOUT_RETRY_SCHEDULED",
          payload: { payout: cur.id, reason: "confirmed not sent" },
          actor: `reconciler:${workerId}`,
          at: now,
        });
      } else {
        await run(ctx.db, "UPDATE payouts SET needs_operator_review = 1, last_error = :e WHERE id = :id", {
          e: "No matching provider transfer found and lookup is not definitive. Operator must verify before any resend.",
          id: cur.id,
        });
        await appendEvent(ctx.db, {
          groupId: cycle.group_id,
          cycleId: cur.cycle_id,
          type: "PAYOUT_OPERATOR_REVIEW",
          payload: { payout: cur.id, problems: ["unknown outcome, non-definitive lookup"] },
          actor: `reconciler:${workerId}`,
          at: now,
        });
      }
    });
  }
  return unknown.length;
}

export async function getPayoutView(ctx: Ctx, payoutId: string, userId: string) {
  const p = await getPayout(ctx, payoutId);
  if (!p) throw notFound("Payout not found");
  const cycle = await (await one<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE id = :id", { id: p.cycle_id }))!;
  const { group } = await requireMember(ctx.db, cycle.group_id, userId);
  const members = await many<MemberRow>(ctx.db, "SELECT * FROM members WHERE group_id = :g ORDER BY rotation_position", {
    g: group.id,
  });
  const cycles = await many<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE group_id = :g", { g: group.id });
  const recipient = members.find((m) => m.id === p.recipient_member_id)!;
  const dest = JSON.parse(p.destination_snapshot) as DestinationSnapshot;
  const receipt = await one<{ id: string }>(ctx.db, "SELECT id FROM receipts WHERE payout_id = :p", { p: p.id });
  const q = await getQuote(ctx.db, cycle.quote_id);
  return {
    id: p.id,
    groupId: group.id,
    groupName: group.name,
    round: cycle.round_number,
    status: p.status,
    needsOperatorReview: Boolean(p.needs_operator_review),
    recipient: { memberId: recipient.id, name: recipient.display_name },
    destinationLabel: dest.label,
    destinationVerifiedAt: dest.verifiedAt,
    asset: p.asset,
    principalUnits: String(p.principal_units),
    feeUnits: String(p.fee_units),
    kesMinor: String(cycle.display_target_kes_minor),
    quote: { rate: q.rate_decimal, mode: q.mode, source: q.source },
    providerPaymentId: p.provider_payment_id,
    attempts: p.attempts,
    lastError: p.status === "SUCCEEDED" ? null : p.last_error,
    createdAt: p.created_at,
    submittedAt: p.submitted_at,
    sentAt: p.sent_at,
    network: ctx.provider.network,
    receiptId: receipt?.id ?? null,
    trigger: "ALL_PAID" as const,
    rotation: members.map((m, i) => {
      const cy = cycles.find((c) => c.round_number === i + 1);
      return {
        name: m.display_name,
        round: i + 1,
        dueAt: cy?.due_at ?? dueAtForRound(group.first_due_at, group.frequency, i + 1, group.custom_interval_days).toISOString(),
        state: cy?.status === "PAID_OUT" ? "PAID_OUT" : cy?.id === cycle.id ? "THIS_PAYOUT" : cy ? "CURRENT" : "UPCOMING",
      };
    }),
  };
}

export function assertWorkerSecret(provided: string | null, expected: string) {
  if (!provided || provided.length !== expected.length) throw new DomainError("UNAUTHORIZED", "Bad worker secret", 401);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw new DomainError("UNAUTHORIZED", "Bad worker secret", 401);
}
