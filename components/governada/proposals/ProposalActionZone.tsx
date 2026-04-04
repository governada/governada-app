'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { VoteRationaleFlow } from '@/components/governada/proposals/VoteRationaleFlow';
import { CitizenPulseReadOnly } from '@/components/governada/proposals/CitizenPulseReadOnly';
import { CitizenEngagementSection } from '@/components/governada/proposals/CitizenEngagementSection';
import { ProposalDepthGate } from '@/components/governada/proposals/ProposalDepthGate';
import { canBodyVote } from '@/lib/governance/votingBodies';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

interface ProposalActionZoneProps {
  txHash: string;
  proposalIndex: number;
  title: string;
  isOpen: boolean;
  proposalAbstract?: string | null;
  proposalType?: string | null;
  paramChanges?: Record<string, unknown> | null;
  aiSummary?: string | null;
}

/**
 * Persona-branching action zone for the proposal detail page.
 *
 * - DRep/SPO: Vote flow (full width) + read-only citizen pulse
 * - Citizen: Unified engagement section (sentiment + concerns + ask DRep)
 * - Anonymous: Blurred teaser with wallet-connect CTA
 */
export function ProposalActionZone({
  txHash,
  proposalIndex,
  title,
  isOpen,
  proposalAbstract,
  proposalType,
  paramChanges,
  aiSummary,
}: ProposalActionZoneProps) {
  const { segment, isLoading } = useSegment();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 flex-1" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isGovernanceActor = segment === 'drep' || segment === 'spo' || segment === 'cc';

  // For governance actors: check if their body can vote on this proposal type
  const effectiveType = proposalType ?? 'InfoAction';
  const voterBody = segment === 'spo' ? 'spo' : segment === 'cc' ? 'cc' : 'drep';
  const canVote = isGovernanceActor && canBodyVote(voterBody, effectiveType, paramChanges);

  if (isGovernanceActor) {
    return (
      <section className="space-y-4">
        {/* Vote flow: only if this body can vote on this proposal type */}
        {canVote && (
          <VoteRationaleFlow
            txHash={txHash}
            proposalIndex={proposalIndex}
            title={title}
            isOpen={isOpen}
            proposalAbstract={proposalAbstract}
            proposalType={proposalType}
            aiSummary={aiSummary}
          />
        )}

        {/* Read-only citizen pulse (what citizens think) */}
        <CitizenPulseReadOnly txHash={txHash} proposalIndex={proposalIndex} />
      </section>
    );
  }

  // Anonymous: blurred teaser with CTA
  if (segment === 'anonymous') {
    return (
      <ProposalDepthGate message="See how citizens feel about this proposal" surface="action-zone">
        <CitizenEngagementSection
          txHash={txHash}
          proposalIndex={proposalIndex}
          proposalTitle={title}
          isOpen={isOpen}
        />
      </ProposalDepthGate>
    );
  }

  // Connected citizen — full engagement section
  return (
    <section>
      <CitizenEngagementSection
        txHash={txHash}
        proposalIndex={proposalIndex}
        proposalTitle={title}
        isOpen={isOpen}
      />
    </section>
  );
}
