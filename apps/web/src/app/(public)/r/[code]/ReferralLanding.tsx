"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REFERRAL_CODE_STORAGE_KEY } from "../../contribute/types";

type LoadState = "loading" | "found" | "not-found";

export function ReferralLanding({ code }: { code: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const response = await fetch(`/api/referrals/${code}`);
      if (cancelled) return;
      if (!response.ok) {
        setState("not-found");
        return;
      }
      const data = (await response.json()) as { ownerDisplayName: string };
      // Stored so a broken/stale referral link never blocks the contribution flow —
      // an invalid code is ignored, not rejected, at creation time (docs/API.md §2.1).
      window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code);
      // Best-effort visit recording — a failure here must not block the landing page.
      fetch(`/api/referrals/${code}/visit`, { method: "POST" }).catch(() => undefined);
      setOwnerDisplayName(data.ownerDisplayName);
      setState("found");
    })().catch(() => setState("not-found"));

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (state === "loading") return <div className="flow-step">Loading…</div>;

  return (
    <div className="flow-step">
      {state === "found" ? (
        <h2>{ownerDisplayName} invited you to claim your pixels on 1 Crore Pixels</h2>
      ) : (
        <h2>Join 1 Crore Pixels</h2>
      )}
      <p>₹1 = 1 pixel. Be part of the wall.</p>
      <Link href={`/contribute?ref=${encodeURIComponent(code)}`} className="cta-button">
        Claim Your Pixels
      </Link>
    </div>
  );
}
