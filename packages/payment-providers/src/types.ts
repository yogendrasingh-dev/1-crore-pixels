// PaymentProvider interface — docs/PAYMENT.md §4. Implemented in Phase 3 (docs/TASKS.md T3.1).
import type { Contribution, DbClient, Payment, PaymentStatus } from "@1crore-pixels/db";

export interface PaymentRequest {
  payment: Payment;
  upiDeepLink: string;
  qrImageUrl: string;
}

export interface RawWebhookRequest {
  headers: Record<string, string>;
  rawBody: string;
}

export interface NormalizedPaymentEvent {
  providerPaymentId: string;
  amountPaise: bigint;
  status: PaymentStatus;
}

export interface PaymentProvider {
  createPaymentRequest(contribution: Contribution, db?: DbClient): Promise<PaymentRequest>;

  // MVP (manual provider): not implemented — verification happens via the admin
  // action in docs/PAYMENT.md §3, not via provider callback.
  handleWebhook?(rawRequest: RawWebhookRequest): Promise<NormalizedPaymentEvent>;

  // Optional active status check (Phase 3 gateways that support polling).
  checkStatus?(payment: Payment, db?: DbClient): Promise<PaymentStatus>;
}
