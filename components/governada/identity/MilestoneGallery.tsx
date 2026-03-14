'use client';

import {
  HandHeart,
  Flame,
  Vote,
  Megaphone,
  Coins,
  Lock,
  MessageCircle,
  Users,
  ThumbsUp,
  ShieldCheck,
  TrendingUp,
  Award,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CITIZEN_MILESTONES, type CitizenMilestoneDefinition } from '@/lib/citizenMilestones';

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

interface MilestoneGalleryProps {
  earned: EarnedMilestone[];
  /** Keys earned since last visit — these get the sparkle highlight */
  recentKeys?: Set<string>;
}

/* ── Helpers ────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const CATEGORY_LABEL: Record<CitizenMilestoneDefinition['category'], string> = {
  delegation: 'Delegation',
  influence: 'Influence',
  engagement: 'Engagement',
  identity: 'Identity',
  impact: 'Impact',
};

/* ── Component ─────────────────────────────────────────────────── */

export function MilestoneGallery({ earned, recentKeys }: MilestoneGalleryProps) {
  const earnedSet = new Set(earned.map((m) => m.key));
  const earnedMap = new Map(earned.map((m) => [m.key, m]));

  const categories = ['delegation', 'influence', 'engagement', 'identity', 'impact'] as const;

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const milestones = CITIZEN_MILESTONES.filter((m) => m.category === cat);
        if (milestones.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {CATEGORY_LABEL[cat]}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {milestones.map((def) => {
                const isEarned = earnedSet.has(def.key);
                const isRecent = recentKeys?.has(def.key);
                const Icon = ICON_MAP[def.icon] ?? Vote;
                const earnedData = earnedMap.get(def.key);

                return (
                  <div
                    key={def.key}
                    className={cn(
                      'relative rounded-xl border p-3 text-center transition-colors',
                      isEarned
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border/50 bg-muted/20 opacity-50',
                      isRecent && 'ring-2 ring-amber-400/50 animate-pulse',
                    )}
                  >
                    <div
                      className={cn(
                        'mx-auto flex h-9 w-9 items-center justify-center rounded-full mb-2',
                        isEarned ? 'bg-primary/10' : 'bg-muted/40',
                      )}
                    >
                      {isEarned ? (
                        <Icon className="h-4 w-4 text-primary" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p
                      className={cn(
                        'text-xs font-medium',
                        isEarned ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {def.label}
                    </p>
                    {isEarned && earnedData ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDate(earnedData.earnedAt)}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{def.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
