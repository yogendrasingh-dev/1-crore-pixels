-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "target_amount_paise" BIGINT,
    "phase" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "achieved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "updates" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "milestone_id" UUID,
    "status" TEXT NOT NULL,
    "created_by_admin_id" BIGINT NOT NULL,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "updates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "updates" ADD CONSTRAINT "updates_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
