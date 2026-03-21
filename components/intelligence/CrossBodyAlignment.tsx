'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeatureGate } from '@/components/FeatureGate';

/* ─── Types ─────────────────────────────────────────────── */

interface DimensionData {
  dimension: string;
  label: string;
  citizenAvg: number;
  drepAvg: number | null;
  spoAvg: number | null;
  ccAvg: number | null;
}

interface CrossBodyResponse {
  dimensions: DimensionData[];
  overallAlignment: number;
  biggestGap: { dimension: string; bodies: string[]; gap: number };
  drepCount: number;
  epoch: number;
}

interface CrossBodyAlignmentProps {
  className?: string;
}

/* ─── Fetcher ───────────────────────────────────────────── */

async function fetchCrossBodyAlignment(): Promise<CrossBodyResponse> {
  const res = await fetch('/api/intelligence/cross-body-alignment');
  if (!res.ok) throw new Error(`Cross-body fetch failed: ${res.status}`);
  return res.json();
}

/* ─── Body colors ───────────────────────────────────────── */

const BODY_COLORS = {
  citizen: '#06b6d4', // Compass Teal
  drep: '#10b981', // Green
  spo: '#a855f7', // Purple
  cc: '#f59e0b', // Gold
} as const;

/* ─── Sub-components ────────────────────────────────────── */

function DimensionBar({
  label,
  citizenAvg,
  drepAvg,
}: {
  label: string;
  citizenAvg: number;
  drepAvg: number | null;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground truncate">{label}</span>
        <div className="flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
          <span style={{ color: BODY_COLORS.citizen }}>{citizenAvg}</span>
          {drepAvg != null && <span style={{ color: BODY_COLORS.drep }}>{drepAvg}</span>}
        </div>
      </div>
      <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
        {/* Citizen bar */}
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-60"
          style={{
            width: `${citizenAvg}%`,
            backgroundColor: BODY_COLORS.citizen,
          }}
        />
        {/* DRep marker line */}
        {drepAvg != null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 rounded-full"
            style={{
              left: `${drepAvg}%`,
              backgroundColor: BODY_COLORS.drep,
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────── */

function CrossBodyAlignmentInner({ className }: CrossBodyAlignmentProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cross-body-alignment'],
    queryFn: fetchCrossBodyAlignment,
    staleTime: 600_000, // 10 min — matches server cache
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className={cn('space-y-3 animate-pulse', className)}>
        <div className="h-3 bg-white/[0.06] rounded w-3/4" />
        <div className="h-3 bg-white/[0.06] rounded w-1/2" />
        <div className="h-3 bg-white/[0.06] rounded w-2/3" />
      </div>
    );
  }

  if (error || !data || data.drepCount === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card/50 p-4 space-y-4', className)}>
      {/* Header + overall score */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Cross-Body Alignment
        </p>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-foreground">{data.overallAlignment}%</p>
          <p className="text-[10px] text-muted-foreground">overall agreement</p>
        </div>
      </div>

      {/* Per-dimension bars */}
      <div className="space-y-2">
        {data.dimensions.map((dim) => (
          <DimensionBar
            key={dim.dimension}
            label={dim.label}
            citizenAvg={dim.citizenAvg}
            drepAvg={dim.drepAvg}
          />
        ))}
      </div>

      {/* Biggest gap callout */}
      {data.biggestGap.gap > 5 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            {data.biggestGap.bodies.join(' and ')} diverge most on{' '}
            <span className="font-medium text-foreground">{data.biggestGap.dimension}</span>
            {' — '}
            gap of {data.biggestGap.gap} points
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-[9px] text-white/40">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: BODY_COLORS.citizen, opacity: 0.6 }}
          />{' '}
          Citizens
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-0.5 rounded-full"
            style={{ backgroundColor: BODY_COLORS.drep }}
          />{' '}
          DReps
        </span>
      </div>

      <p className="text-[10px] text-white/30 text-center">
        Based on {data.drepCount} DReps with alignment data
      </p>
    </div>
  );
}

export function CrossBodyAlignment(props: CrossBodyAlignmentProps) {
  return (
    <FeatureGate flag="community_intelligence">
      <CrossBodyAlignmentInner {...props} />
    </FeatureGate>
  );
}
