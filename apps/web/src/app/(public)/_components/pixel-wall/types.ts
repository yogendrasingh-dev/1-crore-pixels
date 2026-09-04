export interface PixelAllocationSpan {
  start: number;
  end: number;
  displayName: string;
  anonymous: boolean;
}

export interface ChunkResponse {
  chunkId: string;
  bounds: { chunkIndex: number; rowStart: number; rowEnd: number; pixelStart: number; pixelEnd: number };
  allocations: PixelAllocationSpan[];
}

export interface ChunkData {
  chunkId: string;
  chunkIndex: number;
  allocations: PixelAllocationSpan[];
  /** Pre-rendered `WALL_WIDTH x CHUNK_ROWS` bitmap, blitted per-frame instead of redrawing per pixel. */
  canvas: HTMLCanvasElement;
}

export interface PixelLookupResult {
  pixelId: number;
  claimed: boolean;
  displayName?: string;
  anonymous?: boolean;
  contributionId?: string;
}

export interface SelectedPixel {
  index: number;
  claimed: boolean;
  displayName?: string;
  anonymous?: boolean;
  contributionId?: string;
}
