import { prisma } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/referrals/{code}/visit (docs/API.md §2.8.1)", () => {
  let contributorId: bigint | undefined;
  let referralId: bigint | undefined;

  afterEach(async () => {
    if (referralId) {
      await prisma.referralEvent.deleteMany({ where: { referralId } });
      await prisma.referral.delete({ where: { id: referralId } });
    }
    if (contributorId) await prisma.contributor.delete({ where: { id: contributorId } });
    contributorId = undefined;
    referralId = undefined;
  });

  it("records a VISIT event and returns 204", async () => {
    const contributor = await prisma.contributor.create({ data: { displayName: "Rahul" } });
    contributorId = contributor.id;
    const referral = await prisma.referral.create({
      data: { code: `visit-${Date.now()}`, contributorId: contributor.id },
    });
    referralId = referral.id;

    const response = await POST(
      new NextRequest("http://localhost", { method: "POST", headers: { "x-forwarded-for": crypto.randomUUID() } }),
      { params: Promise.resolve({ code: referral.code }) },
    );

    expect(response.status).toBe(204);
    const events = await prisma.referralEvent.findMany({ where: { referralId: referral.id } });
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("VISIT");
  });

  it("returns 404 for an unknown code", async () => {
    const response = await POST(
      new NextRequest("http://localhost", { method: "POST", headers: { "x-forwarded-for": crypto.randomUUID() } }),
      { params: Promise.resolve({ code: "does-not-exist" }) },
    );
    expect(response.status).toBe(404);
  });
});
