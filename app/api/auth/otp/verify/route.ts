import { NextResponse } from "next/server";
import { z } from "zod";
import { api, parseBody, rateLimit } from "@/lib/api/http";
import { consumeOtp } from "@/lib/auth/otp";
import { normalizePhone } from "@/lib/auth/phone";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { id, nowIso, one, run } from "@/lib/db";
import { DomainError } from "@/lib/domain/context";

const body = z.object({
  phone: z.string().trim().min(7).max(20),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  displayName: z.string().trim().min(1).max(40).optional(),
});

/** Step 2: check the code, then sign in to the account that owns this number (creating it the first time). */
export const POST = api(
  async ({ ctx, req }) => {
    rateLimit(req, "otp-verify", 20, 60_000);
    const input = await parseBody(req, body);
    const phone = normalizePhone(input.phone);
    if (!phone) throw new DomainError("BAD_PHONE", "Enter a valid phone number", 400);
    const existing = one<{ id: string }>(ctx.db, "SELECT id FROM users WHERE phone = :p", { p: phone });
    if (!existing && !input.displayName) throw new DomainError("NAME_REQUIRED", "Tell us your name to finish creating your account", 400);
    consumeOtp(ctx.db, phone, input.code, ctx.now());
    let userId = existing?.id;
    if (!userId) {
      userId = id();
      run(
        ctx.db,
        "INSERT INTO users (id, display_name, phone, phone_verified_at, is_demo, created_at) VALUES (:id, :n, :p, :now, :d, :now)",
        { id: userId, n: input.displayName!, p: phone, now: nowIso(), d: config().demo ? 1 : 0 },
      );
    } else {
      run(ctx.db, "UPDATE users SET phone_verified_at = COALESCE(phone_verified_at, :now) WHERE id = :id", { id: userId, now: nowIso() });
    }
    const s = createSession(ctx.db, userId);
    await setSessionCookie(s.token, s.maxAge);
    return NextResponse.json({ ok: true });
  },
  { mutation: true },
);
