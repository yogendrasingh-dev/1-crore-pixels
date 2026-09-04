// UTR-last-4 submission — docs/API.md §2.3, docs/PAYMENT.md §2.1/§3. This has **no code
// path to `PAID`** (CLAUDE.md §7, §8) — it only ever records the assisted-matching signal
// and moves the contribution to `VERIFYING`, reusing the existing state-machine transitions
// rather than introducing a second way to reach that state.
import { prisma, type Contribution, type DbClient, type PrismaClient } from "@1crore-pixels/db";
import { markPaymentSubmitted, markVerifying } from "../state-machine";

async function updateActivePaymentUtr(
  tx: DbClient,
  contributionId: bigint,
  utrLast4: string,
): Promise<void> {
  const payment = await tx.payment.findFirst({
    where: { contributionId },
    orderBy: { createdAt: "desc" },
  });
  if (payment) {
    await tx.payment.update({ where: { id: payment.id }, data: { utrLast4 } });
  }
}

/**
 * `PAYMENT_PENDING` submits for the first time (`-> PAYMENT_SUBMITTED -> VERIFYING`,
 * docs/PAYMENT.md §2.1). `PAYMENT_SUBMITTED`/`VERIFYING` allow re-submission/correction
 * of a mistyped value before verification starts (docs/API.md §2.3) — an idempotent
 * update of the recorded signal, not a new state transition. Any other status is an
 * invalid-state no-op (`null`).
 */
export async function recordUtrSubmission(
  contributionId: bigint,
  utrLast4: string,
  db: PrismaClient = prisma,
): Promise<Contribution | null> {
  return db.$transaction(async (tx) => {
    const contribution = await tx.contribution.findUnique({ where: { id: contributionId } });
    if (!contribution) return null;

    if (contribution.status === "PAYMENT_PENDING") {
      const submitted = await markPaymentSubmitted(contributionId, utrLast4, tx);
      if (!submitted) return null;
      const verifying = await markVerifying(contributionId, tx);
      if (!verifying) return null;
      await updateActivePaymentUtr(tx, contributionId, utrLast4);
      return verifying;
    }

    if (contribution.status === "PAYMENT_SUBMITTED" || contribution.status === "VERIFYING") {
      const updated = await tx.contribution.update({
        where: { id: contributionId, status: contribution.status },
        data: { utrLast4 },
      });
      await updateActivePaymentUtr(tx, contributionId, utrLast4);
      return updated;
    }

    return null;
  });
}
