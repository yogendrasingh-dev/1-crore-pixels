"use client";

import { useEffect, useState } from "react";

export interface ProgressData {
  totalRaisedRupees: number;
  goalRupees: number;
  percentFunded: number;
  verifiedContributorCount: number;
  pixelsClaimed: number;
  updatedAt: string;
}

const POLL_INTERVAL_MS = 15_000;

export function useProgress(): { progress: ProgressData | null; error: boolean } {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/progress");
        if (!response.ok) throw new Error("Failed to load progress");
        const data = (await response.json()) as ProgressData;
        if (!cancelled) {
          setProgress(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { progress, error };
}
