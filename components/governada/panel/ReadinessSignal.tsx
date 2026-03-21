'use client';

/**
 * ReadinessSignal — WHOOP-pattern governance readiness indicator.
 *
 * A single compressed visual at the top of the intelligence panel summarizing:
 * - Delegation health
 * - Pending actions
 * - Alignment drift
 * - Epoch urgency
 *
 * Fetches from GET /api/intelligence/governance-state?stakeAddress=[addr]
 * Uses TanStack Query with 5-minute stale time.
 */

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import type { GovernanceStateResult } from '@/lib/intelligence/governance-state';

// ---------------------------------------------------------------------------
// Readiness computation
// ---------------------------------------------------------------------------

interface ReadinessData {
  /** Overall readiness score 0-100 */
  score: number;
  /** Semantic label */
  label: string;
  /** Color class for the ring/indicator */
  colorClass: string;
  /** Stroke color for the SVG ring */
  strokeColor: string;
  /** Brief description */
  summary: string;
  /** Individual component signals */
  signals: { label: string; value: string; sentiment: 'good' | 'warn' | 'critical' }[];
}

function computeReadiness(state: GovernanceStateResult): ReadinessData {
  const signals: ReadinessData['signals'] = [];

  // Epoch urgency signal
  const urgency = state.urgency;
  signals.push({
    label: 'Urgency',
    value: urgency >= 70 ? 'High' : urgency >= 40 ? 'Moderate' : 'Low',
    sentiment: urgency >= 70 ? 'critical' : urgency >= 40 ? 'warn' : 'good',
  });

  // Epoch progress signal
  const epochPct = Math.round(state.epoch.progress * 100);
  signals.push({
    label: 'Epoch',
    value: `${epochPct}%`,
    sentiment: epochPct >= 80 ? 'warn' : 'good',
  });

  // Active proposals signal
  const activeCount = state.epoch.activeProposalCount;
  signals.push({
    label: 'Active',
    value: `${activeCount} proposal${activeCount === 1 ? '' : 's'}`,
    sentiment: activeCount > 10 ? 'warn' : 'good',
  });

  // User-specific signals
  if (state.userState) {
    if (state.userState.pendingVotes > 0) {
      signals.push({
        label: 'Pending',
        value: `${state.userState.pendingVotes} vote${state.userState.pendingVotes === 1 ? '' : 's'}`,
        sentiment: state.userState.pendingVotes > 3 ? 'critical' : 'warn',
      });
    }

    if (state.userState.delegatedDrepId) {
      signals.push({
        label: 'Delegation',
        value: 'Active',
        sentiment: 'good',
      });
    } else if (state.userState.drepScore === null) {
      // Not a DRep and not delegated
      signals.push({
        label: 'Delegation',
        value: 'None',
        sentiment: 'warn',
      });
    }
  }

  // Composite readiness score
  // Higher = more governance attention needed (inverted from "readiness" to "attention")
  let score = 50; // baseline
  score += (urgency / 100) * 30; // urgency contributes 0-30
  if (state.userState?.pendingVotes) {
    score += Math.min(20, state.userState.pendingVotes * 5); // pending votes contribute 0-20
  }
  score = Math.min(100, Math.max(0, Math.round(score)));

  // Invert: readiness = 100 - attention needed
  const readiness = 100 - score;

  let label: string;
  let colorClass: string;
  let strokeColor: string;
  if (readiness >= 70) {
    label = 'Ready';
    colorClass = 'text-emerald-400';
    strokeColor = '#34d399';
  } else if (readiness >= 40) {
    label = 'Attention';
    colorClass = 'text-amber-400';
    strokeColor = '#fbbf24';
  } else {
    label = 'Action Needed';
    colorClass = 'text-red-400';
    strokeColor = '#f87171';
  }

  const summaryParts: string[] = [];
  if (state.userState?.pendingVotes) {
    summaryParts.push(
      `${state.userState.pendingVotes} pending vote${state.userState.pendingVotes === 1 ? '' : 's'}`,
    );
  }
  if (urgency >= 70) {
    summaryParts.push('urgent governance activity');
  }
  if (epochPct >= 80) {
    summaryParts.push('epoch ending soon');
  }
  // Treasury urgency contributes to readiness if urgency is very high
  if (urgency >= 80) {
    summaryParts.push('major treasury decisions pending');
  }
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : 'Governance is stable';

  return { score: readiness, label, colorClass, strokeColor, summary, signals };
}

// ---------------------------------------------------------------------------
// Readiness Ring SVG
// ---------------------------------------------------------------------------

function ReadinessRing({
  score,
  strokeColor,
  size = 48,
}: {
  score: number;
  strokeColor: string;
  size?: number;
}) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="transform -rotate-90"
      aria-hidden="true"
    >
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        className="text-muted/20"
      />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        className="transition-all duration-500"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ReadinessSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse" aria-busy="true">
      <div className="w-12 h-12 rounded-full bg-muted/20" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-muted/20 rounded w-20" />
        <div className="h-2.5 bg-muted/15 rounded w-32" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReadinessSignal() {
  const { stakeAddress } = useSegment();

  const { data: governanceState, isLoading } = useQuery<GovernanceStateResult>({
    queryKey: ['governance-state', stakeAddress],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stakeAddress) params.set('stakeAddress', stakeAddress);
      const res = await fetch(`/api/intelligence/governance-state?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch governance state');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  if (isLoading || !governanceState) {
    return <ReadinessSkeleton />;
  }

  const readiness = computeReadiness(governanceState);

  return (
    <div
      className="flex items-center gap-3 p-3 border-b border-border/10"
      role="status"
      aria-label={`Governance readiness: ${readiness.label}, ${readiness.score}%`}
    >
      {/* Ring with score */}
      <div className="relative shrink-0">
        <ReadinessRing score={readiness.score} strokeColor={readiness.strokeColor} size={48} />
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center text-sm font-semibold',
            readiness.colorClass,
          )}
        >
          {readiness.score}
        </span>
      </div>

      {/* Label + summary */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-semibold', readiness.colorClass)}>{readiness.label}</p>
        <p className="text-[11px] text-muted-foreground/70 truncate">{readiness.summary}</p>
      </div>
    </div>
  );
}
