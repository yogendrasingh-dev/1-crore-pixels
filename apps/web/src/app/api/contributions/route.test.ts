import { prisma } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const ALLOWED_FIELDS = ["contributionId", "status", "amountRupees", "displayName", "anonymous"].sort();

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/contributions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID(), ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contributions (docs/API.md §2.1)", () => {
  const createdContributionIds: bigint[] = [];
  const createdContributorIds: bigint[] = [];

  afterEach(async () => {
    await prisma.contribution.deleteMany({ where: { id: { in: createdContributionIds } } });
    // Every contribution creation also generates a referral code for its contributor (T9.3).
    await prisma.referral.deleteMany({ where: { contributorId: { in: createdContributorIds } } });
    await prisma.contributor.deleteMany({ where: { id: { in: createdContributorIds } } });
    createdContributionIds.length = 0;
    createdContributorIds.length = 0;
  });

  it("returns exactly the documented public fields (docs/API.md §2.1, docs/TESTING.md §3)", async () => {
    const response = await POST(jsonRequest({ displayName: "Rahul", anonymous: false, amountRupees: 101 }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(Object.keys(body).sort()).toEqual(ALLOWED_FIELDS);
    expect(body).toMatchObject({ status: "CREATED", amountRupees: 101, displayName: "Rahul", anonymous: false });
    expect(body.contributionId).toMatch(/^C_\d+$/);

    const contribution = await prisma.contribution.findUnique({ where: { publicCode: body.contributionId } });
    createdContributionIds.push(contribution!.id);
    createdContributorIds.push(contribution!.contributorId);
    // Never returned: internal bigint id, ip_hash, idempotency_key, anything payment-related.
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("ipHash");
    expect(body).not.toHaveProperty("idempotencyKey");
  });

  it("rejects an invalid amount with 422 (docs/SECURITY.md §2)", async () => {
    const response = await POST(jsonRequest({ displayName: "Rahul", anonymous: false, amountRupees: -5 }));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("is idempotent on a repeated Idempotency-Key (docs/API.md §1, PRD §10)", async () => {
    const idempotencyKey = crypto.randomUUID();
    const forwardedFor = crypto.randomUUID();

    const first = await POST(
      jsonRequest(
        { displayName: "Priya", anonymous: false, amountRupees: 11 },
        { "Idempotency-Key": idempotencyKey, "x-forwarded-for": forwardedFor },
      ),
    );
    const firstBody = await first.json();
    const contribution = await prisma.contribution.findUnique({ where: { publicCode: firstBody.contributionId } });
    createdContributionIds.push(contribution!.id);
    createdContributorIds.push(contribution!.contributorId);

    const second = await POST(
      jsonRequest(
        { displayName: "Someone Else", anonymous: false, amountRupees: 999 },
        { "Idempotency-Key": idempotencyKey, "x-forwarded-for": forwardedFor },
      ),
    );
    const secondBody = await second.json();

    expect(secondBody.contributionId).toBe(firstBody.contributionId);
    expect(secondBody.displayName).toBe("Priya");

    const count = await prisma.contribution.count({ where: { idempotencyKey } });
    expect(count).toBe(1);
  });
});
