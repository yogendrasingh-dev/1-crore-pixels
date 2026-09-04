import Link from "next/link";
import { PixelWallCanvas } from "./pixel-wall/PixelWallCanvas";

export function PixelWallPreview() {
  return (
    <section className="pixel-wall-preview-section">
      <h2>The Pixel Wall</h2>
      <p>Every contribution claims its pixels here. Zoom, pan, and tap a pixel to see who claimed it.</p>
      <PixelWallCanvas height={320} initialCellSize={8} autoPan />
      <Link href="/pixel-wall" className="pixel-wall-preview-link">
        View the full pixel wall →
      </Link>
    </section>
  );
}
