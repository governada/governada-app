'use client';

import { useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { ShareActions } from '@/components/ShareActions';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Vote,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { posthog } from '@/lib/posthog';

interface EpochSummary {
  proposalsClosed: number;
  proposalsOpened: number;
  drepVoteCount: number;
  drepRationaleCount: number;
  representationScore: number | null;
  repScoreDelta: number | null;
  highlightProposal: { title: string; outcome: string } | null;
}

interface EpochSummaryCardProps {
  epoch: number;
  summary: EpochSummary;
}

function TrendBadge({ delta }: { delta: number }) {
  if (delta > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400 text-xs font-medium">
        <TrendingUp className="h-3.5 w-3.5" />+{delta}
      </span>
    );
  if (delta < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-red-500 text-xs font-medium">
        <TrendingDown className="h-3.5 w-3.5" />
        {delta}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground text-xs font-medium">
      <Minus className="h-3.5 w-3.5" />0
    </span>
  );
}

const OUTCOME_COLORS: Record<string, string> = {
  ratified: 'text-green-600 dark:text-green-400',
  enacted: 'text-green-600 dark:text-green-400',
  expired: 'text-amber-600 dark:text-amber-400',
  dropped: 'text-red-500',
};

export function EpochSummaryCard({ epoch, summary }: EpochSummaryCardProps) {
  useEffect(() => {
    posthog.capture('epoch_summary_viewed', { epoch });
  }, [epoch]);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Epoch {epoch} Summary</CardTitle>
        <CardAction>
          <ShareActions
            url={`${siteUrl}/?epoch=${epoch}`}
            text={`Cardano Epoch ${epoch} governance recap via @DRepScore — ${summary.drepVoteCount} DRep votes, ${summary.proposalsOpened} proposals opened.`}
            imageUrl={`/api/og/epoch-summary?epoch=${epoch}&votes=${summary.drepVoteCount}&rationales=${summary.drepRationaleCount}&proposals=${summary.proposalsOpened}${summary.representationScore != null ? `&repScore=${summary.representationScore}` : ''}`}
            imageFilename={`epoch-${epoch}-summary.png`}
            surface="epoch_summary_card"
            metadata={{ epoch }}
            variant="compact"
          />
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <StatCell
            icon={<FileText className="h-4 w-4 text-blue-500" />}
            label="Proposals Opened"
            value={summary.proposalsOpened}
          />
          <StatCell
            icon={<FileText className="h-4 w-4 text-amber-500" />}
            label="Proposals Closed"
            value={summary.proposalsClosed}
          />
          <StatCell
            icon={<Vote className="h-4 w-4 text-primary" />}
            label="DRep Votes"
            value={summary.drepVoteCount}
          />
          <StatCell
            icon={<ScrollText className="h-4 w-4 text-purple-500" />}
            label="Rationales"
            value={summary.drepRationaleCount}
          />
        </div>

        {summary.representationScore !== null && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
            <span className="text-sm text-muted-foreground">Rep Score</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold tabular-nums">
                {summary.representationScore}
              </span>
              {summary.repScoreDelta !== null && <TrendBadge delta={summary.repScoreDelta} />}
            </div>
          </div>
        )}

        {summary.highlightProposal && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{summary.highlightProposal.title}</p>
              <p
                className={`text-xs font-medium capitalize ${OUTCOME_COLORS[summary.highlightProposal.outcome] ?? 'text-muted-foreground'}`}
              >
                {summary.highlightProposal.outcome}
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <p className="text-xs text-muted-foreground">drepscore.io</p>
      </CardFooter>
    </Card>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div>
        <p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
