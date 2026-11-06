import { NextResponse } from "next/server";
import { api, authed } from "@/lib/api/http";
import { getDiasporaContext } from "@/lib/domain/diaspora";

export const GET = api<{ groupId: string }>(async ({ ctx, params }) => {
  const user = await authed(ctx);
  return NextResponse.json(getDiasporaContext(ctx, params.groupId, user.id));
});
