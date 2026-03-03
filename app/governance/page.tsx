import type { Metadata } from 'next';
import { GovernanceHealthStory } from '@/components/GovernanceHealthStory';
import { PageViewTracker } from '@/components/PageViewTracker';
import { getFeatureFlag } from '@/lib/featureFlags';

export const metadata: Metadata = {
  title: 'My Governance — DRepScore',
  description: 'Check your governance health, track your DRep, and follow your governance story.',
};

export default async function GovernancePage() {
  const [showCalendar, showCitizenPanels] = await Promise.all([
    getFeatureFlag('governance_calendar'),
    getFeatureFlag('citizen_levels'),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageViewTracker event="governance_page_viewed" />
      <GovernanceHealthStory showCalendar={showCalendar} showCitizenPanels={showCitizenPanels} />
    </div>
  );
}
