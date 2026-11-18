import { config } from "../config";
import { getDb } from "../db";
import { getProvider } from "../payments";
import type { Ctx } from "./context";

/** Production context for route handlers, worker and scripts. */
export async function serverCtx(): Promise<Ctx> {
  const cfg = config();
  return {
    db: await getDb(),
    provider: await getProvider(),
    now: () => new Date(),
    limits: { maxPrincipalUnits: cfg.maxPrincipalUnits, maxFeeUnits: cfg.maxFeeUnits },
    receiptSecret: cfg.receiptSecret,
  };
}
