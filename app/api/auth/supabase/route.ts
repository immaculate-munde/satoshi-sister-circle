import { NextResponse } from "next/server";
import { z } from "zod";
import { api, parseBody, rateLimit } from "@/lib/api/http";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { verifySupabaseToken } from "@/lib/auth/supabase-server";
import { id, nowIso, one, run } from "@/lib/db";

const body = z.object({
  accessToken: z.string().min(20).max(4000),
  /** Used only when the account has no name yet (email sign-up form). */
  displayName: z.string().trim().min(1).max(40).optional(),
});

/** Exchange a verified Supabase session for this app's own session cookie, creating the user on first sign-in. */
export const POST = api(
  async ({ ctx, req }) => {
    rateLimit(req, "signin-supabase", 30, 60_000);
    const input = await parseBody(req, body);
    const who = await verifySupabaseToken(input.accessToken);

    let user = await one<{ id: string }>(ctx.db, "SELECT id FROM users WHERE auth_user_id = :a", { a: who.authUserId });
    if (!user) {
      const userId = id();
      await run(
        ctx.db,
        "INSERT INTO users (id, display_name, is_demo, auth_user_id, email, created_at) VALUES (:id, :n, 0, :a, :e, :now)",
        { id: userId, n: input.displayName ?? who.name, a: who.authUserId, e: who.email, now: nowIso() },
      );
      user = { id: userId };
    }

    const s = await createSession(ctx.db, user.id);
    await setSessionCookie(s.token, s.maxAge);
    return NextResponse.json({ ok: true });
  },
  { mutation: true },
);
