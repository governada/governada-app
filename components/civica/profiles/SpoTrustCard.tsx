'use client';

import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VotingPatternBar } from '@/components/civica/shared/VotingPatternBar';
import { spring } from '@/lib/animations';
import {
  getScoreNarrative,
  getParticipationNarrative,
  getGovernanceStyleNarrative,
} from '@/lib/scoring/scoreNarratives';

interface SpoTrustCardProps {
  score: number;
  percentile: number;
  identityLabel: string;
  participationRate: number;
  drepAlignPct: number | null;
  ccAlignPct: number | null;
  endorsementCount: number;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  lastVotedText: string | null;
}

function TrustMetric({
  label,
  value,
  subtext,
  narrative,
  tooltip,
}: {
  label: string;
  value: string;
  subtext?: string;
  narrative?: string;
  tooltip?: string;
}) {
  const content = (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold font-mono tabular-nums">{value}</span>
      {subtext && <span className="text-[10px] text-muted-foreground">{subtext}</span>}
      {narrative && (
        <span className="text-[10px] text-muted-foreground/80 italic leading-tight">
          {narrative}
        </span>
      )}
    </div>
  );

  if (!tooltip) return content;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{content}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[200px]">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getLastVotedNarrative(text: string | null): string | undefined {
  if (!text) return undefined;
  if (text.includes('today') || text.includes('yesterday')) return 'Recently active';
  if (text.includes('days')) return 'Active this epoch';
  if (text.includes('week')) return 'Active recently';
  if (text.includes('month')) return 'Governance activity has slowed';
  return 'Long gap since last vote';
}

export function SpoTrustCard({
  score,
  percentile,
  identityLabel,
  participationRate,
  drepAlignPct,
  ccAlignPct,
  endorsementCount,
  totalVotes,
  yesVotes,
  noVotes,
  abstainVotes,
  lastVotedText,
}: SpoTrustCardProps) {
  const { segment } = useSegment();
  const isAnonymous = segment === 'anonymous';
  const isGovernance = segment === 'drep' || segment === 'spo' || segment === 'cc';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-5 space-y-4"
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Trust at a Glance
        </span>
      </div>

      {/* Core metrics — visible to all */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <TrustMetric
          label="Governance Score"
          value={`${score}/100`}
          subtext={percentile > 0 ? `Top ${100 - percentile}%` : undefined}
          narrative={getScoreNarrative({ score, percentile })}
          tooltip="Overall quality score based on participation, deliberation, reliability, and governance identity"
        />
        <TrustMetric
          label="Governance Style"
          value={identityLabel}
          narrative={getGovernanceStyleNarrative(identityLabel)}
          tooltip="Dominant governance philosophy based on voting patterns across 6 dimensions"
        />

        {/* Citizen+ metrics */}
        {!isAnonymous && (
          <>
            <TrustMetric
              label="Votes Cast"
              value={`${participationRate}%`}
              narrative={getParticipationNarrative(participationRate)}
              tooltip="How often this pool votes on governance proposals"
            />
            {lastVotedText && (
              <TrustMetric
                label="Last Voted"
                value={lastVotedText}
                narrative={getLastVotedNarrative(lastVotedText)}
                tooltip="When this pool last cast a governance vote"
              />
            )}
          </>
        )}

        {/* Governance-only metrics */}
        {isGovernance && (
          <>
            {drepAlignPct !== null && (
              <TrustMetric
                label="Agrees with DReps"
                value={`${drepAlignPct}%`}
                subtext="of the time"
                tooltip="How often this pool votes the same way as the DRep majority"
              />
            )}
            {ccAlignPct !== null && (
              <TrustMetric
                label="Agrees with CC"
                value={`${ccAlignPct}%`}
                subtext="of the time"
                tooltip="How often this pool votes the same way as the Constitutional Committee majority"
              />
            )}
            {endorsementCount > 0 && (
              <TrustMetric
                label="Citizen Endorsements"
                value={endorsementCount.toLocaleString()}
                tooltip="Number of citizens who have endorsed this pool across governance competencies"
              />
            )}
          </>
        )}
      </div>

      {/* Voting pattern bar — governance only */}
      {isGovernance && totalVotes > 0 && (
        <VotingPatternBar yesVotes={yesVotes} noVotes={noVotes} abstainVotes={abstainVotes} />
      )}
    </motion.div>
  );
}
