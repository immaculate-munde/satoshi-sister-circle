import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getDb, many, one } from "@/lib/db";

export async function GET() {
  try {
    const cfg = config();
    const db = await getDb();
    const beat = await one<{ last_beat_at: string; last_reconcile_at: string | null }>(
      db,
      "SELECT last_beat_at, last_reconcile_at FROM worker_heartbeats ORDER BY last_beat_at DESC LIMIT 1",
    );
    const stuck = await many<{ status: string; n: number }>(
      db,
      "SELECT status, COUNT(*) AS n FROM payouts WHERE status IN ('UNKNOWN','FAILED','QUEUED','PROCESSING') GROUP BY status",
    );
    const review = await (await one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM payouts WHERE needs_operator_review = 1"))?.n ?? 0;
    const workerAgeSeconds = beat ? Math.round((Date.now() - new Date(beat.last_beat_at).getTime()) / 1000) : null;
    return NextResponse.json(
      {
        ok: true,
        mode: cfg.mode,
        demo: cfg.demo,
        btcEnabled: cfg.flash.btcEnabled,
        simulatedPayments: cfg.allowSimulatedPayments,
        worker: { lastBeatAt: beat?.last_beat_at ?? null, ageSeconds: workerAgeSeconds, healthy: workerAgeSeconds !== null && workerAgeSeconds < 120 },
        reconciliation: { lastRunAt: beat?.last_reconcile_at ?? null },
        payouts: Object.fromEntries(stuck.map((s) => [s.status, s.n])),
        payoutsNeedingOperatorReview: review,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.split("\n")[0] }, { status: 503 });
  }
}
