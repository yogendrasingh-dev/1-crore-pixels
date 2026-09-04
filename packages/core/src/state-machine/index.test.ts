import { afterEach, describe, expect, it } from "vitest";
import {
  expirePayment,
  markPaymentPending,
  markPaymentSubmitted,
  markVerifying,
  rejectVerification,
  submitUtr,
} from "./index";
import { createTestContribution, deleteTestContribution, type TestContribution } from "../test-support/fixtures";

describe("contribution state machine (docs/PAYMENT.md §2.1)", () => {
  const created: TestContribution[] = [];

  afterEach(async () => {
    await Promise.all(created.splice(0).map(deleteTestContribution));
  });

  async function contribution(status: Parameters<typeof createTestContribution>[0]["status"], overrides = {}) {
    const fixture = await createTestContribution({ status, ...overrides });
    created.push(fixture);
    return fixture;
  }

  describe("markPaymentPending: CREATED -> PAYMENT_PENDING", () => {
    it("succeeds when the contribution is CREATED", async () => {
      const { contribution: c } = await contribution("CREATED");
      const expiresAt = new Date(Date.now() + 15 * 60_000);

      const result = await markPaymentPending(c.id, expiresAt);

      expect(result?.status).toBe("PAYMENT_PENDING");
      expect(result?.expiresAt?.getTime()).toBe(expiresAt.getTime());
    });

    it("is a no-op when the contribution is not CREATED", async () => {
      const { contribution: c } = await contribution("PAYMENT_PENDING");

      const result = await markPaymentPending(c.id, new Date());

      expect(result).toBeNull();
    });
  });

  describe("expirePayment: PAYMENT_PENDING -> PAYMENT_EXPIRED", () => {
    it("succeeds when pending and past expiry", async () => {
      const { contribution: c } = await contribution("PAYMENT_PENDING", {
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await expirePayment(c.id);

      expect(result?.status).toBe("PAYMENT_EXPIRED");
    });

    it("is a no-op when not yet past expiry", async () => {
      const { contribution: c } = await contribution("PAYMENT_PENDING", {
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await expirePayment(c.id);

      expect(result).toBeNull();
    });

    it("is a no-op when not PAYMENT_PENDING", async () => {
      const { contribution: c } = await contribution("VERIFYING", {
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await expirePayment(c.id);

      expect(result).toBeNull();
    });
  });

  describe("markPaymentSubmitted: PAYMENT_PENDING -> PAYMENT_SUBMITTED", () => {
    it("succeeds when pending, recording the UTR last-4", async () => {
      const { contribution: c } = await contribution("PAYMENT_PENDING");

      const result = await markPaymentSubmitted(c.id, "1234");

      expect(result?.status).toBe("PAYMENT_SUBMITTED");
      expect(result?.utrLast4).toBe("1234");
      expect(result?.paymentSubmittedAt).not.toBeNull();
    });

    it("is a no-op when not PAYMENT_PENDING", async () => {
      const { contribution: c } = await contribution("VERIFYING");

      const result = await markPaymentSubmitted(c.id, "1234");

      expect(result).toBeNull();
    });
  });

  describe("markVerifying: PAYMENT_SUBMITTED -> VERIFYING", () => {
    it("succeeds when PAYMENT_SUBMITTED", async () => {
      const { contribution: c } = await contribution("PAYMENT_SUBMITTED");

      const result = await markVerifying(c.id);

      expect(result?.status).toBe("VERIFYING");
    });

    it("is a no-op when not PAYMENT_SUBMITTED", async () => {
      const { contribution: c } = await contribution("PAYMENT_PENDING");

      const result = await markVerifying(c.id);

      expect(result).toBeNull();
    });
  });

  describe("submitUtr: PAYMENT_PENDING -> VERIFYING (one request)", () => {
    it("drives the contribution straight to VERIFYING", async () => {
      const { contribution: c } = await contribution("PAYMENT_PENDING");

      const result = await submitUtr(c.id, "5678");

      expect(result?.status).toBe("VERIFYING");
      expect(result?.utrLast4).toBe("5678");
    });

    it("is a no-op when not PAYMENT_PENDING", async () => {
      const { contribution: c } = await contribution("VERIFYING");

      const result = await submitUtr(c.id, "5678");

      expect(result).toBeNull();
    });
  });

  describe("rejectVerification: VERIFYING -> VERIFICATION_FAILED", () => {
    it("succeeds when VERIFYING, recording the reason", async () => {
      const { contribution: c } = await contribution("VERIFYING");

      const result = await rejectVerification(c.id, "No matching evidence found");

      expect(result?.status).toBe("VERIFICATION_FAILED");
      expect(result?.rejectionReason).toBe("No matching evidence found");
    });

    it("is a no-op when not VERIFYING", async () => {
      const { contribution: c } = await contribution("PAYMENT_PENDING");

      const result = await rejectVerification(c.id, "No matching evidence found");

      expect(result).toBeNull();
    });
  });

  describe("terminal states never re-enter the money/pixel path (docs/TESTING.md §2.1)", () => {
    const terminalStatuses = ["PAYMENT_FAILED", "PAYMENT_EXPIRED", "VERIFICATION_FAILED", "REFUNDED"] as const;

    it.each(terminalStatuses)("%s cannot be moved forward by any transition function", async (status) => {
      const { contribution: c } = await contribution(status);

      await expect(markPaymentPending(c.id, new Date())).resolves.toBeNull();
      await expect(expirePayment(c.id)).resolves.toBeNull();
      await expect(markPaymentSubmitted(c.id, "0000")).resolves.toBeNull();
      await expect(markVerifying(c.id)).resolves.toBeNull();
      await expect(submitUtr(c.id, "0000")).resolves.toBeNull();
      await expect(rejectVerification(c.id, "x")).resolves.toBeNull();
    });
  });
});
