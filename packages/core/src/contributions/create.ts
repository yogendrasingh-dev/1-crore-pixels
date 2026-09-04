// Contribution creation — docs/API.md §2.1, docs/PAYMENT.md §2.1 (`— -> CREATED`).
import { Prisma, prisma, type Contribution, type PrismaClient } from "@1crore-pixels/db";
import { validateDisplayName } from "../validation/display-name";

export interface CreateContributionInput {
  displayName: string;
  anonymous: boolean;
  /** Already converted to paise by `amountRupeesSchema` (docs/DATABASE.md §1 — money is always paise internally). */
  amountPaise: bigint;
  referralCode?: string;
  idempotencyKey?: string;
  ipHash?: string;
  userAgentHash?: string;
}

/**
 * Unknown/malformed referral codes are ignored, not rejected — a broken referral link
 * must never block a contribution (docs/API.md §2.1, docs/SECURITY.md §2).
 */
async function resolveReferralCode(
  referralCode: string | undefined,
  db: PrismaClient,
): Promise<string | undefined> {
  if (!referralCode) return undefined;
  const referral = await db.referral.findUnique({ where: { code: referralCode } });
  return referral?.code;
}

/**
 * Idempotency: a repeated request with the same key returns the original contribution
 * rather than creating a duplicate (docs/API.md §1, PRD §10). Names that fail automated
 * moderation are created anyway (never silently rejected, docs/SECURITY.md §2) — see
 * docs/OPEN_ISSUES.md for the moderation-hold gap this leaves until schema/admin support lands.
 */
export async function createContribution(
  input: CreateContributionInput,
  db: PrismaClient = prisma,
): Promise<Contribution> {
  if (input.idempotencyKey) {
    const existing = await db.contribution.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  const { sanitized: displayName } = validateDisplayName(input.displayName);
  const referralCodeUsed = await resolveReferralCode(input.referralCode, db);

  try {
    return await db.$transaction(async (tx) => {
      const contributor = await tx.contributor.create({
        data: { displayName, anonymous: input.anonymous },
      });
      const created = await tx.contribution.create({
        data: {
          publicCode: `PENDING_${contributor.id}_${Date.now()}`,
          displayName,
          anonymous: input.anonymous,
          amountPaise: input.amountPaise,
          status: "CREATED",
          contributorId: contributor.id,
          referralCodeUsed,
          idempotencyKey: input.idempotencyKey,
          ipHash: input.ipHash,
          userAgentHash: input.userAgentHash,
        },
      });
      return tx.contribution.update({
        where: { id: created.id },
        data: { publicCode: `C_${created.id}` },
      });
    });
  } catch (error) {
    // Concurrent duplicate submission with the same Idempotency-Key raced past the
    // upfront check above; the unique constraint is the actual idempotency guarantee.
    const isDuplicateKey =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      input.idempotencyKey !== undefined;
    if (!isDuplicateKey) throw error;
    const existing = await db.contribution.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (!existing) throw error;
    return existing;
  }
}
