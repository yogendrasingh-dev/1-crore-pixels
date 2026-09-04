import { type AdminUser } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  adminRequest,
  createTestAdmin,
  createTestContribution,
  deleteTestAdmin,
  deleteTestContribution,
  type TestContribution,
} from "@/lib/test-support";
import { GET } from "./route";

describe("GET /api/admin/contributions/{id} (docs/API.md §4)", () => {
  let admin: AdminUser | undefined;
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    fixture = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/contributions/x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns full detail including payment evidence for an authenticated admin", async () => {
    admin = await createTestAdmin("VERIFIER");
    fixture = await createTestContribution({ status: "VERIFYING", utrLast4: "2222" });

    const request = await adminRequest(`http://localhost/api/admin/contributions/${fixture.contribution.publicCode}`, {
      admin,
    });
    const response = await GET(request, { params: Promise.resolve({ id: fixture.contribution.publicCode }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.utrLast4).toBe("2222");
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("returns 404 for an unknown contribution", async () => {
    admin = await createTestAdmin("VERIFIER");
    const request = await adminRequest("http://localhost/api/admin/contributions/does-not-exist", { admin });

    const response = await GET(request, { params: Promise.resolve({ id: "does-not-exist" }) });
    expect(response.status).toBe(404);
  });
});
