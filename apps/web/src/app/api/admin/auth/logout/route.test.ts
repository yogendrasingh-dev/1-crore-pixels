import { type AdminUser } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { adminRequest, createTestAdmin, deleteTestAdmin } from "@/lib/test-support";
import { POST } from "./route";

describe("POST /api/admin/auth/logout (docs/API.md §4)", () => {
  let admin: AdminUser | undefined;

  afterEach(async () => {
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await POST(new NextRequest("http://localhost/api/admin/auth/logout", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("destroys the session and clears cookies given a valid session + CSRF token", async () => {
    admin = await createTestAdmin("VERIFIER");
    const request = await adminRequest("http://localhost/api/admin/auth/logout", { admin, method: "POST" });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("admin_session=");
  });
});
