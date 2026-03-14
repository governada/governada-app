'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { DebateSection } from '@/components/governada/proposals/DebateSection';
import { VoteAdoptionCurve } from '@/components/governada/charts/VoteAdoptionCurve';
import { ProposalVoterTabs } from '@/components/ProposalVoterTabs';
import { ProposalDescription } from '@/components/ProposalDescription';
import { ProposalLifecycleTimeline } from '@/components/governada/proposals/ProposalLifecycleTimeline';
import { MessageSquare, TrendingUp, Users, FileText, Clock } from 'lucide-react';
import type { ProposalVoteDetail, VotePowerByEpoch } from '@/lib/data';
import type { RationaleEntry } from './ProposalTopRationales';
import type { ProposalStatus } from '@/utils/proposalPriority';

interface SourceMaterialProps {
  // For DebateSection
  rationales: RationaleEntry[];
  proposalTitle: string;
  txHash: string;
  proposalIndex: number;
  // For VoteAdoptionCurve
  adoptionData: Array<{
    epoch: number;
    yesCount: number;
    noCount: number;
    abstainCount: number;
  }>;
  votePowerByEpoch: VotePowerByEpoch[];
  // For ProposalVoterTabs
  votes: ProposalVoteDetail[];
  status: string;
  proposalType: string;
  // For ProposalDescription
  abstract: string | null;
  // For ProposalLifecycleTimeline
  proposedEpoch: number | null;
  expirationEpoch: number | null;
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  droppedEpoch: number | null;
  expiredEpoch: number | null;
  currentEpoch: number;
}

function trackAccordionExpand(section: string) {
  import('@/lib/posthog').then(({ posthog }) => {
    posthog.capture('proposal_source_material_expanded', {
      section,
    });
  });
}

export function SourceMaterial({
  rationales,
  proposalTitle,
  txHash,
  proposalIndex,
  adoptionData,
  votePowerByEpoch,
  votes,
  status,
  proposalType,
  abstract,
  proposedEpoch,
  expirationEpoch,
  ratifiedEpoch,
  enactedEpoch,
  droppedEpoch,
  expiredEpoch,
  currentEpoch,
}: SourceMaterialProps) {
  const hasAdoptionData = adoptionData.length > 1;

  return (
    <section className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <h2 className="text-lg font-semibold">Source Material</h2>
      </div>

      <div className="px-6 pb-4">
        <Accordion
          type="multiple"
          onValueChange={(values) => {
            // Track newly expanded sections
            for (const v of values) {
              trackAccordionExpand(v);
            }
          }}
        >
          {/* 1. DRep Rationales */}
          <AccordionItem value="rationales">
            <AccordionTrigger className="gap-2">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                DRep Rationales
                <span className="text-xs text-muted-foreground font-normal">
                  ({rationales.length})
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <DebateSection
                rationales={rationales}
                proposalTitle={proposalTitle}
                txHash={txHash}
                proposalIndex={proposalIndex}
              />
            </AccordionContent>
          </AccordionItem>

          {/* 2. Vote Adoption (only when meaningful data exists) */}
          {hasAdoptionData && (
            <AccordionItem value="adoption">
              <AccordionTrigger className="gap-2">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Vote Adoption
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <VoteAdoptionCurve votes={adoptionData} powerByEpoch={votePowerByEpoch} />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* 3. Voter Details */}
          <AccordionItem value="voters">
            <AccordionTrigger className="gap-2">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Voter Details
                <span className="text-xs text-muted-foreground font-normal">({votes.length})</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ProposalVoterTabs
                votes={votes}
                txHash={txHash}
                proposalIndex={proposalIndex}
                status={status as ProposalStatus}
                proposalType={proposalType}
              />
            </AccordionContent>
          </AccordionItem>

          {/* 4. Full Description */}
          <AccordionItem value="description">
            <AccordionTrigger className="gap-2">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Full Description
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ProposalDescription aiSummary={null} abstract={abstract} />
            </AccordionContent>
          </AccordionItem>

          {/* 5. Lifecycle Timeline */}
          <AccordionItem value="lifecycle">
            <AccordionTrigger className="gap-2">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Lifecycle Timeline
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ProposalLifecycleTimeline
                proposedEpoch={proposedEpoch}
                expirationEpoch={expirationEpoch}
                ratifiedEpoch={ratifiedEpoch}
                enactedEpoch={enactedEpoch}
                droppedEpoch={droppedEpoch}
                expiredEpoch={expiredEpoch}
                currentEpoch={currentEpoch}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
}
