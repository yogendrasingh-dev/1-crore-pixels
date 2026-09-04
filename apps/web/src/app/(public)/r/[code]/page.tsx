import { ReferralLanding } from "./ReferralLanding";

export default async function ReferralLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <main className="referral-landing-page">
      <ReferralLanding code={code} />
    </main>
  );
}
