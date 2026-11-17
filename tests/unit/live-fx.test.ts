import { afterEach, describe, expect, it } from "vitest";
import { liveUsdCentsPerKes, resetLiveRateForTests } from "@/lib/domain/live-fx";

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
