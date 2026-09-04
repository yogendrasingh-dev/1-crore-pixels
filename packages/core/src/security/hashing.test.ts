import { describe, expect, it } from "vitest";
import { hashIp, hashUserAgent } from "./hashing";

describe("hashIp / hashUserAgent (docs/DATABASE.md §7)", () => {
  it("produces a deterministic hash for the same value and salt", () => {
    expect(hashIp("1.2.3.4", "salt")).toBe(hashIp("1.2.3.4", "salt"));
  });

  it("never returns the raw input value", () => {
    expect(hashIp("1.2.3.4", "salt")).not.toContain("1.2.3.4");
  });

  it("produces different hashes for different salts", () => {
    expect(hashIp("1.2.3.4", "salt-a")).not.toBe(hashIp("1.2.3.4", "salt-b"));
  });

  it("hashUserAgent is independent of hashIp for the same raw value", () => {
    expect(hashUserAgent("1.2.3.4", "salt")).not.toBe(hashIp("1.2.3.4", "salt"));
  });
});
