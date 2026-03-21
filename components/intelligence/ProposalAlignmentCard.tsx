'use client';

import { useQuery } from '@tanstack/react-query';
import { Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeatureGate } from '@/components/FeatureGate';

/* ─── Types ─────────────────────────────────────────────── */

interface PulseData {
  epoch: number;
  totalSessions: number;
  topicHeatmap: Array<{ topic: string; count: number; trend: number }>;
  archetypeDistribution: Array<{ archetype: string; count: number; percentage: number }>;
  communityCentroid: number[];
  temperature: { value: number; band: string };
  updatedAt: string | null;
}

export interface ProposalAlignmentCardProps {
  proposalDimensions?: Record<string, number>;
  className?: string;
}

/* ─── Dimension labels (same 6D order as alignment vectors) ─── */

const DIMENSION_KEYS = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
] as const;

const DIMENSION_LABELS: Record<string, string> = {
  treasuryConservative: 'Treasury Conservative',
  treasuryGrowth: 'Treasury Growth',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

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

/* ─── Fetcher ──────────────────────────────────────────── */

async function fetchCommunityPulse(): Promise<PulseData> {
  const res = await fetch('/api/community/pulse');
  if (!res.ok) throw new Error(`Pulse fetch failed: ${res.status}`);
  return res.json();
}

/* ─── Utility: cosine similarity ───────────────────────── */

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;
  return dotProduct / magnitude;
}

/* ─── Mini radar chart (SVG) ───────────────────────────── */

function MiniRadar({
  proposalValues,
  communityValues,
  labels,
}: {
  proposalValues: number[];
  communityValues: number[];
  labels: string[];
}) {
  const cx = 60;
  const cy = 60;
  const maxR = 48;
  const n = labels.length;

  function polarToCart(index: number, value: number): { x: number; y: number } {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (value / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function toPolygon(values: number[]): string {
    return values
      .map((v, i) => {
        const { x, y } = polarToCart(i, v);
        return `${x},${y}`;
      })
      .join(' ');
  }

  // Grid rings
  const rings = [25, 50, 75, 100];

  return (
    <svg width={120} height={120} viewBox="0 0 120 120" className="shrink-0">
      {/* Grid */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={Array.from({ length: n }, (_, i) => {
            const { x, y } = polarToCart(i, r);
            return `${x},${y}`;
          }).join(' ')}
          fill="none"
          stroke="currentColor"
          className="text-white/[0.06]"
          strokeWidth="0.5"
        />
      ))}
      {/* Axis lines */}
      {labels.map((_, i) => {
        const { x, y } = polarToCart(i, 100);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="currentColor"
            className="text-white/[0.06]"
            strokeWidth="0.5"
          />
        );
      })}
      {/* Community polygon */}
      <polygon
        points={toPolygon(communityValues)}
        fill="rgba(59, 130, 246, 0.15)"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Proposal polygon */}
      <polygon
        points={toPolygon(proposalValues)}
        fill="rgba(16, 185, 129, 0.15)"
        stroke="#10b981"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeDasharray="4 2"
      />
    </svg>
  );
}

/* ─── Main component ───────────────────────────────────── */

function ProposalAlignmentCardInner({ proposalDimensions, className }: ProposalAlignmentCardProps) {
  const {
    data: pulse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['community-pulse'],
    queryFn: fetchCommunityPulse,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
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
      </div>
    );
  }

  if (error || !pulse || pulse.totalSessions === 0) {
    return null;
  }

  // Convert proposal dimensions to 6D array matching community centroid order
  const proposalVector = proposalDimensions
    ? DIMENSION_KEYS.map((k) => proposalDimensions[k] ?? 50)
    : null;
  const communityVector = pulse.communityCentroid;

  // Compute alignment score
  const alignmentScore = proposalVector
    ? Math.round(cosineSimilarity(proposalVector, communityVector) * 100)
    : null;

  // Top community topic with trend for timing insight
  const topTopic = pulse.topicHeatmap[0] ?? null;
  const risingTopics = pulse.topicHeatmap.filter((t) => t.trend > 0).slice(0, 1);

  return (
    <div className={cn('rounded-xl border border-border bg-card/50 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Compass className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Community Alignment
        </p>
      </div>

      {/* Radar + alignment score */}
      {proposalVector && (
        <div className="flex items-center gap-4">
          <MiniRadar
            proposalValues={proposalVector}
            communityValues={communityVector}
            labels={DIMENSION_KEYS.map((k) => DIMENSION_LABELS[k])}
          />
          <div className="space-y-2">
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{alignmentScore}%</p>
              <p className="text-xs text-muted-foreground">community alignment</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] text-muted-foreground">Community</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-0.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-muted-foreground">Proposal</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* When no proposal dimensions — show community priorities guidance */}
      {!proposalVector && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            The community centroid will overlay with your proposal alignment once your proposal is
            classified. For now, consider the community priorities below.
          </p>
        </div>
      )}

      {/* Topic timing insights */}
      {topTopic && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Community priorities
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{topicLabel(topTopic.topic)}</span>
            {' is the #1 community priority this epoch'}
            {topTopic.count > 0 && ` (${topTopic.count} citizens)`}
          </p>
          {risingTopics.length > 0 && risingTopics[0].topic !== topTopic.topic && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-emerald-400">
                {topicLabel(risingTopics[0].topic)}
              </span>{' '}
              is trending up — consider highlighting related benefits
            </p>
          )}
        </div>
      )}

      {/* Framing suggestion */}
      {topTopic && (
        <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Highlight{' '}
            <span className="font-medium text-foreground">{topicLabel(topTopic.topic)}</span>
            {' benefits — '}
            {pulse.totalSessions > 0 && (
              <>
                {Math.round((topTopic.count / pulse.totalSessions) * 100)}% of citizens list it as
                important
              </>
            )}
          </p>
        </div>
      )}

      <p className="text-[10px] text-white/30 text-center">
        Based on {pulse.totalSessions} citizen{pulse.totalSessions !== 1 ? 's' : ''} this epoch
      </p>
    </div>
  );
}

export function ProposalAlignmentCard(props: ProposalAlignmentCardProps) {
  return (
    <FeatureGate flag="community_intelligence">
      <ProposalAlignmentCardInner {...props} />
    </FeatureGate>
  );
}
