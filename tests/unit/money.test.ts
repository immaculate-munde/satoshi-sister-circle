import { describe, expect, it } from "vitest";
import { bps, convertFiatMinor, divRoundHalfUp, fiatMinorToUnits, formatFiat, formatUnits, parseUnits, splitExact, sum } from "@/lib/money";
import { DEMO_RATES } from "@/lib/domain/rates";
import { gbpMinorForKes } from "@/lib/domain/diaspora";

describe("money", () => {
  it("matches the Figma fixture: KES 5,000 = 3,220 sats, pot 9,660 sats", () => {
    const per = fiatMinorToUnits(500_000n, DEMO_RATES.KES_BTC_SAT);
    expect(per).toBe(3220n);
    expect(per * 3n).toBe(9660n);
  });

  it("converts KES to USD-stable cents deterministically", () => {
    expect(fiatMinorToUnits(500_000n, DEMO_RATES.KES_USD_CENT)).toBe(3870n);
  });

  it("rounds half-up deterministically, including negatives", () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(4n, 3n)).toBe(1n);
    expect(divRoundHalfUp(-5n, 2n)).toBe(-3n);
  });

  it("splits totals into parts that sum exactly", () => {
    const parts = splitExact(10n, 3);
    expect(parts).toEqual([4n, 3n, 3n]);
    expect(sum(parts)).toBe(10n);
  });

  it("computes the remittance benchmark: £30 at 3.4%-4.4% is £1.02-£1.32", () => {
    expect(bps(3000n, 340n)).toBe(102n);
    expect(bps(3000n, 440n)).toBe(132n);
  });

  it("£30 covers KES 5,000 at the demo GBP rate without under-covering", () => {
    const gbp = gbpMinorForKes(500_000n);
    expect(gbp).toBe(3000n);
    expect(convertFiatMinor(gbp, DEMO_RATES.GBP_KES) + 100n).toBeGreaterThanOrEqual(500_000n);
  });

  it("rejects non-integer amounts at JSON boundaries", () => {
    expect(() => parseUnits("12.5")).toThrow();
    expect(() => parseUnits(1.5)).toThrow();
    expect(parseUnits("3220")).toBe(3220n);
  });

  it("formats amounts", () => {
    expect(formatFiat(1_500_000n, "KES")).toBe("KES 15,000");
    expect(formatFiat(500_000n, "KES", { cents: true })).toBe("KES 5,000.00");
    expect(formatFiat(3000n, "GBP")).toBe("£30");
    expect(formatUnits(9660n, "BTC_SAT")).toBe("9,660 sats");
    expect(formatUnits(3870n, "USD_CENT")).toBe("$38.70 USD-stable");
  });
});
