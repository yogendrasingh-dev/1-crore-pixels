-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributor_badges" (
    "id" BIGSERIAL NOT NULL,
    "contributor_id" BIGINT NOT NULL,
    "badge_id" UUID NOT NULL,
    "awarded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributor_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badges_code_key" ON "badges"("code");

-- CreateIndex
CREATE UNIQUE INDEX "contributor_badges_contributor_id_badge_id_key" ON "contributor_badges"("contributor_id", "badge_id");

-- AddForeignKey
ALTER TABLE "contributor_badges" ADD CONSTRAINT "contributor_badges_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "contributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_badges" ADD CONSTRAINT "contributor_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
