import { config } from "../config";
import { getDb } from "../db";
import { getProvider } from "../payments";
import type { Ctx } from "./context";

/** Production context for route handlers, worker and scripts. */
export function serverCtx(): Ctx {
  const cfg = config();
  return {
    db: getDb(),
    provider: getProvider(),
    now: () => new Date(),
    limits: { maxPrincipalUnits: cfg.maxPrincipalUnits, maxFeeUnits: cfg.maxFeeUnits },
    receiptSecret: cfg.receiptSecret,
  };
}
