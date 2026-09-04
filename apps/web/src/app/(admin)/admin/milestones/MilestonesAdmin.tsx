"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../_lib/admin-fetch";

interface MilestoneItem {
  id: string;
  label: string;
  targetAmountRupees: number | null;
  phase: "PRE_GOAL" | "POST_GOAL";
  sortOrder: number;
  achievedAt: string | null;
}

const EMPTY_FORM: {
  label: string;
  targetAmountRupees: string;
  phase: "PRE_GOAL" | "POST_GOAL";
  sortOrder: string;
  achievedAt: string;
} = { label: "", targetAmountRupees: "", phase: "PRE_GOAL", sortOrder: "0", achievedAt: "" };

export function MilestonesAdmin() {
  const [items, setItems] = useState<MilestoneItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await adminFetch("/api/admin/milestones");
    if (!response.ok) return;
    const data = (await response.json()) as { items: MilestoneItem[] };
    setItems(data.items);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => void load(), 0);
    return () => clearTimeout(handle);
  }, [load]);

  function startEdit(item: MilestoneItem) {
    setEditingId(item.id);
    setForm({
      label: item.label,
      targetAmountRupees: item.targetAmountRupees?.toString() ?? "",
      phase: item.phase,
      sortOrder: item.sortOrder.toString(),
      achievedAt: item.achievedAt ? item.achievedAt.slice(0, 10) : "",
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
        label: form.label,
        targetAmountRupees: form.targetAmountRupees ? Number(form.targetAmountRupees) : undefined,
        phase: form.phase,
        sortOrder: Number(form.sortOrder),
        achievedAt: form.achievedAt || undefined,
      };
      const response = editingId
        ? await adminFetch(`/api/admin/milestones/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await adminFetch("/api/admin/milestones", { method: "POST", body: JSON.stringify(payload) });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message: string } } | null;
        setError(body?.error?.message ?? "Failed to save milestone");
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
      <h2>Milestones</h2>
      <div className="admin-form">
        <input
          placeholder="Label"
          value={form.label}
          onChange={(event) => setForm({ ...form, label: event.target.value })}
        />
        <input
          placeholder="Target amount (₹, optional)"
          type="number"
          value={form.targetAmountRupees}
          onChange={(event) => setForm({ ...form, targetAmountRupees: event.target.value })}
        />
        <select
          value={form.phase}
          onChange={(event) => setForm({ ...form, phase: event.target.value as "PRE_GOAL" | "POST_GOAL" })}
        >
          <option value="PRE_GOAL">Pre-goal</option>
          <option value="POST_GOAL">Post-goal</option>
        </select>
        <input
          placeholder="Sort order"
          type="number"
          value={form.sortOrder}
          onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
        />
        <input
          placeholder="Achieved date (optional)"
          type="date"
          value={form.achievedAt}
          onChange={(event) => setForm({ ...form, achievedAt: event.target.value })}
        />
        {error && <p className="field-error">{error}</p>}
        <div className="flow-actions">
          <button type="button" disabled={saving} onClick={() => void submit()}>
            {editingId ? "Save changes" : "Create milestone"}
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
              {item.sortOrder}. {item.label} ({item.phase}) {item.achievedAt ? "✓" : ""}
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
