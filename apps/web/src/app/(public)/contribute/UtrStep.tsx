"use client";

import { useState, type FormEvent } from "react";

export function UtrStep({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (utrLast4: string) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [utrLast4, setUtrLast4] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(utrLast4)) {
      setLocalError("Enter exactly 4 digits.");
      return;
    }
    setLocalError(null);
    onSubmit(utrLast4);
  }

  return (
    <form onSubmit={handleSubmit} className="flow-step">
      <h2>Payment Completed?</h2>
      <p>Enter the last 4 digits of your transaction reference:</p>
      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={utrLast4}
        onChange={(event) => setUtrLast4(event.target.value.replace(/\D/g, ""))}
        placeholder="0000"
        aria-label="Last 4 digits of transaction reference"
      />
      {(localError ?? error) ? <p className="field-error">{localError ?? error}</p> : null}
      <button type="submit" className="cta-button" disabled={submitting}>
        {submitting ? "Submitting…" : "Verify Payment"}
      </button>
    </form>
  );
}
