import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "../test-support/fixtures";
import { findAmbiguousMatches, listVerificationQueue } from "./queue";

describe("findAmbiguousMatches (docs/PAYMENT.md §3.1)", () => {
  const created: TestContribution[] = [];

  afterEach(async () => {
    await Promise.all(created.splice(0).map(deleteTestContribution));
  });

  async function contribution(overrides: Parameters<typeof createTestContribution>[0]) {
    const fixture = await createTestContribution(overrides);
    created.push(fixture);
    return fixture;
  }

  it("flags two VERIFYING contributions sharing amount + utrLast4", async () => {
    const a = await contribution({ status: "VERIFYING", amountPaise: 500n, utrLast4: "1234" });
    const b = await contribution({ status: "VERIFYING", amountPaise: 500n, utrLast4: "1234" });
    await contribution({ status: "VERIFYING", amountPaise: 500n, utrLast4: "5678" });

    const groups = await findAmbiguousMatches();
    const match = groups.find((g) => g.utrLast4 === "1234" && g.amountPaise === 500n);

    expect(match?.contributionIds.sort()).toEqual([a.contribution.id, b.contribution.id].sort());
  });

  it("does not flag a unique amount+utrLast4 pair", async () => {
    await contribution({ status: "VERIFYING", amountPaise: 999n, utrLast4: "4321" });

    const groups = await findAmbiguousMatches();
    expect(groups.some((g) => g.utrLast4 === "4321")).toBe(false);
  });

  it("listVerificationQueue surfaces ambiguousMatch on the affected items", async () => {
    const a = await contribution({ status: "VERIFYING", amountPaise: 700n, utrLast4: "9999" });
    const b = await contribution({ status: "VERIFYING", amountPaise: 700n, utrLast4: "9999" });

    const queue = await listVerificationQueue({});
    const itemA = queue.find((item) => item.contribution.id === a.contribution.id);
    const itemB = queue.find((item) => item.contribution.id === b.contribution.id);

    expect(itemA?.ambiguousMatch).toBe(true);
    expect(itemB?.ambiguousMatch).toBe(true);
  });

  it("listVerificationQueue filters by status", async () => {
    const paid = await contribution({ status: "PAID" });

    const queue = await listVerificationQueue({ status: "PAID" });

    expect(queue.every((item) => item.contribution.status === "PAID")).toBe(true);
    expect(queue.some((item) => item.contribution.id === paid.contribution.id)).toBe(true);
  });
});
