import { Hero } from "./_components/Hero";
import { LiveProgressSection } from "./_components/LiveProgressSection";
import { PixelWallPreview } from "./_components/PixelWallPreview";
import { StorySection } from "./_components/StorySection";
import { ScrollReveal } from "./_components/ScrollReveal";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <ScrollReveal>
        <LiveProgressSection />
      </ScrollReveal>
      <ScrollReveal delayMs={80}>
        <PixelWallPreview />
      </ScrollReveal>
      <ScrollReveal delayMs={80}>
        <StorySection />
      </ScrollReveal>
    </main>
  );
}
