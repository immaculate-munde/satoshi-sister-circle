import { type Asset, formatFiat, formatUnits } from "../money";

export const kes = (minor: string | bigint, cents = false) => formatFiat(BigInt(minor), "KES", { cents });
export const gbp = (minor: string | bigint) => formatFiat(BigInt(minor), "GBP", { cents: true });
export const units = (u: string | bigint, asset: Asset) => formatUnits(BigInt(u), asset);

export function eat(iso: string | null | undefined, withTime = true) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", weekday: "short", day: "numeric", month: "short" }).format(d);
  if (!withTime) return date;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${date}, ${time} EAT`;
}

export function frequencyLabel(
  t: (k: "common.weekly" | "common.monthly" | "common.everyNDays", v?: Record<string, number>) => string,
  freq: string,
  days?: number | null,
) {
  return freq === "WEEKLY" ? t("common.weekly") : freq === "MONTHLY" ? t("common.monthly") : t("common.everyNDays", { n: days ?? 0 });
}

export function countdown(ms: number) {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
