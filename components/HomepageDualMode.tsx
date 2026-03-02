'use client';

import { useState, useCallback } from 'react';
import { ConstellationHero } from '@/components/ConstellationHero';
import { PersonalGovernanceCard } from '@/components/PersonalGovernanceCard';
import { HowItWorksV2 } from '@/components/HowItWorksV2';
import { DRepDiscoveryPreview } from '@/components/DRepDiscoveryPreview';
import { CardanoGovernanceExplainer } from '@/components/CardanoGovernanceExplainer';
import { GovernanceHealthIndex } from '@/components/GovernanceHealthIndex';
import { GovernanceObservatory } from '@/components/GovernanceObservatory';
import { FeatureGate } from '@/components/FeatureGate';

interface PreviewDRep {
  drepId: string;
  name: string | null;
  ticker: string | null;
  handle: string | null;
  drepScore: number;
  sizeTier: string;
  effectiveParticipation: number;
  alignmentTreasuryConservative?: number | null;
  alignmentTreasuryGrowth?: number | null;
  alignmentDecentralization?: number | null;
  alignmentSecurity?: number | null;
  alignmentInnovation?: number | null;
  alignmentTransparency?: number | null;
}

interface PulseData {
  totalAdaGoverned: string;
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  votesThisWeek: number;
  claimedDReps: number;
}

interface HomepageDualModeProps {
  pulseData: PulseData;
  topDReps: PreviewDRep[];
  ssrHolderData?: any;
  ssrWalletAddress?: string | null;
}

export function HomepageDualMode({ pulseData, topDReps, ssrHolderData, ssrWalletAddress }: HomepageDualModeProps) {
  const [personalCard, setPersonalCard] = useState<any>(null);

  const handlePersonalCard = useCallback((data: any) => {
    setPersonalCard(data);
  }, []);

  return (
    <div>
      <ConstellationHero
        stats={{
          totalAdaGoverned: pulseData.totalAdaGoverned,
          activeProposals: pulseData.activeProposals,
          activeDReps: pulseData.activeDReps,
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

      <div className="container mx-auto px-4 space-y-12 py-8">
        <div className="flex justify-center">
          <GovernanceHealthIndex size="compact" className="opacity-80 hover:opacity-100 transition-opacity" />
        </div>

        <FeatureGate flag="cross_chain_observatory">
          <GovernanceObservatory variant="compact" className="opacity-80 hover:opacity-100 transition-opacity" />
        </FeatureGate>

        <HowItWorksV2 />

        {!personalCard && (
          <CardanoGovernanceExplainer
            activeDReps={pulseData.activeDReps}
            activeProposals={pulseData.activeProposals}
            totalAdaGoverned={pulseData.totalAdaGoverned}
          />
        )}

        <DRepDiscoveryPreview dreps={topDReps} />

        <footer className="text-center py-8 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Governance intelligence for Cardano
          </p>
          <a
            href="https://www.cardano.org/governance/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground/60 hover:text-primary transition-colors"
          >
            New to Cardano governance?
          </a>
        </footer>
      </div>
    </div>
  );
}
