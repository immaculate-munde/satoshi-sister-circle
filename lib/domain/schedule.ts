// Africa/Nairobi is UTC+3 with no daylight saving, so calendar math can be done on a shifted clock.
const EAT_OFFSET_MS = 3 * 3600_000;

export type Frequency = "WEEKLY" | "MONTHLY" | "CUSTOM";

/** Due date of a given round (1-based), from the persisted first due date and frequency. */
export function dueAtForRound(firstDueAt: string, frequency: Frequency, round: number, customIntervalDays?: number | null): Date {
  const first = new Date(firstDueAt);
  const steps = round - 1;
  if (frequency === "WEEKLY") return new Date(first.getTime() + steps * 7 * 86400_000);
  if (frequency === "CUSTOM") {
    if (!customIntervalDays) throw new Error("customIntervalDays required");
    return new Date(first.getTime() + steps * customIntervalDays * 86400_000);
  }
  // Monthly: same EAT day-of-month, clamped to the month's last day.
  const local = new Date(first.getTime() + EAT_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + steps;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(local.getUTCDate(), lastDay);
  const shifted = Date.UTC(
    targetYear,
    targetMonth,
    day,
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
  );
  return new Date(shifted - EAT_OFFSET_MS);
}

/** Parse a YYYY-MM-DD date entered in EAT as 18:00 EAT on that day. */
export function eatDateToDueInstant(date: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error("Invalid date");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 18, 0, 0) - EAT_OFFSET_MS);
}

export function toEatDateString(d: Date): string {
  return new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
}
