'use client';

import Link from 'next/link';
import { ArrowRight, Info, Sparkles } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { PrioritySignals } from '@/components/engagement/PrioritySignals';
import { CitizenAssembly } from '@/components/engagement/CitizenAssembly';
import { AssemblyHistory } from '@/components/engagement/AssemblyHistory';
import { EngagementHero } from '@/components/engagement/EngagementHero';
import { CitizenVoiceSection } from '@/components/engagement/CitizenVoiceSection';
import { PageViewTracker } from '@/components/PageViewTracker';
import { FirstVisitBanner } from '@/components/ui/FirstVisitBanner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePriorityRankings, useCitizenCredibility, useCitizenVoice } from '@/hooks/useEngagement';
import { PRIORITY_LABEL_MAP } from '@/lib/engagement/labels';

interface EngageClientProps {
  epoch: number;
}

export function EngageClient({ epoch }: EngageClientProps) {
  const previousEpoch = epoch - 1;
  const { connected, address } = useWallet();
  const { data: currentRankings } = usePriorityRankings(epoch);
  const { data: previousRankings } = usePriorityRankings(previousEpoch);
  const { data: credibility } = useCitizenCredibility();
  const { data: citizenVoice } = useCitizenVoice(connected ? address : null);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="engage_page_viewed" properties={{ epoch }} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Have Your Say</h1>
        <p className="text-muted-foreground mt-1">
          Vote on priorities, flag concerns, and signal what matters to you. DReps and treasury
          teams use these signals to make better governance decisions.
        </p>
      </div>

      <FirstVisitBanner
        pageKey="engage"
        message="This is your direct line to Cardano governance. Rank your priorities, react to proposals, and join citizen assemblies. Your signals are credibility-weighted so genuine participation is rewarded."
      />

      {/* ── Hero Zone: personal context + community pulse ── */}
      <div className="space-y-6">
        {credibility && <EngagementHero credibility={credibility} epoch={epoch} />}
        {currentRankings && currentRankings.rankings.length > 0 ? (
          <EpochRecap current={currentRankings} previous={previousRankings ?? null} epoch={epoch} />
        ) : (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Community priorities refresh each epoch
                </p>
                <p className="text-xs text-muted-foreground">
                  Cast your first vote below to shape Epoch {epoch}&apos;s direction
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── Action Zone: interactive participation ── */}
      <div className="space-y-6 pt-2">
        <section>
          <CitizenAssembly />
        </section>
        <section>
          <PrioritySignals epoch={epoch} />
        </section>
      </div>

      {/* ── Reflection Zone: see what happened ── */}
      <div className="space-y-6 pt-2 opacity-[0.92]">
        {citizenVoice && (
          <section>
            <CitizenVoiceSection data={citizenVoice} />
          </section>
        )}
        <section>
          <AssemblyHistory />
        </section>
      </div>
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

  // Priority trend narrative
  const top1 = current.rankings[0];
  const previousTop1 = previous?.rankings.find((r) => r.rank === 1);
  const isStreak = top1 && previousTop1 && top1.priority === previousTop1.priority;

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

      {isStreak && top1 && (
        <p className="text-xs text-muted-foreground italic">
          {PRIORITY_LABEL_MAP[top1.priority] ?? top1.priority.replace(/_/g, ' ')} has held the #1
          spot for multiple epochs
        </p>
      )}

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
