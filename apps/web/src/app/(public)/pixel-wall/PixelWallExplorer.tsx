"use client";

import { useState, type FormEvent } from "react";
import { PixelWallCanvas } from "../_components/pixel-wall/PixelWallCanvas";

interface ContributorMatch {
  displayName: string;
  anonymous: boolean;
  pixelCount: number;
}

export interface PixelWallExplorerProps {
  initialFocusIndex: number | null;
  /** Where to center the viewport when there's no deep-linked focus (the claimed/unclaimed frontier). */
  initialCenterIndex?: number | null;
}

export function PixelWallExplorer({ initialFocusIndex, initialCenterIndex }: PixelWallExplorerProps) {
  const [query, setQuery] = useState("");
  const [nameMatches, setNameMatches] = useState<ContributorMatch[] | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(initialFocusIndex);
  const [notFound, setNotFound] = useState(false);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setNotFound(false);
    setNameMatches(null);

    if (/^\d+$/.test(trimmed)) {
      const response = await fetch(`/api/pixels/${trimmed}`);
      if (response.ok) {
        const data = (await response.json()) as { claimed: boolean };
        if (data.claimed) {
          setFocusIndex(Number(trimmed));
          return;
        }
      }
      setNotFound(true);
      return;
    }

    const response = await fetch(`/api/contributors?search=${encodeURIComponent(trimmed)}&limit=10`);
    if (!response.ok) return;
    const data = (await response.json()) as { items: ContributorMatch[] };
    setNameMatches(data.items);
    if (data.items.length === 0) setNotFound(true);
  }

  return (
    <div className="pixel-wall-explorer">
      <form className="pixel-wall-search" onSubmit={handleSearch}>
        <input
          type="search"
          placeholder="Search by contributor name or pixel ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search by contributor name or pixel ID"
        />
        <button type="submit" className="cta-button cta-button-small">
          Search
        </button>
      </form>
      {notFound && <p className="pixel-wall-search-empty">No match found.</p>}
      {nameMatches && nameMatches.length > 0 && (
        <ul className="pixel-wall-search-results">
          {nameMatches.map((match, index) => (
            <li key={`${match.displayName}-${index}`} className="pixel-wall-search-result-item">
              <span className="contributors-name">{match.anonymous ? "Anonymous" : match.displayName}</span>
              <span className="pixel-count">{match.pixelCount.toLocaleString("en-IN")} px</span>
            </li>
          ))}
        </ul>
      )}
      <PixelWallCanvas
        height={560}
        focusIndex={focusIndex}
        centerIndex={initialCenterIndex}
        initialCellSize={12}
      />
    </div>
  );
}
