'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CockpitData, ScoreStoryPillar } from '@/hooks/queries';

import { TIER_SCORE_COLOR } from '@/components/governada/cards/tierStyles';

const TIER_ACCENT: Record<string, string> = TIER_SCORE_COLOR;

const TIER_BG: Record<string, string> = {
  Emerging: 'bg-muted/10',
  Bronze: 'bg-amber-500/10',
  Silver: 'bg-slate-400/10',
  Gold: 'bg-yellow-500/10',
  Diamond: 'bg-cyan-400/10',
  Legendary: 'bg-violet-400/10',
};

// ── Score Story Pillar Row ──────────────────────────────────────────

function PillarRow({ pillar, isBiggestWin }: { pillar: ScoreStoryPillar; isBiggestWin: boolean }) {
  const barColor =
    pillar.value >= 70 ? 'bg-emerald-500' : pillar.value >= 40 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div
      className={cn(
        'rounded-lg p-2.5 space-y-1.5 transition-colors',
        isBiggestWin ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-muted/30',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isBiggestWin && <Zap className="h-3 w-3 text-primary" />}
          <span className="text-xs font-medium text-foreground">{pillar.label}</span>
        </div>
        <span className="text-xs font-bold tabular-nums text-foreground">{pillar.value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${Math.min(100, pillar.value)}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">
        {isBiggestWin && <span className="text-primary font-medium">Biggest win: </span>}
        {pillar.action}
        {pillar.scoreImpact > 0 && (
          <span className="text-muted-foreground/70"> (+{pillar.scoreImpact} pts potential)</span>
        )}
      </p>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

interface CockpitScoreHeroProps {
  score: CockpitData['score'];
  scoreStory?: CockpitData['scoreStory'];
}

export function CockpitScoreHero({ score, scoreStory }: CockpitScoreHeroProps) {
  const [storyOpen, setStoryOpen] = useState(false);
  const trend = score.trend;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor =
    trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-rose-500' : 'text-muted-foreground';

  const pillars = [
    { key: 'engagementQuality', label: 'Engagement', value: score.pillars.engagementQuality },
    {
      key: 'effectiveParticipation',
      label: 'Participation',
      value: score.pillars.effectiveParticipation,
    },
    { key: 'reliability', label: 'Reliability', value: score.pillars.reliability },
    { key: 'governanceIdentity', label: 'Identity', value: score.pillars.governanceIdentity },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* Score + Tier + Trend */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                TIER_BG[score.tier] ?? 'bg-muted',
                TIER_ACCENT[score.tier] ?? 'text-foreground',
              )}
            >
              <Trophy className="h-3 w-3" />
              {score.tier}
            </span>
            {score.rank && (
              <span className="text-xs text-muted-foreground tabular-nums">
                #{score.rank} of {score.totalDReps}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{score.narrative}</p>
        </div>

        <div className="text-right">
          <span className="text-4xl font-bold tabular-nums text-foreground">{score.current}</span>
          <div className={cn('flex items-center justify-end gap-1 text-xs', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span className="tabular-nums">
              {trend > 0 ? '+' : ''}
              {trend} pts
            </span>
          </div>
        </div>
      </div>

      {/* 4-Pillar Mini Bars (always visible) */}
      <div className="grid grid-cols-4 gap-2">
        {pillars.map((p) => (
          <div key={p.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground truncate">{p.label}</span>
              <span className="text-[10px] font-medium tabular-nums text-foreground">
                {p.value}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  p.value >= 70 ? 'bg-emerald-500' : p.value >= 40 ? 'bg-amber-500' : 'bg-rose-500',
                )}
                style={{ width: `${Math.min(100, p.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tier Progress */}
      {score.tierProgress.nextTier && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/60"
              style={{ width: `${score.tierProgress.percentWithinTier}%` }}
            />
          </div>
          <span className="tabular-nums whitespace-nowrap">
            {score.tierProgress.pointsToNext} pts to {score.tierProgress.nextTier}
          </span>
        </div>
      )}

      {/* Score Story toggle */}
      {scoreStory && (
        <>
          <button
            onClick={() => setStoryOpen(!storyOpen)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors pt-1"
          >
            {storyOpen ? (
              <>
                Hide score breakdown
                <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                What&apos;s driving your score?
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>

          {storyOpen && (
            <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              {scoreStory.pillars.map((p) => (
                <PillarRow key={p.key} pillar={p} isBiggestWin={p.key === scoreStory.biggestWin} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
