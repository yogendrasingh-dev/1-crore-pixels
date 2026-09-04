import { LeaderboardList } from "./LeaderboardList";

export default function LeaderboardPage() {
  return (
    <main>
      <h1>Community Leaderboard</h1>
      <p>Recognition, not commissions (PRD §20) — ranked by verified referral conversions.</p>
      <LeaderboardList />
    </main>
  );
}
