import { describe, expect, it } from "vitest";
import { one } from "@/lib/db";
import { processPayouts } from "@/lib/domain/payouts";
import { runTick } from "../../worker/tick";
import { makeCtx, payAs, umoja } from "./helpers";

describe("worker tick", () => {
  it("records a heartbeat, keeps the last reconcile time on fast ticks, and never fails on Postgres", async () => {
    const { ctx, clock } = await makeCtx();
    await runTick(ctx, "w1"); // full pass (reconciles invoices)
    const first = await one<{ last_beat_at: string; last_reconcile_at: string }>(ctx.db, "SELECT * FROM worker_heartbeats WHERE worker_id = 'w1'");
    expect(first?.last_reconcile_at).toBeTruthy();

    clock.advance(5_000);
    await runTick(ctx, "w1", { reconcileInvoices: false }); // fast pass
    const second = await one<{ last_beat_at: string; last_reconcile_at: string }>(ctx.db, "SELECT * FROM worker_heartbeats WHERE worker_id = 'w1'");
    expect(second!.last_beat_at > first!.last_beat_at).toBe(true);
    expect(second!.last_reconcile_at).toBe(first!.last_reconcile_at); // not wiped by the fast pass
  });

  it("a tick pays out a fully funded round exactly once", async () => {
    const { ctx, provider } = await makeCtx();
    const { group, users } = await umoja(ctx);
    for (const u of [users.wanjiku, users.faith, users.amina]) await payAs(ctx, provider, u, group.id);
    const r1 = await runTick(ctx, "w1");
    const r2 = await runTick(ctx, "w2");
    expect(r1.payoutsAttempted + r2.payoutsAttempted).toBe(1);
    const sent = await one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'");
    expect(sent?.n).toBe(1);
    expect(await processPayouts(ctx, "w3")).toBe(0);
  });
});
