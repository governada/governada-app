'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Users,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Info,
  Coins,
  Newspaper,
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
  useTreasuryCurrent,
} from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';
import { DepthGate } from '@/components/providers/DepthGate';
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

/* Retyped for string indexing — tiers come as strings from the API */
const TIER_COLORS: Record<string, string> = TIER_SCORE_COLOR;
const TIER_HERO_COLORS: Record<string, string> = TIER_HERO_BASE;

/* Scorecard backgrounds include backdrop-blur for constellation overlay */
const TIER_BG: Record<string, string> = Object.fromEntries(
  Object.entries(TIER_BG_BASE).map(([k, v]) => [
    k,
    `${v} ${TIER_BORDER[k as keyof typeof TIER_BORDER]} backdrop-blur-md`,
  ]),
);

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

/* ── Citizen briefing hook (compact) ────────────────────────── */

interface BriefingHeadline {
  type: string;
  title: string;
  description: string;
}

interface CitizenBriefingCompact {
  epoch: number;
  headlines?: BriefingHeadline[];
}

function useCitizenBriefingCompact(stakeAddress: string | null) {
  return useQuery<CitizenBriefingCompact>({
    queryKey: ['citizen-briefing', stakeAddress],
    queryFn: async () => {
      const url = stakeAddress
        ? `/api/briefing/citizen?wallet=${encodeURIComponent(stakeAddress)}`
        : '/api/briefing/citizen';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

function formatAdaCompact(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

/* ── Main component ─────────────────────────────────────────── */

export function HomeDRep() {
  const { drepId, stakeAddress } = useSegment();

  const { data: reportCardRaw, isLoading: rcLoading } = useDRepReportCard(drepId);
  const { data: urgentDataRaw, isLoading: urgentLoading } = useDashboardUrgent(drepId);
  const { data: competitiveRaw } = useDashboardCompetitive(drepId);
  const { data: delegatorTrendsRaw } = useDashboardDelegatorTrends(drepId);
  const { data: briefingData } = useCitizenBriefingCompact(stakeAddress);
  const { data: rawTreasury } = useTreasuryCurrent();

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
        [key: string]: unknown;
      }
    | undefined;
  const delegatorTrends = delegatorTrendsRaw as
    | { current?: number; delta?: number; [key: string]: unknown }
    | undefined;
  const treasury = rawTreasury as { balance?: number; trend?: string } | undefined;

  const score: number = reportCard?.score ?? 0;
  const tier = reportCard?.tier ?? (score ? computeTier(score) : 'Emerging');
  const momentum: number | null = reportCard?.momentum ?? null;
  const rank: number | null = competitive?.rank ?? null;
  const totalActive: number = competitive?.totalActive ?? 0;
  const delegatorCount: number = delegatorTrends?.current ?? 0;
  const delegatorDelta: number = (delegatorTrends?.delta as number) ?? 0;

  const urgentItems = urgentData?.urgent ?? [];
  const topUrgent = urgentItems[0] ?? null;

  if (!drepId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-xl border border-border bg-muted/10 p-6 flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Viewing as an unclaimed DRep</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connect a wallet with an active DRep registration to see the full dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const momentumLabel =
    momentum !== null && momentum > 0.5
      ? 'Climbing'
      : momentum !== null && momentum < -0.5
        ? 'Sliding'
        : 'Stable';

  // Citizen briefing headlines (compact — max 3)
  const briefingHeadlines = briefingData?.headlines?.slice(0, 3) ?? [];

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
        {/* ── Score hero card (simplified — no pillar breakdown) ───── */}
        <div
          className={cn(
            'rounded-2xl border p-6',
            TIER_BG[tier] ?? 'bg-card/70 border-border/50 backdrop-blur-md',
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
        </div>

        {/* ── Delegator headline ───────────────────────────────────── */}
        <div className="flex items-center gap-3 px-1">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {delegatorCount.toLocaleString()}
            </span>{' '}
            delegators trust you with their <GovTerm term="votingPower">voting power</GovTerm>
            {delegatorDelta !== 0 && (
              <span
                className={cn(
                  'ml-1.5 text-xs font-medium',
                  delegatorDelta > 0 ? 'text-emerald-500' : 'text-rose-500',
                )}
              >
                ({delegatorDelta > 0 ? '+' : ''}
                {delegatorDelta} this epoch)
              </span>
            )}
          </p>
        </div>

        {/* ── Quick Win card ───────────────────────────────────────── */}
        {!urgentLoading && topUrgent && (
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                {urgentItems.length === 1
                  ? 'Quick Win — Vote Expiring'
                  : `${urgentItems.length} proposals need your vote`}
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

        {/* ── Workspace CTA ──────────────────────────────────────── */}
        <Button asChild variant="outline" className="w-full">
          <Link href="/workspace">
            Open workspace <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>

        {/* ── As a Citizen — governance briefing layer (informed+ depth only) ── */}
        <DepthGate minDepth="informed">
          <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                As a Citizen
              </p>
            </div>

            {/* Epoch headlines (condensed) */}
            {briefingHeadlines.length > 0 ? (
              <ul className="space-y-1.5">
                {briefingHeadlines.map((h, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-primary font-bold text-sm leading-none mt-0.5">
                      &bull;
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{h.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{h.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No notable governance events this epoch.
              </p>
            )}

            {/* Treasury one-liner */}
            {treasury?.balance != null && treasury.balance > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Treasury:{' '}
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatAdaCompact(treasury.balance)} ADA
                  </span>
                  {treasury.trend === 'growing' && (
                    <TrendingUp className="inline h-3 w-3 text-emerald-500 ml-1" />
                  )}
                  {treasury.trend === 'shrinking' && (
                    <TrendingDown className="inline h-3 w-3 text-rose-500 ml-1" />
                  )}
                </span>
              </div>
            )}

            <Link
              href="/governance/health"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View full briefing <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </DepthGate>
      </div>
    </div>
  );
}
