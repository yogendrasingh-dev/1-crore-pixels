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

describe("POST /api/admin/contributions/{id}/moderate-name (docs/API.md §4). Role: CONTENT_EDITOR+", () => {
  let admin: AdminUser | undefined;
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    fixture = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await POST(new NextRequest("http://localhost/api/admin/contributions/x/moderate-name", { method: "POST" }), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a VERIFIER (insufficient role)", async () => {
    admin = await createTestAdmin("VERIFIER");
    fixture = await createTestContribution({ status: "PUBLISHED" });

    const request = await adminRequest(
      `http://localhost/api/admin/contributions/${fixture.contribution.publicCode}/moderate-name`,
      { admin, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "HIDE" }) },
    );
    const response = await POST(request, { params: Promise.resolve({ id: fixture.contribution.publicCode }) });
    expect(response.status).toBe(403);
  });

  it("HIDE forces the display name to Anonymous for a CONTENT_EDITOR", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    fixture = await createTestContribution({ status: "PUBLISHED" });

    const request = await adminRequest(
      `http://localhost/api/admin/contributions/${fixture.contribution.publicCode}/moderate-name`,
      { admin, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "HIDE" }) },
    );
    const response = await POST(request, { params: Promise.resolve({ id: fixture.contribution.publicCode }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.displayName).toBe("Anonymous");
  });

  it("returns 422 for REPLACE without a replacementName", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    fixture = await createTestContribution({ status: "PUBLISHED" });

    const request = await adminRequest(
      `http://localhost/api/admin/contributions/${fixture.contribution.publicCode}/moderate-name`,
      { admin, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "REPLACE" }) },
    );
    const response = await POST(request, { params: Promise.resolve({ id: fixture.contribution.publicCode }) });
    expect(response.status).toBe(422);
  });

  it("returns 404 for an unknown contribution code", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");

    const request = await adminRequest("http://localhost/api/admin/contributions/does-not-exist/moderate-name", {
      admin,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "HIDE" }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: "does-not-exist" }) });
    expect(response.status).toBe(404);
  });
});
