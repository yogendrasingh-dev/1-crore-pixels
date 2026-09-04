"use client";

import { useEffect, useState } from "react";
import { formatRupees } from "@/lib/format";
import type { QrData } from "./types";

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function QrStep({
  qrData,
  onExpired,
  onPaid,
}: {
  qrData: QrData;
  onExpired: () => void;
  onPaid: () => void;
}) {
  const [msRemaining, setMsRemaining] = useState(() => new Date(qrData.expiresAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = new Date(qrData.expiresAt).getTime() - Date.now();
      setMsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpired();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [qrData.expiresAt, onExpired]);

  return (
    <div className="flow-step">
      <h2>Scan &amp; Pay</h2>
      {/* qrImageUrl is a server-rendered data: URI (docs/API.md §2.2) — safe to use directly as an <img> src. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrData.qrImageUrl} alt="UPI payment QR code" width={220} height={220} />
      <p className="qr-amount">{formatRupees(qrData.amountRupees)}</p>
      <a href={qrData.upiDeepLink} className="cta-button">
        Open in UPI App
      </a>
      <p className="qr-expiry">Expires in {formatCountdown(msRemaining)}</p>
      <button type="button" onClick={onPaid}>
        I&apos;ve Paid — Enter UTR
      </button>
    </div>
  );
}
