'use client';

import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ShieldCheck,
  Trophy,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GovTerm } from '@/components/GovTerm';
import { useSPOPoolCompetitive } from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';
import dynamic from 'next/dynamic';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);

import {
  TIER_SCORE_COLOR,
  TIER_BG as TIER_BG_BASE,
  TIER_BORDER,
  TIER_HERO_COLORS as TIER_HERO_BASE,
} from '@/components/governada/cards/tierStyles';

const TIER_COLORS: Record<string, string> = TIER_SCORE_COLOR;
const TIER_HERO_COLORS: Record<string, string> = TIER_HERO_BASE;

/* Scorecard backgrounds include backdrop-blur for constellation overlay */
const TIER_BG: Record<string, string> = Object.fromEntries(
  Object.entries(TIER_BG_BASE).map(([k, v]) => [
    k,
    `${v} ${TIER_BORDER[k as keyof typeof TIER_BORDER]} backdrop-blur-md`,
  ]),
);

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
  const competitive = competitiveRaw as Record<string, unknown> | undefined;

  const pool = competitive?.pool as Record<string, unknown> | undefined;
  const rank: number = (competitive?.rank as number) ?? 0;
  const totalPools: number = (competitive?.totalPools as number) ?? 0;
  const percentile: number = (competitive?.percentile as number) ?? 0;
  const neighbors: {
    poolId: string;
    ticker?: string;
    poolName?: string;
    rank?: number;
    score?: number;
    isTarget?: boolean;
  }[] =
    (competitive?.neighbors as {
      poolId: string;
      ticker?: string;
      poolName?: string;
      rank?: number;
      score?: number;
      isTarget?: boolean;
    }[]) ?? [];
  const scoreHistory: { governance_score: number }[] =
    (competitive?.scoreHistory as { governance_score: number }[]) ?? [];
  const momentum: number | null = (competitive?.momentum as number) ?? null;

  const score: number = (pool?.governance_score as number) ?? 0;
  const tier: string = (pool?.tier as string) ?? 'Emerging';
  const ticker: string = (pool?.ticker as string) ?? '';
  const isClaimed = !!pool?.claimed_by;

  const momentumLabel =
    momentum !== null && momentum > 0.5
      ? 'Climbing'
      : momentum !== null && momentum < -0.5
        ? 'Sliding'
        : 'Stable';

  if (!poolId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-xl border border-border bg-muted/10 p-6 flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Viewing as an unclaimed SPO</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connect a wallet with an active pool registration to see the full dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col">
      {/* ── Constellation hero (25vh) — "You help run this network" ── */}
      <section className="relative h-[25vh] min-h-[180px] sm:-mt-14 overflow-hidden">
        <div className="absolute inset-0">
          <ConstellationScene className="w-full h-full" interactive={false} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Pool identity overlay */}
        <div className="absolute inset-0 flex items-center justify-center px-4 sm:pt-14">
          <div className="text-center space-y-1">
            <p className="font-display text-sm sm:text-base font-medium text-[#fff0d4] tracking-wide hero-text-shadow">
              Pool Governance Score
            </p>
            {isLoading ? (
              <div className="h-16 flex items-center justify-center">
                <Skeleton className="h-14 w-24 bg-white/10" />
              </div>
            ) : (
              <div className="flex items-end justify-center gap-3">
                <span className="relative">
                  <span
                    className="absolute inset-0 -inset-x-4 -inset-y-2 rounded-full blur-2xl opacity-30 animate-pulse"
                    style={{
                      background:
                        tier === 'Diamond'
                          ? 'radial-gradient(circle, rgba(34,211,238,0.4), transparent 70%)'
                          : tier === 'Legendary'
                            ? 'radial-gradient(circle, rgba(167,139,250,0.4), transparent 70%)'
                            : tier === 'Gold'
                              ? 'radial-gradient(circle, rgba(234,179,8,0.3), transparent 70%)'
                              : tier === 'Silver'
                                ? 'radial-gradient(circle, rgba(148,163,184,0.3), transparent 70%)'
                                : tier === 'Bronze'
                                  ? 'radial-gradient(circle, rgba(217,119,6,0.3), transparent 70%)'
                                  : 'radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)',
                    }}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      'relative font-display text-6xl sm:text-7xl font-bold tabular-nums leading-none drop-shadow-lg hero-text-shadow',
                      TIER_HERO_COLORS[tier] ?? 'text-white',
                    )}
                  >
                    {score}
                  </span>
                </span>
                <div className="pb-1.5 space-y-0.5 text-left">
                  <span
                    className={cn(
                      'block text-sm font-semibold uppercase tracking-wider hero-text-shadow',
                      TIER_HERO_COLORS[tier] ?? 'text-white/70',
                    )}
                  >
                    {tier}
                  </span>
                  <span className="block text-xs text-white/50 hero-text-shadow tabular-nums">
                    {ticker && <>{ticker} · </>}
                    {rank > 0 ? `#${rank} of ${totalPools.toLocaleString()}` : momentumLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Content cards ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 -mt-4 pb-16 space-y-4 relative z-10">
        {/* ── Claim prompt (dominates if unclaimed) ───────────────── */}
        {!isClaimed && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm font-semibold text-foreground">Claim your pool profile</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Claiming your profile lets you add a governance statement, link your rationale feed,
              and build delegator trust. It&apos;s free and takes 2 minutes.
            </p>
            <Button asChild className="w-full">
              <Link href={`/pool/${poolId}#claim`}>
                Claim {ticker || 'your pool'} profile
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        {/* ── Governance Score card ────────────────────────────────── */}
        <div
          className={cn(
            'rounded-2xl border p-6 space-y-4',
            TIER_BG[tier] ?? 'bg-card/70 border-border/50 backdrop-blur-md',
          )}
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
                        Rank #{rank} of {totalPools.toLocaleString()} pools · Top {100 - percentile}
                        %
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
                <span>{momentumLabel}</span>
              </div>
              <SparkLine history={scoreHistory} />
            </div>
          </div>

          {/* Score components */}
          {pool && (
            <div className="grid grid-cols-3 gap-3 pt-1">
              {[
                { label: 'Participation', value: pool.participation_pct as number | null },
                { label: 'Consistency', value: pool.consistency_pct as number | null },
                { label: 'Reliability', value: pool.reliability_pct as number | null },
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

        {/* ── Competitive context ──────────────────────────────────── */}
        {!isLoading && neighbors.length > 0 && (
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Competitive Context
              </p>
            </div>
            <div className="space-y-2">
              {neighbors.map((n) => (
                <div
                  key={n.poolId as string}
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

        {/* ── Education strip ──────────────────────────────────────── */}
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
    </div>
  );
}
