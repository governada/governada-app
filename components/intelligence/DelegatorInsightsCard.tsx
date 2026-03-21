'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeatureGate } from '@/components/FeatureGate';
import { RepresentationGapAlert } from './RepresentationGapAlert';

/* ─── Types ─────────────────────────────────────────────── */

interface CitizenTopic {
  topic: string;
  count: number;
  percentage: number;
}

interface CitizenArchetype {
  archetype: string;
  count: number;
}

interface GapEntry {
  dimension: string;
  citizenAvg: number;
  drepScore: number;
  gap: number;
}

interface DemandSignal {
  topic: string;
  demand: number;
  supply: number;
  opportunity: string;
}

interface DelegatorInsightsData {
  entityId: string;
  entityType: 'drep' | 'spo';
  matchedCitizenCount: number;
  citizenTopics: CitizenTopic[];
  citizenArchetypes: CitizenArchetype[];
  citizenCentroid: number[];
  drepAlignment: number[];
  representationGap: GapEntry[];
  demandSignals: DemandSignal[];
}

interface DelegatorInsightsCardProps {
  drepId: string;
  className?: string;
}

/* ─── Topic label prettifier ───────────────────────────── */

const TOPIC_LABELS: Record<string, string> = {
  treasury: 'Treasury',
  innovation: 'Innovation',
  security: 'Security',
  transparency: 'Transparency',
  decentralization: 'Decentralization',
  'developer-funding': 'Developer Funding',
  'community-growth': 'Community Growth',
  constitutional: 'Constitutional Compliance',
};

function topicLabel(key: string): string {
  return TOPIC_LABELS[key] ?? key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Gap color ────────────────────────────────────────── */

function gapColor(gap: number): string {
  if (gap < 15) return 'bg-emerald-500';
  if (gap < 30) return 'bg-amber-500';
  return 'bg-red-500';
}

function gapTextColor(gap: number): string {
  if (gap < 15) return 'text-emerald-400';
  if (gap < 30) return 'text-amber-400';
  return 'text-red-400';
}

/* ─── Fetcher ──────────────────────────────────────────── */

async function fetchDelegatorInsights(drepId: string): Promise<DelegatorInsightsData> {
  const res = await fetch(
    `/api/intelligence/delegator-insights?drepId=${encodeURIComponent(drepId)}`,
  );
  if (!res.ok) throw new Error(`Delegator insights fetch failed: ${res.status}`);
  return res.json();
}

/* ─── Sub-components ───────────────────────────────────── */

function TopicBars({ topics }: { topics: CitizenTopic[] }) {
  if (topics.length === 0) return null;
  const maxCount = topics[0]?.count ?? 1;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        What your delegators care about
      </p>
      <div className="space-y-1">
        {topics.slice(0, 6).map((entry, i) => {
          const pct = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
          const isTop3 = i < 3;

          return (
            <div key={entry.topic} className="flex items-center gap-2 h-6">
              <span className="text-xs text-muted-foreground w-28 truncate shrink-0">
                {topicLabel(entry.topic)}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isTop3 ? 'bg-primary' : 'bg-white/20',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right shrink-0">
                {entry.percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RepresentationGapBars({ gaps }: { gaps: GapEntry[] }) {
  if (gaps.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Representation alignment
      </p>
      <div className="space-y-1.5">
        {gaps.map((entry) => (
          <div key={entry.dimension} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{entry.dimension}</span>
              <span className={cn('text-[11px] tabular-nums font-medium', gapTextColor(entry.gap))}>
                {entry.gap < 15 ? 'Aligned' : entry.gap < 30 ? 'Diverging' : 'Misaligned'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 h-3">
              {/* Citizen bar */}
              <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden relative">
                <div
                  className="h-full rounded-full bg-blue-500/60 absolute"
                  style={{ width: `${entry.citizenAvg}%` }}
                />
                <div
                  className={cn('h-full rounded-full absolute', gapColor(entry.gap))}
                  style={{
                    width: '3px',
                    left: `calc(${Math.min(entry.drepScore, 100)}% - 1.5px)`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500/60" />
            <span className="text-[10px] text-muted-foreground">Delegators</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-1 rounded-full bg-white/60" />
            <span className="text-[10px] text-muted-foreground">You</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemandSignals({ signals }: { signals: DemandSignal[] }) {
  if (signals.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {signals.slice(0, 2).map((signal) => (
        <div
          key={signal.topic}
          className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2"
        >
          <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Growing demand for{' '}
            <span className="font-medium text-foreground">{topicLabel(signal.topic)}</span>
            {' — '}
            {signal.demand}% of your delegators vs {signal.supply}% community-wide
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Main component ───────────────────────────────────── */

function DelegatorInsightsCardInner({ drepId, className }: DelegatorInsightsCardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['delegator-insights', drepId],
    queryFn: () => fetchDelegatorInsights(drepId),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    enabled: !!drepId,
  });

  if (isLoading) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border bg-card/50 p-4 space-y-3 animate-pulse',
          className,
        )}
      >
        <div className="h-3 bg-white/[0.06] rounded w-3/4" />
        <div className="h-3 bg-white/[0.06] rounded w-1/2" />
        <div className="h-3 bg-white/[0.06] rounded w-2/3" />
      </div>
    );
  }

  if (error || !data || data.matchedCitizenCount === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card/50 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Delegator Intelligence
          </p>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {data.matchedCitizenCount} citizen{data.matchedCitizenCount !== 1 ? 's' : ''} matched
        </span>
      </div>

      {/* Representation gap alert (inline) */}
      <RepresentationGapAlert gaps={data.representationGap} entityType={data.entityType} />

      {/* Topic bars */}
      <TopicBars topics={data.citizenTopics} />

      {/* Representation gap visualization */}
      <RepresentationGapBars gaps={data.representationGap} />

      {/* Demand signals */}
      <DemandSignals signals={data.demandSignals} />
    </div>
  );
}

export function DelegatorInsightsCard(props: DelegatorInsightsCardProps) {
  return (
    <FeatureGate flag="community_intelligence">
      <DelegatorInsightsCardInner {...props} />
    </FeatureGate>
  );
}
