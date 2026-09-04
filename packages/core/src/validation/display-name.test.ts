import { describe, expect, it } from "vitest";
import {
  moderateDisplayName,
  resolvePublicDisplayName,
  sanitizeDisplayName,
  validateDisplayName,
} from "./display-name";

describe("sanitizeDisplayName", () => {
  it("strips HTML/script tags", () => {
    expect(sanitizeDisplayName("<script>alert(1)</script>Yogendra")).toBe("alert(1)Yogendra");
    expect(sanitizeDisplayName("<b>Bold</b> Name")).toBe("Bold Name");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeDisplayName("  Yogendra   Singh  ")).toBe("Yogendra Singh");
  });
});

describe("validateDisplayName (docs/SECURITY.md §2, PRD §9.1)", () => {
  it("accepts a normal name", () => {
    expect(validateDisplayName("Yogendra")).toEqual({ sanitized: "Yogendra", status: "OK" });
  });

  it("accepts unicode names", () => {
    expect(validateDisplayName("योगेंद्र")).toEqual({ sanitized: "योगेंद्र", status: "OK" });
  });

  it("rejects an empty name after sanitization", () => {
    expect(() => validateDisplayName("   ")).toThrow();
    expect(() => validateDisplayName("<script></script>")).toThrow();
  });

  it("rejects a name over the max length", () => {
    expect(() => validateDisplayName("A".repeat(41))).toThrow();
  });

  it("rejects disallowed characters", () => {
    expect(() => validateDisplayName("Yogendra@#$%")).toThrow();
  });

  it("flags offensive content for moderation rather than rejecting or silently accepting", () => {
    const result = validateDisplayName("bastard");
    expect(result.status).toBe("FLAGGED");
    expect(result.sanitized).toBe("bastard");
  });

  it("flags spam-looking content (URLs, repeated characters) for moderation", () => {
    expect(moderateDisplayName("visit www.spam.com").status).toBe("FLAGGED");
    expect(moderateDisplayName("aaaaaaaaaa").status).toBe("FLAGGED");
  });
});

describe("resolvePublicDisplayName (CLAUDE.md §10)", () => {
  it("forces Anonymous when the contribution is anonymous", () => {
    expect(resolvePublicDisplayName("Yogendra", true)).toBe("Anonymous");
  });

  it("shows the real name when not anonymous", () => {
    expect(resolvePublicDisplayName("Yogendra", false)).toBe("Yogendra");
  });
});
