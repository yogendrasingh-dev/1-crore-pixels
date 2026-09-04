-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "payments" (
    "id" BIGSERIAL NOT NULL,
    "contribution_id" BIGINT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_payment_id" TEXT,
    "amount_paise" BIGINT NOT NULL,
    "status" "payment_status" NOT NULL,
    "reference_hash" TEXT,
    "utr_last4" CHAR(4),
    "verification_method" TEXT,
    "verified_by_admin_id" BIGINT,
    "raw_provider_payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_contribution_id_idx" ON "payments"("contribution_id");

-- CreateIndex
CREATE INDEX "payments_reference_hash_amount_paise_idx" ON "payments"("reference_hash", "amount_paise");

-- CreateIndex
-- docs/DATABASE.md §3.3: only a real gateway attempt (Phase 3) has a provider_payment_id;
-- multiple manual-UPI attempts with NULL provider_payment_id must not collide.
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "payments"("provider", "provider_payment_id") WHERE "provider_payment_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
