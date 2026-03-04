'use client';

import { useWallet } from '@/utils/wallet';
import { GovernanceTimeline } from '@/components/GovernanceTimeline';
import { GovernanceImpactHero } from '@/components/GovernanceImpactHero';
import { GovernanceCitizenPanels } from '@/components/GovernanceCitizenPanels';
import { CohortIdentity } from '@/components/CohortIdentity';
import { DelegatorShareCard } from '@/components/DelegatorShareCard';
import { DelegationAnniversaryCard } from '@/components/DelegationAnniversaryCard';
import { EpochSummaryCard } from '@/components/EpochSummaryCard';

import { GovernanceLevelBadge } from '@/components/GovernanceLevelBadge';
import { checkDelegationMilestones } from '@/lib/delegationMilestones';
import { checkLevel, type GovernanceLevel } from '@/lib/governanceLevels';
import { useMemo } from 'react';
import { useGovernanceHolder, useGovernanceTimeline } from '@/hooks/queries';

interface CitizenState {
  milestone: { key: string; label: string; description: string; days: number } | null;
  drepName: string;
  proposalCount: number;
  epochSummary: {
    epoch: number;
    summary: {
      proposalsClosed: number;
      proposalsOpened: number;
      drepVoteCount: number;
      drepRationaleCount: number;
      representationScore: number | null;
      repScoreDelta: number | null;
      highlightProposal: { title: string; outcome: string } | null;
    };
  } | null;
  level: GovernanceLevel;
  pollCount: number;
  visitStreak: number;
  isDelegated: boolean;
}

export function GovernanceCitizenSection() {
  const { connected, isAuthenticated, address, delegatedDrepId } = useWallet();
  const stakeAddress = isAuthenticated && address ? address : undefined;
  const { data: holderData } = useGovernanceHolder(stakeAddress);
  const { data: timelineData } = useGovernanceTimeline();

  const state = useMemo<CitizenState | null>(() => {
    if (!isAuthenticated || !address) return null;
    const holder = holderData as any;
    const timeline = timelineData as any;

    const init: CitizenState = {
      milestone: null,
      drepName: 'Your DRep',
      proposalCount: 0,
      epochSummary: null,
      level: 'observer',
      pollCount: 0,
      visitStreak: 0,
      isDelegated: !!delegatedDrepId,
    };

    if (holder) {
      init.drepName = holder.drepName || 'Your DRep';
      init.proposalCount = holder.proposalsVotedOn || 0;
      init.pollCount = holder.pollCount || 0;
      init.visitStreak = holder.visitStreak || 0;
      init.isDelegated = !!holder.delegatedDrepId;
      init.level = checkLevel(init.pollCount, init.visitStreak, init.isDelegated);

      if (holder.delegatedSince) {
        const milestones = checkDelegationMilestones(new Date(holder.delegatedSince), []);
        if (milestones.length > 0) {
          init.milestone = milestones[milestones.length - 1];
        }
      }
    }

    if (timeline?.events?.length) {
      const summaryEvent = timeline.events.find(
        (e: { type: string }) => e.type === 'epoch_summary',
      );
      if (summaryEvent?.data) {
        init.epochSummary = {
          epoch: summaryEvent.epoch || 0,
          summary: {
            proposalsClosed: summaryEvent.data.proposalsClosed || 0,
            proposalsOpened: summaryEvent.data.proposalsOpened || 0,
            drepVoteCount: summaryEvent.data.drepVoteCount || 0,
            drepRationaleCount: summaryEvent.data.drepRationaleCount || 0,
            representationScore: summaryEvent.data.representationScore ?? null,
            repScoreDelta: summaryEvent.data.repScoreDelta ?? null,
            highlightProposal: summaryEvent.data.highlightProposal ?? null,
          },
        };
      }
    }

    return init;
  }, [holderData, timelineData, isAuthenticated, address, delegatedDrepId]);

  if (!connected || !isAuthenticated || !state) return null;

  return (
    <div className="space-y-6">
      <GovernanceImpactHero />

      <div className="grid gap-6 md:grid-cols-2">
        <GovernanceLevelBadge
          level={state.level}
          pollCount={state.pollCount}
          visitStreak={state.visitStreak}
          isDelegated={state.isDelegated}
        />
        <CohortIdentity />
      </div>

      {state.milestone && (
        <DelegationAnniversaryCard
          milestone={state.milestone}
          drepName={state.drepName}
          proposalCount={state.proposalCount}
        />
      )}

      {state.epochSummary && (
        <EpochSummaryCard epoch={state.epochSummary.epoch} summary={state.epochSummary.summary} />
      )}

      <GovernanceCitizenPanels />
      <GovernanceTimeline />
      <DelegatorShareCard />
    </div>
  );
}
