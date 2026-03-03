import type { Metadata } from 'next';
import { GovernanceDashboard } from '@/components/GovernanceDashboard';
import { GovernanceImpactHero } from '@/components/GovernanceImpactHero';
import { GovernanceCitizenPanels } from '@/components/GovernanceCitizenPanels';
import { GovernanceCalendar } from '@/components/GovernanceCalendar';
import { getFeatureFlag } from '@/lib/featureFlags';

export const metadata: Metadata = {
  title: 'My Governance — DRepScore',
  description:
    'Track your delegation health, representation score, and active governance proposals.',
};

export default async function GovernancePage() {
  const [showCalendar, showCitizenPanels] = await Promise.all([
    getFeatureFlag('governance_calendar'),
    getFeatureFlag('citizen_levels'),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <GovernanceImpactHero />
      <GovernanceDashboard />
      {showCitizenPanels && <GovernanceCitizenPanels />}
      {showCalendar && <GovernanceCalendar />}
    </div>
  );
}
