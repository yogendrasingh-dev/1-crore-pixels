/*
  Warnings:

  - Made the column `pixel_count` on table `pixel_allocations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `pixel_range` on table `pixel_allocations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "pixel_allocations" ALTER COLUMN "pixel_count" SET NOT NULL,
ALTER COLUMN "pixel_range" SET NOT NULL;
