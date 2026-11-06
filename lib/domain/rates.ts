/**
 * Labelled DEMO rates taken from the Figma fixtures. They are NOT a market feed.
 * - 0.644 sats per KES  => KES 5,000 = 3,220 sats, pot KES 15,000 = 9,660 sats
 * - 0.7740 USD cents per KES (about KES 129.20 per USD, illustrative)
 * - 166.6667 KES per GBP => GBP 30 = KES 5,000
 * Pure module: safe to import from client components.
 */
export const DEMO_RATES = {
  KES_BTC_SAT: "0.644",
  KES_USD_CENT: "0.7740",
  GBP_KES: "166.6667",
} as const;

export const DEMO_FX_SOURCE = "Figma demo fixture (illustrative, not a market rate)";
