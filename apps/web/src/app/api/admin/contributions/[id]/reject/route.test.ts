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
import { POST } from "./route";

describe("POST /api/admin/contributions/{id}/reject (docs/API.md §4). Role: VERIFIER+", () => {
  let admin: AdminUser | undefined;
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    fixture = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await POST(new NextRequest("http://localhost/api/admin/x/reject", { method: "POST" }), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a CONTENT_EDITOR (insufficient role)", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    fixture = await createTestContribution({ status: "VERIFYING" });

    const request = await adminRequest(
      `http://localhost/api/admin/contributions/${fixture.contribution.publicCode}/reject`,
      { admin, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "x" }) },
    );
    const response = await POST(request, { params: Promise.resolve({ id: fixture.contribution.publicCode }) });

    expect(response.status).toBe(403);
  });

  it("rejects with a reason for a VERIFIER", async () => {
    admin = await createTestAdmin("VERIFIER");
    fixture = await createTestContribution({ status: "VERIFYING" });

    const request = await adminRequest(
      `http://localhost/api/admin/contributions/${fixture.contribution.publicCode}/reject`,
      {
        admin,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "No matching evidence" }),
      },
    );
    const response = await POST(request, { params: Promise.resolve({ id: fixture.contribution.publicCode }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("VERIFICATION_FAILED");
  });

  it("returns 422 without a reason", async () => {
    admin = await createTestAdmin("VERIFIER");
    fixture = await createTestContribution({ status: "VERIFYING" });

    const request = await adminRequest(
      `http://localhost/api/admin/contributions/${fixture.contribution.publicCode}/reject`,
      { admin, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
    );
    const response = await POST(request, { params: Promise.resolve({ id: fixture.contribution.publicCode }) });

    expect(response.status).toBe(422);
  });
});
