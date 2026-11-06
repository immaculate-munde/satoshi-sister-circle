import { config } from "../config";
import { getDb } from "../db";
import { DemoProvider } from "./demo";
import { FlashProvider } from "./flash";
import type { PaymentsProvider } from "./provider";

let provider: PaymentsProvider | null = null;

/** Server-only. Never silently falls back from Flash to demo. */
export function getProvider(): PaymentsProvider {
  if (provider) return provider;
  const cfg = config();
  if (cfg.mode === "flash") {
    provider = new FlashProvider({
      graphqlUrl: cfg.flash.graphqlUrl,
      apiKey: cfg.flash.apiKey,
      btcWalletId: cfg.flash.btcWalletId,
      usdWalletId: cfg.flash.usdWalletId,
      network: cfg.flash.network,
    });
  } else {
    provider = new DemoProvider(getDb());
  }
  return provider;
}

export type { PaymentsProvider } from "./provider";
