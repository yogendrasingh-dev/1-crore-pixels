-- CreateEnum
CREATE TYPE "contribution_status" AS ENUM ('CREATED', 'PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'VERIFYING', 'PAID', 'PIXELS_ASSIGNED', 'PUBLISHED', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED', 'VERIFICATION_FAILED', 'REFUND_PENDING', 'REFUNDED');

-- CreateTable
CREATE TABLE "contributors" (
    "id" BIGSERIAL NOT NULL,
    "display_name" TEXT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "referral_code" TEXT,
    "total_verified_amount_paise" BIGINT NOT NULL DEFAULT 0,
    "total_pixels" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" BIGSERIAL NOT NULL,
    "public_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "amount_paise" BIGINT NOT NULL CHECK ("amount_paise" > 0),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "contribution_status" NOT NULL,
    "contributor_id" BIGINT NOT NULL,
    "referral_code_used" TEXT,
    "utr_last4" CHAR(4),
    "idempotency_key" TEXT,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "rejection_reason" TEXT,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_submitted_at" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,
    "verified_at" TIMESTAMPTZ,
    "published_at" TIMESTAMPTZ,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contributors_referral_code_key" ON "contributors"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_public_code_key" ON "contributions"("public_code");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_idempotency_key_key" ON "contributions"("idempotency_key");

-- CreateIndex
CREATE INDEX "contributions_status_idx" ON "contributions"("status");

-- CreateIndex
CREATE INDEX "contributions_contributor_id_idx" ON "contributions"("contributor_id");

-- CreateIndex
CREATE INDEX "contributions_referral_code_used_idx" ON "contributions"("referral_code_used");

-- CreateIndex
CREATE INDEX "contributions_created_at_idx" ON "contributions"("created_at");

-- CreateIndex
-- docs/DATABASE.md §3.1: supports public search over published contributions only.
CREATE INDEX "contributions_display_name_published_idx" ON "contributions"("display_name") WHERE "status" = 'PUBLISHED';

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "contributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
