import { PIXELS_PER_CHUNK } from "../_components/pixel-wall/geometry";
import { PixelWallExplorer } from "./PixelWallExplorer";

interface PixelWallPageProps {
  searchParams: Promise<{ pixel?: string; chunk?: string }>;
}

export default async function PixelWallPage({ searchParams }: PixelWallPageProps) {
  const params = await searchParams;

  let focusIndex: number | null = null;
  if (params.pixel && /^\d+$/.test(params.pixel)) {
    focusIndex = Number(params.pixel);
  } else if (params.chunk) {
    const match = /^chunk_(\d+)$/.exec(params.chunk);
    if (match?.[1]) focusIndex = Number(match[1]) * PIXELS_PER_CHUNK;
  }

  return (
    <main>
      <h1>Pixel Wall</h1>
      <PixelWallExplorer initialFocusIndex={focusIndex} />
    </main>
  );
}
