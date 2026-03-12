'use client';

import { motion } from 'framer-motion';
import { Lightbulb, Zap, TrendingUp, ShieldCheck } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';
import type { CCHealthSummaryResponse, CommitteeMemberQuickView } from '@/hooks/queries';

interface CCInsightCardProps {
  health: CCHealthSummaryResponse;
  members: CommitteeMemberQuickView[];
}

interface Insight {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  accent: string;
}

function selectInsight(
  health: CCHealthSummaryResponse,
  members: CommitteeMemberQuickView[],
): Insight {
  // Priority 1: Alignment tensions
  if (health.tensionCount > 0) {
    return {
      icon: Zap,
      title: 'CC Independence',
      body: `The Constitutional Committee diverged from the DRep majority on ${health.tensionCount} proposal${health.tensionCount > 1 ? 's' : ''} — exercising independent constitutional judgment.`,
      accent: 'text-amber-500',
    };
  }

  // Priority 2: Trend change
  if (health.trend === 'improving') {
    return {
      icon: TrendingUp,
      title: 'Accountability Improving',
      body: `Average transparency scores are trending upward across the committee, signaling stronger governance practices.`,
      accent: 'text-emerald-500',
    };
  }

  if (health.trend === 'declining') {
    return {
      icon: TrendingUp,
      title: 'Accountability Declining',
      body: `Average transparency scores have dropped — some members may need to improve participation or rationale quality.`,
      accent: 'text-rose-500',
    };
  }

  // Priority 3: All members graded well
  const graded = members.filter((m) => m.transparencyGrade != null);
  const allStrong =
    graded.length > 0 &&
    graded.every((m) => m.transparencyGrade === 'A' || m.transparencyGrade === 'B');
  if (allStrong) {
    return {
      icon: ShieldCheck,
      title: 'Strong Accountability',
      body: `All scored members are maintaining a B grade or above — healthy transparency across the committee.`,
      accent: 'text-emerald-500',
    };
  }

  // Fallback: general insight
  const scored = members.filter((m) => m.transparencyIndex != null);
  const active = health.activeMembers;
  return {
    icon: Lightbulb,
    title: 'Committee Overview',
    body:
      scored.length > 0
        ? `${active} active member${active !== 1 ? 's' : ''} with ${scored.length} scored on the Transparency Index. Review individual profiles to see pillar breakdowns.`
        : `${active} active committee member${active !== 1 ? 's' : ''} participating in governance. Transparency scores will appear after the next scoring cycle.`,
    accent: 'text-blue-500',
  };
}

export function CCInsightCard({ health, members }: CCInsightCardProps) {
  const insight = selectInsight(health, members);
  const Icon = insight.icon;

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-xl border border-border/60 bg-card/50 p-5 sm:p-6"
    >
      <div className="flex gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted ${insight.accent}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{insight.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{insight.body}</p>
        </div>
      </div>
    </motion.div>
  );
}
