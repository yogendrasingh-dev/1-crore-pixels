import { prisma } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/referrals/{code} (docs/API.md §2.8)", () => {
  let contributorId: bigint | undefined;
  let referralId: bigint | undefined;

  afterEach(async () => {
    if (referralId) await prisma.referral.delete({ where: { id: referralId } });
    if (contributorId) await prisma.contributor.delete({ where: { id: contributorId } });
    contributorId = undefined;
    referralId = undefined;
  });

  it("returns exactly the documented fields", async () => {
    const contributor = await prisma.contributor.create({ data: { displayName: "Rahul" } });
    contributorId = contributor.id;
    const referral = await prisma.referral.create({
      data: { code: `rahul-${Date.now()}`, contributorId: contributor.id },
    });
    referralId = referral.id;

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ code: referral.code }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["code", "ownerDisplayName"].sort());
    expect(body.ownerDisplayName).toBe("Rahul");
  });

  it("resolves anonymous owners to 'Anonymous'", async () => {
    const contributor = await prisma.contributor.create({ data: { displayName: "Hidden", anonymous: true } });
    contributorId = contributor.id;
    const referral = await prisma.referral.create({
      data: { code: `hidden-${Date.now()}`, contributorId: contributor.id },
    });
    referralId = referral.id;

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ code: referral.code }),
    });
    const body = await response.json();

    expect(body.ownerDisplayName).toBe("Anonymous");
  });

  it("returns 404 for an unknown code", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ code: "does-not-exist" }),
    });
    expect(response.status).toBe(404);
  });
});
