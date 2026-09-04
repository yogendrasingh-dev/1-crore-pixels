"use client";

import Link from "next/link";
import { formatRupees } from "@/lib/format";
import { useProgress } from "./useProgress";
import { useCountUp } from "./useCountUp";

export function Hero() {
  const { progress } = useProgress();
  const raised = useCountUp(progress?.totalRaisedRupees ?? 0);

  return (
    <section className="hero">
      <span className="hero-glow" aria-hidden="true" />
      <h1 className="hero-eyebrow reveal-in" style={{ animationDelay: "0ms" }}>
        1 Crore Pixels
      </h1>
      <p className="hero-headline reveal-in" style={{ animationDelay: "80ms" }}>
        Can 1 Crore People Give ₹1 to a Stranger?
      </p>
      <p className="hero-supporting-line reveal-in" style={{ animationDelay: "160ms" }}>
        I&apos;m that stranger.
      </p>
      <p className="hero-amount reveal-in" style={{ animationDelay: "240ms" }}>
        {formatRupees(raised)} / {formatRupees(progress?.goalRupees ?? 10_000_000)}
      </p>
      {progress ? (
        <p className="hero-contributor-count reveal-in" style={{ animationDelay: "300ms" }}>
          <span className="live-dot" aria-hidden="true" />
          {progress.verifiedContributorCount} contributors so far
        </p>
      ) : null}
      <Link href="/contribute" className="cta-button reveal-in" style={{ animationDelay: "360ms" }}>
        Claim My ₹1 Pixel
      </Link>
      <p className="hero-disclaimer reveal-in" style={{ animationDelay: "420ms" }}>
        No investment. No promised returns. Just one small contribution to a big experiment.
      </p>
    </section>
  );
}
