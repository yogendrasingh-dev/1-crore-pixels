export type FlowStep = "name" | "amount" | "qr" | "utr" | "waiting" | "success" | "failed" | "expired";

export interface QrData {
  upiDeepLink: string;
  qrImageUrl: string;
  amountRupees: number;
  expiresAt: string;
}

export interface PixelRange {
  start: number;
  end: number;
  count: number;
}

export interface ContributionStatusResponse {
  contributionId: string;
  status: string;
  displayName?: string;
  anonymous?: boolean;
  amountRupees?: number;
  pixelRange?: PixelRange;
  referralCode?: string;
  message?: string;
}

export const CONTRIBUTION_ID_STORAGE_KEY = "1crore-pixels:contributionId";
// Set by the `/r/{code}` referral landing page (PRD §20, T9.3); read once at contribution
// creation time so a referral survives navigating from the landing page to `/contribute`.
export const REFERRAL_CODE_STORAGE_KEY = "1crore-pixels:referralCode";
