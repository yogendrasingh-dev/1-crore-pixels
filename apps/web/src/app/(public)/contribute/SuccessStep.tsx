"use client";

import Link from "next/link";
import { useState } from "react";
import type { PixelRange } from "./types";

const CAMPAIGN_NAME = "1 Crore Pixels";

interface SuccessStepProps {
  pixelRange?: PixelRange;
  referralCode?: string;
  displayName?: string;
}

/** Share card text (PRD §19: campaign name, first name/Anonymous, pixel count/id, CTA). */
function buildShareText(pixelRange: PixelRange | undefined, displayName: string | undefined): string {
  const who = displayName ? `${displayName} just` : "I just";
  if (!pixelRange) return `${who} contributed to ${CAMPAIGN_NAME}! Join the wall.`;
  const pixelWord = pixelRange.count === 1 ? "pixel" : "pixels";
  return `${who} claimed ${pixelRange.count} ${pixelWord} (#${pixelRange.start}–#${pixelRange.end}) on ${CAMPAIGN_NAME}! ₹1 = 1 pixel — join the wall.`;
}

export function SuccessStep({ pixelRange, referralCode, displayName }: SuccessStepProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = referralCode ? `${window.location.origin}/r/${referralCode}` : window.location.origin;
  const shareText = buildShareText(pixelRange, displayName);

  async function handleCopyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  async function handleShare() {
    const shareData = { title: CAMPAIGN_NAME, text: shareText, url: shareUrl };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
    } else {
      await handleCopyLink();
    }
  }

  function handleWhatsAppShare() {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleXShare() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flow-step">
      <div className="share-card">
        <p className="share-card-campaign">{CAMPAIGN_NAME}</p>
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
        <p className="share-card-name">— {displayName ?? "Anonymous"}</p>
      </div>
      <div className="flow-actions">
        <Link href="/pixel-wall" className="cta-button">
          View My Pixels
        </Link>
        <button type="button" className="cta-button cta-button-secondary" onClick={handleShare}>
          Share My Contribution
        </button>
        <button type="button" className="cta-button cta-button-secondary" onClick={handleWhatsAppShare}>
          Share on WhatsApp
        </button>
        <button type="button" className="cta-button cta-button-secondary" onClick={handleXShare}>
          Share on X
        </button>
        <button type="button" className="cta-button cta-button-secondary" onClick={handleCopyLink}>
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}
