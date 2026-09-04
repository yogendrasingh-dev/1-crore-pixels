import { prisma } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const ALLOWED_ITEM_FIELDS = ["id", "label", "targetAmountRupees", "phase", "sortOrder", "achievedAt"].sort();

describe("GET /api/milestones (docs/API.md §2.9)", () => {
  let milestoneId: string | undefined;

  afterEach(async () => {
    if (milestoneId) await prisma.milestone.delete({ where: { id: milestoneId } });
    milestoneId = undefined;
  });

  it("returns exactly the documented fields, converting target amount to rupees", async () => {
    const milestone = await prisma.milestone.create({
      data: { label: "₹10 Lakh", targetAmountPaise: 100_000_00n, phase: "PRE_GOAL", sortOrder: 1 },
    });
    milestoneId = milestone.id;

    const response = await GET();
    const body = await response.json();

    const returned = body.items.find((item: { id: string }) => item.id === milestone.id);
    expect(returned).toBeDefined();
    expect(Object.keys(returned).sort()).toEqual(ALLOWED_ITEM_FIELDS);
    expect(returned.targetAmountRupees).toBe(100_000);
  });
});
