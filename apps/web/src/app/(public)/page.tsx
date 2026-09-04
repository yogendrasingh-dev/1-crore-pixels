import { Hero } from "./_components/Hero";
import { LiveProgressSection } from "./_components/LiveProgressSection";
import { PixelWallPreview } from "./_components/PixelWallPreview";
import { StorySection } from "./_components/StorySection";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <LiveProgressSection />
      <PixelWallPreview />
      <StorySection />
    </main>
  );
}
