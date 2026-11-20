import { parseStatement } from "./parse";
import { buildProfile } from "./profile";
import type { FinancialProfile } from "./schema";

/** Read pasted M-Pesa SMS or statement text on the device. Nothing is uploaded. */
export function readStatement(text: string): { profile: FinancialProfile; count: number } {
  const transactions = parseStatement({ text, source: "mpesa_pdf" });
  if (transactions.length === 0) {
    throw new Error("unreadable");
  }
  return { profile: buildProfile({ transactions }), count: transactions.length };
}

/** A round monthly habit that stays under the surplus floor. */
export function habitAmount(profile: FinancialProfile): number | null {
  if (profile.surplus.bufferFirst || profile.resilience.bufferFirst) return null;
  const floor = profile.surplus.monthlyKes.floor;
  if (floor < 100) return null;
  const amount = Math.min(10_000, Math.floor((floor * 0.75) / 50) * 50);
  return amount >= 50 ? amount : null;
}
