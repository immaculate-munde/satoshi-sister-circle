/**
 * Persistent worker: provider watcher + reconciler + automatic payout processor.
 * Run with `npm run worker`. Durable state (payout leases, attempts, invoice status) lives in the DB,
 * so restarting this process resumes open invoices and payouts safely.
 */
import { hostname } from "node:os";
import { randomBytes } from "node:crypto";
import { config } from "../lib/config";
import { many } from "../lib/db";
import type { Ctx } from "../lib/domain/context";
import { serverCtx } from "../lib/domain/server";
import { reconcileInvoice } from "../lib/domain/invoices";
import type { PaymentState } from "../lib/payments/provider";
import { ensureFreshRates } from "../lib/domain/live-rates";
import { runTick } from "./tick";

const cfg = config();
let ctx: Ctx;
const workerId = `${hostname()}-${process.pid}-${randomBytes(3).toString("hex")}`;
const FAST_MS = 1000;
const watchers = new Map<string, () => void>();
let stopping = false;

function log(msg: string) {
  console.log(`${new Date().toISOString()} [worker ${workerId}] ${msg}`);
}

/** Live watch for open invoices; the periodic reconciler is the safety net for missed events. */
async function syncWatchers() {
  const open = await many<{ id: string; payment_hash: string; bolt11: string; wallet_ref: string }>(
    ctx.db,
    "SELECT id, payment_hash, bolt11, wallet_ref FROM invoices WHERE status = 'PENDING' AND payment_hash IS NOT NULL",
  );
  const openIds = new Set(open.map((o) => o.id));
  for (const [invoiceId, stop] of watchers) {
    if (!openIds.has(invoiceId)) {
      stop();
      watchers.delete(invoiceId);
    }
  }
  for (const inv of open) {
    if (watchers.has(inv.id)) continue;
    const stop = await ctx.provider.watchInvoice(
      { paymentHash: inv.payment_hash, bolt11: inv.bolt11, walletId: inv.wallet_ref },
      (state: PaymentState) => {
        if (state === "PAID" || state === "EXPIRED") {
          reconcileInvoice(ctx, inv.id)
            .then((s) => log(`invoice ${inv.id.slice(0, 8)} -> ${s}`))
            .catch((e) => log(`watch reconcile failed: ${(e as Error).message}`));
        }
      },
    );
    watchers.set(inv.id, stop);
  }
}

async function main() {
  ctx = await serverCtx();
  log(`starting in ${cfg.mode} mode, network: ${ctx.provider.network}, reconcile every ${cfg.reconcileIntervalSeconds}s`);
  let lastFull = 0;
  while (!stopping) {
    try {
      const full = Date.now() - lastFull >= cfg.reconcileIntervalSeconds * 1000;
      if (cfg.fxProvider === "live") await ensureFreshRates(ctx.db);
      await syncWatchers();
      const r = await runTick(ctx, workerId, { reconcileInvoices: full });
      if (full) lastFull = Date.now();
      if (r.payoutsAttempted || r.invoiceErrors || r.lateMarked) log(JSON.stringify(r));
    } catch (e) {
      log(`tick failed: ${(e as Error).message}`);
    }
    await new Promise((res) => setTimeout(res, FAST_MS));
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log(`received ${sig}, stopping after current tick`);
    stopping = true;
    for (const stop of watchers.values()) stop();
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
