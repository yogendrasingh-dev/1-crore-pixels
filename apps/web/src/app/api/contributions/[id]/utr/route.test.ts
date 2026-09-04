import { prisma } from "@1crore-pixels/db";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "@/lib/test-support";
import { POST } from "./route";

function utrRequest(publicCode: string, utrLast4: string) {
  return new NextRequest(`http://localhost/api/contributions/${publicCode}/utr`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
    body: JSON.stringify({ utrLast4 }),
  });
}

describe("POST /api/contributions/{id}/utr (docs/API.md §2.3)", () => {
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    fixture = undefined;
  });

  it("returns exactly the documented fields and transitions to VERIFYING", async () => {
    fixture = await createTestContribution({ status: "PAYMENT_PENDING" });

    const response = await POST(utrRequest(fixture.contribution.publicCode, "4821"), {
      params: Promise.resolve({ id: fixture.contribution.publicCode }),
    });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(Object.keys(body).sort()).toEqual(["contributionId", "status"]);
    expect(body.status).toBe("VERIFYING");

    const updated = await prisma.contribution.findUnique({ where: { id: fixture.contribution.id } });
    expect(updated?.status).not.toBe("PAID");
  });

  it("rejects a malformed UTR with 422", async () => {
    fixture = await createTestContribution({ status: "PAYMENT_PENDING" });

    const response = await POST(utrRequest(fixture.contribution.publicCode, "abc"), {
      params: Promise.resolve({ id: fixture.contribution.publicCode }),
    });

    expect(response.status).toBe(422);
  });

  it("returns 409 for a contribution not awaiting a UTR", async () => {
    fixture = await createTestContribution({ status: "CREATED" });

    const response = await POST(utrRequest(fixture.contribution.publicCode, "4821"), {
      params: Promise.resolve({ id: fixture.contribution.publicCode }),
    });

    expect(response.status).toBe(409);
  });

  it("returns 404 for an unknown contribution", async () => {
    const response = await POST(utrRequest("C_does_not_exist", "4821"), {
      params: Promise.resolve({ id: "C_does_not_exist" }),
    });
    expect(response.status).toBe(404);
  });
});
