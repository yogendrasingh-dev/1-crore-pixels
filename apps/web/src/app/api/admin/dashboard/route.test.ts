import { type AdminUser } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { adminRequest, createTestAdmin, deleteTestAdmin } from "@/lib/test-support";
import { GET } from "./route";

describe("GET /api/admin/dashboard (docs/API.md §4, docs/PRD.md §22)", () => {
  let admin: AdminUser | undefined;

  afterEach(async () => {
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/dashboard"));
    expect(response.status).toBe(401);
  });

  it("returns totals for any authenticated admin role", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    const request = await adminRequest("http://localhost/api/admin/dashboard", { admin });

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.totalVerifiedAmountRupees).toBe("number");
    expect(Array.isArray(body.recentContributions)).toBe(true);
  });
});
