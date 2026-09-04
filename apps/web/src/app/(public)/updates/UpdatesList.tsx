"use client";

import { useEffect, useState } from "react";

interface UpdateItem {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  milestoneId: string | null;
  publishedAt: string;
}

export function UpdatesList() {
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/updates");
      if (response.ok) {
        const data = (await response.json()) as { items: UpdateItem[] };
        setItems(data.items);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <p>Loading updates…</p>;
  if (items.length === 0) return <p>No updates yet — check back soon.</p>;

  return (
    <ul className="updates-list">
      {items.map((item) => (
        <li key={item.id} className="update-item">
          <h2>{item.title}</h2>
          <p>{new Date(item.publishedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
          {item.imageUrl && <img className="update-image" src={item.imageUrl} alt={item.title} />}
          <p>{item.body}</p>
        </li>
      ))}
    </ul>
  );
}
