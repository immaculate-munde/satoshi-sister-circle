import { type Db, id, one, run } from "../db";
import type { Asset } from "../money";

import { config } from "../config";
import { readCachedRate } from "./live-rates";
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

export async function createQuote(db: Db, now: Date, pair: "KES/BTC_SAT" | "KES/USD_CENT" | "GBP/KES", validSeconds: number): Promise<FxQuoteRow> {
  const [base, quote] = pair.split("/");
  const live = config().fxProvider === "live" ? await readCachedRate(db, pair, now) : undefined;
  const rate = live
    ? live.rate_decimal
    : pair === "KES/BTC_SAT"
      ? DEMO_RATES.KES_BTC_SAT
      : pair === "KES/USD_CENT"
        ? DEMO_RATES.KES_USD_CENT
        : DEMO_RATES.GBP_KES;
  const row: FxQuoteRow = {
    id: id(),
    base_currency: base,
    quote_currency: quote,
    rate_decimal: rate,
    source: live ? live.source : DEMO_FX_SOURCE,
    fetched_at: live ? live.fetched_at : now.toISOString(),
    valid_until: new Date(now.getTime() + validSeconds * 1000).toISOString(),
    mode: live ? "LIVE" : "DEMO",
    rounding_rule: "HALF_UP_PER_OBLIGATION",
  };
  await run(
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

export async function getQuote(db: Db, quoteId: string): Promise<FxQuoteRow> {
  const q = await one<FxQuoteRow>(db, "SELECT * FROM fx_quotes WHERE id = :id", { id: quoteId });
  if (!q) throw new Error(`Missing quote ${quoteId}`);
  return q;
}
