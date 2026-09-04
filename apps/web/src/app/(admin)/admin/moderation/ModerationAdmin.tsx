"use client";

import { useState } from "react";
import { adminFetch } from "../_lib/admin-fetch";

interface ContributionDetail {
  contributionId: string;
  displayName: string;
  anonymous: boolean;
  status: string;
}

export function ModerationAdmin() {
  const [code, setCode] = useState("");
  const [contribution, setContribution] = useState<ContributionDetail | null>(null);
  const [replacementName, setReplacementName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    setLoading(true);
    setError(null);
    setContribution(null);
    try {
      const response = await adminFetch(`/api/admin/contributions/${code}`);
      if (!response.ok) {
        setError("Contribution not found");
        return;
      }
      const data = (await response.json()) as ContributionDetail;
      setContribution(data);
    } finally {
      setLoading(false);
    }
  }

  async function moderate(action: "HIDE" | "REPLACE") {
    if (!contribution) return;
    setError(null);
    const response = await adminFetch(`/api/admin/contributions/${contribution.contributionId}/moderate-name`, {
      method: "POST",
      body: JSON.stringify(action === "HIDE" ? { action } : { action, replacementName }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message: string } } | null;
      setError(body?.error?.message ?? "Failed to moderate name");
      return;
    }
    const data = (await response.json()) as { displayName: string };
    setContribution({ ...contribution, displayName: data.displayName });
    setReplacementName("");
  }

  return (
    <section className="admin-section">
      <h2>Name moderation</h2>
      <div className="admin-form">
        <input
          placeholder="Contribution code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <button type="button" disabled={loading || !code} onClick={() => void lookup()}>
          Look up
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
      {contribution && (
        <div className="admin-form">
          <p>
            Current display name: <strong>{contribution.displayName}</strong>
          </p>
          <div className="flow-actions">
            <button type="button" onClick={() => void moderate("HIDE")}>
              Hide (force Anonymous)
            </button>
          </div>
          <input
            placeholder="Replacement name"
            value={replacementName}
            onChange={(event) => setReplacementName(event.target.value)}
          />
          <div className="flow-actions">
            <button type="button" disabled={!replacementName} onClick={() => void moderate("REPLACE")}>
              Replace name
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
