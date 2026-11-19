import { NextResponse } from "next/server";
import { z } from "zod";
import { api, authed, parseBody, rateLimit } from "@/lib/api/http";
import { cancelJoinRequest, decideJoinRequest } from "@/lib/domain/discovery";

/** Requester cancels, or the owner approves / rejects. */
export const POST = api<{ requestId: string }>(
  async ({ ctx, req, params }) => {
    const user = await authed(ctx);
    rateLimit(req, "join-decide", 30, 60_000, user.id);
    const body = await parseBody(
      req,
      z.object({ action: z.enum(["cancel", "approve", "reject"]), memberId: z.string().uuid().optional() }),
    );
    if (body.action === "cancel") return NextResponse.json(await cancelJoinRequest(ctx, user.id, params.requestId));
    return NextResponse.json(
      await decideJoinRequest(ctx, user.id, params.requestId, body.action === "approve" ? "APPROVE" : "REJECT", body.memberId),
    );
  },
  { mutation: true },
);
