import { prisma, type AdminUser } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { adminRequest, createTestAdmin, deleteTestAdmin } from "@/lib/test-support";
import { GET, POST } from "./route";

describe("POST /api/admin/milestones (docs/API.md §4). Role: CONTENT_EDITOR+", () => {
  let admin: AdminUser | undefined;
  let milestoneId: string | undefined;

  afterEach(async () => {
    if (milestoneId) await prisma.milestone.delete({ where: { id: milestoneId } }).catch(() => undefined);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    milestoneId = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await POST(new NextRequest("http://localhost/api/admin/milestones", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a VERIFIER (insufficient role)", async () => {
    admin = await createTestAdmin("VERIFIER");
    const request = await adminRequest("http://localhost/api/admin/milestones", {
      admin,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "x", phase: "PRE_GOAL", sortOrder: 1 }),
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("creates a milestone for a CONTENT_EDITOR", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    const request = await adminRequest("http://localhost/api/admin/milestones", {
      admin,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "₹1 Lakh", targetAmountRupees: 100_000, phase: "PRE_GOAL", sortOrder: 1 }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    milestoneId = body.id;
  });
});

describe("GET /api/admin/milestones (docs/API.md §4)", () => {
  let admin: AdminUser | undefined;

  afterEach(async () => {
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
  });

  it("allows any authenticated admin role", async () => {
    admin = await createTestAdmin("VERIFIER");
    const request = await adminRequest("http://localhost/api/admin/milestones", { admin });
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
