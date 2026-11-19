import { NextResponse } from "next/server";
import { z } from "zod";
import { api, authed, parseBody, rateLimit } from "@/lib/api/http";
import { listJoinRequests, requestToJoin } from "@/lib/domain/discovery";

/** Owner: pending requests + open seats. */
export const GET = api<{ groupId: string }>(async ({ ctx, params }) => {
  const user = await authed(ctx);
  return NextResponse.json(await listJoinRequests(ctx, params.groupId, user.id));
});

/** Anyone signed in: ask to join a public chama. */
export const POST = api<{ groupId: string }>(
  async ({ ctx, req, params }) => {
    const user = await authed(ctx);
    rateLimit(req, "join-request", 10, 60_000, user.id);
    const { message } = await parseBody(req, z.object({ message: z.string().trim().max(300).optional() }));
    return NextResponse.json(await requestToJoin(ctx, user.id, params.groupId, message), { status: 201 });
  },
  { mutation: true },
);
