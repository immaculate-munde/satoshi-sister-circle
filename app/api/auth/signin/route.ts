import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { api, parseBody, rateLimit } from "@/lib/api/http";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { id, nowIso, one, run } from "@/lib/db";
import { DomainError } from "@/lib/domain/context";

const body = z.union([
  z.object({ personaId: z.string().uuid() }),
  z.object({ displayName: z.string().trim().min(1).max(40), passcode: z.string().max(200).optional() }),
]);

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Demo mode: pick a seeded persona or create a demo user by name (no real money exists).
 * Flash test mode: name + shared deployment passcode. Phone OTP is on the roadmap.
 */
export const POST = api(
  async ({ ctx, req }) => {
    rateLimit(req, "signin", 20, 60_000);
    const cfg = config();
    const input = await parseBody(req, body);
    let userId: string;
    if ("personaId" in input) {
      if (!cfg.demo) throw new DomainError("FORBIDDEN", "Demo personas are disabled", 403);
      const u = await one<{ id: string }>(ctx.db, "SELECT id FROM users WHERE id = :id AND is_demo = 1", { id: input.personaId });
      if (!u) throw new DomainError("NOT_FOUND", "Persona not found", 404);
      userId = u.id;
    } else {
      if (!cfg.demo && !safeEqual(input.passcode ?? "", cfg.authPasscode)) {
        throw new DomainError("BAD_PASSCODE", "That passcode is not right", 401);
      }
      userId = id();
      await run(ctx.db, "INSERT INTO users (id, display_name, is_demo, created_at) VALUES (:id, :n, :d, :now)", {
        id: userId,
        n: input.displayName,
        d: cfg.demo ? 1 : 0,
        now: nowIso(),
      });
    }
    const s = await createSession(ctx.db, userId);
    await setSessionCookie(s.token, s.maxAge);
    return NextResponse.json({ ok: true });
  },
  { mutation: true },
);
