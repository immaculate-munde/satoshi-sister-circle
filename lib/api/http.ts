import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { requireUser, type SessionUser } from "../auth/session";
import { one, run } from "../db";
import { DomainError } from "../domain/context";
import { serverCtx } from "../domain/server";
import type { Ctx } from "../domain/context";

export interface ApiContext<P = Record<string, string>> {
  ctx: Ctx;
  requestId: string;
  req: Request;
  params: P;
}

type Handler<P> = (a: ApiContext<P>) => Promise<Response>;

export function errorResponse(e: unknown, requestId: string) {
  if (e instanceof DomainError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, retryable: e.retryable }, requestId },
      { status: e.status },
    );
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      {
        error: { code: "VALIDATION", message: e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "), retryable: false },
        requestId,
      },
      { status: 400 },
    );
  }
  console.error(`[${requestId}]`, redact(String((e as Error)?.stack ?? e)));
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again.", retryable: true }, requestId },
    { status: 500 },
  );
}

export function redact(s: string) {
  return s.replace(/fk_[A-Za-z0-9_-]+/g, "fk_[redacted]").replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, "$1[redacted]");
}

/** Wrap a route handler with request id + structured errors. Mutations also get origin checks. */
export function api<P = Record<string, string>>(handler: Handler<P>, opts: { mutation?: boolean } = {}) {
  return async (req: Request, route: { params: Promise<P> }) => {
    const requestId = randomUUID();
    try {
      if (opts.mutation) assertSameOrigin(req);
      const params = (await route?.params) ?? ({} as P);
      const res = await handler({ ctx: await serverCtx(), requestId, req, params });
      res.headers.set("x-request-id", requestId);
      res.headers.set("cache-control", "no-store");
      return res;
    } catch (e) {
      return errorResponse(e, requestId);
    }
  };
}

/** CSRF defence for cookie-authenticated mutations: require a same-origin Origin (or Referer). */
export function assertSameOrigin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin || !host) throw new DomainError("BAD_ORIGIN", "Missing origin", 403);
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new DomainError("BAD_ORIGIN", "Bad origin", 403);
  }
  if (originHost !== host) throw new DomainError("BAD_ORIGIN", "Cross-site request blocked", 403);
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new DomainError("VALIDATION", "Request body must be JSON");
  }
  return schema.parse(json);
}

export async function authed(ctx: Ctx): Promise<SessionUser> {
  return requireUser(ctx.db);
}

// ---------- rate limiting (per process; put a shared limiter in front for multi-instance deploys) ----------
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, scope: string, limit: number, windowMs: number, subject?: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${scope}:${subject ?? ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > limit) {
    throw new DomainError("RATE_LIMITED", `Too many requests. Try again in ${Math.ceil((b.resetAt - now) / 1000)}s.`, 429, true);
  }
}

// ---------- idempotency ----------
export async function idempotent<P>(
  a: ApiContext<P>,
  userId: string,
  scope: string,
  fn: () => Promise<{ status: number; body: unknown }>,
): Promise<Response> {
  const key = a.req.headers.get("idempotency-key");
  if (key && !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new DomainError("VALIDATION", "Bad Idempotency-Key");
  if (key) {
    const prior = await one<{ response_status: number; response_json: string }>(
      a.ctx.db,
      "SELECT response_status, response_json FROM idempotency_keys WHERE user_id = :u AND scope = :s AND key = :k",
      { u: userId, s: scope, k: key },
    );
    if (prior) {
      return new NextResponse(prior.response_json, {
        status: prior.response_status,
        headers: { "content-type": "application/json", "idempotent-replay": "true" },
      });
    }
  }
  const { status, body } = await fn();
  const json = JSON.stringify(body);
  if (key && status < 500) {
    await run(
      a.ctx.db,
      `INSERT INTO idempotency_keys (user_id, scope, key, response_status, response_json, created_at)
       VALUES (:u, :s, :k, :st, :j, :now) ON CONFLICT DO NOTHING`,
      { u: userId, s: scope, k: key, st: status, j: json, now: new Date().toISOString() },
    );
  }
  return new NextResponse(json, { status, headers: { "content-type": "application/json" } });
}
