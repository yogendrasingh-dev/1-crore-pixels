import { Suspense } from "react";
import { ContributionFlow } from "./ContributionFlow";

export default function ContributePage() {
  return (
    <main className="contribute-page">
      <Suspense fallback={<div className="flow-step">Loading…</div>}>
        <ContributionFlow />
      </Suspense>
    </main>
  );
}
