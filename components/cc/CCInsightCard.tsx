'use client';

import { motion } from 'framer-motion';
import { Lightbulb, Zap, TrendingUp, ShieldCheck, Users } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';
import type { CCHealthSummaryResponse, CommitteeMemberQuickView } from '@/hooks/queries';

interface CCInsightCardProps {
  health: CCHealthSummaryResponse;
  members: CommitteeMemberQuickView[];
  segment?: string;
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
  segment?: string,
): Insight {
  // Persona-aware: DRep sees CC-DRep tension elevated
  if (segment === 'drep' && health.tensionCount > 0) {
    return {
      icon: Zap,
      title: 'CC–DRep Alignment',
      body: `The committee diverged from DRep majority on ${health.tensionCount} proposal${health.tensionCount > 1 ? 's' : ''}. Review member profiles to see where your votes differed from the CC.`,
      accent: 'text-amber-500',
    };
  }

  // Persona-aware: SPO sees CC-SPO alignment
  if (segment === 'spo') {
    return {
      icon: Users,
      title: 'CC–SPO Alignment',
      body: "See how each committee member's constitutional votes align with SPO consensus on their individual profiles.",
      accent: 'text-violet-500',
    };
  }

  // Persona-aware: CC member sees standing
  if (segment === 'cc') {
    const scored = members.filter((m) => m.fidelityScore != null);
    return {
      icon: ShieldCheck,
      title: 'Your Committee Standing',
      body: `${scored.length} member${scored.length !== 1 ? 's' : ''} scored on Constitutional Fidelity. Check your profile to see your rank and pillar breakdown.`,
      accent: 'text-emerald-500',
    };
  }

  // Priority 1: Alignment tensions (citizen/anonymous default)
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
      body: `Average fidelity scores are trending upward across the committee, signaling stronger governance practices.`,
      accent: 'text-emerald-500',
    };
  }

  if (health.trend === 'declining') {
    return {
      icon: TrendingUp,
      title: 'Accountability Declining',
      body: `Average fidelity scores have dropped — some members may need to improve participation or rationale quality.`,
      accent: 'text-rose-500',
    };
  }

  // Priority 3: All members graded well
  const graded = members.filter((m) => m.fidelityGrade != null);
  const allStrong =
    graded.length > 0 && graded.every((m) => m.fidelityGrade === 'A' || m.fidelityGrade === 'B');
  if (allStrong) {
    return {
      icon: ShieldCheck,
      title: 'Strong Accountability',
      body: `All scored members are maintaining a B grade or above — strong constitutional fidelity across the committee.`,
      accent: 'text-emerald-500',
    };
  }

  // Fallback: general insight
  const scored = members.filter((m) => m.fidelityScore != null);
  const active = health.activeMembers;
  return {
    icon: Lightbulb,
    title: 'Committee Overview',
    body:
      scored.length > 0
        ? `${active} active member${active !== 1 ? 's' : ''} with ${scored.length} scored on Constitutional Fidelity. Review individual profiles to see pillar breakdowns.`
        : `${active} active committee member${active !== 1 ? 's' : ''} participating in governance. Fidelity scores will appear after the next scoring cycle.`,
    accent: 'text-blue-500',
  };
}

export function CCInsightCard({ health, members, segment }: CCInsightCardProps) {
  const insight = selectInsight(health, members, segment);
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
