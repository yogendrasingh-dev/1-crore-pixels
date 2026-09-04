-- CreateEnum
CREATE TYPE "referral_event_type" AS ENUM ('VISIT', 'CONTRIBUTION');

-- CreateTable
CREATE TABLE "referrals" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "contributor_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_events" (
    "id" BIGSERIAL NOT NULL,
    "referral_id" BIGINT NOT NULL,
    "event_type" "referral_event_type" NOT NULL,
    "contribution_id" BIGINT,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");

-- CreateIndex
CREATE INDEX "referral_events_referral_id_event_type_idx" ON "referral_events"("referral_id", "event_type");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "contributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_referral_code_used_fkey" FOREIGN KEY ("referral_code_used") REFERENCES "referrals"("code") ON DELETE SET NULL ON UPDATE CASCADE;
