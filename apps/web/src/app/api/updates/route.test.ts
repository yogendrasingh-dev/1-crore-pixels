import { prisma } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const ALLOWED_ITEM_FIELDS = ["id", "title", "body", "imageUrl", "milestoneId", "publishedAt"].sort();

describe("GET /api/updates (docs/API.md §2.9)", () => {
  let adminId: bigint | undefined;
  let updateIds: string[] = [];

  afterEach(async () => {
    await prisma.update.deleteMany({ where: { id: { in: updateIds } } });
    if (adminId) await prisma.adminUser.delete({ where: { id: adminId } });
    adminId = undefined;
    updateIds = [];
  });

  it("only returns PUBLISHED updates with exactly the documented fields", async () => {
    const admin = await prisma.adminUser.create({
      data: {
        email: `admin-${Date.now()}@example.com`,
        passwordHash: "hash",
        role: "CONTENT_EDITOR",
      },
    });
    adminId = admin.id;

    const published = await prisma.update.create({
      data: {
        title: "We hit ₹1 lakh!",
        body: "Thanks to everyone.",
        status: "PUBLISHED",
        createdByAdminId: admin.id,
        publishedAt: new Date(),
      },
    });
    const draft = await prisma.update.create({
      data: { title: "Draft", body: "Not yet.", status: "DRAFT", createdByAdminId: admin.id },
    });
    updateIds = [published.id, draft.id];

    const response = await GET(new NextRequest("http://localhost/api/updates"));
    const body = await response.json();

    const returned = body.items.find((item: { id: string }) => item.id === published.id);
    expect(returned).toBeDefined();
    expect(Object.keys(returned).sort()).toEqual(ALLOWED_ITEM_FIELDS);
    expect(body.items.some((item: { id: string }) => item.id === draft.id)).toBe(false);
  });
});
