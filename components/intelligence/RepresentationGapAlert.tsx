'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */

interface GapEntry {
  dimension: string;
  citizenAvg: number;
  entityScore: number;
  gap: number;
}

export interface RepresentationGapAlertProps {
  gaps: Array<{
    dimension: string;
    citizenAvg: number;
    drepScore?: number;
    entityScore?: number;
    gap: number;
  }>;
  entityType: 'drep' | 'spo';
}

const DISMISS_KEY = 'governada:rep-gap-alert-dismissed';
const GAP_THRESHOLD = 25;

/* ─── Main component ───────────────────────────────────── */

export function RepresentationGapAlert({ gaps, entityType }: RepresentationGapAlertProps) {
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { ts: number };
        // Re-show after 7 days
        if (Date.now() - parsed.ts < 7 * 24 * 60 * 60 * 1000) {
          setDismissed(true);
          return;
        }
      }
      setDismissed(false);
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  // Normalize gap entries — accept both drepScore and entityScore
  const normalizedGaps: GapEntry[] = gaps.map((g) => ({
    dimension: g.dimension,
    citizenAvg: g.citizenAvg,
    entityScore: g.entityScore ?? g.drepScore ?? 50,
    gap: g.gap,
  }));

  // Find the largest gap above threshold
  const significantGaps = normalizedGaps
    .filter((g) => g.gap > GAP_THRESHOLD)
    .sort((a, b) => b.gap - a.gap);

  if (significantGaps.length === 0) return null;

  const topGap = significantGaps[0];
  const entityLabel = entityType === 'drep' ? 'delegators' : 'stakers';

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ ts: Date.now() }));
    } catch {
      // localStorage unavailable — dismiss for session only
    }
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
        'border-amber-700/40 bg-amber-950/20',
      )}
    >
      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your {entityLabel} prioritize{' '}
          <span className="font-medium text-amber-300">{topGap.dimension}</span> (avg:{' '}
          {topGap.citizenAvg}) but your alignment is{' '}
          <span className="font-medium text-foreground">{topGap.entityScore}</span>
          {' — '}consider addressing this in your next vote rationale
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
        aria-label="Dismiss alert"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
