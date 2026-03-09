'use client';

import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Users,
  AlertTriangle,
  ChevronRight,
  Trophy,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GovTerm } from '@/components/GovTerm';
import { computeTier } from '@/lib/scoring/tiers';
import {
  useDRepReportCard,
  useDashboardUrgent,
  useDashboardCompetitive,
  useDashboardDelegatorTrends,
} from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';
import { ConstellationScene } from '@/components/ConstellationScene';

const TIER_COLORS: Record<string, string> = {
  Emerging: 'text-muted-foreground',
  Bronze: 'text-amber-700 dark:text-amber-600',
  Silver: 'text-slate-500 dark:text-slate-400',
  Gold: 'text-yellow-600 dark:text-yellow-500',
  Diamond: 'text-cyan-600 dark:text-cyan-400',
  Legendary: 'text-violet-600 dark:text-violet-400',
};

const TIER_BG: Record<string, string> = {
  Emerging: 'bg-card border-border',
  Bronze: 'bg-amber-50 dark:bg-amber-950/20 border-amber-300/40 dark:border-amber-800/25',
  Silver: 'bg-slate-50 dark:bg-slate-900/30 border-slate-300/40 dark:border-slate-700/25',
  Gold: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300/50 dark:border-yellow-800/25',
  Diamond: 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-300/50 dark:border-cyan-800/25',
  Legendary: 'bg-violet-50 dark:bg-violet-950/20 border-violet-300/50 dark:border-violet-800/25',
};

/* White-on-constellation tier colors for the hero overlay */
const TIER_HERO_COLORS: Record<string, string> = {
  Emerging: 'text-white/70',
  Bronze: 'text-amber-300',
  Silver: 'text-slate-300',
  Gold: 'text-yellow-300',
  Diamond: 'text-cyan-300',
  Legendary: 'text-violet-300',
};

function SparkLine({ history }: { history: { score: number }[] }) {
  if (!history || history.length < 2) return null;
  const scores = history.map((h) => h.score).reverse();
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

export function HomeDRep() {
  const { drepId } = useSegment();

  const { data: reportCardRaw, isLoading: rcLoading } = useDRepReportCard(drepId);
  const { data: urgentDataRaw, isLoading: urgentLoading } = useDashboardUrgent(drepId);
  const { data: competitiveRaw, isLoading: compLoading } = useDashboardCompetitive(drepId);
  const { data: delegatorTrendsRaw } = useDashboardDelegatorTrends(drepId);

  const reportCard = reportCardRaw as
    | {
        score?: number;
        tier?: string;
        momentum?: number;
        scoreHistory?: { score: number }[];
        pillars?: Record<string, number>;
        [key: string]: unknown;
      }
    | undefined;
  const urgentData = urgentDataRaw as
    | {
        urgent?: { title?: string; txHash?: string; index?: number; epochsRemaining?: number }[];
        [key: string]: unknown;
      }
    | undefined;
  const competitive = competitiveRaw as
    | {
        rank?: number;
        totalActive?: number;
        nearbyAbove?: Record<string, unknown>[];
        nearbyBelow?: Record<string, unknown>[];
        [key: string]: unknown;
      }
    | undefined;
  const delegatorTrends = delegatorTrendsRaw as
    | { current?: number; [key: string]: unknown }
    | undefined;

  const score: number = reportCard?.score ?? 0;
  const tier = reportCard?.tier ?? (score ? computeTier(score) : 'Emerging');
  const momentum: number | null = reportCard?.momentum ?? null;
  const rank: number | null = competitive?.rank ?? null;
  const totalActive: number = competitive?.totalActive ?? 0;
  const delegatorCount: number = delegatorTrends?.current ?? 0;

  const urgentItems = urgentData?.urgent ?? [];
  const topUrgent = urgentItems[0] ?? null;

  if (!drepId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading your governance profile…</p>
      </div>
    );
  }

  const momentumLabel =
    momentum !== null && momentum > 0.5
      ? 'Climbing'
      : momentum !== null && momentum < -0.5
        ? 'Sliding'
        : 'Stable';

  return (
    <div className="relative flex flex-col">
      {/* ── Constellation hero (25vh) — "You are governance" ──────── */}
      <section className="relative h-[25vh] min-h-[180px] sm:-mt-14 overflow-hidden">
        <div className="absolute inset-0">
          <ConstellationScene className="w-full h-full" interactive={false} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Score-in-the-cosmos overlay */}
        <div className="absolute inset-0 flex items-center justify-center px-4 sm:pt-14">
          <div className="text-center space-y-1">
            <p className="font-display text-sm sm:text-base font-medium text-[#fff0d4] tracking-wide hero-text-shadow">
              Your Governance Score
            </p>
            {rcLoading ? (
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
                    {rank !== null ? `#${rank} of ${totalActive.toLocaleString()}` : momentumLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Content cards ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 -mt-4 pb-16 space-y-4 relative z-10">
        {/* ── Score + pillars card ─────────────────────────────────── */}
        <div
          className={cn(
            'rounded-2xl border p-6 space-y-4',
            TIER_BG[tier] ?? 'bg-card border-border',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Your <GovTerm term="drepScore">Governance Score</GovTerm>
              </p>
              {rcLoading ? (
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
                    {rank !== null && (
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        Rank #{rank} of {totalActive.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* Momentum indicator */}
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
              {reportCard?.scoreHistory && <SparkLine history={reportCard.scoreHistory} />}
            </div>
          </div>

          {/* Pillar bars */}
          {reportCard?.pillars && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                { key: 'engagementQuality', label: 'Engagement', weight: '35%' },
                { key: 'effectiveParticipation', label: 'Participation', weight: '25%' },
                { key: 'reliability', label: 'Reliability', weight: '25%' },
                { key: 'governanceIdentity', label: 'Identity', weight: '15%' },
              ].map(({ key, label, weight }) => {
                const v = Math.round(reportCard.pillars![key] ?? 0);
                return (
                  <div key={key} className="space-y-0.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>
                        {label} <span className="opacity-50">({weight})</span>
                      </span>
                      <span className="tabular-nums font-medium text-foreground">{v}</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${v}%`,
                          background: `hsl(var(--primary) / ${0.4 + v / 200})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Delegator headline ───────────────────────────────────── */}
        <div className="flex items-center gap-3 px-1">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {delegatorCount.toLocaleString()}
            </span>{' '}
            delegators trust you with their <GovTerm term="votingPower">voting power</GovTerm>
          </p>
        </div>

        {/* ── Quick Win card ───────────────────────────────────────── */}
        {!urgentLoading && topUrgent && (
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Quick Win — Vote Expiring
              </p>
            </div>
            <p className="text-sm font-medium text-foreground line-clamp-2">{topUrgent.title}</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {topUrgent.epochsRemaining === 0
                  ? 'Expires this epoch'
                  : `${topUrgent.epochsRemaining} epoch${topUrgent.epochsRemaining !== 1 ? 's' : ''} remaining`}
              </span>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-amber-700/50 text-amber-400 hover:bg-amber-950/40"
              >
                <Link href={`/proposal/${topUrgent.txHash}/${topUrgent.index}`}>
                  Vote now <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {urgentLoading && <Skeleton className="h-24 rounded-xl" />}

        {!urgentLoading && urgentItems.length === 0 && (
          <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/10 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-sm font-medium text-foreground">
                All caught up — no urgent votes this epoch
              </p>
            </div>
          </div>
        )}

        {/* ── Competitive context ──────────────────────────────────── */}
        {!compLoading && (competitive?.nearbyAbove?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Competitive Context
              </p>
            </div>
            <div className="space-y-2">
              {competitive!.nearbyAbove?.map((d) => (
                <div key={d.drepId as string} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[200px]">
                    #{d.rank as React.ReactNode} {d.name as React.ReactNode}
                  </span>
                  <span className="tabular-nums font-medium text-foreground">
                    {d.score as React.ReactNode}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                <span className="font-medium text-primary">#{rank} You</span>
                <span className="tabular-nums font-bold text-primary">{score}</span>
              </div>
              {competitive!.nearbyBelow?.map((d) => (
                <div key={d.drepId as string} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[200px]">
                    #{d.rank as React.ReactNode} {d.name as React.ReactNode}
                  </span>
                  <span className="tabular-nums font-medium text-foreground">
                    {d.score as React.ReactNode}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full profile CTA */}
        <Button asChild variant="outline" className="w-full">
          <Link href={`/drep/${drepId}`}>
            View full profile <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
