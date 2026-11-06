import { many, one, run, tx } from "../db";
import { type Ctx, DomainError } from "./context";
import { hashInviteCode } from "./chamas";
import { appendEvent } from "./ledger";
import type { GroupRow, MemberRow } from "./rows";

interface InviteRow {
  id: string;
  group_id: string;
  invited_member_id: string | null;
  expires_at: string;
  max_uses: number;
  uses: number;
  revoked_at: string | null;
}

function findInvite(ctx: Ctx, code: string): InviteRow {
  const inv = one<InviteRow>(ctx.db, "SELECT * FROM invites WHERE token_hash = :h", { h: hashInviteCode(code) });
  if (!inv) throw new DomainError("INVITE_INVALID", "That invite code is not valid", 404);
  if (inv.revoked_at) throw new DomainError("INVITE_REVOKED", "That invite has been cancelled", 410);
  if (new Date(inv.expires_at) <= ctx.now()) throw new DomainError("INVITE_EXPIRED", "That invite has expired", 410);
  if (inv.uses >= inv.max_uses) throw new DomainError("INVITE_USED", "That invite has already been used", 410);
  return inv;
}

/** Shows only what a joiner needs: group name and open seats. */
export function previewInvite(ctx: Ctx, code: string, userId: string) {
  const inv = findInvite(ctx, code);
  const group = one<GroupRow>(ctx.db, "SELECT * FROM groups WHERE id = :id", { id: inv.group_id })!;
  const already = one<MemberRow>(ctx.db, "SELECT * FROM members WHERE group_id = :g AND user_id = :u", {
    g: group.id,
    u: userId,
  });
  const seats = many<MemberRow>(
    ctx.db,
    "SELECT * FROM members WHERE group_id = :g AND user_id IS NULL ORDER BY rotation_position",
    { g: group.id },
  ).filter((m) => !inv.invited_member_id || m.id === inv.invited_member_id);
  return {
    groupId: group.id,
    groupName: group.name,
    contributionKesMinor: String(group.contribution_kes_minor),
    frequency: group.frequency,
    alreadyMember: Boolean(already),
    seats: seats.map((s) => ({ memberId: s.id, name: s.display_name, position: s.rotation_position })),
  };
}

export function acceptInvite(ctx: Ctx, code: string, userId: string, memberId?: string) {
  return tx(ctx.db, () => {
    const inv = findInvite(ctx, code);
    const existing = one<MemberRow>(ctx.db, "SELECT * FROM members WHERE group_id = :g AND user_id = :u", {
      g: inv.group_id,
      u: userId,
    });
    if (existing) return { groupId: inv.group_id, memberId: existing.id, alreadyMember: true };
    const seats = many<MemberRow>(ctx.db, "SELECT * FROM members WHERE group_id = :g AND user_id IS NULL", {
      g: inv.group_id,
    }).filter((m) => !inv.invited_member_id || m.id === inv.invited_member_id);
    if (!seats.length) throw new DomainError("NO_SEATS", "Every seat in this chama is already taken", 409);
    const seat = memberId ? seats.find((s) => s.id === memberId) : seats.length === 1 ? seats[0] : undefined;
    if (!seat) throw new DomainError("CHOOSE_SEAT", "Choose which member you are", 400);
    const res = run(
      ctx.db,
      "UPDATE members SET user_id = :u, invite_state = 'JOINED' WHERE id = :id AND user_id IS NULL",
      { u: userId, id: seat.id },
    );
    if (Number(res.changes) !== 1) throw new DomainError("SEAT_TAKEN", "That seat was just taken", 409);
    run(ctx.db, "UPDATE invites SET uses = uses + 1 WHERE id = :id", { id: inv.id });
    appendEvent(ctx.db, {
      groupId: inv.group_id,
      type: "MEMBER_JOINED",
      payload: { member: seat.display_name, position: seat.rotation_position },
      actor: `user:${userId}`,
      at: ctx.now(),
    });
    return { groupId: inv.group_id, memberId: seat.id, alreadyMember: false };
  });
}
