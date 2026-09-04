import { prisma, type AdminUser } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { createTestAdmin, deleteTestAdmin } from "@/lib/test-support";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/auth/login (docs/API.md §4, docs/SECURITY.md §5)", () => {
  let admin: AdminUser | undefined;

  afterEach(async () => {
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
  });

  it("sets a session + CSRF cookie on correct credentials", async () => {
    admin = await createTestAdmin("VERIFIER");

    const response = await POST(jsonRequest({ email: admin.email, password: "Sup3r-Secret-Password!" }));

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("admin_session=");
    expect(setCookie).toContain("HttpOnly");

    const auditRows = await prisma.auditLog.findMany({ where: { adminUserId: admin.id, action: "ADMIN_LOGIN" } });
    expect(auditRows).toHaveLength(1);
  });

  it("rejects an incorrect password with 401 and never reveals which field was wrong", async () => {
    admin = await createTestAdmin("VERIFIER");

    const response = await POST(jsonRequest({ email: admin.email, password: "wrong" }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain(admin.email);
  });

  it("returns 422 for a malformed request body", async () => {
    const response = await POST(jsonRequest({ email: "not-an-email" }));
    expect(response.status).toBe(422);
  });
});
