import { type Db, many, nowIso, run } from "../db";

export type RatePair = "KES/BTC_SAT" | "KES/USD_CENT" | "GBP/KES";

/** Rates older than this are treated as unavailable and quotes fall back to labelled demo rates. */
export const MAX_RATE_AGE_MS = 15 * 60_000;
const REFRESH_AFTER_MS = 5 * 60_000;
const SOURCE = "open.er-api.com (USD/KES/GBP) + Coinbase spot (BTC/USD)";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

/** Fetch from the public APIs (no keys) and derive the three pairs we quote. */
export async function fetchLiveRates(): Promise<Record<RatePair, string>> {
  const [fx, btc] = (await Promise.all([
    getJson("https://open.er-api.com/v6/latest/USD"),
    getJson("https://api.coinbase.com/v2/prices/BTC-USD/spot"),
  ])) as [{ result?: string; rates?: Record<string, number> }, { data?: { amount?: string } }];
  const kesPerUsd = fx.rates?.KES;
  const gbpPerUsd = fx.rates?.GBP;
  const btcUsd = Number(btc.data?.amount);
  if (!kesPerUsd || !gbpPerUsd || !Number.isFinite(btcUsd) || btcUsd <= 0) throw new Error("Rate API returned incomplete data");
  return {
    "KES/USD_CENT": (100 / kesPerUsd).toFixed(6), // US cents per KES
    "KES/BTC_SAT": (1e8 / (btcUsd * kesPerUsd)).toFixed(6), // sats per KES
    "GBP/KES": (kesPerUsd / gbpPerUsd).toFixed(4), // KES per GBP
  };
}

export async function readCachedRate(db: Db, pair: RatePair, now: Date) {
  const row = await (await many<{ rate_decimal: string; source: string; fetched_at: string }>(
    db,
    "SELECT rate_decimal, source, fetched_at FROM fx_rate_cache WHERE pair = :p",
    { p: pair },
  ))[0];
  if (!row) return undefined;
  if (now.getTime() - new Date(row.fetched_at).getTime() > MAX_RATE_AGE_MS) return undefined;
  return row;
}

/** Refresh the cache if it is older than 5 minutes. Never throws: on failure the old/demo rate path applies. */
export async function ensureFreshRates(db: Db, now: Date = new Date()): Promise<void> {
  const newest = await (await many<{ fetched_at: string }>(db, "SELECT MAX(fetched_at) AS fetched_at FROM fx_rate_cache"))[0]?.fetched_at;
  if (newest && now.getTime() - new Date(newest).getTime() < REFRESH_AFTER_MS) return;
  try {
    const rates = await fetchLiveRates();
    const at = nowIso(now);
    for (const [pair, rate] of Object.entries(rates)) {
      await run(
        db,
        `INSERT INTO fx_rate_cache (pair, rate_decimal, source, fetched_at) VALUES (:p, :r, :s, :f)
         ON CONFLICT(pair) DO UPDATE SET rate_decimal = :r, source = :s, fetched_at = :f`,
        { p: pair, r: rate, s: SOURCE, f: at },
      );
    }
  } catch (e) {
    console.warn(`[fx] live rate refresh failed: ${(e as Error).message}`);
  }
}
