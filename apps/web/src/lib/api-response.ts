// Shared API error shape and BigInt-safe JSON helper — docs/API.md §1.
import { NextResponse } from "next/server";

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function apiError(status: number, code: string, message: string): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export const apiErrors = {
  notFound: (message = "Resource not found") => apiError(404, "NOT_FOUND", message),
  invalidState: (message: string) => apiError(409, "INVALID_STATE", message),
  validation: (message: string) => apiError(422, "VALIDATION_ERROR", message),
  rateLimited: (message = "Too many requests") => apiError(429, "RATE_LIMITED", message),
  unauthorized: (message = "Authentication required") => apiError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Insufficient permissions") => apiError(403, "FORBIDDEN", message),
};

/** Rupees are integer or 2-decimal-place decimal-safe at the API boundary (docs/API.md intro). */
export function paiseToRupees(paise: bigint): number {
  return Number(paise) / 100;
}
