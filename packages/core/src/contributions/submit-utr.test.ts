import { prisma } from "@1crore-pixels/db";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "../test-support/fixtures";
import { recordUtrSubmission } from "./submit-utr";

describe("recordUtrSubmission (docs/API.md §2.3, docs/PAYMENT.md §3)", () => {
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    fixture = undefined;
  });

  it("transitions PAYMENT_PENDING -> VERIFYING and records the signal", async () => {
    fixture = await createTestContribution({ status: "PAYMENT_PENDING" });

    const result = await recordUtrSubmission(fixture.contribution.id, "4821");

    expect(result?.status).toBe("VERIFYING");
    expect(result?.utrLast4).toBe("4821");
  });

  it("never transitions to PAID — no such code path exists", async () => {
    fixture = await createTestContribution({ status: "PAYMENT_PENDING" });

    const result = await recordUtrSubmission(fixture.contribution.id, "4821");

    expect(result?.status).not.toBe("PAID");
    expect(result?.status).toBe("VERIFYING");
  });

  it("allows correcting a mistyped UTR while VERIFYING, without changing status", async () => {
    fixture = await createTestContribution({ status: "VERIFYING", utrLast4: "1111" });

    const result = await recordUtrSubmission(fixture.contribution.id, "2222");

    expect(result?.status).toBe("VERIFYING");
    expect(result?.utrLast4).toBe("2222");
  });

  it("is a no-op for a contribution not awaiting a UTR", async () => {
    fixture = await createTestContribution({ status: "CREATED" });

    const result = await recordUtrSubmission(fixture.contribution.id, "4821");

    expect(result).toBeNull();
  });

  it("also updates the active payment row's utrLast4 (docs/API.md §2.3)", async () => {
    fixture = await createTestContribution({ status: "PAYMENT_PENDING" });
    const payment = await prisma.payment.create({
      data: {
        contributionId: fixture.contribution.id,
        provider: "manual",
        amountPaise: fixture.contribution.amountPaise,
        status: "PENDING",
      },
    });

    await recordUtrSubmission(fixture.contribution.id, "9999");

    const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment?.utrLast4).toBe("9999");

    await prisma.payment.delete({ where: { id: payment.id } });
  });
});
