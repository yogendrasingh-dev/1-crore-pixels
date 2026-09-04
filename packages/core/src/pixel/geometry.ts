// Wall geometry & coordinate mapping — docs/PIXEL_SYSTEM.md §3. Pure functions, no DB access.
// `W`/chunk height are frozen once real allocations exist (CLAUDE.md §9) — kept configurable via
// env only so the pre-launch baseline can be tuned without a code change (docs/PIXEL_SYSTEM.md §6.2).

export interface WallGeometry {
  width: number;
  chunkRows: number;
}

export function getWallGeometry(): WallGeometry {
  return {
    width: Number(process.env.PIXEL_WALL_WIDTH ?? 4000),
    chunkRows: Number(process.env.PIXEL_CHUNK_ROWS ?? 25),
  };
}

export interface PixelCoordinate {
  row: bigint;
  col: bigint;
}

/** `docs/PIXEL_SYSTEM.md §3.1` — row = floor(index / W), col = index mod W. */
export function indexToCoordinate(
  index: bigint,
  geometry: WallGeometry = getWallGeometry(),
): PixelCoordinate {
  const width = BigInt(geometry.width);
  return { row: index / width, col: index % width };
}

/** Inverse of {@link indexToCoordinate}. */
export function coordinateToIndex(
  coordinate: PixelCoordinate,
  geometry: WallGeometry = getWallGeometry(),
): bigint {
  return coordinate.row * BigInt(geometry.width) + coordinate.col;
}

/** `docs/PIXEL_SYSTEM.md §3.2` — chunkIndex = floor(row / chunkHeight). */
export function chunkIndexForRow(row: bigint, geometry: WallGeometry = getWallGeometry()): bigint {
  return row / BigInt(geometry.chunkRows);
}

export function chunkIdForIndex(index: bigint, geometry: WallGeometry = getWallGeometry()): string {
  const { row } = indexToCoordinate(index, geometry);
  return formatChunkId(chunkIndexForRow(row, geometry));
}

export function formatChunkId(chunkIndex: bigint): string {
  return `chunk_${chunkIndex}`;
}

export function parseChunkId(chunkId: string): bigint {
  const match = /^chunk_(\d+)$/.exec(chunkId);
  const digits = match?.[1];
  if (!digits) {
    throw new Error(`Invalid chunkId: ${chunkId}`);
  }
  return BigInt(digits);
}

export interface ChunkBounds {
  /** Inclusive global pixel index. */
  start: bigint;
  /** Exclusive global pixel index. */
  end: bigint;
}

/** `docs/PIXEL_SYSTEM.md §3.2` — a chunk's contiguous global-index bounds. */
export function chunkBounds(chunkId: string, geometry: WallGeometry = getWallGeometry()): ChunkBounds {
  const chunkIndex = parseChunkId(chunkId);
  const pixelsPerChunk = BigInt(geometry.chunkRows) * BigInt(geometry.width);
  const start = chunkIndex * pixelsPerChunk;
  return { start, end: start + pixelsPerChunk };
}
