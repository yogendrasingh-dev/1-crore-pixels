"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  anonymous: boolean;
  referralCount: number;
}

export function LeaderboardList() {
  const [items, setItems] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const response = await fetch("/api/leaderboard");
      if (!response.ok) {
        setLoading(false);
        return;
      }
      const data = (await response.json()) as { items: LeaderboardEntry[] };
      setItems(data.items);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="skeleton-list">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton skeleton-row" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return <p>No referrals yet — be the first to invite a friend.</p>;

  return (
    <ol className="leaderboard-list">
      {items.map((item, index) => (
        <li
          key={`${item.rank}-${item.displayName}`}
          className="leaderboard-item list-item-in"
          style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
        >
          <span className="leaderboard-rank">#{item.rank}</span>
          <span className="leaderboard-name">{item.displayName}</span>
          <span className="leaderboard-count">{item.referralCount} referrals</span>
        </li>
      ))}
    </ol>
  );
}
