import { describe, expect, it } from "vitest";
import { Button } from "./index";

describe("@1crore-pixels/ui scaffold", () => {
  it("exports Button as a function component", () => {
    expect(typeof Button).toBe("function");
  });
});
