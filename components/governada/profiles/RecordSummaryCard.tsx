'use client';

import { motion } from 'framer-motion';
import { FileText, CheckCircle2, AlertTriangle, XCircle, Clock, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDRepOutcomeSummary, useDRepNclImpact } from '@/hooks/queries';
import type { DRepOutcomeSummary as DRepOutcomeSummaryType } from '@/lib/proposalOutcomes';
import { spring } from '@/lib/animations';

interface RecordSummaryCardProps {
  drepId: string;
  totalVotes: number;
  participationRate: number;
  rationaleRate: number;
}

function generateRecordNarrative(
  summary: DRepOutcomeSummaryType | undefined,
  totalVotes: number,
  rationaleRate: number,
): string {
  if (!summary || summary.enactedProposals === 0) {
    return `This DRep has voted on ${totalVotes} proposals, providing rationale ${rationaleRate}% of the time. Treasury outcomes tracking will grow as enacted proposals are evaluated.`;
  }

  const { enactedProposals, deliveredCount, approvalSuccessRate, avgDeliveryScore } = summary;
  const parts: string[] = [];

  if (approvalSuccessRate != null && approvalSuccessRate >= 70) {
    parts.push(
      `Strong track record — ${approvalSuccessRate}% of proposals this DRep supported have delivered on their promises.`,
    );
  } else if (approvalSuccessRate != null && approvalSuccessRate >= 40) {
    parts.push(
      `Mixed track record — ${approvalSuccessRate}% of proposals this DRep supported have delivered.`,
    );
  } else if (approvalSuccessRate != null) {
    parts.push(
      `Developing track record — ${approvalSuccessRate}% of backed proposals have delivered so far.`,
    );
  }

  if (deliveredCount > 0 && enactedProposals > 0) {
    parts.push(
      `${deliveredCount} of ${enactedProposals} enacted proposals delivered successfully.`,
    );
  }

  if (avgDeliveryScore != null) {
    const quality =
      avgDeliveryScore >= 70 ? 'strong' : avgDeliveryScore >= 40 ? 'moderate' : 'developing';
    parts.push(`Average delivery score of ${avgDeliveryScore}/100 (${quality}).`);
  }

  return parts.join(' ');
}

export function RecordSummaryCard({
  drepId,
  totalVotes,
  participationRate,
  rationaleRate,
}: RecordSummaryCardProps) {
  const { data: raw, isLoading } = useDRepOutcomeSummary(drepId);
  const { data: nclRaw } = useDRepNclImpact(drepId);
  const summary = raw as DRepOutcomeSummaryType | undefined;
  const nclImpact = (
    nclRaw as
      | {
          impact: {
            approvedAda: number;
            opposedAda: number;
            approvedPct: number;
            opposedPct: number;
            nclAda: number;
            judgmentScore: number | null;
          } | null;
        }
      | undefined
  )?.impact;

  if (isLoading) return null;

  const narrative = generateRecordNarrative(summary, totalVotes, rationaleRate);
  const hasOutcomes = summary && summary.enactedProposals > 0;
  const totalResolved = hasOutcomes
    ? summary.deliveredCount + summary.partialCount + summary.notDeliveredCount
    : 0;
  const totalOutcomeBar = hasOutcomes ? totalResolved + summary.inProgressCount : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-5 space-y-4"
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          The Record
        </span>
      </div>

      {/* Lead narrative */}
      <p className="text-sm text-muted-foreground leading-relaxed">{narrative}</p>

      {/* Key metrics when outcomes exist */}
      {hasOutcomes && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Proposals Voted</p>
            <p className="text-xl font-bold tabular-nums">{summary.totalVotedProposals}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Enacted</p>
            <p className="text-xl font-bold tabular-nums">{summary.enactedProposals}</p>
          </div>
          {summary.avgDeliveryScore != null && (
            <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Delivery Score</p>
              <p
                className={`text-xl font-bold tabular-nums ${
                  summary.avgDeliveryScore >= 70
                    ? 'text-emerald-500'
                    : summary.avgDeliveryScore >= 40
                      ? 'text-amber-500'
                      : 'text-rose-500'
                }`}
              >
                {summary.avgDeliveryScore}
                <span className="text-xs font-normal text-muted-foreground">/100</span>
              </p>
            </div>
          )}
          {summary.approvalSuccessRate != null && (
            <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className="text-xl font-bold tabular-nums">
                {summary.approvalSuccessRate}
                <span className="text-xs font-normal text-muted-foreground">%</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Outcome breakdown bar */}
      {hasOutcomes && totalOutcomeBar > 0 && (
        <div className="space-y-1.5">
          <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-border">
            {summary.deliveredCount > 0 && (
              <div
                className="h-full bg-emerald-500"
                style={{
                  width: `${(summary.deliveredCount / totalOutcomeBar) * 100}%`,
                }}
              />
            )}
            {summary.partialCount > 0 && (
              <div
                className="h-full bg-amber-500"
                style={{
                  width: `${(summary.partialCount / totalOutcomeBar) * 100}%`,
                }}
              />
            )}
            {summary.notDeliveredCount > 0 && (
              <div
                className="h-full bg-rose-500"
                style={{
                  width: `${(summary.notDeliveredCount / totalOutcomeBar) * 100}%`,
                }}
              />
            )}
            {summary.inProgressCount > 0 && (
              <div
                className="h-full bg-blue-500"
                style={{
                  width: `${(summary.inProgressCount / totalOutcomeBar) * 100}%`,
                }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            {summary.deliveredCount > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {summary.deliveredCount} delivered
              </span>
            )}
            {summary.partialCount > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                {summary.partialCount} partial
              </span>
            )}
            {summary.notDeliveredCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-rose-500" />
                {summary.notDeliveredCount} not delivered
              </span>
            )}
            {summary.inProgressCount > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-blue-500" />
                {summary.inProgressCount} in progress
              </span>
            )}
          </div>
        </div>
      )}

      {/* NCL Treasury Voting Record */}
      {nclImpact && (nclImpact.approvedAda > 0 || nclImpact.opposedAda > 0) && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Landmark className="h-3 w-3 text-amber-400" />
            Treasury Voting Record
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {nclImpact.approvedAda > 0 && (
              <div>
                <span className="text-muted-foreground">Approved: </span>
                <span className="font-semibold tabular-nums text-foreground">
                  ₳
                  {nclImpact.approvedAda >= 1_000_000
                    ? `${(nclImpact.approvedAda / 1_000_000).toFixed(1)}M`
                    : `${(nclImpact.approvedAda / 1_000).toFixed(0)}K`}
                </span>
                <span
                  className={cn(
                    'text-xs ml-1',
                    nclImpact.approvedPct >= 40 ? 'text-amber-400' : 'text-muted-foreground',
                  )}
                >
                  ({nclImpact.approvedPct}% of budget)
                </span>
              </div>
            )}
            {nclImpact.opposedAda > 0 && (
              <div>
                <span className="text-muted-foreground">Opposed: </span>
                <span className="font-semibold tabular-nums text-foreground">
                  ₳
                  {nclImpact.opposedAda >= 1_000_000
                    ? `${(nclImpact.opposedAda / 1_000_000).toFixed(1)}M`
                    : `${(nclImpact.opposedAda / 1_000).toFixed(0)}K`}
                </span>
              </div>
            )}
          </div>
          {nclImpact.judgmentScore != null && (
            <p className="text-xs text-muted-foreground">
              Judgment: {nclImpact.judgmentScore}% of approved proposals delivered
            </p>
          )}
        </div>
      )}

      {/* Participation context */}
      <p className="text-xs text-muted-foreground">
        Votes on {participationRate}% of proposals · Explains reasoning {rationaleRate}% of the time
      </p>
    </motion.div>
  );
}
