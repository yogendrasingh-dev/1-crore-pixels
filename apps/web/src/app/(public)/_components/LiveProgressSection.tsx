"use client";

import { formatRupees } from "@/lib/format";
import { useProgress } from "./useProgress";

export function LiveProgressSection() {
  const { progress, error } = useProgress();

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
        <p>Loading progress…</p>
      </section>
    );
  }

  const percent = Math.min(100, Math.max(0, progress.percentFunded));

  return (
    <section className="progress-section">
      <h2>Live Progress</h2>
      <p className="progress-amount">
        {formatRupees(progress.totalRaisedRupees)} / {formatRupees(progress.goalRupees)}
      </p>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <p>{progress.percentFunded}% funded</p>
      <div className="progress-stats">
        <div>
          <strong>{progress.verifiedContributorCount}</strong>
          <span>verified contributors</span>
        </div>
        <div>
          <strong>{progress.pixelsClaimed.toLocaleString("en-IN")}</strong>
          <span>pixels claimed</span>
        </div>
      </div>
      <p className="progress-updated">Last updated {new Date(progress.updatedAt).toLocaleTimeString()}</p>
    </section>
  );
}
