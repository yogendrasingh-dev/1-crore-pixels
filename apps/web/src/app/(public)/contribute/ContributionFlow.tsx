"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AmountStep } from "./AmountStep";
import { NameStep, type NameStepValue } from "./NameStep";
import { QrStep } from "./QrStep";
import { SuccessStep } from "./SuccessStep";
import { TerminalStep } from "./TerminalStep";
import {
  CONTRIBUTION_ID_STORAGE_KEY,
  REFERRAL_CODE_STORAGE_KEY,
  type ContributionStatusResponse,
  type FlowStep,
  type PixelRange,
  type QrData,
} from "./types";
import { UtrStep } from "./UtrStep";
import { WaitingStep } from "./WaitingStep";

const STATUS_POLL_INTERVAL_MS = 4000;

const GENERIC_FAILURE_MESSAGE =
  "Your payment could not be verified. Please contact support with your contribution ID.";

function stepForStatus(status: string): FlowStep {
  switch (status) {
    case "CREATED":
    case "PAYMENT_PENDING":
      return "qr";
    case "PAYMENT_SUBMITTED":
    case "VERIFYING":
      return "waiting";
    case "PAID":
    case "PIXELS_ASSIGNED":
    case "PUBLISHED":
      return "success";
    case "PAYMENT_EXPIRED":
      return "expired";
    case "VERIFICATION_FAILED":
    default:
      return "failed";
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function ContributionFlow() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<FlowStep>("name");
  const [nameValue, setNameValue] = useState<NameStepValue | null>(null);
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [pixelRange, setPixelRange] = useState<PixelRange | undefined>(undefined);
  // Read once, lazily, at mount — a `?ref=` query param (from the `/r/{code}` landing
  // page, T9.3) takes precedence over a previously stored code. An unknown/stale code is
  // validated server-side at creation time and simply ignored there, never rejected
  // (docs/API.md §2.1), so no re-validation is needed here.
  const [usedReferralCode] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return searchParams.get("ref") ?? window.localStorage.getItem(REFERRAL_CODE_STORAGE_KEY) ?? undefined;
  });
  const [ownReferralCode, setOwnReferralCode] = useState<string | undefined>(undefined);
  const [failureMessage, setFailureMessage] = useState<string>(GENERIC_FAILURE_MESSAGE);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  // Persist a freshly-arrived `?ref=` so it survives navigating away from this page and back.
  useEffect(() => {
    if (usedReferralCode) window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, usedReferralCode);
  }, [usedReferralCode]);

  const resetFlow = useCallback(() => {
    window.localStorage.removeItem(CONTRIBUTION_ID_STORAGE_KEY);
    idempotencyKeyRef.current = null;
    setContributionId(null);
    setQrData(null);
    setPixelRange(undefined);
    setOwnReferralCode(undefined);
    setNameValue(null);
    setStep("name");
  }, []);

  const requestQr = useCallback(async (id: string) => {
    const response = await fetch(`/api/contributions/${id}/qr`, { method: "POST" });
    if (!response.ok) {
      setFailureMessage(GENERIC_FAILURE_MESSAGE);
      setStep("failed");
      return;
    }
    const data = await parseJsonResponse<{
      upiDeepLink: string;
      qrImageUrl: string;
      amountRupees: number;
      expiresAt: string;
    }>(response);
    setQrData({
      upiDeepLink: data.upiDeepLink,
      qrImageUrl: data.qrImageUrl,
      amountRupees: data.amountRupees,
      expiresAt: data.expiresAt,
    });
    setStep("qr");
  }, []);

  const applyStatus = useCallback((data: ContributionStatusResponse) => {
    if (data.pixelRange) setPixelRange(data.pixelRange);
    if (data.referralCode) setOwnReferralCode(data.referralCode);
    if (data.status === "VERIFICATION_FAILED") setFailureMessage(data.message ?? GENERIC_FAILURE_MESSAGE);
    setStep(stepForStatus(data.status));
  }, []);

  // Resume an in-progress contribution after a reload/browser-close (PRD §34).
  useEffect(() => {
    const storedId = window.localStorage.getItem(CONTRIBUTION_ID_STORAGE_KEY);
    if (!storedId) return;

    (async () => {
      const response = await fetch(`/api/contributions/${storedId}`);
      if (response.status === 404) {
        window.localStorage.removeItem(CONTRIBUTION_ID_STORAGE_KEY);
        return;
      }
      setContributionId(storedId);
      const data = await parseJsonResponse<ContributionStatusResponse>(response);
      if (data.status === "CREATED" || data.status === "PAYMENT_PENDING") {
        await requestQr(storedId);
      } else {
        applyStatus(data);
      }
    })();
  }, [requestQr, applyStatus]);

  // Poll for verification outcome while waiting (PRD §34 "webhook before frontend response" /
  // still-VERIFYING-after-reload cases resolve the same way: keep polling server state).
  useEffect(() => {
    if (step !== "waiting" || !contributionId) return;

    const interval = setInterval(async () => {
      const response = await fetch(`/api/contributions/${contributionId}`);
      if (!response.ok) return;
      const data = await parseJsonResponse<ContributionStatusResponse>(response);
      if (data.status !== "PAYMENT_SUBMITTED" && data.status !== "VERIFYING") {
        clearInterval(interval);
        applyStatus(data);
      }
    }, STATUS_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [step, contributionId, applyStatus]);

  async function handleNameContinue(value: NameStepValue) {
    setNameValue(value);
    setStep("amount");
  }

  async function handleAmountContinue(amountRupees: number) {
    if (!nameValue) return;
    setSubmitting(true);
    setAmountError(null);
    idempotencyKeyRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKeyRef.current },
        body: JSON.stringify({
          displayName: nameValue.displayName,
          anonymous: nameValue.anonymous,
          amountRupees,
          ...(usedReferralCode ? { referralCode: usedReferralCode } : {}),
        }),
      });

      if (!response.ok) {
        const errorBody = await parseJsonResponse<{ error?: { message?: string } }>(response).catch(() => undefined);
        setAmountError(errorBody?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }

      const data = await parseJsonResponse<{ contributionId: string }>(response);
      window.localStorage.setItem(CONTRIBUTION_ID_STORAGE_KEY, data.contributionId);
      setContributionId(data.contributionId);
      await requestQr(data.contributionId);
    } finally {
      setSubmitting(false);
    }
  }

  const handleExpired = useCallback(async () => {
    if (!contributionId) return;
    const response = await fetch(`/api/contributions/${contributionId}`);
    if (!response.ok) return;
    const data = await parseJsonResponse<ContributionStatusResponse>(response);
    if (data.status === "PAYMENT_EXPIRED") {
      setStep("expired");
    } else {
      await requestQr(contributionId);
    }
  }, [contributionId, requestQr]);

  async function handleUtrSubmit(utrLast4: string) {
    if (!contributionId) return;
    setSubmitting(true);
    setUtrError(null);
    try {
      const response = await fetch(`/api/contributions/${contributionId}/utr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utrLast4 }),
      });
      if (!response.ok) {
        const errorBody = await parseJsonResponse<{ error?: { message?: string } }>(response).catch(() => undefined);
        setUtrError(errorBody?.error?.message ?? "Could not submit — please try again.");
        return;
      }
      setStep("waiting");
    } finally {
      setSubmitting(false);
    }
  }

  switch (step) {
    case "name":
      return <NameStep onContinue={handleNameContinue} />;
    case "amount":
      return (
        <AmountStep onBack={() => setStep("name")} onContinue={handleAmountContinue} submitting={submitting} error={amountError} />
      );
    case "qr":
      return qrData ? (
        <QrStep qrData={qrData} onExpired={handleExpired} onPaid={() => setStep("utr")} />
      ) : (
        <div className="flow-step">Loading…</div>
      );
    case "utr":
      return <UtrStep onSubmit={handleUtrSubmit} submitting={submitting} error={utrError} />;
    case "waiting":
      return <WaitingStep />;
    case "success":
      return (
        <SuccessStep
          pixelRange={pixelRange}
          referralCode={ownReferralCode}
          displayName={nameValue?.anonymous ? "Anonymous" : nameValue?.displayName}
        />
      );
    case "expired":
      return (
        <TerminalStep
          title="This QR Has Expired"
          message="Your payment window ran out before we saw a payment. Please start over to get a fresh QR code."
          onRestart={resetFlow}
        />
      );
    case "failed":
      return <TerminalStep title="Verification Failed" message={failureMessage} onRestart={resetFlow} />;
    default:
      return null;
  }
}
