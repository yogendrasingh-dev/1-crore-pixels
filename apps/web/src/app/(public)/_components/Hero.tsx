"use client";

import Link from "next/link";
import { formatRupees } from "@/lib/format";
import { useProgress } from "./useProgress";

export function Hero() {
  const { progress } = useProgress();

  return (
    <section className="hero">
      <h1>1 Crore Pixels</h1>
      <p className="hero-headline">Can 1 Crore People Give ₹1 to a Stranger?</p>
      <p className="hero-supporting-line">I&apos;m that stranger.</p>
      <p className="hero-amount">
        {formatRupees(progress?.totalRaisedRupees ?? 0)} / {formatRupees(progress?.goalRupees ?? 10_000_000)}
      </p>
      {progress ? <p className="hero-contributor-count">{progress.verifiedContributorCount} contributors so far</p> : null}
      <Link href="/contribute" className="cta-button">
        Claim My ₹1 Pixel
      </Link>
      <p className="hero-disclaimer">No investment. No promised returns. Just one small contribution to a big experiment.</p>
    </section>
  );
}
