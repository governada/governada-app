'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfidenceBar } from './ConfidenceBar';
import { ArrowRight, Zap, Vote, MessageSquare, Users, TrendingUp } from 'lucide-react';
import type { ConfidenceBreakdown, ConfidenceAction } from '@/lib/matching/confidence';

/* ─── Icons per action type ────────────────────────────── */

const ACTION_ICONS: Record<string, typeof Zap> = {
  take_quiz: Zap,
  vote_proposals: Vote,
  diversify_votes: TrendingUp,
  engage: MessageSquare,
  delegate: Users,
};

/* ─── Props ────────────────────────────────────────────── */

interface MatchConfidenceCTAProps {
  breakdown: ConfidenceBreakdown;
  /** Compact mode: single-line CTA. Full mode: card with breakdown. */
  variant?: 'compact' | 'full';
  className?: string;
}

/* ─── Component ────────────────────────────────────────── */

export function MatchConfidenceCTA({
  breakdown,
  variant = 'full',
  className,
}: MatchConfidenceCTAProps) {
  const { overall, sources, nextAction } = breakdown;

  if (variant === 'compact') {
    return <CompactCTA overall={overall} nextAction={nextAction} className={className} />;
  }

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">Improve Your Match</h4>
          <span className="text-xs text-muted-foreground">
            {overall < 40
              ? 'Getting started'
              : overall < 70
                ? 'Building confidence'
                : 'Strong match'}
          </span>
        </div>

        <ConfidenceBar confidence={overall} sources={sources} expandable />

        {overall < 100 && nextAction && <ActionCard action={nextAction} />}

        {overall >= 70 && (
          <p className="text-xs text-muted-foreground">
            Your governance profile is well-established. Match results reflect a strong
            understanding of your values.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Compact CTA ──────────────────────────────────────── */

function CompactCTA({
  overall,
  nextAction,
  className,
}: {
  overall: number;
  nextAction: ConfidenceAction | null;
  className?: string;
}) {
  if (!nextAction || overall >= 90) return null;

  const Icon = ACTION_ICONS[nextAction.type] ?? ArrowRight;

  return (
    <Link href={nextAction.href} className={className}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span>{nextAction.label}</span>
        <span className="text-primary/60 group-hover:text-primary tabular-nums">
          +{Math.round(nextAction.potentialGain)}%
        </span>
        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

/* ─── Action card ──────────────────────────────────────── */

function ActionCard({ action }: { action: ConfidenceAction }) {
  const Icon = ACTION_ICONS[action.type] ?? ArrowRight;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm font-medium leading-tight">{action.label}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
        <Link href={action.href}>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 mt-1">
            Get started
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
      <span className="text-xs font-medium text-primary tabular-nums shrink-0">
        +{Math.round(action.potentialGain)}%
      </span>
    </div>
  );
}
