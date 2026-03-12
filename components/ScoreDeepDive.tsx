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
  rationaleQualityAvg: number | null;
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
                          <p className="text-xs font-medium text-foreground/80 mb-1">
                            Provision (40%) + AI Quality (40%) + Deliberation (20%)
                          </p>
                          <p className="tabular-nums">
                            Rationale provision: {props.rationaleRate}%
                          </p>
                          <p className="tabular-nums">
                            AI rationale quality:{' '}
                            {props.rationaleQualityAvg !== null
                              ? `${props.rationaleQualityAvg}/100`
                              : 'Not yet scored'}
                          </p>
                          <p className="tabular-nums">
                            Deliberation factor: {props.deliberationModifier}x
                          </p>
                          {props.rationaleQualityAvg !== null && (
                            <p className="text-primary/80 mt-1">
                              {props.rationaleQualityAvg >= 70
                                ? 'Strong rationale quality — your explanations demonstrate specificity, reasoning depth, and proposal awareness.'
                                : props.rationaleQualityAvg >= 40
                                  ? 'Moderate rationale quality. To improve: cite specific proposal details, explain cause-effect reasoning, and reference stakeholder impacts.'
                                  : 'Low rationale quality. To improve: explain WHY you voted this way, reference specific numbers or stakeholders from the proposal, and describe expected consequences.'}
                            </p>
                          )}
                          {props.rationaleQualityAvg === null && (
                            <p className="text-primary/80 mt-1">
                              {props.rationaleRate < 50
                                ? 'To improve: add written rationales when voting — even brief reasoning boosts this pillar significantly.'
                                : 'Strong rationale rate. AI quality scoring will appear after your rationales are analyzed.'}
                            </p>
                          )}
                        </>
                      )}
                      {pillar.key === 'participation' && (
                        <>
                          <p className="tabular-nums">
                            Importance-weighted voting — raw: {raw ?? '—'}, percentile:{' '}
                            {pct !== null ? `${Math.round(pct)}%` : '—'}
                          </p>
                          <p className="text-primary/80 mt-1">
                            {(pct ?? 0) < 50
                              ? 'To improve: vote on more proposals, especially high-importance ones like treasury withdrawals and parameter changes.'
                              : 'Strong participation. Continue voting consistently to maintain this standing.'}
                          </p>
                        </>
                      )}
                      {pillar.key === 'reliability' && (
                        <>
                          <p className="tabular-nums">Streak: {props.reliabilityStreak} epochs</p>
                          <p className="tabular-nums">Recency: {props.reliabilityRecency}</p>
                          <p className="tabular-nums">
                            Longest gap: {props.reliabilityLongestGap} epochs
                          </p>
                          <p className="tabular-nums">Tenure: {props.reliabilityTenure} epochs</p>
                          <p className="text-primary/80 mt-1">
                            {props.reliabilityStreak < 3
                              ? 'To improve: vote every epoch without gaps — consistency matters more than volume here.'
                              : 'Solid streak. Keep voting each epoch to maintain reliability.'}
                          </p>
                        </>
                      )}
                      {pillar.key === 'identity' && (
                        <>
                          <p className="text-xs font-medium text-foreground/80 mb-1">
                            Profile Quality (60%) + Community Presence (40%)
                          </p>
                          <p className="tabular-nums">
                            Profile completeness: {props.profileCompleteness}%
                          </p>
                          <p className="tabular-nums">Delegators: {props.delegatorCount}</p>
                          <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground/80">
                            <p className="font-medium text-muted-foreground mb-0.5">
                              Profile point breakdown (max 100):
                            </p>
                            <p>
                              Name (15 pts) · Objectives (up to 20 pts) · Motivations (up to 15 pts)
                            </p>
                            <p>
                              Qualifications (up to 10 pts) · Bio (up to 10 pts) · Social links (up
                              to 30 pts)
                            </p>
                          </div>
                          <p className="text-primary/80 mt-2">
                            {props.profileCompleteness < 40
                              ? 'To improve: add objectives (200+ chars for max points), motivations, and 2+ social links — these fields carry the most weight.'
                              : props.profileCompleteness < 70
                                ? 'Good start. Add longer objectives/motivations (200+ chars) and a second social link to unlock more points.'
                                : 'Profile is well-filled. Growing your delegator count (by number, not ADA) strengthens Community Presence.'}
                          </p>
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
