import type { Metadata } from 'next';
import { GovernanceDashboard } from '@/components/GovernanceDashboard';
import { GovernanceCitizenSection } from '@/components/GovernanceCitizenSection';
import { GovernanceCalendar } from '@/components/GovernanceCalendar';
import { PageViewTracker } from '@/components/PageViewTracker';
import { ActivityFeed } from '@/components/ActivityFeed';
import { DelegatorGovernanceCard } from '@/components/DelegatorGovernanceCard';

export const metadata: Metadata = {
  title: 'My Governance — DRepScore',
  description: 'Track your delegation health, representation score, governance timeline, and active proposals.',
};

export default function GovernancePage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="governance_page_viewed" />
      <GovernanceDashboard />
      <DelegatorGovernanceCard />
      <GovernanceCalendar />
      <GovernanceCitizenSection />
      <ActivityFeed limit={8} />
    </div>
  );
}
