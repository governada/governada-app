'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Users, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeatureGate } from '@/components/FeatureGate';

/* ─── Types ─────────────────────────────────────────────── */

interface PulseData {
  epoch: number;
  totalSessions: number;
  topicHeatmap: Array<{ topic: string; count: number; trend: number }>;
  temperature: { value: number; band: string };
}

interface CrossBodyData {
  overallAlignment: number;
}

interface GovernanceEvolutionWidgetProps {
  className?: string;
}

/* ─── Topic label prettifier ────────────────────────────── */

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

/* ─── Fetchers ──────────────────────────────────────────── */

async function fetchPulse(): Promise<PulseData> {
  const res = await fetch('/api/community/pulse');
  if (!res.ok) throw new Error('Pulse fetch failed');
  return res.json();
}

async function fetchCrossBody(): Promise<CrossBodyData | null> {
  try {
    const res = await fetch('/api/intelligence/cross-body-alignment');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/* ─── Temperature band styling ──────────────────────────── */

function bandColor(band: string): string {
  switch (band) {
    case 'hot':
      return '#ef4444';
    case 'warm':
      return '#f59e0b';
    case 'cool':
      return '#06b6d4';
    case 'cold':
    default:
      return '#3b82f6';
  }
}

function bandLabel(band: string): string {
  return band === 'cold' ? 'Cold' : band === 'cool' ? 'Cool' : band === 'warm' ? 'Warm' : 'Hot';
}

/* ─── Trend Row ─────────────────────────────────────────── */

function TrendRow({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 min-h-[28px]">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground flex-1 truncate">{label}</span>
      <span
        className="text-xs font-medium tabular-nums shrink-0"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      {detail && <span className="text-[10px] text-white/40 shrink-0">{detail}</span>}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────── */

function GovernanceEvolutionWidgetInner({ className }: GovernanceEvolutionWidgetProps) {
  const { data: pulse, isLoading: pulseLoading } = useQuery({
    queryKey: ['community-pulse'],
    queryFn: fetchPulse,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  const { data: crossBody } = useQuery({
    queryKey: ['cross-body-alignment'],
    queryFn: fetchCrossBody,
    staleTime: 600_000,
    refetchOnWindowFocus: false,
  });

  if (pulseLoading) {
    return (
      <div
        className={cn('rounded-xl border border-border bg-card/50 p-3 animate-pulse', className)}
      >
        <div className="h-3 bg-white/[0.06] rounded w-2/3 mb-2" />
        <div className="h-3 bg-white/[0.06] rounded w-1/2" />
      </div>
    );
  }

  if (!pulse || pulse.totalSessions === 0) {
    return null;
  }

  const topTopic = pulse.topicHeatmap[0] ?? null;
  const topicTrendArrow =
    topTopic && topTopic.trend > 0 ? ' ^' : topTopic && topTopic.trend < 0 ? ' v' : '';

  return (
    <div className={cn('rounded-xl border border-border bg-card/50 p-3 space-y-1', className)}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        Governance this epoch
      </p>

      <TrendRow
        icon={Users}
        label="Community engagement"
        value={`${pulse.totalSessions}`}
        detail={`citizen${pulse.totalSessions !== 1 ? 's' : ''} matched`}
      />

      {topTopic && (
        <TrendRow
          icon={TrendingUp}
          label="Top priority"
          value={`${topicLabel(topTopic.topic)}${topicTrendArrow}`}
        />
      )}

      <TrendRow
        icon={Activity}
        label="Governance temperature"
        value={`${pulse.temperature.value}`}
        detail={bandLabel(pulse.temperature.band)}
        color={bandColor(pulse.temperature.band)}
      />

      {crossBody && crossBody.overallAlignment > 0 && (
        <TrendRow
          icon={BarChart3}
          label="Body alignment"
          value={`${crossBody.overallAlignment}%`}
        />
      )}
    </div>
  );
}

export function GovernanceEvolutionWidget(props: GovernanceEvolutionWidgetProps) {
  return (
    <FeatureGate flag="community_intelligence">
      <GovernanceEvolutionWidgetInner {...props} />
    </FeatureGate>
  );
}
