import { NextResponse } from "next/server";
import { z } from "zod";
import { api, authed, parseBody, rateLimit } from "@/lib/api/http";
import { setVisibility } from "@/lib/domain/discovery";

export const POST = api<{ groupId: string }>(
  async ({ ctx, req, params }) => {
    const user = await authed(ctx);
    rateLimit(req, "visibility", 20, 60_000, user.id);
    const { visibility, description } = await parseBody(
      req,
      z.object({ visibility: z.enum(["PRIVATE", "PUBLIC"]), description: z.string().trim().max(500).optional() }),
    );
    return NextResponse.json(await setVisibility(ctx, user.id, params.groupId, visibility, description));
  },
  { mutation: true },
);
