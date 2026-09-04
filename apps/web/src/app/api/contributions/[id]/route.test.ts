import { prisma } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "@/lib/test-support";
import { GET } from "./route";

describe("GET /api/contributions/{id} (docs/API.md §2.4)", () => {
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    fixture = undefined;
  });

  it("returns exactly the documented fields before pixel assignment", async () => {
    fixture = await createTestContribution({ status: "VERIFYING" });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: fixture.contribution.publicCode }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      ["contributionId", "status", "displayName", "anonymous", "amountRupees"].sort(),
    );
    expect(body).not.toHaveProperty("pixelRange");
    expect(body).not.toHaveProperty("utrLast4");
  });

  it("includes pixelRange only once PIXELS_ASSIGNED", async () => {
    fixture = await createTestContribution({ status: "PIXELS_ASSIGNED", amountPaise: 500n });
    await prisma.pixelAllocation.create({
      data: { contributionId: fixture.contribution.id, startPixel: 1_000_000, endPixel: 1_000_005 },
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: fixture.contribution.publicCode }),
    });
    const body = await response.json();

    expect(body.pixelRange).toEqual({ start: 1_000_000, end: 1_000_005, count: 5 });
  });

  it("forces displayName to Anonymous when anonymous is true", async () => {
    fixture = await createTestContribution({ status: "VERIFYING", anonymous: true });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: fixture.contribution.publicCode }),
    });
    const body = await response.json();

    expect(body.anonymous).toBe(true);
    expect(body.displayName).toBe("Anonymous");
  });

  it("includes a generic message, never the raw rejectionReason, on VERIFICATION_FAILED", async () => {
    fixture = await createTestContribution({ status: "VERIFYING" });
    await prisma.contribution.update({
      where: { id: fixture.contribution.id },
      data: { status: "VERIFICATION_FAILED", rejectionReason: "admin saw a mismatched bank statement note" },
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: fixture.contribution.publicCode }),
    });
    const body = await response.json();

    expect(body.status).toBe("VERIFICATION_FAILED");
    expect(typeof body.message).toBe("string");
    expect(body.message).not.toContain("bank statement");
  });

  it("returns 404 for an unknown contribution", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "C_does_not_exist" }),
    });
    expect(response.status).toBe(404);
  });
});
