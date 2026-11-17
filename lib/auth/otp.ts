import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { config } from "../config";
import { type Db, id, many, one, run } from "../db";
import { DomainError } from "../domain/context";

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

interface Challenge {
  id: string;
  phone: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
  created_at: string;
}

const hash = (challengeId: string, code: string) => createHmac("sha256", config().sessionSecret).update(`${challengeId}:${code}`).digest("hex");

/** Create a fresh one-time code for a phone. Returns the plaintext code to be sent by SMS (never stored). */
export function createOtp(db: Db, phone: string, now: Date): string {
  const recent = many<Challenge>(db, "SELECT * FROM otp_challenges WHERE phone = :p AND created_at > :since ORDER BY created_at DESC", {
    p: phone,
    since: new Date(now.getTime() - 3600_000).toISOString(),
  });
  if (recent.length >= MAX_PER_HOUR) {
    throw new DomainError("RATE_LIMITED", "Too many codes requested for this number. Try again later.", 429, true);
  }
  if (recent[0] && now.getTime() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_MS) {
    throw new DomainError("RATE_LIMITED", "Please wait a minute before asking for another code.", 429, true);
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const cid = id();
  run(db, "INSERT INTO otp_challenges (id, phone, code_hash, expires_at, created_at) VALUES (:id, :p, :h, :exp, :now)", {
    id: cid,
    p: phone,
    h: hash(cid, code),
    exp: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    now: now.toISOString(),
  });
  return code;
}

/** Check a code against the latest challenge. Single use, expires, and locks after too many wrong guesses. */
export function consumeOtp(db: Db, phone: string, code: string, now: Date): void {
  const bad = new DomainError("BAD_CODE", "That code is not right or has expired.", 401);
  const ch = one<Challenge>(db, "SELECT * FROM otp_challenges WHERE phone = :p ORDER BY created_at DESC LIMIT 1", { p: phone });
  if (!ch || ch.consumed_at || new Date(ch.expires_at) <= now || ch.attempts >= MAX_ATTEMPTS) throw bad;
  run(db, "UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = :id", { id: ch.id });
  const a = Buffer.from(hash(ch.id, code.trim()));
  const b = Buffer.from(ch.code_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw bad;
  run(db, "UPDATE otp_challenges SET consumed_at = :now WHERE id = :id AND consumed_at IS NULL", { id: ch.id, now: now.toISOString() });
}
