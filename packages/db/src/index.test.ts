import { describe, expect, it } from "vitest";
import { prisma } from "./index";

describe("@1crore-pixels/db scaffold", () => {
  it("constructs a PrismaClient without connecting", () => {
    expect(prisma).toBeDefined();
  });
});
