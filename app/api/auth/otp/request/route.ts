import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { api, parseBody, rateLimit } from "@/lib/api/http";
import { createOtp } from "@/lib/auth/otp";
import { normalizePhone } from "@/lib/auth/phone";
import { sendSms } from "@/lib/auth/sms";
import { config } from "@/lib/config";
import { one } from "@/lib/db";
import { DomainError } from "@/lib/domain/context";

const body = z.object({ phone: z.string().trim().min(7).max(20), passcode: z.string().max(200).optional() });

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Step 1 of phone sign-in: text a one-time code. With real money the pilot passcode is also required, so strangers
 * cannot spend the SMS budget or create accounts. Reports whether the number is new so the UI can ask for a name.
 */
export const POST = api(
  async ({ ctx, req }) => {
    rateLimit(req, "otp-request", 10, 60_000);
    const cfg = config();
    const input = await parseBody(req, body);
    if (!cfg.demo && !safeEqual(input.passcode ?? "", cfg.authPasscode)) {
      throw new DomainError("BAD_PASSCODE", "That passcode is not right", 401);
    }
    const phone = normalizePhone(input.phone);
    if (!phone) throw new DomainError("BAD_PHONE", "Enter a valid phone number, for example 0712 345 678", 400);
    rateLimit(req, "otp-request-phone", 5, 3600_000, phone);
    const code = createOtp(ctx.db, phone, ctx.now());
    await sendSms(phone, `Chama on Lightning code: ${code}. It expires in 10 minutes. Do not share it.`);
    const existing = one<{ id: string }>(ctx.db, "SELECT id FROM users WHERE phone = :p", { p: phone });
    return NextResponse.json({ ok: true, isNew: !existing });
  },
  { mutation: true },
);
