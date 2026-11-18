import { NextResponse } from "next/server";
import { api, authed } from "@/lib/api/http";
import { getPayoutView } from "@/lib/domain/payouts";

export const GET = api<{ payoutId: string }>(async ({ ctx, params }) => {
  const user = await authed(ctx);
  return NextResponse.json(await getPayoutView(ctx, params.payoutId, user.id));
});
