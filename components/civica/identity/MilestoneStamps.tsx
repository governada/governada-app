'use client';

import {
  HandHeart,
  Flame,
  Vote,
  Megaphone,
  Coins,
  MessageCircle,
  Users,
  ThumbsUp,
  ShieldCheck,
  TrendingUp,
  Award,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CITIZEN_MILESTONES } from '@/lib/citizenMilestones';

/* ── Icon map ──────────────────────────────────────────────────── */

const ICON_MAP: Record<string, LucideIcon> = {
  HandHeart,
  Flame,
  Vote,
  Megaphone,
  Coins,
  MessageCircle,
  Users,
  ThumbsUp,
  ShieldCheck,
  TrendingUp,
  Award,
};

/* ── Types ──────────────────────────────────────────────────────── */

interface EarnedMilestone {
  key: string;
  label: string;
  earnedAt: string;
}

interface MilestoneStampsProps {
  earned: EarnedMilestone[];
  recentKeys?: Set<string>;
  maxVisible?: number;
}

/* ── Component ─────────────────────────────────────────────────── */

export function MilestoneStamps({ earned, recentKeys, maxVisible = 6 }: MilestoneStampsProps) {
  if (earned.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">No milestones yet</p>
      </div>
    );
  }

  const visible = earned.slice(0, maxVisible);
  const overflow = earned.length - maxVisible;

  return (
    <div className="flex gap-2 overflow-x-auto">
      {visible.map((milestone) => {
        const def = CITIZEN_MILESTONES.find((m) => m.key === milestone.key);
        const Icon = (def ? ICON_MAP[def.icon] : null) ?? Vote;
        const isRecent = recentKeys?.has(milestone.key);

        return (
          <div
            key={milestone.key}
            className={cn(
              'flex w-16 h-16 flex-col items-center justify-center rounded-lg border shrink-0',
              'border-primary/30 bg-primary/5',
              isRecent && 'ring-2 ring-amber-400/50',
            )}
          >
            <Icon className="h-4 w-4 text-primary" />
            <span className="text-[10px] text-muted-foreground mt-1 text-center leading-tight line-clamp-2 px-0.5">
              {milestone.label}
            </span>
          </div>
        );
      })}
      {overflow > 0 && (
        <div className="flex w-16 h-16 flex-col items-center justify-center rounded-lg border border-border/50 bg-muted/20 shrink-0">
          <span className="text-xs font-medium text-muted-foreground">+{overflow} more</span>
        </div>
      )}
    </div>
  );
}
