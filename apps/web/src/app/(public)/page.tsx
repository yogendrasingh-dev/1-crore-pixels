import { Hero } from "./_components/Hero";
import { LiveProgressSection } from "./_components/LiveProgressSection";
import { StorySection } from "./_components/StorySection";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <LiveProgressSection />
      <StorySection />
    </main>
  );
}
