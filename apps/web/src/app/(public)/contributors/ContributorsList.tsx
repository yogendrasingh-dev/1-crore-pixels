"use client";

import { useCallback, useEffect, useState } from "react";

interface ContributorItem {
  displayName: string;
  anonymous: boolean;
  pixelCount: number;
  contributedAgo: string;
}

interface ContributorsResponse {
  items: ContributorItem[];
  nextCursor: string | null;
}

export function ContributorsList() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ContributorItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (query: string, cursor: string | null, append: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/contributors?${params.toString()}`);
      if (!response.ok) return;
      const data = (await response.json()) as ContributorsResponse;
      setItems((current) => (append ? [...current, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => void load(search, null, false), 250);
    return () => clearTimeout(handle);
  }, [search, load]);

  return (
    <section className="contributors-section">
      <input
        type="search"
        className="contributors-search"
        placeholder="Search contributors by name"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Search contributors by name"
      />
      {items.length === 0 && loading ? (
        <div className="skeleton-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      ) : (
        <ul className="contributors-list">
          {items.map((item, index) => (
            <li
              key={`${item.displayName}-${index}`}
              className="contributors-list-item list-item-in"
              style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            >
              <span className="contributors-name">{item.displayName}</span>
              <span className="pixel-count">{item.pixelCount.toLocaleString("en-IN")} px</span>
              <span className="contributors-ago">{item.contributedAgo}</span>
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 && !loading && <p>No contributors found.</p>}
      {nextCursor && (
        <button
          type="button"
          className="cta-button-secondary cta-button cta-button-small"
          disabled={loading}
          onClick={() => void load(search, nextCursor, true)}
        >
          Load more
        </button>
      )}
    </section>
  );
}
