-- CreateTable
-- docs/DATABASE.md §3.4: `pixel_count` and `pixel_range` are generated columns —
-- Prisma's schema DSL can't express GENERATED ALWAYS AS, so this table is raw SQL.
CREATE TABLE "pixel_allocations" (
    "id" BIGSERIAL NOT NULL,
    "contribution_id" BIGINT NOT NULL,
    "start_pixel" BIGINT NOT NULL,
    "end_pixel" BIGINT NOT NULL,
    "pixel_count" BIGINT GENERATED ALWAYS AS ("end_pixel" - "start_pixel") STORED,
    "pixel_range" INT8RANGE GENERATED ALWAYS AS (int8range("start_pixel", "end_pixel", '[)')) STORED,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pixel_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pixel_allocations_contribution_id_key" ON "pixel_allocations"("contribution_id");

-- CreateExclusionConstraint
-- docs/DATABASE.md §3.4, §5: makes overlapping pixel ranges impossible at the DB level,
-- regardless of application bugs or concurrent transactions (PRD §14, §34).
ALTER TABLE "pixel_allocations" ADD CONSTRAINT "pixel_allocations_pixel_range_excl" EXCLUDE USING gist ("pixel_range" WITH &&);

-- AddForeignKey
ALTER TABLE "pixel_allocations" ADD CONSTRAINT "pixel_allocations_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
