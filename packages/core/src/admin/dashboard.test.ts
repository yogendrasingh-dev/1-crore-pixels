import { afterEach, describe, expect, it } from "vitest";
import { createTestContribution, deleteTestContribution, type TestContribution } from "../test-support/fixtures";
import { getAdminDashboard } from "./dashboard";

describe("getAdminDashboard (docs/PRD.md §22)", () => {
  let fixture: TestContribution | undefined;

  afterEach(async () => {
    if (fixture) await deleteTestContribution(fixture);
    fixture = undefined;
  });

  it("counts VERIFYING/PAYMENT_SUBMITTED contributions as pending", async () => {
    fixture = await createTestContribution({ status: "VERIFYING" });

    const dashboard = await getAdminDashboard();

    expect(dashboard.pendingVerificationCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.recentContributions.length).toBeGreaterThan(0);
  });
});
