import { describe, expect, it } from "vitest";
import { hasRole } from "./rbac";

describe("hasRole (docs/API.md §4 role gating)", () => {
  it("SUPER_ADMIN satisfies any minimum role", () => {
    expect(hasRole("SUPER_ADMIN", "VERIFIER")).toBe(true);
    expect(hasRole("SUPER_ADMIN", "CONTENT_EDITOR")).toBe(true);
    expect(hasRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
  });

  it("a role satisfies only its own minimum", () => {
    expect(hasRole("VERIFIER", "VERIFIER")).toBe(true);
    expect(hasRole("CONTENT_EDITOR", "CONTENT_EDITOR")).toBe(true);
  });

  it("VERIFIER and CONTENT_EDITOR are disjoint siblings", () => {
    expect(hasRole("VERIFIER", "CONTENT_EDITOR")).toBe(false);
    expect(hasRole("CONTENT_EDITOR", "VERIFIER")).toBe(false);
  });

  it("neither sibling role satisfies a SUPER_ADMIN-only endpoint", () => {
    expect(hasRole("VERIFIER", "SUPER_ADMIN")).toBe(false);
    expect(hasRole("CONTENT_EDITOR", "SUPER_ADMIN")).toBe(false);
  });
});
