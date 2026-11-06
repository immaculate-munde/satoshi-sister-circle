"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}

export async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "OFFLINE", "You're offline or the server can't be reached.", true);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error ?? {};
    if (res.status === 401 && typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname);
      // Outside React here, so a hard navigation is the only option.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/welcome?signin=1&next=${next}`);
    }
    throw new ApiError(res.status, err.code ?? "HTTP", err.message ?? `Request failed (${res.status})`, Boolean(err.retryable), json?.requestId);
  }
  return json as T;
}

/** Minimal data hook: fetch on mount, refetch on demand, optional polling. Keeps last good data when offline. */
export function useApi<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  const refetch = useCallback(async () => {
    const p = pathRef.current;
    if (!p) return;
    try {
      const d = await apiFetch<T>(p);
      if (pathRef.current === p) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e as ApiError);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    const tick = async () => {
      if (!cancelled) await refetch();
    };
    void tick();
    if (!opts.pollMs) return () => void (cancelled = true);
    const timer = setInterval(tick, opts.pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [path, opts.pollMs, refetch]);

  return { data, error, loading: !loaded, refetch };
}

/** Subscribe to the chama's SSE stream; calls onChange when the ledger sequence moves. */
export function useLedgerEvents(groupId: string | null, onChange: () => void) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!groupId) return;
    let last = -1;
    const es = new EventSource(`/api/chamas/${groupId}/events`);
    es.addEventListener("ledger", (ev) => {
      const { sequence } = JSON.parse((ev as MessageEvent).data) as { sequence: number };
      if (last !== -1 && sequence !== last) cb.current();
      last = sequence;
    });
    return () => es.close();
  }, [groupId]);
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const timer = setTimeout(update, 0);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
