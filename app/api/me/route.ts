import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { api } from "@/lib/api/http";
import { config } from "@/lib/config";
import { liveUsdCentsPerKes } from "@/lib/domain/live-fx";

export const GET = api(async ({ ctx }) => {
  const cfg = config();
  const user = await currentUser(ctx.db);
  let fxUsdCentsPerKes: string | null = null;
  if (cfg.fxProvider === "live") {
    try {
      fxUsdCentsPerKes = liveUsdCentsPerKes().rate;
    } catch {
      fxUsdCentsPerKes = null;
    }
  }
  return NextResponse.json({
    user,
    fxUsdCentsPerKes,
    mode: { provider: cfg.mode, demo: cfg.demo, simulatedPayments: cfg.allowSimulatedPayments, live: cfg.liveFunds, bitcoinEnabled: cfg.bitcoinEnabled, network: ctx.provider.network },
  });
});
