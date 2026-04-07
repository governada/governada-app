'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { CitizenPulseReadOnly } from '@/components/governada/proposals/CitizenPulseReadOnly';
import { CitizenEngagementSection } from '@/components/governada/proposals/CitizenEngagementSection';
import { ProposalDepthGate } from '@/components/governada/proposals/ProposalDepthGate';
import { ProposalBridge } from '@/components/governada/proposals/ProposalBridge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  CITIZEN_PROPOSAL_ACTION_ID,
  getProposalGovernanceActionState,
} from '@/lib/navigation/proposalAction';

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
  proposalAbstract: _proposalAbstract,
  proposalType,
  paramChanges,
  aiSummary: _aiSummary,
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

  const actionState = getProposalGovernanceActionState(segment, isOpen, proposalType, paramChanges);

  if (actionState.isGovernanceActor) {
    return (
      <section className="space-y-4">
        <ProposalBridge
          txHash={txHash}
          proposalIndex={proposalIndex}
          title={title}
          isOpen={isOpen}
          proposalType={proposalType}
          paramChanges={paramChanges}
        />

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
    <section id={CITIZEN_PROPOSAL_ACTION_ID}>
      <CitizenEngagementSection
        txHash={txHash}
        proposalIndex={proposalIndex}
        proposalTitle={title}
        isOpen={isOpen}
      />
    </section>
  );
}
