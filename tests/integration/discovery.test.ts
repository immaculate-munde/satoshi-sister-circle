import { describe, expect, it } from "vitest";
import { one } from "@/lib/db";
import { createChama } from "@/lib/domain/chamas";
import { DomainError } from "@/lib/domain/context";
import {
  cancelJoinRequest,
  decideJoinRequest,
  listJoinRequests,
  listPublicChamas,
  requestToJoin,
  setVisibility,
} from "@/lib/domain/discovery";
import { makeCtx, user } from "./helpers";

async function publicChama(visibility: "PUBLIC" | "PRIVATE" = "PUBLIC") {
  const env = await makeCtx();
  const owner = await user(env.ctx, "Owner Amina");
  const { group } = await createChama(env.ctx, owner, {
    name: "Goal Savers",
    contributionKes: "1000",
    frequency: "WEEKLY",
    settlementAsset: "USD_CENT",
    firstDueDate: "2026-11-06",
    visibility,
    description: "Saving for school fees",
    members: [
      { displayName: "Owner Amina", isMe: true, payoutPreference: "USD" },
      { displayName: "Seat Two", isMe: false, payoutPreference: "USD" },
      { displayName: "Seat Three", isMe: false, payoutPreference: "USD" },
    ],
  });
  return { ...env, owner, group };
}

describe("public chama directory and join requests", () => {
  it("lists public chamas with open seats and hides private ones", async () => {
    const pub = await publicChama("PUBLIC");
    const stranger = await user(pub.ctx, "Njeri");
    const list = await listPublicChamas(pub.ctx, stranger);
    expect(list.chamas).toHaveLength(1);
    expect(list.chamas[0]).toMatchObject({ name: "Goal Savers", description: "Saving for school fees", openSeats: 2, totalSeats: 3 });
    expect(JSON.stringify(list)).not.toContain("Seat Two"); // no member names leak

    const priv = await publicChama("PRIVATE");
    const s2 = await user(priv.ctx, "Njeri");
    expect((await listPublicChamas(priv.ctx, s2)).chamas).toHaveLength(0);
    await expect(requestToJoin(priv.ctx, s2, priv.group.id)).rejects.toThrow(DomainError);
  });

  it("members do not see their own chama in the directory", async () => {
    const { ctx, owner } = await publicChama();
    expect((await listPublicChamas(ctx, owner)).chamas).toHaveLength(0);
  });

  it("a request is one-at-a-time, and can be cancelled then re-sent", async () => {
    const { ctx, group } = await publicChama();
    const u = await user(ctx, "Njeri");
    const r = await requestToJoin(ctx, u, group.id, "My cousin knows the owner");
    await expect(requestToJoin(ctx, u, group.id)).rejects.toThrow(/already asked/);
    expect((await listPublicChamas(ctx, u)).chamas[0].myRequest).toMatchObject({ id: r.id, status: "PENDING" });
    await cancelJoinRequest(ctx, u, r.id);
    await expect(requestToJoin(ctx, u, group.id)).resolves.toMatchObject({ status: "PENDING" });
  });

  it("only the owner sees and decides requests; approval fills the chosen seat", async () => {
    const { ctx, owner, group } = await publicChama();
    const njeri = await user(ctx, "Njeri");
    const other = await user(ctx, "Other");
    const r = await requestToJoin(ctx, njeri, group.id, "Hello");

    await expect(listJoinRequests(ctx, group.id, other)).rejects.toThrow(DomainError);
    await expect(decideJoinRequest(ctx, other, r.id, "APPROVE")).rejects.toThrow(DomainError);

    const view = await listJoinRequests(ctx, group.id, owner);
    expect(view.requests).toMatchObject([{ id: r.id, name: "Njeri", message: "Hello" }]);
    expect(view.openSeats).toHaveLength(2);

    const seatThree = view.openSeats.find((s) => s.name === "Seat Three")!;
    await decideJoinRequest(ctx, owner, r.id, "APPROVE", seatThree.memberId);
    const seat = await one<{ user_id: string; invite_state: string }>(ctx.db, "SELECT user_id, invite_state FROM members WHERE id = :id", {
      id: seatThree.memberId,
    });
    expect(seat).toMatchObject({ user_id: njeri, invite_state: "JOINED" });
    await expect(decideJoinRequest(ctx, owner, r.id, "APPROVE")).rejects.toThrow(/already handled/);
    // She is now a member, so the directory no longer offers it to her.
    expect((await listPublicChamas(ctx, njeri)).chamas).toHaveLength(0);
  });

  it("rejecting leaves the seat open, and a full chama stops taking requests", async () => {
    const { ctx, owner, group } = await publicChama();
    const a = await user(ctx, "A");
    const b = await user(ctx, "B");
    const c = await user(ctx, "C");
    const ra = await requestToJoin(ctx, a, group.id);
    await decideJoinRequest(ctx, owner, ra.id, "REJECT");
    expect((await listJoinRequests(ctx, group.id, owner)).openSeats).toHaveLength(2);

    const rb = await requestToJoin(ctx, b, group.id);
    const rc = await requestToJoin(ctx, c, group.id);
    await decideJoinRequest(ctx, owner, rb.id, "APPROVE");
    await decideJoinRequest(ctx, owner, rc.id, "APPROVE");
    const late = await user(ctx, "Late");
    await expect(requestToJoin(ctx, late, group.id)).rejects.toThrow(/seat/i);
    expect((await listPublicChamas(ctx, late)).chamas).toHaveLength(0);
  });

  it("going private withdraws pending requests", async () => {
    const { ctx, owner, group } = await publicChama();
    const u = await user(ctx, "Njeri");
    const r = await requestToJoin(ctx, u, group.id);
    await setVisibility(ctx, owner, group.id, "PRIVATE");
    await expect(decideJoinRequest(ctx, owner, r.id, "APPROVE")).rejects.toThrow(/already handled/);
    expect((await listPublicChamas(ctx, u)).chamas).toHaveLength(0);
  });
});
