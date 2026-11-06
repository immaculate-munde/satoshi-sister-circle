import { NextResponse } from "next/server";
import { api } from "@/lib/api/http";
import { config } from "@/lib/config";
import { assertWorkerSecret } from "@/lib/domain/payouts";
import { runTick } from "@/worker/tick";

/** Protected trigger for an external scheduler (e.g. cron). The persistent worker is still preferred. */
export const POST = api(async ({ ctx, req }) => {
  assertWorkerSecret(req.headers.get("x-worker-secret"), config().workerSecret);
  return NextResponse.json(await runTick(ctx, "http-tick"));
});
