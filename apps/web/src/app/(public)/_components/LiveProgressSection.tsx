"use client";

import { formatRupees } from "@/lib/format";
import { useProgress } from "./useProgress";
import { useCountUp } from "./useCountUp";

export function LiveProgressSection() {
  const { progress, error } = useProgress();
  const raised = useCountUp(progress?.totalRaisedRupees ?? 0);
  const contributors = useCountUp(progress?.verifiedContributorCount ?? 0);
  const pixels = useCountUp(progress?.pixelsClaimed ?? 0);

  if (error && !progress) {
    return (
      <section className="progress-section">
        <p>Live progress is temporarily unavailable.</p>
      </section>
    );
  }

  if (!progress) {
    return (
      <section className="progress-section">
        <div className="skeleton skeleton-line" style={{ width: "60%" }} />
        <div className="skeleton skeleton-bar" />
        <div className="skeleton skeleton-line" style={{ width: "40%" }} />
      </section>
    );
  }

  const percent = Math.min(100, Math.max(0, progress.percentFunded));

  return (
    <section className="progress-section">
      <h2>
        <span className="live-dot" aria-hidden="true" />
        Live Progress
      </h2>
      <p className="progress-amount">
        {formatRupees(raised)} / {formatRupees(progress.goalRupees)}
      </p>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <p>{progress.percentFunded}% funded</p>
      <div className="progress-stats">
        <div>
          <strong>{contributors}</strong>
          <span>verified contributors</span>
        </div>
        <div>
          <strong>{pixels.toLocaleString("en-IN")}</strong>
          <span>pixels claimed</span>
        </div>
      </div>
      <p className="progress-updated">Last updated {new Date(progress.updatedAt).toLocaleTimeString()}</p>
    </section>
  );
}
