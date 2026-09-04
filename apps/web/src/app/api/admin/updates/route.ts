// GET/POST /api/admin/updates — docs/API.md §4. GET: any authenticated admin. POST (publish/
// edit updates, PRD §18): role CONTENT_EDITOR+.
import { adminUpdateCreateSchema, createUpdate } from "@1crore-pixels/core";
import { prisma } from "@1crore-pixels/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiErrors } from "@/lib/api-response";
import { isAuthResult, requireAdmin } from "@/lib/admin-auth";
import { getRequestSignals } from "@/lib/request-context";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthResult(auth)) return auth;

  const updates = await prisma.update.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    items: updates.map((update) => ({
      id: update.id,
      title: update.title,
      body: update.body,
      imageUrl: update.imageUrl,
      milestoneId: update.milestoneId,
      status: update.status,
      publishedAt: update.publishedAt,
      createdAt: update.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request, "CONTENT_EDITOR");
  if (isAuthResult(auth)) return auth;

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = adminUpdateCreateSchema.safeParse(body);
  if (!parsed.success) return apiErrors.validation(parsed.error.issues[0]?.message ?? "Invalid request");

  const { ip } = getRequestSignals(request);
  const update = await createUpdate(parsed.data, { adminUserId: auth.adminId, ipAddress: ip });

  return NextResponse.json({ id: update.id, status: update.status }, { status: 201 });
}
