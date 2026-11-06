import { nowIso, run } from "../lib/db";
import type { Ctx } from "../lib/domain/context";
import { invoicesToReconcile, markLateContributions, reconcileInvoice } from "../lib/domain/invoices";
import { processPayouts, reconcileUnknownPayouts } from "../lib/domain/payouts";

export interface TickResult {
  invoicesChecked: number;
  invoiceErrors: number;
  payoutsAttempted: number;
  unknownPayoutsChecked: number;
  lateMarked: number;
}

/** One reconciliation + payout pass. Idempotent; safe to run from several workers. */
export async function runTick(ctx: Ctx, workerId: string, opts: { reconcileInvoices?: boolean } = {}): Promise<TickResult> {
  let invoicesChecked = 0;
  let invoiceErrors = 0;
  if (opts.reconcileInvoices !== false) {
    for (const invoiceId of invoicesToReconcile(ctx)) {
      try {
        await reconcileInvoice(ctx, invoiceId);
        invoicesChecked++;
      } catch (e) {
        invoiceErrors++;
        console.warn(`[${workerId}] reconcile ${invoiceId} failed: ${(e as Error).message}`);
      }
    }
  }
  const lateMarked = markLateContributions(ctx);
  const unknownPayoutsChecked = await reconcileUnknownPayouts(ctx, workerId);
  const payoutsAttempted = await processPayouts(ctx, workerId);
  run(
    ctx.db,
    `INSERT INTO worker_heartbeats (worker_id, last_beat_at, last_reconcile_at, info) VALUES (:w, :now, :rec, :info)
     ON CONFLICT(worker_id) DO UPDATE SET last_beat_at = :now, last_reconcile_at = COALESCE(:rec, last_reconcile_at), info = :info`,
    {
      w: workerId,
      now: nowIso(ctx.now()),
      rec: opts.reconcileInvoices !== false ? nowIso(ctx.now()) : null,
      info: JSON.stringify({ invoicesChecked, invoiceErrors, payoutsAttempted, unknownPayoutsChecked }),
    },
  );
  return { invoicesChecked, invoiceErrors, payoutsAttempted, unknownPayoutsChecked, lateMarked };
}
