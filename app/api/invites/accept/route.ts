import { NextResponse } from "next/server";
import { z } from "zod";
import { api, authed, parseBody, rateLimit } from "@/lib/api/http";
import { acceptInvite } from "@/lib/domain/invites";

export const POST = api(
  async ({ ctx, req }) => {
    const user = await authed(ctx);
    rateLimit(req, "invite", 20, 60_000, user.id);
    const { code, memberId } = await parseBody(
      req,
      z.object({ code: z.string().trim().min(4).max(40), memberId: z.string().uuid().optional() }),
    );
    return NextResponse.json(acceptInvite(ctx, code, user.id, memberId));
  },
  { mutation: true },
);
