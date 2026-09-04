// ManualUpiProvider — docs/PAYMENT.md §4.1. Implemented in Phase 3 (docs/TASKS.md T3.2).
import QRCode from "qrcode";
import { prisma, type Contribution, type DbClient } from "@1crore-pixels/db";
import type { PaymentProvider, PaymentRequest } from "../types";

/**
 * `tr` is the contribution's `public_code`, not the contributor's name — the QR
 * identifies the payment/contribution transaction (docs/PAYMENT.md §4.1, PRD §11).
 */
export function buildUpiDeepLink(params: {
  vpa: string;
  payeeName: string;
  amountPaise: bigint;
  publicCode: string;
}): string {
  const amountRupees = params.amountPaise / BigInt(100);
  const query = new URLSearchParams({
    pa: params.vpa,
    pn: params.payeeName,
    am: `${amountRupees}.00`,
    tr: params.publicCode,
    cu: "INR",
  });
  return `upi://pay?${query.toString()}`;
}

export const manualUpiProvider: PaymentProvider = {
  async createPaymentRequest(
    contribution: Contribution,
    db: DbClient = prisma,
  ): Promise<PaymentRequest> {
    const vpa = process.env.UPI_VPA;
    const payeeName = process.env.UPI_PAYEE_NAME;
    if (!vpa || !payeeName) {
      throw new Error("UPI_VPA and UPI_PAYEE_NAME must be configured");
    }

    const upiDeepLink = buildUpiDeepLink({
      vpa,
      payeeName,
      amountPaise: contribution.amountPaise,
      publicCode: contribution.publicCode,
    });
    const qrImageUrl = await QRCode.toDataURL(upiDeepLink);

    const payment = await db.payment.create({
      data: {
        contributionId: contribution.id,
        provider: "manual",
        amountPaise: contribution.amountPaise,
        status: "PENDING",
      },
    });

    return { payment, upiDeepLink, qrImageUrl };
  },
};
