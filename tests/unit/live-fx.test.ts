import { afterEach, describe, expect, it } from "vitest";
import { liveUsdCentsPerKes, resetLiveRateForTests } from "@/lib/domain/live-fx";
import { loadConfig } from "@/lib/config";

afterEach(() => resetLiveRateForTests(null));

describe("live FX", () => {
  it("refuses to quote with no cached rate (never falls back to demo)", () => {
    expect(() => liveUsdCentsPerKes()).toThrow(/unavailable/i);
  });
  it("converts KES per USD to USD cents per KES", () => {
    resetLiveRateForTests({ kesPerUsd: 129.2, fetchedAt: Date.now() });
    expect(liveUsdCentsPerKes().rate).toBe("0.773994");
  });
  it("rejects a stale rate", () => {
    resetLiveRateForTests({ kesPerUsd: 129.2, fetchedAt: Date.now() - 7 * 3600_000 });
    expect(() => liveUsdCentsPerKes()).toThrow();
  });
});

describe("production config", () => {
  const base = {
    NODE_ENV: "production" as const,
    PAYMENTS_PROVIDER: "flash", NEXT_PUBLIC_DEMO_MODE: "false", FLASH_API_KEY: "k", FLASH_USD_WALLET_ID: "w",
    FLASH_GRAPHQL_URL: "https://api.flashapp.me/graphql", AUTH_PASSCODE: "a-long-passcode-123", FX_PROVIDER: "live",
    SESSION_SECRET: "s".repeat(32), INTERNAL_WORKER_SECRET: "i".repeat(32), RECEIPT_SIGNING_SECRET: "r".repeat(32),
  };
  it("needs an explicit opt-in for the production endpoint", () => {
    expect(loadConfig(base).problems.join()).toMatch(/FLASH_ALLOW_PRODUCTION/);
    const ok = loadConfig({ ...base, FLASH_ALLOW_PRODUCTION: "true" });
    expect(ok.problems).toEqual([]);
    expect(ok.liveFunds).toBe(true);
    expect(ok.bitcoinEnabled).toBe(false);
  });
  it("requires live FX with real funds", () => {
    expect(loadConfig({ ...base, FLASH_ALLOW_PRODUCTION: "true", FX_PROVIDER: "demo" }).problems.join()).toMatch(/FX_PROVIDER=live/);
  });
});
