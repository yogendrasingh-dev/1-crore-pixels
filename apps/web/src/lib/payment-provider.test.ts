import { manualUpiProvider } from "@1crore-pixels/payment-providers";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("paymentProvider selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("selects ManualUpiProvider by default (docs/PAYMENT.md §4.3)", async () => {
    const { paymentProvider } = await import("./payment-provider");
    expect(paymentProvider).toBe(manualUpiProvider);
  });

  it("throws for the not-yet-implemented gateway provider rather than silently proceeding", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "gateway");
    await expect(import("./payment-provider")).rejects.toThrow(/GatewayProvider/);
  });
});
