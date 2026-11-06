// Exact money math. Never use floating point for balances or settlement units.
// Amounts cross JSON boundaries as validated integer decimal strings.

export type Asset = "BTC_SAT" | "USD_CENT";
export type Fiat = "KES" | "GBP" | "USD";

export const ASSETS: readonly Asset[] = ["BTC_SAT", "USD_CENT"] as const;

const INT_RE = /^-?\d+$/;
const DEC_RE = /^\d+(\.\d+)?$/;

export function parseUnits(value: string | number | bigint, field = "amount"): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`${field} must be a safe integer`);
    return BigInt(value);
  }
  if (!INT_RE.test(value)) throw new Error(`${field} must be an integer string`);
  return BigInt(value);
}

/** An exact decimal: value = num / 10^scale. */
export interface Decimal {
  num: bigint;
  scale: number;
}

export function parseDecimal(value: string): Decimal {
  if (!DEC_RE.test(value)) throw new Error(`Invalid decimal rate: ${value}`);
  const [whole, frac = ""] = value.split(".");
  return { num: BigInt(whole + frac), scale: frac.length };
}

export function decimalToString(d: Decimal): string {
  const neg = d.num < 0n;
  const s = (neg ? -d.num : d.num).toString().padStart(d.scale + 1, "0");
  const out = d.scale ? `${s.slice(0, -d.scale)}.${s.slice(-d.scale)}` : s;
  return neg ? `-${out}` : out;
}

/** Divide rounding half away from zero (deterministic, documented in receipts as "half-up"). */
export function divRoundHalfUp(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("Division by zero");
  const neg = n < 0n !== d < 0n;
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  const q = (an * 2n + ad) / (ad * 2n);
  return neg ? -q : q;
}

const pow10 = (n: number) => 10n ** BigInt(n);

/**
 * Convert a fiat amount in minor units (e.g. KES cents) to settlement units using an exact
 * "units per 1 major fiat unit" rate. e.g. 500000 KES minor * 0.644 sats/KES = 3220 sats.
 */
export function fiatMinorToUnits(fiatMinor: bigint, unitsPerMajor: string): bigint {
  const r = parseDecimal(unitsPerMajor);
  return divRoundHalfUp(fiatMinor * r.num, 100n * pow10(r.scale));
}

/** Inverse of fiatMinorToUnits, for display only. */
export function unitsToFiatMinor(units: bigint, unitsPerMajor: string): bigint {
  const r = parseDecimal(unitsPerMajor);
  if (r.num === 0n) throw new Error("Rate must be positive");
  return divRoundHalfUp(units * 100n * pow10(r.scale), r.num);
}

/** Convert between fiat minor units using "quote per 1 base" rate (e.g. 166.6667 KES per GBP). */
export function convertFiatMinor(baseMinor: bigint, quotePerBase: string): bigint {
  const r = parseDecimal(quotePerBase);
  return divRoundHalfUp(baseMinor * r.num, pow10(r.scale));
}

/** Basis-points percentage of a minor amount, e.g. pct(3000n, 340) = 102 (= £1.02 of £30). */
export function bps(amountMinor: bigint, basisPoints: bigint): bigint {
  return divRoundHalfUp(amountMinor * basisPoints, 10000n);
}

/**
 * Split a total into n parts that sum exactly to the total (largest-remainder, earliest positions
 * get the extra unit). Used so obligations always sum to the frozen pot target.
 */
export function splitExact(total: bigint, n: number): bigint[] {
  if (n <= 0) throw new Error("n must be positive");
  const base = total / BigInt(n);
  let rem = total - base * BigInt(n);
  return Array.from({ length: n }, () => {
    if (rem > 0n) {
      rem -= 1n;
      return base + 1n;
    }
    return base;
  });
}

export function sum(values: bigint[]): bigint {
  return values.reduce((a, b) => a + b, 0n);
}

function groupThousands(s: string): string {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Format minor fiat units: formatFiat(500000n,'KES') => "KES 5,000"; withCents => "KES 5,000.00". */
export function formatFiat(minor: bigint, currency: Fiat, opts: { cents?: boolean } = {}): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const major = groupThousands((abs / 100n).toString());
  const cents = (abs % 100n).toString().padStart(2, "0");
  const showCents = opts.cents ?? cents !== "00";
  const body = showCents ? `${major}.${cents}` : major;
  const prefix = currency === "GBP" ? "£" : currency === "USD" ? "$" : "KES ";
  return `${neg ? "-" : ""}${prefix}${body}`;
}

export function formatUnits(units: bigint, asset: Asset): string {
  if (asset === "BTC_SAT") return `${groupThousands(units.toString())} sats`;
  const abs = units < 0n ? -units : units;
  return `${units < 0n ? "-" : ""}$${groupThousands((abs / 100n).toString())}.${(abs % 100n)
    .toString()
    .padStart(2, "0")} USD-stable`;
}

export function assetLabel(asset: Asset): string {
  return asset === "BTC_SAT" ? "Bitcoin" : "USD-stable";
}
