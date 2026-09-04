import type { Payment } from "@1crore-pixels/db";
import type { PaymentProvider } from "@1crore-pixels/payment-providers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "../test-support/fixtures";
import { requestPaymentQr } from "./qr";

function fakeProvider(): PaymentProvider {
  return {
    createPaymentRequest: vi.fn(async () => ({
      payment: {} as Payment,
      upiDeepLink: "upi://pay?pa=test@upi&pn=Test&am=1.00&tr=C_1&cu=INR",
      qrImageUrl: "data:image/png;base64,test",
    })),
  };
}

describe("requestPaymentQr (docs/API.md §2.2)", () => {
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    fixture = undefined;
  });

  it("transitions CREATED -> PAYMENT_PENDING and returns the provider's payment request", async () => {
    fixture = await createTestContribution({ status: "CREATED" });
    const provider = fakeProvider();

    const result = await requestPaymentQr(fixture.contribution.id, provider);

    expect(result).not.toBeNull();
    expect(result?.contribution.status).toBe("PAYMENT_PENDING");
    expect(result?.contribution.expiresAt).toBeInstanceOf(Date);
    expect(result?.paymentRequest.upiDeepLink).toContain("upi://pay");
    expect(provider.createPaymentRequest).toHaveBeenCalledOnce();
  });

  it("allows re-requesting a QR while still PAYMENT_PENDING", async () => {
    fixture = await createTestContribution({ status: "PAYMENT_PENDING" });
    const provider = fakeProvider();

    const result = await requestPaymentQr(fixture.contribution.id, provider);

    expect(result?.contribution.status).toBe("PAYMENT_PENDING");
  });

  it("is a no-op for a contribution that is already past PAYMENT_PENDING", async () => {
    fixture = await createTestContribution({ status: "VERIFYING" });
    const provider = fakeProvider();

    const result = await requestPaymentQr(fixture.contribution.id, provider);

    expect(result).toBeNull();
    expect(provider.createPaymentRequest).not.toHaveBeenCalled();
  });

  it("returns null for an unknown contribution id", async () => {
    const provider = fakeProvider();
    const result = await requestPaymentQr(999_999_999_999n, provider);
    expect(result).toBeNull();
  });
});
