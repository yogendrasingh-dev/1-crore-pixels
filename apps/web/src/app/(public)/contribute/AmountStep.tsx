"use client";

import { useState, type FormEvent } from "react";
import { formatRupees } from "@/lib/format";

const PRESET_AMOUNTS = [1, 11, 51, 101, 501];

export function AmountStep({
  onBack,
  onContinue,
  submitting,
  error,
}: {
  onBack: () => void;
  onContinue: (amountRupees: number) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [selected, setSelected] = useState<number | "custom">(1);
  const [customAmount, setCustomAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (selected !== "custom") {
      onContinue(selected);
      return;
    }

    const parsed = Number(customAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setLocalError("Enter a valid amount greater than ₹0.");
      return;
    }
    setLocalError(null);
    onContinue(parsed);
  }

  return (
    <form onSubmit={handleSubmit} className="flow-step">
      <h2>Contribution Amount</h2>
      <div className="amount-presets">
        {PRESET_AMOUNTS.map((amount) => (
          <button
            type="button"
            key={amount}
            className={selected === amount ? "amount-preset selected" : "amount-preset"}
            onClick={() => setSelected(amount)}
          >
            {formatRupees(amount)}
          </button>
        ))}
        <button
          type="button"
          className={selected === "custom" ? "amount-preset selected" : "amount-preset"}
          onClick={() => setSelected("custom")}
        >
          Custom
        </button>
      </div>
      {selected === "custom" ? (
        <input
          type="number"
          min={1}
          step={1}
          value={customAmount}
          onChange={(event) => setCustomAmount(event.target.value)}
          placeholder="Enter amount in ₹"
          aria-label="Custom amount in rupees"
        />
      ) : null}
      {(localError ?? error) ? <p className="field-error">{localError ?? error}</p> : null}
      <div className="flow-actions">
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
        <button type="submit" className="cta-button" disabled={submitting}>
          {submitting ? "Creating…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
