import { describe, expect, it } from "vitest";
import { CAMPAIGN_GOAL_PAISE, CAMPAIGN_GOAL_RUPEES } from "./goal";

describe("campaign goal constant (PRD §1-2)", () => {
  it("is exactly ₹1 crore", () => {
    expect(CAMPAIGN_GOAL_RUPEES).toBe(10_000_000);
    expect(CAMPAIGN_GOAL_PAISE).toBe(1_000_000_000n);
  });
});
