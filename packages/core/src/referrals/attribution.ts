// Referral conversion attribution — PRD §20, docs/API.md §2.1/§2.8, docs/TASKS.md T9.4.
// Deliberately called *after* the pixel-allocation transaction commits, never inside it
// (docs/PIXEL_SYSTEM.md §2.3 "Non-critical side effects") — referral attribution is
// analytics/recognition (PRD §20 — "use recognition instead" of cash commissions), not
// money or pixel state, so a failure here must never affect an already-committed allocation.
import { prisma, type Contribution, type PrismaClient } from "@1crore-pixels/db";

export async function recordReferralConversion(
  contribution: Contribution,
  db: PrismaClient = prisma,
): Promise<void> {
  if (!contribution.referralCodeUsed) return;
  try {
    const referral = await db.referral.findUnique({ where: { code: contribution.referralCodeUsed } });
    if (!referral) return;
    await db.referralEvent.create({
      data: { referralId: referral.id, eventType: "CONTRIBUTION", contributionId: contribution.id },
    });
  } catch {
    // Best-effort — see module note above. Never rethrown.
  }
}
