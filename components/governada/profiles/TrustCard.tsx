'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Landmark,
} from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { spring } from '@/lib/animations';
import {
  getScoreNarrative,
  getParticipationNarrative,
  getRationaleNarrative,
  getGovernanceStyleNarrative,
} from '@/lib/scoring/scoreNarratives';

interface DivergenceExample {
  txHash: string;
  index: number;
  title: string;
  drepVote: string;
  citizenMajority: string;
  citizenMajorityPct: number;
}

interface EngagementData {
  proposalsWithSentiment: number;
  totalCitizenVotes: number;
  sentimentAlignment: number | null;
  alignedCount: number;
  divergedCount: number;
  noSentimentCount: number;
  divergenceExamples?: DivergenceExample[];
}

interface TrustCardProps {
  score: number;
  percentile: number;
  identityLabel: string;
  participationRate: number;
  rationaleRate: number;
  spoAlignPct: number | null;
  endorsementCount: number;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  drepId: string;
  treasuryJudgmentScore: number | null;
  treasuryProposalCount: number;
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

const SENTIMENT_LABELS: Record<string, string> = {
  support: 'Support',
  oppose: 'Oppose',
  unsure: 'Unsure',
};

export function TrustCard({
  score,
  percentile,
  identityLabel,
  participationRate,
  rationaleRate,
  spoAlignPct,
  endorsementCount,
  totalVotes,
  yesVotes,
  noVotes,
  abstainVotes,
  drepId,
  treasuryJudgmentScore,
  treasuryProposalCount,
}: TrustCardProps) {
  const { segment } = useSegment();
  const isAnonymous = segment === 'anonymous';
  const isGovernance = segment === 'drep' || segment === 'spo' || segment === 'cc';
  const [divergenceExpanded, setDivergenceExpanded] = useState(false);

  // Citizen sentiment data — only fetch for non-anonymous
  const { data: engagement } = useQuery<EngagementData>({
    queryKey: ['drep-engagement', drepId],
    queryFn: () =>
      fetch(`/api/drep/${encodeURIComponent(drepId)}/engagement`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    enabled: !isAnonymous,
  });

  const alignment = engagement?.sentimentAlignment ?? null;
  const compared = (engagement?.alignedCount ?? 0) + (engagement?.divergedCount ?? 0);
  const hasDivergence = engagement?.divergenceExamples && engagement.divergenceExamples.length > 0;

  const alignColor =
    alignment != null && alignment >= 70
      ? 'text-emerald-500'
      : alignment != null && alignment < 50
        ? 'text-rose-500'
        : 'text-amber-500';

  const alignLabel =
    alignment != null && alignment >= 70
      ? 'votes with citizen sentiment'
      : alignment != null && alignment < 50
        ? 'diverges from citizen sentiment'
        : 'mixed alignment with citizens';

  const AlignIcon =
    alignment != null && alignment >= 70
      ? TrendingUp
      : alignment != null && alignment < 50
        ? TrendingDown
        : Minus;

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
          tooltip="Overall quality score based on participation, rationale, reliability, and profile completeness"
        />
        <TrustMetric
          label="Governance Style"
          value={identityLabel}
          narrative={getGovernanceStyleNarrative(identityLabel)}
          tooltip="Dominant governance philosophy based on voting patterns across 6 dimensions"
        />

        {/* Trust indicators — citizen+ */}
        {!isAnonymous && (
          <>
            <TrustMetric
              label="Votes Cast"
              value={`${participationRate}%`}
              narrative={getParticipationNarrative(participationRate)}
              tooltip="How often this DRep votes on proposals, adjusted for voting pattern diversity"
            />
            <TrustMetric
              label="Explains Votes"
              value={`${rationaleRate}%`}
              narrative={getRationaleNarrative(rationaleRate)}
              tooltip="How often this DRep provides written reasoning for their votes"
            />
          </>
        )}

        {/* Governance-only metrics */}
        {isGovernance && (
          <>
            {spoAlignPct !== null && (
              <TrustMetric
                label="Agrees with SPOs"
                value={`${spoAlignPct}%`}
                subtext="of the time"
                tooltip="How often this DRep votes the same way as the SPO majority"
              />
            )}
            {endorsementCount > 0 && (
              <TrustMetric
                label="Citizen Endorsements"
                value={endorsementCount.toLocaleString()}
                tooltip="Number of citizens who have endorsed this DRep across governance competencies"
              />
            )}
            {treasuryJudgmentScore !== null && treasuryProposalCount > 0 && (
              <TrustMetric
                label="Treasury Stewardship"
                value={`${treasuryJudgmentScore}% delivery`}
                subtext={`on ${treasuryProposalCount} spending proposal${treasuryProposalCount !== 1 ? 's' : ''}`}
                tooltip="Delivery rate of treasury proposals this DRep voted to approve"
              />
            )}
          </>
        )}
      </div>

      {/* Voting pattern bar — governance only */}
      {isGovernance && totalVotes > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Voting Pattern</span>
          <div className="flex h-2 w-full rounded-full overflow-hidden bg-border">
            {yesVotes > 0 && (
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${(yesVotes / totalVotes) * 100}%` }}
              />
            )}
            {noVotes > 0 && (
              <div
                className="h-full bg-rose-500"
                style={{ width: `${(noVotes / totalVotes) * 100}%` }}
              />
            )}
            {abstainVotes > 0 && (
              <div
                className="h-full bg-muted-foreground/40"
                style={{ width: `${(abstainVotes / totalVotes) * 100}%` }}
              />
            )}
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {yesVotes} Yes
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {noVotes} No
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              {abstainVotes} Abstain
            </span>
          </div>
        </div>
      )}

      {/* Citizen sentiment signal — citizen+ */}
      {!isAnonymous && engagement && engagement.proposalsWithSentiment > 0 && (
        <div className="space-y-2 pt-1 border-t border-border/30">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              {alignment != null && (
                <div className="flex items-center gap-1.5">
                  <AlignIcon className={`h-4 w-4 ${alignColor}`} />
                  <span className="text-sm font-medium">
                    <span className={`font-bold tabular-nums ${alignColor}`}>{alignment}%</span>{' '}
                    {alignLabel}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {engagement.totalCitizenVotes.toLocaleString()} citizen
                {engagement.totalCitizenVotes !== 1 ? 's' : ''} expressed views across {compared}{' '}
                proposal
                {compared !== 1 ? 's' : ''}
              </p>
            </div>

            {alignment != null && compared > 0 && (
              <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    alignment >= 70
                      ? 'bg-emerald-500'
                      : alignment >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${alignment}%` }}
                />
              </div>
            )}
          </div>

          {/* Divergence detail toggle */}
          {hasDivergence && (
            <>
              <button
                onClick={() => setDivergenceExpanded(!divergenceExpanded)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {divergenceExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {engagement.divergedCount} divergence
                {engagement.divergedCount !== 1 ? 's' : ''} from citizen sentiment
              </button>

              {divergenceExpanded && (
                <div className="space-y-1.5">
                  {engagement.divergenceExamples!.map((ex) => (
                    <Link
                      key={`${ex.txHash}:${ex.index}`}
                      href={`/proposal/${ex.txHash}/${ex.index}`}
                      className="block rounded-lg border border-border/50 px-3 py-2 hover:bg-muted/30 transition-colors"
                    >
                      <p className="text-xs font-medium text-foreground truncate">{ex.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        DRep voted <span className="font-medium">{ex.drepVote}</span>
                        {' · '}
                        {ex.citizenMajorityPct}% of citizens{' '}
                        {SENTIMENT_LABELS[ex.citizenMajority]?.toLowerCase() ?? ex.citizenMajority}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
