import { describe, expect, it } from "vitest";
import { buildUpiDeepLink } from "./index";

describe("buildUpiDeepLink", () => {
  it("encodes pa/pn/am/tr/cu with tr set to the contribution's public_code", () => {
    const link = buildUpiDeepLink({
      vpa: "campaign@upi",
      payeeName: "1 Crore Pixels",
      amountPaise: 10_100n,
      publicCode: "C_82931",
    });

    const [scheme, query] = link.split("?");
    const params = new URLSearchParams(query);

    expect(scheme).toBe("upi://pay");
    expect(params.get("pa")).toBe("campaign@upi");
    expect(params.get("pn")).toBe("1 Crore Pixels");
    expect(params.get("am")).toBe("101.00");
    expect(params.get("tr")).toBe("C_82931");
    expect(params.get("cu")).toBe("INR");
  });

  it("only ever produces a whole-rupee amount, since contribution amounts are whole rupees", () => {
    const link = buildUpiDeepLink({
      vpa: "campaign@upi",
      payeeName: "1 Crore Pixels",
      amountPaise: 100n,
      publicCode: "C_1",
    });

    expect(new URLSearchParams(link.split("?")[1]).get("am")).toBe("1.00");
  });
});
