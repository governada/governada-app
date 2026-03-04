'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, ArrowRight, ShieldCheck, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GovTerm } from '@/components/GovTerm';
import { useSPOPoolCompetitive } from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';

const TIER_COLORS: Record<string, string> = {
  Emerging: 'text-muted-foreground',
  Bronze: 'text-amber-600',
  Silver: 'text-slate-400',
  Gold: 'text-yellow-500',
  Diamond: 'text-cyan-400',
  Legendary: 'text-violet-400',
};

const TIER_BG: Record<string, string> = {
  Emerging: 'bg-card border-border',
  Bronze: 'bg-amber-950/20 border-amber-800/25',
  Silver: 'bg-slate-900/30 border-slate-700/25',
  Gold: 'bg-yellow-950/20 border-yellow-800/25',
  Diamond: 'bg-cyan-950/20 border-cyan-800/25',
  Legendary: 'bg-violet-950/20 border-violet-800/25',
};

function SparkLine({ history }: { history: { governance_score: number }[] }) {
  if (!history || history.length < 2) return null;
  const scores = [...history].reverse().map((h) => h.governance_score ?? 0);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pts = scores
    .map((s, i) => {
      const x = (i / (scores.length - 1)) * w;
      const y = h - ((s - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
  const trend = scores[scores.length - 1] - scores[0];
  const color = trend > 0 ? '#34d399' : trend < 0 ? '#f87171' : '#6b7280';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeSPO() {
  const { poolId } = useSegment();
  const { data: competitiveRaw, isLoading } = useSPOPoolCompetitive(poolId);
  const competitive = competitiveRaw as any;

  const pool = competitive?.pool;
  const rank: number = competitive?.rank ?? 0;
  const totalPools: number = competitive?.totalPools ?? 0;
  const percentile: number = competitive?.percentile ?? 0;
  const neighbors: any[] = competitive?.neighbors ?? [];
  const scoreHistory: any[] = competitive?.scoreHistory ?? [];
  const momentum: number | null = competitive?.momentum ?? null;

  const score: number = pool?.governance_score ?? 0;
  const tier: string = pool?.tier ?? 'Emerging';
  const isClaimed = false; // Server-side claim status deferred; always show soft claim prompt

  if (!poolId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading your pool profile…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16 space-y-4">
      {/* ── Claim prompt (dominates if unclaimed) ───────────────────── */}
      {!isClaimed && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm font-semibold text-foreground">Claim your pool profile</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Claiming your profile lets you add a governance statement, link your rationale feed, and
            build delegator trust. It&apos;s free and takes 2 minutes.
          </p>
          <Button asChild className="w-full">
            <Link href={`/pool/${poolId}#claim`}>
              Claim {pool?.ticker ?? 'your pool'} profile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* ── Governance Score Hero ────────────────────────────────────── */}
      <div
        className={cn('rounded-2xl border p-6 space-y-4', TIER_BG[tier] ?? 'bg-card border-border')}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
              Pool Governance Score
            </p>
            {isLoading ? (
              <Skeleton className="h-16 w-28" />
            ) : (
              <div className="flex items-end gap-3">
                <span
                  className={cn(
                    'font-display text-6xl font-bold tabular-nums leading-none',
                    TIER_COLORS[tier],
                  )}
                >
                  {score}
                </span>
                <div className="pb-1 space-y-0.5">
                  <span
                    className={cn(
                      'block text-sm font-semibold uppercase tracking-wider',
                      TIER_COLORS[tier],
                    )}
                  >
                    {tier}
                  </span>
                  {rank > 0 && (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      Rank #{rank} of {totalPools.toLocaleString()} pools · Top {100 - percentile}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {momentum !== null && momentum > 0.5 && (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              )}
              {momentum !== null && momentum < -0.5 && (
                <TrendingDown className="h-4 w-4 text-rose-400" />
              )}
              {(momentum === null || (momentum >= -0.5 && momentum <= 0.5)) && (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
              <span>
                {momentum !== null && momentum > 0.5
                  ? 'Climbing'
                  : momentum !== null && momentum < -0.5
                    ? 'Sliding'
                    : 'Stable'}
              </span>
            </div>
            <SparkLine history={scoreHistory} />
          </div>
        </div>

        {/* Score components */}
        {pool && (
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              { label: 'Participation', value: pool.participation_pct },
              { label: 'Consistency', value: pool.consistency_pct },
              { label: 'Reliability', value: pool.reliability_pct },
            ].map(({ label, value }) => (
              <div key={label} className="text-center space-y-0.5">
                <p className="font-display text-xl font-bold tabular-nums text-foreground">
                  {value != null ? `${Math.round(value)}%` : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Competitive context ──────────────────────────────────────── */}
      {!isLoading && neighbors.length > 0 && (
        <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Competitive Context
            </p>
          </div>
          <div className="space-y-2">
            {neighbors.map((n: any) => (
              <div
                key={n.poolId}
                className={cn(
                  'flex items-center justify-between text-xs',
                  n.isTarget && 'font-bold text-primary',
                  !n.isTarget && 'text-muted-foreground',
                )}
              >
                <span className="truncate max-w-[200px]">
                  #{n.rank} {n.ticker ?? n.poolName ?? n.poolId.slice(0, 12)}
                  {n.isTarget && ' (You)'}
                </span>
                <span
                  className={cn('tabular-nums', n.isTarget ? 'text-primary' : 'text-foreground')}
                >
                  {n.score ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Education strip ──────────────────────────────────────────── */}
      <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
        Your pool&apos;s governance score measures{' '}
        <GovTerm term="governanceAction">governance action</GovTerm> participation (45%),
        consistency (30%), and reliability (25%) — completely separate from stake size.{' '}
        <Link href="/methodology" className="text-primary hover:underline underline-offset-2">
          Learn how it&apos;s calculated
        </Link>
        .
      </div>

      {/* View full pool profile */}
      <Button asChild variant="outline" className="w-full">
        <Link href={`/pool/${poolId}`}>
          View full pool profile <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
