import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "../config";
import { type Db, id, one, run } from "../db";
import { DomainError } from "../domain/context";

export const SESSION_COOKIE = "chama_session";
const SESSION_TTL_MS = 7 * 86400_000;

export interface SessionUser {
  id: string;
  displayName: string;
  locale: string;
  isDemo: boolean;
}

function hashToken(token: string) {
  return createHmac("sha256", config().sessionSecret).update(token).digest("hex");
}

export async function createSession(db: Db, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await run(
    db,
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (:id, :u, :h, :exp, :now)",
    { id: id(), u: userId, h: hashToken(token), exp: new Date(now.getTime() + SESSION_TTL_MS).toISOString(), now: now.toISOString() },
  );
  return { token, maxAge: SESSION_TTL_MS / 1000 };
}

export async function setSessionCookie(token: string, maxAge: number) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function destroySession(db: Db) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await run(db, "DELETE FROM sessions WHERE token_hash = :h", { h: hashToken(token) });
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(db: Db): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await one<{ id: string; display_name: string; locale: string; is_demo: number; expires_at: string }>(
    db,
    `SELECT u.id, u.display_name, u.locale, u.is_demo, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = :h`,
    { h: hashToken(token) },
  );
  if (!row || new Date(row.expires_at) <= new Date()) return null;
  return { id: row.id, displayName: row.display_name, locale: row.locale, isDemo: Boolean(row.is_demo) };
}

export async function requireUser(db: Db): Promise<SessionUser> {
  const u = await currentUser(db);
  if (!u) throw new DomainError("UNAUTHENTICATED", "Please sign in", 401);
  return u;
}
