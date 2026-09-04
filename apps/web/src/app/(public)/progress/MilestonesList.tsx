"use client";

import { useEffect, useState } from "react";

interface MilestoneItem {
  id: string;
  label: string;
  targetAmountRupees: number | null;
  phase: "PRE_GOAL" | "POST_GOAL";
  sortOrder: number;
  achievedAt: string | null;
}

export function MilestonesList() {
  const [items, setItems] = useState<MilestoneItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/milestones");
      if (response.ok) {
        const data = (await response.json()) as { items: MilestoneItem[] };
        setItems(data.items);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <p>Loading milestones…</p>;
  if (items.length === 0) return <p>No milestones configured yet.</p>;

  return (
    <ul className="milestones-list">
      {items.map((item) => (
        <li key={item.id} className={`milestone-item ${item.achievedAt ? "achieved" : ""}`}>
          <span>
            {item.achievedAt ? "✓ " : ""}
            {item.label}
          </span>
          {item.targetAmountRupees !== null && (
            <span>₹{item.targetAmountRupees.toLocaleString("en-IN")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
