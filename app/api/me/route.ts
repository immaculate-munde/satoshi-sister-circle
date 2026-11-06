import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { api } from "@/lib/api/http";
import { config } from "@/lib/config";

export const GET = api(async ({ ctx }) => {
  const cfg = config();
  const user = await currentUser(ctx.db);
  return NextResponse.json({
    user,
    mode: { provider: cfg.mode, demo: cfg.demo, simulatedPayments: cfg.allowSimulatedPayments, network: ctx.provider.network },
  });
});
