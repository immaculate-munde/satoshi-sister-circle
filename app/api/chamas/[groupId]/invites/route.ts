import { NextResponse } from "next/server";
import { api, authed, rateLimit } from "@/lib/api/http";
import { createInvite, requireMember } from "@/lib/domain/chamas";
import { DomainError } from "@/lib/domain/context";

export const POST = api<{ groupId: string }>(
  async ({ ctx, req, params }) => {
    const user = await authed(ctx);
    rateLimit(req, "invite-create", 10, 60_000, user.id);
    const { member } = requireMember(ctx.db, params.groupId, user.id);
    if (member.role !== "OWNER") throw new DomainError("FORBIDDEN", "Only the chama owner can create invites", 403);
    return NextResponse.json(createInvite(ctx, params.groupId, user.id), { status: 201 });
  },
  { mutation: true },
);
