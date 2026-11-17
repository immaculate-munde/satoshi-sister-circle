import { DomainError } from "./context";

/**
 * Live KES/USD rate for real-money mode. Source: open.er-api.com (free, no key, refreshed daily upstream).
 * Quotes are synchronous (they run inside DB transactions), so the rate is fetched ahead of time into a
 * process-local cache by ensureLiveRate(), which API routes and the worker call. If no fresh rate is
 * available, creating a quote fails loudly: we never fall back to the demo fixture with real money.
 */
const SOURCE_URL = "https://open.er-api.com/v6/latest/USD";
const REFRESH_AFTER_MS = 10 * 60_000;
const MAX_AGE_MS = 6 * 60 * 60_000;

export const LIVE_FX_SOURCE = "open.er-api.com (daily reference rate; not a remittance quote)";

let cache: { kesPerUsd: number; fetchedAt: number } | null = null;
let inflight: Promise<void> | null = null;

export async function ensureLiveRate(force = false): Promise<void> {
  if (!force && cache && Date.now() - cache.fetchedAt < REFRESH_AFTER_MS) return;
  inflight ??= (async () => {
    try {
      const res = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
      const kes = body.rates?.KES;
      // Sanity bounds: a bad upstream value must never price real invoices.
      if (body.result !== "success" || typeof kes !== "number" || !(kes > 50 && kes < 300)) {
        throw new Error("unexpected response");
      }
      cache = { kesPerUsd: kes, fetchedAt: Date.now() };
    } catch (e) {
      console.warn(`[fx] live rate refresh failed: ${(e as Error).message}`);
    } finally {
      inflight = null;
    }
  })();
  await inflight;
}

/** USD cents per 1 KES as a decimal string, from the cache. Throws if missing or stale. */
export function liveUsdCentsPerKes(now = Date.now()): { rate: string; fetchedAt: string } {
  if (!cache || now - cache.fetchedAt > MAX_AGE_MS) {
    throw new DomainError("FX_UNAVAILABLE", "Live exchange rate is unavailable right now. Please try again in a minute.", 503, true);
  }
  return { rate: (100 / cache.kesPerUsd).toFixed(6), fetchedAt: new Date(cache.fetchedAt).toISOString() };
}

export function resetLiveRateForTests(v: { kesPerUsd: number; fetchedAt: number } | null) {
  cache = v;
}
