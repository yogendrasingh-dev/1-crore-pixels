// Display-name validation, sanitization, and moderation — docs/SECURITY.md §2, PRD §9.1.
import { z } from "zod";

/** Not specified by the PRD; a reasonable engineering default for a public display name. */
export const DISPLAY_NAME_MAX_LENGTH = 40;

const HTML_TAG_PATTERN = /<[^>]*>/g;

export function sanitizeDisplayName(rawName: string): string {
  return rawName.replace(HTML_TAG_PATTERN, "").replace(/\s+/g, " ").trim();
}

export const displayNameSchema = z.string().transform(sanitizeDisplayName).pipe(
  z
    .string()
    .min(1, "Display name is required")
    .max(DISPLAY_NAME_MAX_LENGTH, `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`)
    // \p{M} (combining marks) is required for Indian scripts (e.g. Devanagari vowel signs).
    .regex(/^[\p{L}\p{M}\p{N} .'-]+$/u, "Display name contains disallowed characters"),
);

// Starter wordlist/heuristics — not exhaustive; extend as moderation needs grow.
const OFFENSIVE_WORDLIST = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "randi",
  "chutiya",
  "madarchod",
  "behenchod",
];

const SPAM_PATTERNS = [/https?:\/\//i, /www\./i, /(.)\1{4,}/];

export type DisplayNameModerationStatus = "OK" | "FLAGGED";

export interface ModeratedDisplayName {
  sanitized: string;
  status: DisplayNameModerationStatus;
}

/**
 * Names that trip moderation are FLAGGED for admin review, never silently rejected or
 * silently published as-is (docs/SECURITY.md §2's "held for admin review" rule mirrors the
 * "ambiguous stays pending" philosophy applied to payments, PRD §12).
 */
export function moderateDisplayName(sanitized: string): ModeratedDisplayName {
  const lower = sanitized.toLowerCase();
  const isOffensive = OFFENSIVE_WORDLIST.some((word) => lower.includes(word));
  const isSpam = SPAM_PATTERNS.some((pattern) => pattern.test(sanitized));
  return { sanitized, status: isOffensive || isSpam ? "FLAGGED" : "OK" };
}

/** Validates, sanitizes, and moderates a raw display-name input in one step. */
export function validateDisplayName(rawName: string): ModeratedDisplayName {
  const sanitized = displayNameSchema.parse(rawName);
  return moderateDisplayName(sanitized);
}

/**
 * `anonymous: true` always forces the public display name to "Anonymous" (CLAUDE.md §10,
 * PRD §9.1) — a single shared function so every response-assembly call site enforces the
 * same invariant instead of re-implementing it.
 */
export function resolvePublicDisplayName(displayName: string, anonymous: boolean): string {
  return anonymous ? "Anonymous" : displayName;
}
