import { describe, expect, it } from "vitest";
import {
  chunkBounds,
  chunkIdForIndex,
  chunkIndexForRow,
  coordinateToIndex,
  formatChunkId,
  indexToCoordinate,
  parseChunkId,
  type WallGeometry,
} from "./geometry";

const geometry: WallGeometry = { width: 4000, chunkRows: 25 };

describe("index <-> coordinate mapping (docs/PIXEL_SYSTEM.md §3.1)", () => {
  it("maps the start of the wall to (0, 0)", () => {
    expect(indexToCoordinate(0n, geometry)).toEqual({ row: 0n, col: 0n });
  });

  it("wraps to the next row at the width boundary", () => {
    expect(indexToCoordinate(3999n, geometry)).toEqual({ row: 0n, col: 3999n });
    expect(indexToCoordinate(4000n, geometry)).toEqual({ row: 1n, col: 0n });
    expect(indexToCoordinate(4001n, geometry)).toEqual({ row: 1n, col: 1n });
  });

  it("is reversible for representative indices", () => {
    for (const index of [0n, 1n, 3999n, 4000n, 100_000n, 9_999_999n]) {
      const coordinate = indexToCoordinate(index, geometry);
      expect(coordinateToIndex(coordinate, geometry)).toBe(index);
    }
  });
});

describe("chunk derivation (docs/PIXEL_SYSTEM.md §3.2)", () => {
  it("assigns chunk_0 to the first chunkRows rows", () => {
    expect(chunkIdForIndex(0n, geometry)).toBe("chunk_0");
    expect(chunkIdForIndex(99_999n, geometry)).toBe("chunk_0"); // last pixel of chunk 0
  });

  it("crosses into chunk_1 at exactly the chunk boundary", () => {
    expect(chunkIdForIndex(100_000n, geometry)).toBe("chunk_1");
  });

  it("derives the same chunk index from row directly", () => {
    expect(chunkIndexForRow(24n, geometry)).toBe(0n);
    expect(chunkIndexForRow(25n, geometry)).toBe(1n);
  });

  it("round-trips chunkId formatting", () => {
    expect(parseChunkId(formatChunkId(42n))).toBe(42n);
  });

  it("rejects a malformed chunkId", () => {
    expect(() => parseChunkId("not-a-chunk")).toThrow();
  });

  it("computes contiguous, non-overlapping chunk bounds consistent with write-side indices", () => {
    const chunk0 = chunkBounds("chunk_0", geometry);
    const chunk1 = chunkBounds("chunk_1", geometry);

    expect(chunk0).toEqual({ start: 0n, end: 100_000n });
    expect(chunk1).toEqual({ start: 100_000n, end: 200_000n });
    expect(chunk0.end).toBe(chunk1.start);
  });
});
