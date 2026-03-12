import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { LeaderboardPage } from '@/components/governance/LeaderboardPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'DRep Leaderboard — Governada',
  description:
    'See how Cardano DReps rank by governance score, participation, rationale quality, and endorsements.',
  openGraph: {
    title: 'DRep Leaderboard — Governada',
    description:
      'Competitive rankings for Cardano governance representatives. Who is leading the way?',
    type: 'website',
  },
};

export default function Leaderboard() {
  return (
    <>
      <PageViewTracker event="leaderboard_viewed" />
      <LeaderboardPage />
    </>
  );
}
