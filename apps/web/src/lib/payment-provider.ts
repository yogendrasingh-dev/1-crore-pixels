import { manualUpiProvider, type PaymentProvider } from "@1crore-pixels/payment-providers";
import { env } from "./env";

// apps/web depends only on the PaymentProvider interface, never a concrete provider
// directly — swapping providers is this one selection, not a rewrite (docs/PAYMENT.md §4.3).
function selectPaymentProvider(): PaymentProvider {
  switch (env.PAYMENT_PROVIDER) {
    case "manual":
      return manualUpiProvider;
    case "gateway":
      throw new Error("GatewayProvider is not implemented until Phase 12 (docs/TASKS.md T12.1)");
  }
}

export const paymentProvider: PaymentProvider = selectPaymentProvider();
