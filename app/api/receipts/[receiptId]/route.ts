import { NextResponse } from "next/server";
import { api, authed } from "@/lib/api/http";
import { getReceipt } from "@/lib/domain/receipts";

export const GET = api<{ receiptId: string }>(async ({ ctx, params }) => {
  const user = await authed(ctx);
  return NextResponse.json(await getReceipt(ctx, params.receiptId, user.id));
});
