'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, ArrowRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GovTerm } from '@/components/GovTerm';
import { computeTier } from '@/lib/scoring/tiers';
import { useDRepReportCard } from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import dynamic from 'next/dynamic';

const GovernanceConstellation = dynamic(
  () =>
    import('@/components/GovernanceConstellation').then((m) => ({
      default: m.GovernanceConstellation,
    })),
  { ssr: false },
);

const TIER_COLORS: Record<string, string> = {
  Emerging: 'text-muted-foreground',
  Bronze: 'text-amber-600',
  Silver: 'text-slate-400',
  Gold: 'text-yellow-500',
  Diamond: 'text-cyan-400',
  Legendary: 'text-violet-400',
};

const TIER_BG: Record<string, string> = {
  Emerging: 'bg-muted/40',
  Bronze: 'bg-amber-950/30 border-amber-800/30',
  Silver: 'bg-slate-900/40 border-slate-700/30',
  Gold: 'bg-yellow-950/30 border-yellow-800/30',
  Diamond: 'bg-cyan-950/30 border-cyan-800/30',
  Legendary: 'bg-violet-950/30 border-violet-800/30',
};

interface HomeCitizenProps {
  ssrHolderData?: any;
  ssrWalletAddress?: string | null;
}

function MomentumIcon({ momentum }: { momentum: number | null }) {
  if (momentum === null || momentum === undefined)
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (momentum > 0.5) return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (momentum < -0.5) return <TrendingDown className="h-4 w-4 text-rose-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function HomeCitizen({ ssrHolderData, ssrWalletAddress }: HomeCitizenProps) {
  const { delegatedDrep } = useSegment();
  const { address } = useWallet();

  // Prefer SSR delegation data, fall back to segment detection
  const drepId = ssrHolderData?.delegationHealth?.drepId ?? delegatedDrep;
  const wallet = ssrWalletAddress ?? address;

  const { data: reportCardRaw, isLoading } = useDRepReportCard(drepId, wallet);
  const reportCard = reportCardRaw as any;

  const drepName =
    ssrHolderData?.delegationHealth?.drepName ??
    reportCard?.name ??
    (drepId ? `${drepId.slice(0, 16)}…` : null);

  const score: number = reportCard?.score ?? ssrHolderData?.delegationHealth?.drepScore ?? 0;
  const tier = reportCard?.tier ?? (score ? computeTier(score) : 'Emerging');
  const momentum: number | null = reportCard?.momentum ?? null;
  const openProposals: number =
    ssrHolderData?.delegationHealth?.openProposalCount ?? reportCard?.openProposalCount ?? 0;

  if (!drepId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">
          Your wallet is connected but not delegated to a <GovTerm term="drep">DRep</GovTerm>.
        </p>
        <Button asChild>
          <Link href="/match">
            Find a DRep <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col">
      {/* ── Ambient constellation header (15vh) ─────────────────────── */}
      <section className="relative h-[15vh] min-h-[80px] overflow-hidden" aria-hidden="true">
        <GovernanceConstellation className="w-full h-full opacity-40" interactive={false} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
      </section>

      {/* ── DRep report card headline ────────────────────────────────── */}
      <section className="mx-auto w-full max-w-3xl px-4 -mt-4 pb-4">
        <div
          className={cn(
            'rounded-2xl border p-6 space-y-5',
            TIER_BG[tier] ?? 'bg-card border-border',
          )}
        >
          {/* Header: name + tier badge + trend */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Your DRep
              </p>
              {isLoading && !drepName ? (
                <Skeleton className="h-7 w-48" />
              ) : (
                <h2 className="font-display text-2xl font-bold text-foreground truncate">
                  {drepName}
                </h2>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  'text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border',
                  TIER_COLORS[tier],
                  TIER_BG[tier],
                )}
              >
                {tier}
              </span>
              <MomentumIcon momentum={momentum} />
            </div>
          </div>

          {/* Score + pillars */}
          <div className="flex items-center gap-6">
            {isLoading && !score ? (
              <Skeleton className="h-14 w-20" />
            ) : (
              <div className="text-center">
                <p
                  className={cn('font-display text-5xl font-bold tabular-nums', TIER_COLORS[tier])}
                >
                  {score}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <GovTerm term="drepScore">score</GovTerm>
                </p>
              </div>
            )}

            {reportCard?.pillars && (
              <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  { key: 'engagementQuality', label: 'Engagement', weight: '35%' },
                  { key: 'effectiveParticipation', label: 'Participation', weight: '25%' },
                  { key: 'reliability', label: 'Reliability', weight: '25%' },
                  { key: 'governanceIdentity', label: 'Identity', weight: '15%' },
                ].map(({ key, label, weight }) => {
                  const v = Math.round(reportCard.pillars[key] ?? 0);
                  return (
                    <div key={key} className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{label}</span>
                        <span className="tabular-nums">{v}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all duration-500"
                          style={{ width: `${v}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* This epoch callout */}
          <div className="rounded-lg bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                This <GovTerm term="epoch">epoch</GovTerm>
              </p>
              <p className="text-sm text-foreground">
                {openProposals > 0 ? (
                  <>
                    <span className="font-semibold text-amber-400">{openProposals}</span> open
                    proposals awaiting a vote
                  </>
                ) : (
                  'No open proposals — governance is quiet'
                )}
              </p>
            </div>
            {reportCard?.votingRecord && (
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Rationale rate</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {reportCard.votingRecord.rationaleRate}%
                </p>
              </div>
            )}
          </div>

          {/* Action CTA */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild className="flex-1">
              <Link href={`/drep/${drepId}`}>
                Full profile <ChevronRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/match">Find a better match</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
