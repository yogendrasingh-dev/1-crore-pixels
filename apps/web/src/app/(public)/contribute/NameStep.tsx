"use client";

import { useState, type FormEvent } from "react";

// Mirrors packages/core/src/validation/display-name.ts — the server remains authoritative;
// this is a client-side convenience check only (CLAUDE.md §3 client/server boundary).
const DISPLAY_NAME_MAX_LENGTH = 40;
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{M}\p{N} .'-]+$/u;

export interface NameStepValue {
  displayName: string;
  anonymous: boolean;
}

export function NameStep({ onContinue }: { onContinue: (value: NameStepValue) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (anonymous) {
      onContinue({ displayName: "Anonymous", anonymous: true });
      return;
    }

    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      setError("Please enter a display name, or choose to stay Anonymous.");
      return;
    }
    if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
      setError(`Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters.`);
      return;
    }
    if (!DISPLAY_NAME_PATTERN.test(trimmed)) {
      setError("Display name contains disallowed characters.");
      return;
    }

    setError(null);
    onContinue({ displayName: trimmed, anonymous: false });
  }

  return (
    <form onSubmit={handleSubmit} className="flow-step">
      <h2>Your Name</h2>
      <input
        type="text"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="e.g. Rahul"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        disabled={anonymous}
        aria-label="Your name"
      />
      <label className="checkbox-label">
        <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
        Show me as Anonymous
      </label>
      {error ? <p className="field-error">{error}</p> : null}
      <button type="submit" className="cta-button">
        Continue
      </button>
    </form>
  );
}
