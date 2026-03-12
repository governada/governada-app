'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ProposalDivergence {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string | null;
  citizenSentiment: { support: number; oppose: number; unsure: number; total: number };
  drepVote: { yes: number; no: number; abstain: number; total: number };
  divergenceScore: number;
}

interface DivergenceData {
  epoch: number;
  proposals: ProposalDivergence[];
  aggregateDivergence: number;
  updatedAt: string;
}

async function fetchDivergence(): Promise<DivergenceData | null> {
  const res = await fetch('/api/community/divergence');
  if (!res.ok) return null;
  return res.json();
}

export function SentimentDivergence() {
  const { data, isLoading } = useQuery({
    queryKey: ['sentiment-divergence'],
    queryFn: fetchDivergence,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <DivergenceSkeleton />;
  }

  if (!data || data.proposals.length === 0) {
    return null;
  }

  const aggPct = Math.round(data.aggregateDivergence * 100);
  const aggColor =
    aggPct <= 20 ? 'text-emerald-500' : aggPct <= 50 ? 'text-amber-500' : 'text-rose-500';
  const aggLabel =
    aggPct <= 20 ? 'Well Aligned' : aggPct <= 50 ? 'Some Tension' : 'Significant Gap';

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Citizen-DRep Alignment</h3>
        </div>
        <span className="text-xs text-muted-foreground">Epoch {data.epoch}</span>
      </div>

      {/* Aggregate score */}
      <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
        <div className={cn('text-3xl font-bold tabular-nums', aggColor)}>{aggPct}%</div>
        <div>
          <p className={cn('text-sm font-medium', aggColor)}>{aggLabel}</p>
          <p className="text-xs text-muted-foreground">
            Average divergence across {data.proposals.length} proposal
            {data.proposals.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Per-proposal list */}
      <div className="space-y-2">
        {data.proposals.slice(0, 5).map((p) => (
          <ProposalDivergenceRow key={`${p.proposalTxHash}:${p.proposalIndex}`} proposal={p} />
        ))}
      </div>
    </div>
  );
}

function ProposalDivergenceRow({ proposal }: { proposal: ProposalDivergence }) {
  const divPct = Math.round(proposal.divergenceScore * 100);
  const isAligned = divPct <= 20;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/30 px-3 py-2.5">
      {isAligned ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium truncate">
          {proposal.proposalTitle ||
            `${proposal.proposalTxHash.slice(0, 8)}...#${proposal.proposalIndex}`}
        </p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            Citizens: <span className="text-emerald-500">{proposal.citizenSentiment.support}S</span>
            {' / '}
            <span className="text-rose-500">{proposal.citizenSentiment.oppose}O</span>
            {' / '}
            <span>{proposal.citizenSentiment.unsure}U</span>
          </span>
          <span>
            DReps: <span className="text-emerald-500">{proposal.drepVote.yes}Y</span>
            {' / '}
            <span className="text-rose-500">{proposal.drepVote.no}N</span>
            {' / '}
            <span>{proposal.drepVote.abstain}A</span>
          </span>
        </div>
      </div>

      <div
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
          divPct <= 20
            ? 'bg-emerald-500/10 text-emerald-500'
            : divPct <= 50
              ? 'bg-amber-500/10 text-amber-500'
              : 'bg-rose-500/10 text-rose-500',
        )}
      >
        {divPct}%
      </div>
    </div>
  );
}

function DivergenceSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-36 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-16 rounded-lg bg-muted animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
