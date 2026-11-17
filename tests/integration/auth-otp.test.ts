import { describe, expect, it } from "vitest";
import { consumeOtp, createOtp } from "@/lib/auth/otp";
import { maskPhone, normalizePhone } from "@/lib/auth/phone";
import { run } from "@/lib/db";
import { acceptInvite, previewInvite } from "@/lib/domain/invites";
import { makeCtx, user } from "./helpers";

describe("phone numbers", () => {
  it("normalises Kenyan formats to E.164", () => {
    expect(normalizePhone("0712 345 678")).toBe("+254712345678");
    expect(normalizePhone("0112345678")).toBe("+254112345678");
    expect(normalizePhone("254712345678")).toBe("+254712345678");
    expect(normalizePhone("+254-712-345-678")).toBe("+254712345678");
    expect(normalizePhone("+447911123456")).toBe("+447911123456");
  });
  it("rejects junk", () => {
    for (const bad of ["", "abc", "0612345678", "07123", "+0123456789", "12345678901234567890"]) expect(normalizePhone(bad)).toBeNull();
  });
  it("masks for logs", () => expect(maskPhone("+254712345678")).toBe("+254712***678"));
});

describe("one-time codes", () => {
  const phone = "+254712345678";
  it("accepts the right code once, and never again", () => {
    const { db, clock } = makeCtx();
    const code = createOtp(db, phone, clock.now());
    expect(code).toMatch(/^\d{6}$/);
    consumeOtp(db, phone, code, clock.now());
    expect(() => consumeOtp(db, phone, code, clock.now())).toThrow(/not right or has expired/);
  });
  it("expires after 10 minutes", () => {
    const { db, clock } = makeCtx();
    const code = createOtp(db, phone, clock.now());
    clock.advance(10 * 60_000 + 1000);
    expect(() => consumeOtp(db, phone, code, clock.now())).toThrow(/not right or has expired/);
  });
  it("locks after 5 wrong guesses even if the right code follows", () => {
    const { db, clock } = makeCtx();
    const code = createOtp(db, phone, clock.now());
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(() => consumeOtp(db, phone, wrong, clock.now())).toThrow();
    expect(() => consumeOtp(db, phone, code, clock.now())).toThrow(/not right or has expired/);
  });
  it("enforces a resend cooldown and an hourly cap", () => {
    const { db, clock } = makeCtx();
    createOtp(db, phone, clock.now());
    expect(() => createOtp(db, phone, clock.now())).toThrow(/wait a minute/);
    for (let i = 0; i < 4; i++) {
      clock.advance(61_000);
      createOtp(db, phone, clock.now());
    }
    clock.advance(61_000);
    expect(() => createOtp(db, phone, clock.now())).toThrow(/Too many codes/);
  });
  it("a code for one number does not work for another", () => {
    const { db, clock } = makeCtx();
    const code = createOtp(db, phone, clock.now());
    expect(() => consumeOtp(db, "+254799999999", code, clock.now())).toThrow();
  });
});

describe("seats bound to phone numbers", () => {
  it("only the verified owner of the number can claim the seat", async () => {
    const { ctx } = makeCtx();
    const amina = user(ctx, "Amina Otieno");
    const { createChama } = await import("@/lib/domain/chamas");
    const { invite, group } = await createChama(ctx, amina, {
      name: "Umoja", contributionKes: "5000", frequency: "WEEKLY", settlementAsset: "USD_CENT", firstDueDate: "2026-11-06",
      members: [
        { displayName: "Wanjiku", isMe: false, payoutPreference: "USD" },
        { displayName: "Faith", isMe: false, payoutPreference: "USD" },
        { displayName: "Amina Otieno", isMe: true, payoutPreference: "USD" },
      ],
    });
    run(ctx.db, "UPDATE members SET phone = '+254711111111' WHERE group_id = :g AND display_name = 'Wanjiku'", { g: group.id });
    run(ctx.db, "UPDATE members SET phone = '+254722222222' WHERE group_id = :g AND display_name = 'Faith'", { g: group.id });
    const stranger = user(ctx, "Stranger");
    run(ctx.db, "UPDATE users SET phone = '+254733333333', phone_verified_at = :n WHERE id = :u", { u: stranger, n: new Date().toISOString() });
    expect(() => previewInvite(ctx, invite.code, stranger)).toThrow(/different phone number/);
    expect(() => acceptInvite(ctx, invite.code, stranger)).toThrow(/different phone number/);

    const wanjiku = user(ctx, "Wanjiku");
    expect(() => acceptInvite(ctx, invite.code, wanjiku)).toThrow(); // phone not verified yet
    run(ctx.db, "UPDATE users SET phone = '+254711111111', phone_verified_at = :n WHERE id = :u", { u: wanjiku, n: new Date().toISOString() });
    const preview = previewInvite(ctx, invite.code, wanjiku);
    expect(preview.seats.map((s) => s.name)).toEqual(["Wanjiku"]);
    expect(acceptInvite(ctx, invite.code, wanjiku).alreadyMember).toBe(false);
  });
});
