import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "@/lib/test-support";
import { POST } from "./route";

const ALLOWED_FIELDS = ["contributionId", "status", "upiDeepLink", "qrImageUrl", "amountRupees", "expiresAt"].sort();

describe("POST /api/contributions/{id}/qr (docs/API.md §2.2)", () => {
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    fixture = undefined;
  });

  it("returns exactly the documented public fields and never the provider payload", async () => {
    fixture = await createTestContribution({ status: "CREATED" });

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: fixture.contribution.publicCode }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(ALLOWED_FIELDS);
    expect(body.status).toBe("PAYMENT_PENDING");
    expect(body.upiDeepLink).toContain("upi://pay");
    expect(body.qrImageUrl).toMatch(/^data:image\/png;base64,/);
    expect(body).not.toHaveProperty("provider");
    expect(body).not.toHaveProperty("providerPaymentId");
  });

  it("returns 404 for an unknown contribution", async () => {
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "C_does_not_exist" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 409 for a contribution already past PAYMENT_PENDING", async () => {
    fixture = await createTestContribution({ status: "VERIFYING" });

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: fixture.contribution.publicCode }),
    });

    expect(response.status).toBe(409);
  });
});
