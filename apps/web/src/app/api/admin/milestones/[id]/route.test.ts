import { prisma, type AdminUser } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { adminRequest, createTestAdmin, deleteTestAdmin } from "@/lib/test-support";
import { PATCH } from "./route";

describe("PATCH /api/admin/milestones/{id} (docs/API.md §4). Role: CONTENT_EDITOR+", () => {
  let admin: AdminUser | undefined;
  let milestoneId: string | undefined;

  afterEach(async () => {
    if (milestoneId) await prisma.milestone.delete({ where: { id: milestoneId } }).catch(() => undefined);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    milestoneId = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/admin/milestones/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 for a non-existent milestone", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    const request = await adminRequest("http://localhost/api/admin/milestones/00000000-0000-0000-0000-000000000000", {
      admin,
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "New label" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) });
    expect(response.status).toBe(404);
  });

  it("edits an existing milestone for a CONTENT_EDITOR", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    const created = await prisma.milestone.create({
      data: { label: "Old label", phase: "PRE_GOAL", sortOrder: 1 },
    });
    milestoneId = created.id;

    const request = await adminRequest(`http://localhost/api/admin/milestones/${created.id}`, {
      admin,
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "New label" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: created.id }) });
    expect(response.status).toBe(200);

    const reloaded = await prisma.milestone.findUniqueOrThrow({ where: { id: created.id } });
    expect(reloaded.label).toBe("New label");
  });
});
