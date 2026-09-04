// Payment-attempt/QR creation — docs/API.md §2.2, docs/PAYMENT.md §2.1
// (`CREATED/PAYMENT_PENDING -> PAYMENT_PENDING`). Depends only on the `PaymentProvider`
// interface (docs/PAYMENT.md §4.3), never a concrete provider.
import { prisma, type Contribution, type PrismaClient } from "@1crore-pixels/db";
import type { PaymentProvider, PaymentRequest } from "@1crore-pixels/payment-providers";
import { markPaymentPending } from "../state-machine";

/** Not specified by the PRD; a reasonable engineering default (docs/PAYMENT.md §6 Open Decision #2 territory). */
export function getQrExpiryMinutes(): number {
  return Number(process.env.PAYMENT_QR_EXPIRY_MINUTES ?? 15);
}

export interface QrRequestResult {
  contribution: Contribution;
  paymentRequest: PaymentRequest;
}

/**
 * Re-requesting a QR for an unpaid, non-expired contribution is allowed (docs/API.md §2.2 —
 * e.g. the user refreshed the page), so `CREATED` and `PAYMENT_PENDING` are both valid guards;
 * anything else (already paid, expired, etc.) returns `null`.
 */
export async function requestPaymentQr(
  contributionId: bigint,
  provider: PaymentProvider,
  db: PrismaClient = prisma,
): Promise<QrRequestResult | null> {
  return db.$transaction(async (tx) => {
    const contribution = await tx.contribution.findUnique({ where: { id: contributionId } });
    if (!contribution) return null;
    if (contribution.status !== "CREATED" && contribution.status !== "PAYMENT_PENDING") return null;

    const paymentRequest = await provider.createPaymentRequest(contribution, tx);
    const expiresAt = new Date(Date.now() + getQrExpiryMinutes() * 60_000);
    const updated =
      contribution.status === "CREATED"
        ? await markPaymentPending(contributionId, expiresAt, tx)
        : await tx.contribution.update({ where: { id: contributionId }, data: { expiresAt } });
    if (!updated) return null;

    return { contribution: updated, paymentRequest };
  });
}
