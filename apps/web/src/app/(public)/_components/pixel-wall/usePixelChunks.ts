"use client";

import { useCallback, useRef, useState } from "react";
import { CHUNK_ROWS, WALL_WIDTH } from "./geometry";
import type { ChunkData, ChunkResponse, PixelAllocationSpan } from "./types";

const UNCLAIMED_COLOR = "#f4f2fb";
const CLAIMED_COLOR = "#4c1d95";
const CLAIMED_ANONYMOUS_COLOR = "#7c3aed";

function renderChunkBitmap(allocations: PixelAllocationSpan[], pixelStart: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WALL_WIDTH;
  canvas.height = CHUNK_ROWS;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = UNCLAIMED_COLOR;
  ctx.fillRect(0, 0, WALL_WIDTH, CHUNK_ROWS);

  for (const allocation of allocations) {
    ctx.fillStyle = allocation.anonymous ? CLAIMED_ANONYMOUS_COLOR : CLAIMED_COLOR;
    const localStart = allocation.start - pixelStart;
    const localEnd = allocation.end - pixelStart;
    let cursor = localStart;
    while (cursor < localEnd) {
      const row = Math.floor(cursor / WALL_WIDTH);
      const rowEndIndex = (row + 1) * WALL_WIDTH;
      const segmentEnd = Math.min(localEnd, rowEndIndex);
      const col = cursor % WALL_WIDTH;
      ctx.fillRect(col, row, segmentEnd - cursor, 1);
      cursor = segmentEnd;
    }
  }

  return canvas;
}

/** Loads and caches per-chunk allocation data + a pre-rendered bitmap, keyed by chunk index. */
export function usePixelChunks() {
  const [chunks, setChunks] = useState<Map<number, ChunkData>>(new Map());
  const pendingRef = useRef<Set<number>>(new Set());

  const ensureChunks = useCallback((chunkIndexes: number[]) => {
    const toFetch = chunkIndexes.filter(
      (index) => index >= 0 && !pendingRef.current.has(index) && !chunks.has(index),
    );
    if (toFetch.length === 0) return;

    for (const chunkIndex of toFetch) pendingRef.current.add(chunkIndex);

    for (const chunkIndex of toFetch) {
      const chunkId = `chunk_${chunkIndex}`;
      fetch(`/api/pixels?chunk=${chunkId}`)
        .then((response) => (response.ok ? (response.json() as Promise<ChunkResponse>) : null))
        .then((data) => {
          pendingRef.current.delete(chunkIndex);
          if (!data) return;
          const bitmap = renderChunkBitmap(data.allocations, data.bounds.pixelStart);
          setChunks((previous) => {
            const next = new Map(previous);
            next.set(chunkIndex, {
              chunkId,
              chunkIndex,
              allocations: data.allocations,
              canvas: bitmap,
            });
            return next;
          });
        })
        .catch(() => {
          pendingRef.current.delete(chunkIndex);
        });
    }
  }, [chunks]);

  return { chunks, ensureChunks };
}
