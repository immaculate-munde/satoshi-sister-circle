import { describe, expect, it } from "vitest";
import { loadConfig } from "@/lib/config";
import { dueAtForRound, eatDateToDueInstant, toEatDateString } from "@/lib/domain/schedule";

describe("schedule (Africa/Nairobi)", () => {
  const first = eatDateToDueInstant("2026-11-06").toISOString();
  it("parses dates as 18:00 EAT", () => expect(first).toBe("2026-11-06T15:00:00.000Z"));
  it("weekly rounds follow Fri 6, 13, 20 Nov 2026", () => {
    expect([1, 2, 3].map((r) => toEatDateString(dueAtForRound(first, "WEEKLY", r)))).toEqual(["2026-11-06", "2026-11-13", "2026-11-20"]);
  });
  it("monthly clamps to month end", () => {
    const jan31 = eatDateToDueInstant("2027-01-31").toISOString();
    expect(toEatDateString(dueAtForRound(jan31, "MONTHLY", 2))).toBe("2027-02-28");
  });
  it("custom interval", () => expect(toEatDateString(dueAtForRound(first, "CUSTOM", 2, 10))).toBe("2026-11-16"));
});

describe("config validation", () => {
  it("demo mode runs without secrets", () => {
    expect(loadConfig({ NODE_ENV: "development" }).problems).toEqual([]);
  });
  it("flash mode rejects placeholders, simulation and mismatched badge", () => {
    const c = loadConfig({
      NODE_ENV: "development",
      PAYMENTS_PROVIDER: "flash",
      FLASH_API_KEY: "SET_LOCALLY_ONLY",
      ALLOW_SIMULATED_PAYMENTS: "true",
      NEXT_PUBLIC_DEMO_MODE: "true",
    });
    expect(c.problems.join("\n")).toMatch(/FLASH_API_KEY/);
    expect(c.problems.join("\n")).toMatch(/ALLOW_SIMULATED_PAYMENTS/);
    expect(c.problems.join("\n")).toMatch(/NEXT_PUBLIC_DEMO_MODE/);
    expect(c.allowSimulatedPayments).toBe(false);
  });
  it("refuses the production Flash endpoint", () => {
    const c = loadConfig({ NODE_ENV: "development", PAYMENTS_PROVIDER: "flash", FLASH_GRAPHQL_URL: "https://api.flashapp.me/graphql" });
    expect(c.problems.join("\n")).toMatch(/production/);
  });
});
