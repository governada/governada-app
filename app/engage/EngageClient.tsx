'use client';

import Link from 'next/link';
import { ArrowRight, Shield, Info } from 'lucide-react';
import { PrioritySignals } from '@/components/engagement/PrioritySignals';
import { CitizenAssembly } from '@/components/engagement/CitizenAssembly';
import { AssemblyHistory } from '@/components/engagement/AssemblyHistory';
import { PageViewTracker } from '@/components/PageViewTracker';
import { FirstVisitBanner } from '@/components/ui/FirstVisitBanner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePriorityRankings, useCitizenCredibility } from '@/hooks/useEngagement';

interface EngageClientProps {
  epoch: number;
}

export function EngageClient({ epoch }: EngageClientProps) {
  const previousEpoch = epoch - 1;
  const { data: currentRankings } = usePriorityRankings(epoch);
  const { data: previousRankings } = usePriorityRankings(previousEpoch);
  const { data: credibility } = useCitizenCredibility();

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="engage_page_viewed" properties={{ epoch }} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Civic Engagement</h1>
        <p className="text-muted-foreground mt-1">
          Shape what Cardano governance focuses on. Your signals directly inform DReps and treasury
          teams.
        </p>
      </div>

      <FirstVisitBanner
        pageKey="engage"
        message="Your input here directly influences the governance intelligence engine. Every signal you send — sentiment, priority, concern — helps DReps make better decisions."
      />

      {/* Credibility Tier Banner */}
      {credibility && <CredibilityBanner tier={credibility.tier} weight={credibility.weight} />}

      {/* Last Epoch Recap */}
      {currentRankings && currentRankings.rankings.length > 0 && (
        <EpochRecap current={currentRankings} previous={previousRankings ?? null} epoch={epoch} />
      )}

      {/* Citizen Assembly (if active) */}
      <section>
        <CitizenAssembly />
      </section>

      {/* Priority Signals */}
      <section>
        <PrioritySignals epoch={epoch} />
      </section>

      {/* Past Assemblies */}
      <section>
        <AssemblyHistory />
      </section>
    </div>
  );
}

/* ── Credibility Banner ─────────────────────────────────────────── */

function CredibilityBanner({ tier, weight }: { tier: string; weight: number }) {
  const tierConfig = {
    standard: {
      label: 'Standard weight',
      color: 'text-muted-foreground',
      bg: 'bg-muted/50',
      tip: 'Connect your wallet, delegate, and participate regularly to increase your signal weight.',
    },
    enhanced: {
      label: 'Enhanced weight',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/5',
      tip: 'Keep participating to reach full weight.',
    },
    full: {
      label: 'Full weight',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/5',
      tip: 'Your signals carry maximum weight. Thank you for your sustained participation.',
    },
  };

  const config = tierConfig[tier as keyof typeof tierConfig] ?? tierConfig.standard;

  return (
    <div
      className={cn('rounded-lg border border-border px-4 py-3 flex items-center gap-3', config.bg)}
    >
      <Shield className={cn('h-4 w-4 shrink-0', config.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className={cn('font-medium', config.color)}>{config.label}</span>
          <span className="text-muted-foreground ml-1.5 text-xs">
            — signals are credibility-weighted to ensure quality
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{config.tip}</p>
      </div>
      <Badge variant="outline" className={cn('shrink-0 tabular-nums', config.color)}>
        {Math.round(weight * 100)}%
      </Badge>
    </div>
  );
}

/* ── Epoch Recap ────────────────────────────────────────────────── */

interface RankingsData {
  rankings: { priority: string; score: number; rank: number; firstChoiceCount: number }[];
  totalVoters: number;
  epoch: number;
}

function EpochRecap({
  current,
  previous,
  epoch,
}: {
  current: RankingsData;
  previous: RankingsData | null;
  epoch: number;
}) {
  const top3 = current.rankings.slice(0, 3);

  // Compute rank changes from previous epoch
  const rankChanges = new Map<string, number>();
  if (previous) {
    for (const r of current.rankings) {
      const prev = previous.rankings.find((p) => p.priority === r.priority);
      if (prev) {
        rankChanges.set(r.priority, prev.rank - r.rank); // positive = moved up
      }
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Community Priorities — Epoch {epoch}
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {current.totalVoters} citizen{current.totalVoters !== 1 ? 's' : ''} voted
        </span>
      </div>

      <div className="space-y-2">
        {top3.map((r) => {
          const change = rankChanges.get(r.priority);
          return (
            <div key={r.priority} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-primary font-bold w-5 text-center tabular-nums">
                  {r.rank}
                </span>
                <span className="text-foreground font-medium capitalize">
                  {r.priority.replace(/_/g, ' ')}
                </span>
                {change != null && change !== 0 && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0',
                      change > 0
                        ? 'text-emerald-500 border-emerald-500/30'
                        : 'text-rose-500 border-rose-500/30',
                    )}
                  >
                    {change > 0 ? `\u2191${change}` : `\u2193${Math.abs(change)}`}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {r.firstChoiceCount} first-choice
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-1">
        <Link
          href="/pulse"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Full governance health
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
