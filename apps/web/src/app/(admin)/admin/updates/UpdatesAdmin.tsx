"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../_lib/admin-fetch";

interface UpdateItem {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  milestoneId: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  createdAt: string;
}

const EMPTY_FORM: { title: string; body: string; imageUrl: string; milestoneId: string; status: "DRAFT" | "PUBLISHED" } =
  { title: "", body: "", imageUrl: "", milestoneId: "", status: "DRAFT" };

export function UpdatesAdmin() {
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await adminFetch("/api/admin/updates");
    if (!response.ok) return;
    const data = (await response.json()) as { items: UpdateItem[] };
    setItems(data.items);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => void load(), 0);
    return () => clearTimeout(handle);
  }, [load]);

  function startEdit(item: UpdateItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      body: item.body,
      imageUrl: item.imageUrl ?? "",
      milestoneId: item.milestoneId ?? "",
      status: item.status,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        body: form.body,
        imageUrl: form.imageUrl || undefined,
        milestoneId: form.milestoneId || undefined,
        status: form.status,
      };
      const response = editingId
        ? await adminFetch(`/api/admin/updates/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await adminFetch("/api/admin/updates", { method: "POST", body: JSON.stringify(payload) });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message: string } } | null;
        setError(body?.error?.message ?? "Failed to save update");
        return;
      }
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-section">
      <h2>Updates</h2>
      <div className="admin-form">
        <input
          placeholder="Title"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <textarea
          placeholder="Body"
          value={form.body}
          onChange={(event) => setForm({ ...form, body: event.target.value })}
        />
        <input
          placeholder="Image URL (optional)"
          value={form.imageUrl}
          onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
        />
        <input
          placeholder="Milestone ID (optional)"
          value={form.milestoneId}
          onChange={(event) => setForm({ ...form, milestoneId: event.target.value })}
        />
        <select
          value={form.status}
          onChange={(event) => setForm({ ...form, status: event.target.value as "DRAFT" | "PUBLISHED" })}
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
        {error && <p className="field-error">{error}</p>}
        <div className="flow-actions">
          <button type="button" disabled={saving} onClick={() => void submit()}>
            {editingId ? "Save changes" : "Create update"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>
      <ul className="admin-list">
        {items.map((item) => (
          <li key={item.id} className="admin-list-item">
            <span>
              {item.title} — {item.status}
            </span>
            <button type="button" onClick={() => startEdit(item)}>
              Edit
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
