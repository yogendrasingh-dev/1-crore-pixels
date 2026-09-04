"use client";

import Link from "next/link";
import { useState } from "react";
import type { PixelRange } from "./types";

export function SuccessStep({ pixelRange }: { pixelRange?: PixelRange }) {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
  }

  async function handleShare() {
    const shareData = {
      title: "1 Crore Pixels",
      text: pixelRange
        ? `I just claimed ${pixelRange.count} pixel${pixelRange.count === 1 ? "" : "s"} on 1 Crore Pixels!`
        : "I just contributed to 1 Crore Pixels!",
      url: window.location.origin,
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
    } else {
      await handleCopyLink();
    }
  }

  return (
    <div className="flow-step">
      <h2>🎉 You&apos;re part of the journey!</h2>
      {pixelRange ? (
        <>
          <p className="pixel-count">
            {pixelRange.count} Pixel{pixelRange.count === 1 ? "" : "s"} Claimed
          </p>
          <p>
            Pixel #{pixelRange.start} → #{pixelRange.end}
          </p>
        </>
      ) : (
        <p>Your contribution has been recorded. Your pixels will appear here shortly.</p>
      )}
      <div className="flow-actions">
        <Link href="/pixel-wall" className="cta-button">
          View My Pixels
        </Link>
        <button type="button" onClick={handleShare}>
          Share My Contribution
        </button>
        <button type="button" onClick={handleCopyLink}>
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}
