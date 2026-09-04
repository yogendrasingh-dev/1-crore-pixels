// Contribution state machine transitions — docs/PAYMENT.md §2.1. Implemented in Phase 2 (docs/TASKS.md T2.1).
//
// Every transition here is a single conditional UPDATE (`WHERE id = :id AND status = :from`)
// so that a guard failure — the contribution has already moved on, via a retry or a race —
// is a no-op (`null`) rather than an error implying state corruption. This is the same
// idempotency pattern the `VERIFYING -> PAID` step uses in the allocation transaction
// (docs/PIXEL_SYSTEM.md §2.3); it is intentionally not duplicated here as a standalone
// `VERIFYING -> PAID` function, since PAID may only ever be reached from inside that single
// allocation transaction (docs/PAYMENT.md §2.1 "these are never two separate transactions").
import {
  Prisma,
  prisma,
  type Contribution,
  type DbClient,
  type PrismaClient,
} from "@1crore-pixels/db";

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/** `CREATED -> PAYMENT_PENDING` (docs/PAYMENT.md §2.1). */
export async function markPaymentPending(
  contributionId: bigint,
  expiresAt: Date,
  db: DbClient = prisma,
): Promise<Contribution | null> {
  try {
    return await db.contribution.update({
      where: { id: contributionId, status: "CREATED" },
      data: { status: "PAYMENT_PENDING", expiresAt },
    });
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}

/** `PAYMENT_PENDING -> PAYMENT_EXPIRED` (docs/PAYMENT.md §2.1), guarded on `now() > expires_at`. */
export async function expirePayment(
  contributionId: bigint,
  db: DbClient = prisma,
): Promise<Contribution | null> {
  try {
    return await db.contribution.update({
      where: {
        id: contributionId,
        status: "PAYMENT_PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "PAYMENT_EXPIRED" },
    });
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}

/** `PAYMENT_PENDING -> PAYMENT_SUBMITTED` (docs/PAYMENT.md §2.1), recording the UTR-last-4 signal. */
export async function markPaymentSubmitted(
  contributionId: bigint,
  utrLast4: string,
  db: DbClient = prisma,
): Promise<Contribution | null> {
  try {
    return await db.contribution.update({
      where: { id: contributionId, status: "PAYMENT_PENDING" },
      data: { status: "PAYMENT_SUBMITTED", utrLast4, paymentSubmittedAt: new Date() },
    });
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}

/** `PAYMENT_SUBMITTED -> VERIFYING` (docs/PAYMENT.md §2.1) — automatic, queued for matching. */
export async function markVerifying(
  contributionId: bigint,
  db: DbClient = prisma,
): Promise<Contribution | null> {
  try {
    return await db.contribution.update({
      where: { id: contributionId, status: "PAYMENT_SUBMITTED" },
      data: { status: "VERIFYING" },
    });
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}

/**
 * UTR submission: `PAYMENT_PENDING -> PAYMENT_SUBMITTED -> VERIFYING` as one atomic step,
 * since the second transition is automatic and part of the same request (docs/PAYMENT.md §2.1).
 */
export async function submitUtr(
  contributionId: bigint,
  utrLast4: string,
  db: PrismaClient = prisma,
): Promise<Contribution | null> {
  return db.$transaction(async (tx) => {
    const submitted = await markPaymentSubmitted(contributionId, utrLast4, tx);
    if (!submitted) return null;
    return markVerifying(contributionId, tx);
  });
}

/** `VERIFYING -> VERIFICATION_FAILED` (docs/PAYMENT.md §2.1, §3) — admin reject or no evidence found. */
export async function rejectVerification(
  contributionId: bigint,
  rejectionReason: string,
  db: DbClient = prisma,
): Promise<Contribution | null> {
  try {
    return await db.contribution.update({
      where: { id: contributionId, status: "VERIFYING" },
      data: { status: "VERIFICATION_FAILED", rejectionReason },
    });
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}
