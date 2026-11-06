import { NextResponse } from "next/server";
import { z } from "zod";
import { api, authed, parseBody, rateLimit } from "@/lib/api/http";
import { previewInvite } from "@/lib/domain/invites";

export const POST = api(
  async ({ ctx, req }) => {
    const user = await authed(ctx);
    rateLimit(req, "invite", 20, 60_000, user.id);
    const { code } = await parseBody(req, z.object({ code: z.string().trim().min(4).max(40) }));
    return NextResponse.json(previewInvite(ctx, code, user.id));
  },
  { mutation: true },
);
