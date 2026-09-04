"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { CHUNK_ROWS, WALL_WIDTH } from "./geometry";
import { usePixelChunks } from "./usePixelChunks";
import type { PixelLookupResult, SelectedPixel } from "./types";

const MIN_CELL_SIZE_FLOOR = 0.05;
const MAX_CELL_SIZE = 24;
const MAX_ROW = 5_000_000; // sanity cap on how far a user can pan into never-fetched space.
const PREFETCH_CHUNKS = 1;
const DRAG_THRESHOLD_PX = 4;

export interface PixelWallCanvasProps {
  height: number;
  /** Global pixel index to center the viewport on and highlight, per a deep link (PRD §15). */
  focusIndex?: number | null;
}

export function PixelWallCanvas({ height, focusIndex }: PixelWallCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { chunks, ensureChunks } = usePixelChunks();

  const [size, setSize] = useState({ width: 0, height });
  const [cellSize, setCellSize] = useState(0.2);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // world (wall-pixel) coordinates of the top-left corner.
  const [selected, setSelected] = useState<SelectedPixel | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const hasJumpedToFocusRef = useRef(false);

  const minCellSize = size.width > 0 ? size.width / WALL_WIDTH : MIN_CELL_SIZE_FLOOR;

  const clampPan = useCallback(
    (next: { x: number; y: number }, cell: number, width: number) => {
      const visibleCols = width / cell;
      const maxX = Math.max(0, WALL_WIDTH - visibleCols);
      return { x: Math.min(Math.max(0, next.x), maxX), y: Math.min(Math.max(0, next.y), MAX_ROW) };
    },
    [],
  );

  // Resolves and highlights a deep-linked pixel directly (docs/PIXEL_SYSTEM.md §4), once, the
  // first time the viewport has a real size to center on.
  const jumpToFocus = useCallback(
    (index: number, viewportHeight: number, cell: number, width: number) => {
      const row = Math.floor(index / WALL_WIDTH);
      const visibleRows = viewportHeight / cell;
      setPan((current) => clampPan({ x: current.x, y: row - visibleRows / 2 }, cell, width));

      fetch(`/api/pixels/${index}`)
        .then((response) => (response.ok ? (response.json() as Promise<PixelLookupResult>) : null))
        .then((data) => {
          if (!data) return;
          setSelected({
            index: data.pixelId,
            claimed: data.claimed,
            displayName: data.displayName,
            anonymous: data.anonymous,
            contributionId: data.contributionId,
          });
        })
        .catch(() => undefined);
    },
    [clampPan],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      const nextCellSize = Math.max(cellSize, width > 0 ? width / WALL_WIDTH : MIN_CELL_SIZE_FLOOR);
      setSize({ width, height });
      setCellSize(nextCellSize);
      if (!hasJumpedToFocusRef.current && focusIndex != null && width > 0 && height > 0) {
        hasJumpedToFocusRef.current = true;
        jumpToFocus(focusIndex, height, nextCellSize, width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Ensure the visible chunk range (plus a small prefetch margin) is loaded.
  useEffect(() => {
    if (size.height === 0) return;
    const visibleRows = size.height / cellSize;
    const firstChunk = Math.max(0, Math.floor(pan.y / CHUNK_ROWS) - PREFETCH_CHUNKS);
    const lastChunk = Math.floor((pan.y + visibleRows) / CHUNK_ROWS) + PREFETCH_CHUNKS;
    const indexes: number[] = [];
    for (let i = firstChunk; i <= lastChunk; i += 1) indexes.push(i);
    ensureChunks(indexes);
  }, [pan.y, cellSize, size.height, ensureChunks]);

  // Draw the visible chunks + selection marker.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#f4f2fb";
    ctx.fillRect(0, 0, size.width, size.height);

    const visibleRows = size.height / cellSize;
    const firstChunk = Math.max(0, Math.floor(pan.y / CHUNK_ROWS));
    const lastChunk = Math.floor((pan.y + visibleRows) / CHUNK_ROWS);

    for (let chunkIndex = firstChunk; chunkIndex <= lastChunk; chunkIndex += 1) {
      const chunk = chunks.get(chunkIndex);
      if (!chunk) continue;
      const dx = -pan.x * cellSize;
      const dy = (chunkIndex * CHUNK_ROWS - pan.y) * cellSize;
      ctx.drawImage(chunk.canvas, 0, 0, WALL_WIDTH, CHUNK_ROWS, dx, dy, WALL_WIDTH * cellSize, CHUNK_ROWS * cellSize);
    }

    if (selected) {
      const row = Math.floor(selected.index / WALL_WIDTH);
      const col = selected.index % WALL_WIDTH;
      const markerSize = Math.max(4, cellSize);
      ctx.strokeStyle = "#ff5f5f";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        (col - pan.x) * cellSize - markerSize / 2,
        (row - pan.y) * cellSize - markerSize / 2,
        markerSize * 2,
        markerSize * 2,
      );
    }
  }, [chunks, pan, cellSize, size, selected]);

  function resolveSelection(index: number) {
    if (index < 0 || index >= WALL_WIDTH * MAX_ROW) return;
    const row = Math.floor(index / WALL_WIDTH);
    const chunkIndex = Math.floor(row / CHUNK_ROWS);
    const chunk = chunks.get(chunkIndex);
    const allocation = chunk?.allocations.find((a) => a.start <= index && index < a.end);
    if (allocation) {
      setSelected({ index, claimed: true, displayName: allocation.displayName, anonymous: allocation.anonymous });
      return;
    }
    if (chunk) {
      setSelected({ index, claimed: false });
      return;
    }
    fetch(`/api/pixels/${index}`)
      .then((response) => (response.ok ? (response.json() as Promise<PixelLookupResult>) : null))
      .then((data) => {
        if (!data) return;
        setSelected({
          index: data.pixelId,
          claimed: data.claimed,
          displayName: data.displayName,
          anonymous: data.anonymous,
          contributionId: data.contributionId,
        });
      })
      .catch(() => undefined);
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y, moved: false };
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) drag.moved = true;
    if (!drag.moved) return;
    setPan(clampPan({ x: drag.panX - dx / cellSize, y: drag.panY - dy / cellSize }, cellSize, size.width));
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const col = Math.floor(pan.x + (event.clientX - rect.left) / cellSize);
    const row = Math.floor(pan.y + (event.clientY - rect.top) / cellSize);
    if (col < 0 || col >= WALL_WIDTH || row < 0) return;
    resolveSelection(row * WALL_WIDTH + col);
  }

  function handleWheel(event: WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      setCellSize((current) => Math.min(MAX_CELL_SIZE, Math.max(minCellSize, current * factor)));
      return;
    }
    setPan((current) =>
      clampPan({ x: current.x + event.deltaX / cellSize, y: current.y + event.deltaY / cellSize }, cellSize, size.width),
    );
  }

  function zoomBy(factor: number) {
    setCellSize((current) => Math.min(MAX_CELL_SIZE, Math.max(minCellSize, current * factor)));
  }

  return (
    <div className="pixel-wall-viewport" ref={containerRef} style={{ height }}>
      <canvas
        ref={canvasRef}
        className="pixel-wall-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />
      <div className="pixel-wall-controls">
        <button type="button" onClick={() => zoomBy(1.3)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">
          −
        </button>
      </div>
      {selected && (
        <div className="pixel-wall-info" role="status">
          <button type="button" className="pixel-wall-info-close" onClick={() => setSelected(null)} aria-label="Close">
            ×
          </button>
          <p className="pixel-wall-info-index">Pixel #{selected.index.toLocaleString("en-IN")}</p>
          {selected.claimed ? (
            <p>{selected.anonymous ? "Anonymous" : selected.displayName}</p>
          ) : (
            <p>Unclaimed</p>
          )}
        </div>
      )}
    </div>
  );
}
