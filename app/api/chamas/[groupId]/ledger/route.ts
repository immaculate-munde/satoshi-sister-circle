import { NextResponse } from "next/server";
import { api, authed } from "@/lib/api/http";
import { getLedger } from "@/lib/domain/chamas";

export const GET = api<{ groupId: string }>(async ({ ctx, params }) => {
  const user = await authed(ctx);
  return NextResponse.json(await getLedger(ctx, params.groupId, user.id));
});
