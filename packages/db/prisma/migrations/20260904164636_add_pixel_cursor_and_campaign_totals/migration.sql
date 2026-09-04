-- CreateTable
-- docs/DATABASE.md §3.5: CHECK (id = 1) enforces the single-row invariant —
-- Prisma's schema DSL has no CHECK constraint, so it's added by raw SQL below.
CREATE TABLE "pixel_cursor" (
    "id" SMALLINT NOT NULL,
    "next_index" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pixel_cursor_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pixel_cursor_id_check" CHECK ("id" = 1)
);

-- CreateTable
-- docs/DATABASE.md §3.6: same single-row invariant as pixel_cursor.
CREATE TABLE "campaign_totals" (
    "id" SMALLINT NOT NULL,
    "total_verified_amount_paise" BIGINT NOT NULL DEFAULT 0,
    "verified_contributor_count" BIGINT NOT NULL DEFAULT 0,
    "total_pixels_allocated" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_totals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "campaign_totals_id_check" CHECK ("id" = 1)
);

-- Seed the single row each table requires — docs/TASKS.md T1.4 "with seed rows".
INSERT INTO "pixel_cursor" ("id", "next_index") VALUES (1, 0);
INSERT INTO "campaign_totals" ("id") VALUES (1);
