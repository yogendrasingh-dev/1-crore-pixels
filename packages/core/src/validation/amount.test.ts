import { describe, expect, it } from "vitest";
import { amountRupeesSchema, rupeesToPaise, type AmountBounds } from "./amount";

const bounds: AmountBounds = { minPaise: 100n, maxPaise: 50_000_00n };

describe("amountRupeesSchema (docs/SECURITY.md §2)", () => {
  it("accepts the documented presets", () => {
    for (const preset of [1, 11, 51, 101, 501]) {
      expect(amountRupeesSchema(bounds).parse(preset)).toBe(rupeesToPaise(preset));
    }
  });

  it("accepts a valid custom whole-rupee amount", () => {
    expect(amountRupeesSchema(bounds).parse(2500)).toBe(250_000n);
  });

  it("rejects zero and negative amounts", () => {
    expect(() => amountRupeesSchema(bounds).parse(0)).toThrow();
    expect(() => amountRupeesSchema(bounds).parse(-5)).toThrow();
  });

  it("rejects non-numeric input", () => {
    expect(() => amountRupeesSchema(bounds).parse("101" as unknown as number)).toThrow();
  });

  it("rejects a fractional-rupee amount, since ₹1 = 1 pixel exactly (docs/PIXEL_SYSTEM.md §1)", () => {
    expect(() => amountRupeesSchema(bounds).parse(10.5)).toThrow();
  });

  it("rejects amounts below the configured minimum", () => {
    expect(() => amountRupeesSchema(bounds).parse(0.5)).toThrow();
  });

  it("rejects amounts above the configured maximum", () => {
    expect(() => amountRupeesSchema(bounds).parse(50_001)).toThrow();
  });

  it("never silently clamps an out-of-range amount", () => {
    const result = amountRupeesSchema(bounds).safeParse(50_001);
    expect(result.success).toBe(false);
  });
});
