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
  message?: string;
}

export const CONTRIBUTION_ID_STORAGE_KEY = "1crore-pixels:contributionId";
