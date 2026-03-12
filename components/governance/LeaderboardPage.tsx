'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGovernanceLeaderboard } from '@/hooks/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { posthog } from '@/lib/posthog';
import { Trophy, TrendingUp, TrendingDown, ArrowLeft, Medal, Flame, Crown } from 'lucide-react';

type SortTab = 'score' | 'participation' | 'rationale' | 'movers';

interface LeaderboardEntry {
  rank: number;
  drepId: string;
  name: string;
  score: number;
  sizeTier?: string;
  isActive?: boolean;
  participation?: number;
  rationale?: number;
  reliability?: number;
}

interface Mover {
  drepId: string;
  name: string;
  currentScore: number;
  previousScore: number;
  delta: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  weeklyMovers?: {
    gainers: Mover[];
    losers: Mover[];
  };
  hallOfFame?: {
    drepId: string;
    name: string;
    score: number;
    days: number;
  }[];
}

const TABS: { key: SortTab; label: string; icon: React.ReactNode }[] = [
  { key: 'score', label: 'By Score', icon: <Trophy className="h-3.5 w-3.5" /> },
  { key: 'participation', label: 'By Participation', icon: <Medal className="h-3.5 w-3.5" /> },
  { key: 'rationale', label: 'By Rationale', icon: <Flame className="h-3.5 w-3.5" /> },
  { key: 'movers', label: 'Weekly Movers', icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

/**
 * LeaderboardPage — competitive rankings for DReps.
 *
 * Tabs: by score, by participation rate, by rationale quality, weekly movers.
 * Each row: name, score, rank, key metric, trend.
 */
export function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<SortTab>('score');
  const { data: dataRaw, isLoading } = useGovernanceLeaderboard(
    activeTab === 'movers' ? undefined : activeTab,
  );

  const data = dataRaw as LeaderboardData | undefined;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/governance"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">DRep Leaderboard</h1>
          <p className="text-xs text-muted-foreground">
            How Cardano governance representatives compare
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5 text-xs shrink-0"
            onClick={() => {
              setActiveTab(tab.key);
              posthog.capture('leaderboard_tab_changed', { tab: tab.key });
            }}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : activeTab === 'movers' ? (
        <MoversView
          gainers={data?.weeklyMovers?.gainers ?? []}
          losers={data?.weeklyMovers?.losers ?? []}
        />
      ) : (
        <RankingsView entries={data?.leaderboard ?? []} sortBy={activeTab} />
      )}

      {/* Hall of Fame */}
      {data?.hallOfFame && data.hallOfFame.length > 0 && activeTab === 'score' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Hall of Fame
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            DReps who maintained a score of 80+ for 60+ days in the last 90 days
          </p>
          <div className="space-y-1.5">
            {data.hallOfFame.map((d) => (
              <Link
                key={d.drepId}
                href={`/drep/${encodeURIComponent(d.drepId)}`}
                className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 hover:border-amber-500/40 transition-colors"
              >
                <span className="text-sm font-medium text-foreground truncate">{d.name}</span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs text-muted-foreground">{d.days}d streak</span>
                  <span className="text-sm font-bold tabular-nums text-foreground">{d.score}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RankingsView({ entries, sortBy }: { entries: LeaderboardEntry[]; sortBy: SortTab }) {
  return (
    <div className="space-y-1.5">
      {entries.map((entry) => {
        const keyMetric =
          sortBy === 'participation'
            ? { label: 'Participation', value: `${entry.participation ?? 0}%` }
            : sortBy === 'rationale'
              ? { label: 'Rationale', value: `${entry.rationale ?? 0}%` }
              : null;

        return (
          <Link
            key={entry.drepId}
            href={`/drep/${encodeURIComponent(entry.drepId)}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 transition-colors group"
          >
            <span className="text-sm font-medium tabular-nums text-muted-foreground w-8 shrink-0">
              #{entry.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {entry.name}
              </p>
              {entry.sizeTier && (
                <Badge variant="outline" className="text-[10px] mt-0.5">
                  {entry.sizeTier}
                </Badge>
              )}
            </div>
            {keyMetric && (
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{keyMetric.label}</p>
                <p className="text-sm font-medium tabular-nums">{keyMetric.value}</p>
              </div>
            )}
            <span className="text-lg font-bold tabular-nums text-foreground shrink-0 ml-2">
              {entry.score}
            </span>
          </Link>
        );
      })}

      {entries.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No DReps found for this view.</p>
        </div>
      )}
    </div>
  );
}

function MoversView({ gainers, losers }: { gainers: Mover[]; losers: Mover[] }) {
  return (
    <div className="space-y-6">
      {/* Gainers */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Biggest Gainers (7d)
        </h3>
        {gainers.length === 0 && (
          <p className="text-xs text-muted-foreground">No significant gainers this week.</p>
        )}
        {gainers.map((m) => (
          <Link
            key={m.drepId}
            href={`/drep/${encodeURIComponent(m.drepId)}`}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3 hover:border-emerald-500/40 transition-colors"
          >
            <span className="text-sm font-medium text-foreground truncate">{m.name}</span>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-sm font-bold tabular-nums text-foreground">
                {m.currentScore}
              </span>
              <span className="text-xs font-medium tabular-nums text-emerald-500">+{m.delta}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Losers */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-rose-500" />
          Biggest Declines (7d)
        </h3>
        {losers.length === 0 && (
          <p className="text-xs text-muted-foreground">No significant declines this week.</p>
        )}
        {losers.map((m) => (
          <Link
            key={m.drepId}
            href={`/drep/${encodeURIComponent(m.drepId)}`}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3 hover:border-rose-500/40 transition-colors"
          >
            <span className="text-sm font-medium text-foreground truncate">{m.name}</span>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-sm font-bold tabular-nums text-foreground">
                {m.currentScore}
              </span>
              <span className="text-xs font-medium tabular-nums text-rose-500">{m.delta}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
