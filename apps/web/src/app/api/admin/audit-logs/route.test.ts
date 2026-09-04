import { prisma, type AdminUser } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { adminRequest, createTestAdmin, deleteTestAdmin } from "@/lib/test-support";
import { GET } from "./route";

describe("GET /api/admin/audit-logs (docs/API.md §4). Role: SUPER_ADMIN only", () => {
  let admin: AdminUser | undefined;
  const entityId = `test-entity-${Date.now()}`;

  afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId } });
    if (admin) await deleteTestAdmin(admin);
    admin = undefined;
  });

  it("returns 401 without a session", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/audit-logs"));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a CONTENT_EDITOR (insufficient role)", async () => {
    admin = await createTestAdmin("CONTENT_EDITOR");
    const request = await adminRequest("http://localhost/api/admin/audit-logs", { admin });
    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it("returns filtered logs for a SUPER_ADMIN", async () => {
    admin = await createTestAdmin("SUPER_ADMIN");
    await prisma.auditLog.create({
      data: { adminUserId: admin.id, action: "MILESTONE_CREATED", entityType: "milestone", entityId },
    });

    const request = await adminRequest(`http://localhost/api/admin/audit-logs?entityType=milestone&entityId=${entityId}`, {
      admin,
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].action).toBe("MILESTONE_CREATED");
  });
});
