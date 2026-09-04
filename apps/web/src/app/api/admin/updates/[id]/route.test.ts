import { prisma, type AdminUser } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { adminRequest, createTestAdmin, deleteTestAdmin } from "@/lib/test-support";
import { PATCH } from "./route";

describe("PATCH /api/admin/updates/{id} (docs/API.md §4). Role: CONTENT_EDITOR+", () => {
  let admin: AdminUser | undefined;
  let updateId: string | undefined;

  afterEach(async () => {
    if (updateId) await prisma.update.delete({ where: { id: updateId } }).catch(() => undefined);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    updateId = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/admin/updates/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 for a non-existent update", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    const request = await adminRequest("http://localhost/api/admin/updates/00000000-0000-0000-0000-000000000000", {
      admin,
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New title" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) });
    expect(response.status).toBe(404);
  });

  it("edits an existing update for a CONTENT_EDITOR", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    const created = await prisma.update.create({
      data: { title: "Old title", body: "old body", status: "DRAFT", createdByAdminId: admin.id },
    });
    updateId = created.id;

    const request = await adminRequest(`http://localhost/api/admin/updates/${created.id}`, {
      admin,
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New title", status: "PUBLISHED" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: created.id }) });
    expect(response.status).toBe(200);

    const reloaded = await prisma.update.findUniqueOrThrow({ where: { id: created.id } });
    expect(reloaded.title).toBe("New title");
    expect(reloaded.status).toBe("PUBLISHED");
    expect(reloaded.publishedAt).not.toBeNull();
  });
});
