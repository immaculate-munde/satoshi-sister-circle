/** One-off reconciliation pass plus audit-chain checkpoint export. Usage: npm run reconcile */
import { many } from "../lib/db";
import { verifyChain } from "../lib/domain/ledger";
import { serverCtx } from "../lib/domain/server";
import { runTick } from "../worker/tick";

async function main() {
  const ctx = await serverCtx();
  const r = await runTick(ctx, "manual-reconcile");
  console.log("Reconciliation:", r);
  const review = await many<{ id: string; status: string; last_error: string }>(
    ctx.db,
    "SELECT id, status, last_error FROM payouts WHERE needs_operator_review = 1",
  );
  if (review.length) console.log("Payouts needing operator review:", review);
  console.log("Audit chain checkpoints (store these somewhere outside the database):");
  for (const g of await many<{ id: string; name: string }>(ctx.db, "SELECT id, name FROM groups")) {
    const v = await verifyChain(ctx.db, g.id);
    console.log(`  ${g.name} (${g.id}): ${v.ok ? "OK" : `BROKEN at #${v.brokenAt}`} head=${v.head}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
