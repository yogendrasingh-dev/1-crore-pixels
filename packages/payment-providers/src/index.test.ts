import { describe, expect, it } from "vitest";
import * as paymentProviders from "./index";

describe("@1crore-pixels/payment-providers scaffold", () => {
  it("loads without throwing", () => {
    expect(paymentProviders).toBeDefined();
  });
});
