'use client';

import { useState, useCallback } from 'react';
import { ConstellationHero } from '@/components/ConstellationHero';
import { PersonalGovernanceCard } from '@/components/PersonalGovernanceCard';
import { OnboardingOverlay } from '@/components/OnboardingOverlay';
import { WelcomeBackToast } from '@/components/WelcomeBackToast';

interface PulseData {
  totalAdaGoverned: string;
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  votesThisWeek: number;
  claimedDReps: number;
  activeSpOs: number;
  ccMembers: number;
}

interface HomepageDualModeProps {
  pulseData: PulseData;
  topDReps: any[];
  ssrHolderData?: any;
  ssrWalletAddress?: string | null;
}

export function HomepageDualMode({
  pulseData,
  topDReps,
  ssrHolderData,
  ssrWalletAddress,
}: HomepageDualModeProps) {
  const [personalCard, setPersonalCard] = useState<any>(null);

  const handlePersonalCard = useCallback((data: any) => {
    setPersonalCard(data);
  }, []);

  return (
    <div>
      <OnboardingOverlay />
      <WelcomeBackToast streak={ssrHolderData?.visitStreak} />
      <ConstellationHero
        stats={{
          totalAdaGoverned: pulseData.totalAdaGoverned,
          activeProposals: pulseData.activeProposals,
          activeDReps: pulseData.activeDReps,
          activeSpOs: pulseData.activeSpOs,
          ccMembers: pulseData.ccMembers,
        }}
        ssrHolderData={ssrHolderData || undefined}
        ssrWalletAddress={ssrWalletAddress || undefined}
        onPersonalCard={handlePersonalCard}
      />
      {personalCard && (
        <div className="max-w-xl mx-auto px-4 py-6">
          <PersonalGovernanceCard {...personalCard} />
        </div>
      )}
    </div>
  );
}
