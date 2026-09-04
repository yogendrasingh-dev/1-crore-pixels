import { prisma, type AdminUser } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { adminRequest, createTestAdmin, deleteTestAdmin } from "@/lib/test-support";
import { GET, POST } from "./route";

describe("POST /api/admin/updates (docs/API.md §4). Role: CONTENT_EDITOR+", () => {
  let admin: AdminUser | undefined;
  let updateId: string | undefined;

  afterEach(async () => {
    if (updateId) await prisma.update.delete({ where: { id: updateId } }).catch(() => undefined);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    updateId = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await POST(new NextRequest("http://localhost/api/admin/updates", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a VERIFIER (insufficient role)", async () => {
    admin = await createTestAdmin("VERIFIER");
    const request = await adminRequest("http://localhost/api/admin/updates", {
      admin,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x", body: "y" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("creates a DRAFT update for a CONTENT_EDITOR", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    const request = await adminRequest("http://localhost/api/admin/updates", {
      admin,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Milestone hit", body: "We did it" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.status).toBe("DRAFT");
    updateId = body.id;
  });

  it("returns 422 without a title", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    const request = await adminRequest("http://localhost/api/admin/updates", {
      admin,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "y" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(422);
  });
});

describe("GET /api/admin/updates (docs/API.md §4)", () => {
  let admin: AdminUser | undefined;

  afterEach(async () => {
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/updates"));
    expect(response.status).toBe(401);
  });

  it("allows any authenticated admin role", async () => {
    admin = await createTestAdmin("VERIFIER");
    const request = await adminRequest("http://localhost/api/admin/updates", { admin });
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
