"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../_lib/admin-fetch";

interface AuditLogItem {
  id: string;
  adminUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export function AuditLogsViewer() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [entityType, setEntityType] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (filterEntityType: string) => {
    setError(null);
    const params = new URLSearchParams();
    if (filterEntityType) params.set("entityType", filterEntityType);
    const response = await adminFetch(`/api/admin/audit-logs?${params.toString()}`);
    if (!response.ok) {
      setError(response.status === 403 ? "SUPER_ADMIN role required" : "Failed to load audit logs");
      setItems([]);
      return;
    }
    const data = (await response.json()) as { items: AuditLogItem[] };
    setItems(data.items);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => void load(entityType), 0);
    return () => clearTimeout(handle);
  }, [load, entityType]);

  return (
    <section className="admin-section">
      <h2>Audit logs</h2>
      <input
        placeholder="Filter by entity type (e.g. contribution, update, milestone)"
        value={entityType}
        onChange={(event) => setEntityType(event.target.value)}
      />
      {error && <p className="field-error">{error}</p>}
      <ul className="admin-list">
        {items.map((item) => (
          <li key={item.id} className="admin-list-item">
            <span>
              {new Date(item.createdAt).toLocaleString("en-IN")} — {item.action} ({item.entityType}:{item.entityId})
              by admin {item.adminUserId ?? "system"}
            </span>
          </li>
        ))}
      </ul>
      {items.length === 0 && !error && <p>No audit log entries found.</p>}
    </section>
  );
}
