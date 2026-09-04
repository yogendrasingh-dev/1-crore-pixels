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

describe("GET /api/admin/contributions (docs/API.md §4)", () => {
  let admin: AdminUser | undefined;
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
    fixture = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/contributions"));
    expect(response.status).toBe(401);
  });

  it("lists the queue for any authenticated admin role", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    fixture = await createTestContribution({ status: "VERIFYING", utrLast4: "1111" });

    const request = await adminRequest("http://localhost/api/admin/contributions", { admin });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.some((item: { contributionId: string }) => item.contributionId === fixture!.contribution.publicCode)).toBe(
      true,
    );
  });
});
