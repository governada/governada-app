'use client';

import { useWallet } from '@/utils/wallet';
import { useSegment } from '@/components/providers/SegmentProvider';
import { Shield } from 'lucide-react';
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
    const holder = holderData as Record<string, unknown> | undefined;
    const timeline = timelineData as Record<string, unknown> | undefined;

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
      init.drepName = (holder.drepName as string) || 'Your DRep';
      init.proposalCount = (holder.proposalsVotedOn as number) || 0;
      init.pollCount = (holder.pollCount as number) || 0;
      init.visitStreak = (holder.visitStreak as number) || 0;
      init.isDelegated = !!(holder.delegatedDrepId as string | undefined);
      init.level = checkLevel(init.pollCount, init.visitStreak, init.isDelegated);

      if (holder.delegatedSince) {
        const milestones = checkDelegationMilestones(new Date(holder.delegatedSince as string), []);
        if (milestones.length > 0) {
          init.milestone = milestones[milestones.length - 1];
        }
      }
    }

    if ((timeline?.events as unknown[] | undefined)?.length) {
      const summaryEvent = (timeline!.events as Record<string, unknown>[]).find(
        (e: Record<string, unknown>) => e.type === 'epoch_summary',
      );
      if (summaryEvent?.data) {
        const eventData = summaryEvent.data as Record<string, unknown>;
        init.epochSummary = {
          epoch: (summaryEvent.epoch as number) || 0,
          summary: {
            proposalsClosed: (eventData.proposalsClosed as number) || 0,
            proposalsOpened: (eventData.proposalsOpened as number) || 0,
            drepVoteCount: (eventData.drepVoteCount as number) || 0,
            drepRationaleCount: (eventData.drepRationaleCount as number) || 0,
            representationScore: (eventData.representationScore as number | null) ?? null,
            repScoreDelta: (eventData.repScoreDelta as number | null) ?? null,
            highlightProposal:
              (eventData.highlightProposal as { title: string; outcome: string } | null) ?? null,
          },
        };
      }
    }

    return init;
  }, [holderData, timelineData, isAuthenticated, address, delegatedDrepId]);

  const { isViewingAs, segment } = useSegment();

  if (isViewingAs && (!connected || !isAuthenticated || !state)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          Preview mode — viewing as {segment}. Connect a wallet to see real citizen governance data.
        </div>
      </div>
    );
  }

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
