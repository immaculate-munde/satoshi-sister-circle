import { id, many, nowIso, one, run, tx } from "../db";
import { requireMember } from "./chamas";
import { type Ctx, DomainError, notFound } from "./context";
import { appendEvent } from "./ledger";
import type { GroupRow, MemberRow } from "./rows";

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface JoinRequestRow {
  id: string;
  group_id: string;
  user_id: string;
  message: string | null;
  status: RequestStatus;
  member_id: string | null;
  created_at: string;
  decided_at: string | null;
}

/**
 * Public chamas the user is not already in, with at least one open seat.
 * Deliberately exposes no member names, ledger or wallet details: only what someone needs to decide to ask.
 */
export async function listPublicChamas(ctx: Ctx, userId: string) {
  const rows = await many<
    GroupRow & { open_seats: number; total_seats: number; owner_name: string; req_id: string | null; req_status: RequestStatus | null }
  >(
    ctx.db,
    `SELECT g.*,
            (SELECT COUNT(*) FROM members m WHERE m.group_id = g.id AND m.user_id IS NULL) AS open_seats,
            (SELECT COUNT(*) FROM members m WHERE m.group_id = g.id) AS total_seats,
            (SELECT u.display_name FROM users u WHERE u.id = g.owner_user_id) AS owner_name,
            (SELECT r.id FROM join_requests r WHERE r.group_id = g.id AND r.user_id = :u AND r.status = 'PENDING') AS req_id,
            (SELECT r.status FROM join_requests r WHERE r.group_id = g.id AND r.user_id = :u AND r.status = 'PENDING') AS req_status
       FROM groups g
      WHERE g.visibility = 'PUBLIC' AND g.status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM members m WHERE m.group_id = g.id AND m.user_id = :u)
        AND EXISTS (SELECT 1 FROM members m WHERE m.group_id = g.id AND m.user_id IS NULL)
      ORDER BY g.created_at DESC
      LIMIT 100`,
    { u: userId },
  );
  return {
    chamas: rows.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      ownerName: g.owner_name,
      contributionKesMinor: String(g.contribution_kes_minor),
      frequency: g.frequency,
      customIntervalDays: g.custom_interval_days,
      settlementAsset: g.settlement_asset,
      openSeats: Number(g.open_seats),
      totalSeats: Number(g.total_seats),
      myRequest: g.req_id ? { id: g.req_id, status: g.req_status as RequestStatus } : null,
    })),
  };
}

export async function requestToJoin(ctx: Ctx, userId: string, groupId: string, message?: string) {
  return tx(ctx.db, async () => {
    const group = await one<GroupRow>(ctx.db, "SELECT * FROM groups WHERE id = :id", { id: groupId });
    // Private chamas look exactly like missing ones, so ids cannot be probed.
    if (!group || group.visibility !== "PUBLIC" || group.status !== "ACTIVE") throw notFound("This chama is not open for requests");
    const already = await one(ctx.db, "SELECT 1 AS x FROM members WHERE group_id = :g AND user_id = :u", { g: groupId, u: userId });
    if (already) throw new DomainError("ALREADY_MEMBER", "You are already in this chama", 409);
    const open = await one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM members WHERE group_id = :g AND user_id IS NULL", { g: groupId });
    if (!open || Number(open.n) < 1) throw new DomainError("NO_SEATS", "Every seat in this chama is taken", 409);
    const pending = await one(ctx.db, "SELECT 1 AS x FROM join_requests WHERE group_id = :g AND user_id = :u AND status = 'PENDING'", {
      g: groupId,
      u: userId,
    });
    if (pending) throw new DomainError("ALREADY_REQUESTED", "You already asked to join this chama", 409);
    const requestId = id();
    await run(
      ctx.db,
      "INSERT INTO join_requests (id, group_id, user_id, message, status, created_at) VALUES (:id, :g, :u, :m, 'PENDING', :now)",
      { id: requestId, g: groupId, u: userId, m: message?.trim() ? message.trim().slice(0, 300) : null, now: nowIso(ctx.now()) },
    );
    return { id: requestId, status: "PENDING" as const };
  });
}

export async function cancelJoinRequest(ctx: Ctx, userId: string, requestId: string) {
  const res = await run(
    ctx.db,
    "UPDATE join_requests SET status = 'CANCELLED', decided_at = :now WHERE id = :id AND user_id = :u AND status = 'PENDING'",
    { id: requestId, u: userId, now: nowIso(ctx.now()) },
  );
  if (res.changes !== 1) throw notFound("No pending request found");
  return { status: "CANCELLED" as const };
}

async function requireOwner(ctx: Ctx, groupId: string, userId: string) {
  const { group, member } = await requireMember(ctx.db, groupId, userId);
  if (member.role !== "OWNER") throw new DomainError("FORBIDDEN", "Only the chama owner can do this", 403);
  return group;
}

/** Owner view: pending requests plus the seats an approval can fill. */
export async function listJoinRequests(ctx: Ctx, groupId: string, ownerId: string) {
  const group = await requireOwner(ctx, groupId, ownerId);
  const requests = await many<JoinRequestRow & { display_name: string }>(
    ctx.db,
    `SELECT r.*, u.display_name FROM join_requests r JOIN users u ON u.id = r.user_id
      WHERE r.group_id = :g AND r.status = 'PENDING' ORDER BY r.created_at`,
    { g: groupId },
  );
  const seats = await many<MemberRow>(
    ctx.db,
    "SELECT * FROM members WHERE group_id = :g AND user_id IS NULL ORDER BY rotation_position",
    { g: groupId },
  );
  return {
    visibility: group.visibility,
    description: group.description,
    requests: requests.map((r) => ({ id: r.id, name: r.display_name, message: r.message, createdAt: r.created_at })),
    openSeats: seats.map((s) => ({ memberId: s.id, name: s.display_name, position: s.rotation_position, wallet: s.destination_label })),
  };
}

export async function decideJoinRequest(
  ctx: Ctx,
  ownerId: string,
  requestId: string,
  decision: "APPROVE" | "REJECT",
  memberId?: string,
) {
  return tx(ctx.db, async () => {
    const req = await one<JoinRequestRow>(ctx.db, "SELECT * FROM join_requests WHERE id = :id", { id: requestId });
    if (!req) throw notFound("Request not found");
    await requireOwner(ctx, req.group_id, ownerId); // 403/404 for anyone but the owner
    if (req.status !== "PENDING") throw new DomainError("ALREADY_DECIDED", "This request was already handled", 409);

    if (decision === "REJECT") {
      await run(ctx.db, "UPDATE join_requests SET status = 'REJECTED', decided_at = :now WHERE id = :id", { id: requestId, now: nowIso(ctx.now()) });
      return { status: "REJECTED" as const };
    }

    const already = await one(ctx.db, "SELECT 1 AS x FROM members WHERE group_id = :g AND user_id = :u", { g: req.group_id, u: req.user_id });
    if (already) throw new DomainError("ALREADY_MEMBER", "They are already in this chama", 409);
    const seats = await many<MemberRow>(
      ctx.db,
      "SELECT * FROM members WHERE group_id = :g AND user_id IS NULL ORDER BY rotation_position",
      { g: req.group_id },
    );
    if (!seats.length) throw new DomainError("NO_SEATS", "Every seat in this chama is taken", 409);
    const seat = memberId ? seats.find((s) => s.id === memberId) : seats[0];
    if (!seat) throw new DomainError("SEAT_TAKEN", "That seat is not available", 409);

    const bound = await run(ctx.db, "UPDATE members SET user_id = :u, invite_state = 'JOINED' WHERE id = :id AND user_id IS NULL", {
      u: req.user_id,
      id: seat.id,
    });
    if (bound.changes !== 1) throw new DomainError("SEAT_TAKEN", "That seat was just taken", 409);
    await run(
      ctx.db,
      "UPDATE join_requests SET status = 'APPROVED', member_id = :m, decided_at = :now WHERE id = :id",
      { id: requestId, m: seat.id, now: nowIso(ctx.now()) },
    );
    await appendEvent(ctx.db, {
      groupId: req.group_id,
      type: "MEMBER_JOINED",
      payload: { member: seat.display_name, position: seat.rotation_position, via: "REQUEST" },
      actor: `user:${ownerId}`,
      at: ctx.now(),
    });
    return { status: "APPROVED" as const, memberId: seat.id };
  });
}

export async function setVisibility(ctx: Ctx, ownerId: string, groupId: string, visibility: "PRIVATE" | "PUBLIC", description?: string) {
  await requireOwner(ctx, groupId, ownerId);
  await run(ctx.db, "UPDATE groups SET visibility = :v, description = :d WHERE id = :g", {
    v: visibility,
    d: description?.trim() ? description.trim().slice(0, 500) : null,
    g: groupId,
  });
  if (visibility === "PRIVATE") {
    // Going private withdraws every open request so nobody is left waiting on a hidden chama.
    await run(ctx.db, "UPDATE join_requests SET status = 'CANCELLED', decided_at = :now WHERE group_id = :g AND status = 'PENDING'", {
      g: groupId,
      now: nowIso(ctx.now()),
    });
  }
  return { visibility };
}
