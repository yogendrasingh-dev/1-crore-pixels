// Client-safe mirror of `packages/core`'s pure geometry math (docs/PIXEL_SYSTEM.md §3). Not
// imported from `@1crore-pixels/core` directly because that package's index also re-exports the
// allocation transaction, which pulls in `@1crore-pixels/db`/Prisma — unsafe to bundle for the
// browser. `W`/chunk height are frozen once real allocations exist (CLAUDE.md §9).
export const WALL_WIDTH = 4000;
export const CHUNK_ROWS = 25;
export const PIXELS_PER_CHUNK = WALL_WIDTH * CHUNK_ROWS;

export function rowOf(index: number): number {
  return Math.floor(index / WALL_WIDTH);
}

export function colOf(index: number): number {
  return index % WALL_WIDTH;
}

export function chunkIndexForRow(row: number): number {
  return Math.floor(row / CHUNK_ROWS);
}

export function chunkIdForIndex(index: number): string {
  return `chunk_${chunkIndexForRow(rowOf(index))}`;
}

export function formatChunkId(chunkIndex: number): string {
  return `chunk_${chunkIndex}`;
}

export function parseChunkId(chunkId: string): number | null {
  const match = /^chunk_(\d+)$/.exec(chunkId);
  return match?.[1] ? Number(match[1]) : null;
}

export interface ChunkBounds {
  chunkIndex: number;
  rowStart: number;
  rowEnd: number;
  pixelStart: number;
  pixelEnd: number;
}

export function chunkBounds(chunkIndex: number): ChunkBounds {
  const rowStart = chunkIndex * CHUNK_ROWS;
  return {
    chunkIndex,
    rowStart,
    rowEnd: rowStart + CHUNK_ROWS,
    pixelStart: chunkIndex * PIXELS_PER_CHUNK,
    pixelEnd: (chunkIndex + 1) * PIXELS_PER_CHUNK,
  };
}
