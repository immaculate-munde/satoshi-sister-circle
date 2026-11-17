import { type Db, id, one, run } from "../db";
import type { Asset } from "../money";

import { config } from "../config";
import { DomainError } from "./context";
import { LIVE_FX_SOURCE, liveUsdCentsPerKes } from "./live-fx";
import { DEMO_FX_SOURCE, DEMO_RATES } from "./rates";

export { DEMO_FX_SOURCE, DEMO_RATES };

export interface FxQuoteRow {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate_decimal: string;
  source: string;
  fetched_at: string;
  valid_until: string;
  mode: "LIVE" | "DEMO";
  rounding_rule: string;
}

type Pair = "KES/BTC_SAT" | "KES/USD_CENT" | "GBP/KES";

/** Rate for a pair under the configured FX provider. Live mode supports KES/USD only; the rest refuse. */
export function rateFor(pair: Pair, nowMs = Date.now()): { rate: string; source: string; mode: "LIVE" | "DEMO"; fetchedAt?: string } {
  if (config().fxProvider === "live") {
    if (pair !== "KES/USD_CENT") {
      throw new DomainError("NOT_AVAILABLE", "This currency is not available yet", 400);
    }
    const live = liveUsdCentsPerKes(nowMs);
    return { rate: live.rate, source: LIVE_FX_SOURCE, mode: "LIVE", fetchedAt: live.fetchedAt };
  }
  const rate = pair === "KES/BTC_SAT" ? DEMO_RATES.KES_BTC_SAT : pair === "KES/USD_CENT" ? DEMO_RATES.KES_USD_CENT : DEMO_RATES.GBP_KES;
  return { rate, source: DEMO_FX_SOURCE, mode: "DEMO" };
}

export function createQuote(db: Db, now: Date, pair: Pair, validSeconds: number): FxQuoteRow {
  const [base, quote] = pair.split("/");
  const r = rateFor(pair, now.getTime());
  const rate = r.rate;
  const row: FxQuoteRow = {
    id: id(),
    base_currency: base,
    quote_currency: quote,
    rate_decimal: rate,
    source: r.source,
    fetched_at: r.fetchedAt ?? now.toISOString(),
    valid_until: new Date(now.getTime() + validSeconds * 1000).toISOString(),
    mode: r.mode,
    rounding_rule: "HALF_UP_PER_OBLIGATION",
  };
  run(
    db,
    `INSERT INTO fx_quotes (id, base_currency, quote_currency, rate_decimal, source, fetched_at, valid_until, mode, rounding_rule)
     VALUES (:id, :b, :q, :r, :s, :f, :v, :m, :rr)`,
    {
      id: row.id,
      b: row.base_currency,
      q: row.quote_currency,
      r: row.rate_decimal,
      s: row.source,
      f: row.fetched_at,
      v: row.valid_until,
      m: row.mode,
      rr: row.rounding_rule,
    },
  );
  return row;
}

export function settlementPair(asset: Asset) {
  return asset === "BTC_SAT" ? ("KES/BTC_SAT" as const) : ("KES/USD_CENT" as const);
}

export function getQuote(db: Db, quoteId: string): FxQuoteRow {
  const q = one<FxQuoteRow>(db, "SELECT * FROM fx_quotes WHERE id = :id", { id: quoteId });
  if (!q) throw new Error(`Missing quote ${quoteId}`);
  return q;
}
