import { NextResponse } from "next/server";
import { api, authed } from "@/lib/api/http";
import { listPublicChamas } from "@/lib/domain/discovery";

export const GET = api(async ({ ctx }) => {
  const user = await authed(ctx);
  return NextResponse.json(await listPublicChamas(ctx, user.id));
});
