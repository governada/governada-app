'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Vote, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { posthog } from '@/lib/posthog';

interface Suggestion {
  drepId: string;
  drepName: string;
  drepScore: number;
  matchCount: number;
  totalComparisons: number;
  matchRate: number;
}

export interface DelegationIntelligenceProps {
  currentDrepName?: string | null;
  currentMatchScore?: number | null;
  suggestions: Suggestion[];
  totalPollVotes: number;
}

function matchTier(score: number | null | undefined) {
  if (score == null) return 'unknown';
  if (score >= 75) return 'good';
  if (score >= 50) return 'moderate';
  return 'poor';
}

const TIER_STYLES = {
  good: {
    border: 'border-green-300 dark:border-green-700',
    bg: 'bg-green-50/50 dark:bg-green-950/20',
    text: 'text-green-800 dark:text-green-300',
    muted: 'text-green-900/70 dark:text-green-200/70',
    label: 'Your DRep aligns well with your views',
  },
  moderate: {
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50/50 dark:bg-amber-950/20',
    text: 'text-amber-800 dark:text-amber-300',
    muted: 'text-amber-900/70 dark:text-amber-200/70',
    label: 'There may be better-aligned options',
  },
  poor: {
    border: 'border-red-300 dark:border-red-700',
    bg: 'bg-red-50/50 dark:bg-red-950/20',
    text: 'text-red-800 dark:text-red-300',
    muted: 'text-red-900/70 dark:text-red-200/70',
    label: 'Consider re-delegation',
  },
  unknown: {
    border: 'border-border',
    bg: '',
    text: '',
    muted: 'text-muted-foreground',
    label: '',
  },
} as const;

export function DelegationIntelligence({
  currentDrepName,
  currentMatchScore,
  suggestions,
  totalPollVotes,
}: DelegationIntelligenceProps) {
  const tracked = useRef(false);
  const top3 = suggestions.slice(0, 3);
  const bestAlt = top3[0]?.matchRate ?? null;
  const tier = matchTier(currentMatchScore);
  const style = TIER_STYLES[tier];

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    posthog.capture('delegation_intelligence_viewed', {
      currentMatch: currentMatchScore,
      bestAlternativeMatch: bestAlt,
    });
  }, [currentMatchScore, bestAlt]);

  if (totalPollVotes < 3) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Delegation Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cast more poll votes to unlock delegation insights. We need at least 3 votes to compare
            your views against DReps.
          </p>
          <Link
            href="/governance/proposals"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Vote className="h-3.5 w-3.5" />
            Vote on Proposals
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${style.border} ${style.bg}`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-base flex items-center gap-2 ${style.text}`}>
          <Brain className="h-4 w-4" />
          Delegation Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentMatchScore != null && (
          <p className={`text-sm ${style.muted}`}>
            {style.label} <span className="font-semibold">({currentMatchScore}% match)</span>
            {currentDrepName && <span className="text-xs opacity-80"> with {currentDrepName}</span>}
          </p>
        )}

        {top3.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Top Alternatives
            </p>
            {top3.map((s) => {
              const delta = currentMatchScore != null ? s.matchRate - currentMatchScore : null;
              return (
                <Link
                  key={s.drepId}
                  href={`/drep/${encodeURIComponent(s.drepId)}`}
                  className="flex items-center gap-3 text-sm rounded px-2 py-2 -mx-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">
                      {s.drepName || `${s.drepId.slice(0, 16)}...`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Score {s.drepScore} &middot; {s.matchCount}/{s.totalComparisons} votes aligned
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] shrink-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800"
                  >
                    {s.matchRate}% match
                  </Badge>
                  {delta != null && (
                    <span
                      className={`text-xs font-medium tabular-nums shrink-0 flex items-center gap-0.5 ${
                        delta > 0
                          ? 'text-green-600 dark:text-green-400'
                          : delta < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {delta > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : delta < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      {delta > 0 ? '+' : ''}
                      {delta}%
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {top3.length > 0 && top3[0].matchRate > (currentMatchScore ?? 0) && (
          <p className="text-xs text-muted-foreground">
            Switching to <strong>{top3[0].drepName || top3[0].drepId.slice(0, 16)}</strong> would
            give you {top3[0].matchRate}% representation
            {currentMatchScore != null && <> (vs {currentMatchScore}% current)</>}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
