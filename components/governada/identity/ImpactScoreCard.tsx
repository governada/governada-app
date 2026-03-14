'use client';

import { TrendingUp, Flame, Users, MessageCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlowBar } from '@/components/ui/GlowBar';
import type { ImpactScoreResponse } from '@/hooks/queries';

/* ── Pillar config ─────────────────────────────────────────────── */

const PILLARS = [
  {
    key: 'delegationTenureScore' as const,
    label: 'Delegation Tenure',
    icon: Flame,
    max: 25,
    description: 'How long you have been delegating',
  },
  {
    key: 'repActivityScore' as const,
    label: 'Rep Activity',
    icon: Users,
    max: 25,
    description: "Your DRep's participation rate",
  },
  {
    key: 'engagementDepthScore' as const,
    label: 'Engagement Depth',
    icon: MessageCircle,
    max: 25,
    description: 'Sentiment votes, priorities, assemblies',
  },
  {
    key: 'coverageScore' as const,
    label: 'Coverage',
    icon: ShieldCheck,
    max: 25,
    description: 'Proposals covered by your delegation',
  },
] as const;

/* ── Score ring (circular progress) ─────────────────────────────── */

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / 100, 1);
  const offset = circumference * (1 - progress);

  const color =
    score >= 80
      ? 'text-emerald-500'
      : score >= 50
        ? 'text-primary'
        : score >= 25
          ? 'text-amber-500'
          : 'text-muted-foreground';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-700', color)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold tabular-nums', color)}>{Math.round(score)}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

/* ── Pillar bar ─────────────────────────────────────────────────── */

function pillarGlow(pct: number): { fillClass: string; glowColor: string } {
  if (pct >= 80) return { fillClass: 'bg-emerald-500', glowColor: '#10b981' };
  if (pct >= 50) return { fillClass: 'bg-blue-500', glowColor: '#3b82f6' };
  return { fillClass: 'bg-amber-500', glowColor: '#f59e0b' };
}

function PillarBar({
  label,
  value,
  max,
  icon: Icon,
  description,
}: {
  label: string;
  value: number;
  max: number;
  icon: typeof Flame;
  description: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const { fillClass, glowColor } = pillarGlow(pct);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">{label}</span>
        </div>
        <span className="text-xs font-bold tabular-nums text-foreground">
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <GlowBar value={pct} fillClass={fillClass} glowColor={glowColor} height={8} />
      <p className="text-[10px] text-muted-foreground">{description}</p>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

interface ImpactScoreCardProps {
  data: ImpactScoreResponse;
}

export function ImpactScoreCard({ data }: ImpactScoreCardProps) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-5 space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Governance Impact Score
        </h3>
      </div>

      {/* Score ring + summary */}
      <div className="flex items-center gap-6">
        <ScoreRing score={data.score} />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {data.score >= 80
              ? 'Governance Champion'
              : data.score >= 50
                ? 'Rising Citizen'
                : data.score >= 25
                  ? 'Active Participant'
                  : 'Getting Started'}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.score >= 80
              ? 'Your governance participation is exceptional.'
              : data.score >= 50
                ? 'Strong participation. Keep building your civic footprint.'
                : data.score >= 25
                  ? 'Good start. More engagement will increase your impact.'
                  : 'Delegate and engage with governance to grow your score.'}
          </p>
        </div>
      </div>

      {/* Pillar breakdown */}
      <div className="space-y-4 pt-1">
        {PILLARS.map((pillar) => (
          <PillarBar
            key={pillar.key}
            label={pillar.label}
            value={data[pillar.key]}
            max={pillar.max}
            icon={pillar.icon}
            description={pillar.description}
          />
        ))}
      </div>
    </div>
  );
}
