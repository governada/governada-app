'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface ScoreDeepDiveProps {
  score: number;
  engagementQuality: number | null;
  engagementQualityRaw: number | null;
  effectiveParticipation: number | null;
  effectiveParticipationRaw: number | null;
  reliability: number | null;
  reliabilityRaw: number | null;
  governanceIdentity: number | null;
  governanceIdentityRaw: number | null;
  scoreMomentum: number | null;
  rationaleRate: number;
  deliberationModifier: number;
  reliabilityStreak: number;
  reliabilityRecency: number;
  reliabilityLongestGap: number;
  reliabilityTenure: number;
  profileCompleteness: number;
  delegatorCount: number;
}

const PILLARS = [
  {
    key: 'engagement' as const,
    label: 'Engagement Quality',
    weight: 35,
    percentile: (p: ScoreDeepDiveProps) => p.engagementQuality,
    raw: (p: ScoreDeepDiveProps) => p.engagementQualityRaw,
  },
  {
    key: 'participation' as const,
    label: 'Effective Participation',
    weight: 25,
    percentile: (p: ScoreDeepDiveProps) => p.effectiveParticipation,
    raw: (p: ScoreDeepDiveProps) => p.effectiveParticipationRaw,
  },
  {
    key: 'reliability' as const,
    label: 'Reliability',
    weight: 25,
    percentile: (p: ScoreDeepDiveProps) => p.reliability,
    raw: (p: ScoreDeepDiveProps) => p.reliabilityRaw,
  },
  {
    key: 'identity' as const,
    label: 'Governance Identity',
    weight: 15,
    percentile: (p: ScoreDeepDiveProps) => p.governanceIdentity,
    raw: (p: ScoreDeepDiveProps) => p.governanceIdentityRaw,
  },
] as const;

function tierColor(pct: number | null): string {
  if (pct === null) return 'bg-muted';
  if (pct < 30) return 'bg-red-500/80';
  if (pct < 60) return 'bg-amber-500/80';
  return 'bg-green-500/80';
}

function formatPercentile(pct: number | null): string {
  if (pct === null) return '—';
  const top = Math.round(100 - pct);
  if (top <= 1) return 'Top 1%';
  if (top >= 99) return 'Bottom 1%';
  return `Top ${top}%`;
}

export function ScoreDeepDive(props: ScoreDeepDiveProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allNull =
    props.engagementQuality === null &&
    props.effectiveParticipation === null &&
    props.reliability === null &&
    props.governanceIdentity === null;

  if (allNull) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-muted-foreground" />
            Score Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            V3 scoring is processing — check back after the next sync cycle.
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const momentum = props.scoreMomentum;
  const momentumEl =
    momentum === null || momentum === 0 ? (
      <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
        <Minus className="h-3.5 w-3.5" />— pts/day
      </span>
    ) : momentum > 0 ? (
      <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 tabular-nums">
        <TrendingUp className="h-3.5 w-3.5" />+{momentum.toFixed(1)} pts/day
      </span>
    ) : (
      <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 tabular-nums">
        <TrendingDown className="h-3.5 w-3.5" />
        {momentum.toFixed(1)} pts/day
      </span>
    );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-muted-foreground" />
          Score Intelligence
        </CardTitle>
        {momentumEl}
      </CardHeader>
      <CardContent className="space-y-4">
        {PILLARS.map((pillar) => {
          const pct = pillar.percentile(props);
          const raw = pillar.raw(props);
          const isExpanded = expanded.has(pillar.key);
          const displayVal = pct ?? raw ?? 0;

          return (
            <div key={pillar.key} className="space-y-1.5">
              <button
                type="button"
                onClick={() => toggle(pillar.key)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">
                  {pillar.label} · {pillar.weight}%
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] tabular-nums font-normal">
                    {formatPercentile(pct)}
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${tierColor(pct)}`}
                  initial={false}
                  animate={{ width: `${Math.min(100, Math.max(0, displayVal))}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 pl-1 space-y-1 text-xs text-muted-foreground">
                      {pillar.key === 'engagement' && (
                        <>
                          <p className="tabular-nums">
                            Rationale provision: {props.rationaleRate}%
                          </p>
                          <p className="tabular-nums">
                            Deliberation factor: {props.deliberationModifier}x
                          </p>
                        </>
                      )}
                      {pillar.key === 'participation' && (
                        <p className="tabular-nums">
                          Importance-weighted voting — raw: {raw ?? '—'}, percentile:{' '}
                          {pct !== null ? `${Math.round(pct)}%` : '—'}
                        </p>
                      )}
                      {pillar.key === 'reliability' && (
                        <>
                          <p className="tabular-nums">Streak: {props.reliabilityStreak} epochs</p>
                          <p className="tabular-nums">Recency: {props.reliabilityRecency}</p>
                          <p className="tabular-nums">
                            Longest gap: {props.reliabilityLongestGap} epochs
                          </p>
                          <p className="tabular-nums">Tenure: {props.reliabilityTenure} epochs</p>
                        </>
                      )}
                      {pillar.key === 'identity' && (
                        <>
                          <p className="tabular-nums">
                            Profile completeness: {props.profileCompleteness}%
                          </p>
                          <p className="tabular-nums">Delegators: {props.delegatorCount}</p>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
