'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

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

const SENTIMENT_LABELS: Record<string, string> = {
  support: 'Support',
  oppose: 'Oppose',
  unsure: 'Unsure',
};

export function DRepCitizenSignals({ drepId }: { drepId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery<EngagementData>({
    queryKey: ['drep-engagement', drepId],
    queryFn: () =>
      fetch(`/api/drep/${encodeURIComponent(drepId)}/engagement`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data || data.proposalsWithSentiment === 0) return null;

  const alignment = data.sentimentAlignment;
  const compared = data.alignedCount + data.divergedCount;
  const hasDivergence = data.divergenceExamples && data.divergenceExamples.length > 0;

  const AlignIcon =
    alignment != null && alignment >= 70
      ? TrendingUp
      : alignment != null && alignment < 50
        ? TrendingDown
        : Minus;

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
        ? 'often diverges from citizen sentiment'
        : 'mixed alignment with citizen sentiment';

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-2">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Citizen Sentiment Signal
        </span>
      </div>

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
            {data.totalCitizenVotes.toLocaleString()} citizen
            {data.totalCitizenVotes !== 1 ? 's' : ''} expressed views across {compared} proposal
            {compared !== 1 ? 's' : ''}
          </p>
        </div>

        {alignment != null && compared > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  alignment >= 70
                    ? 'bg-emerald-500'
                    : alignment >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}
                style={{ width: `${alignment}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Divergence detail toggle */}
      {hasDivergence && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:underline pt-1"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {data.divergedCount} divergence{data.divergedCount !== 1 ? 's' : ''} from citizen
            sentiment
          </button>

          {expanded && (
            <div className="space-y-1.5 pt-1">
              {data.divergenceExamples!.map((ex) => (
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
  );
}
