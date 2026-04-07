'use client';

import { useState } from 'react';
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
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CITIZEN_MILESTONES } from '@/lib/citizenMilestones';
import { ShareActions } from '@/components/ShareActions';
import { CIVIC_IDENTITY_SHARE_URL } from '@/lib/navigation/civicIdentity';

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
  stakeAddress?: string | null;
}

/* ── Stamp detail card ─────────────────────────────────────────── */

function StampDetailCard({
  milestone,
  stakeAddress,
  onClose,
}: {
  milestone: EarnedMilestone;
  stakeAddress?: string | null;
  onClose: () => void;
}) {
  const def = CITIZEN_MILESTONES.find((m) => m.key === milestone.key);
  const Icon = (def ? ICON_MAP[def.icon] : null) ?? Vote;
  const earnedDate = new Date(milestone.earnedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const shareUrl = CIVIC_IDENTITY_SHARE_URL;
  const shareText = def?.shareText ?? `I earned the "${milestone.label}" milestone! @GovernadaIO`;
  const imageUrl = stakeAddress ? `/api/og/civic-identity/${encodeURIComponent(stakeAddress)}` : '';

  return (
    <div className="mt-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
      <div className="rounded-xl border border-primary/20 bg-card shadow-lg p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{milestone.label}</p>
              <p className="text-xs text-muted-foreground">Earned {earnedDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {def?.description && <p className="text-xs text-muted-foreground">{def.description}</p>}

        {imageUrl && (
          <ShareActions
            url={shareUrl}
            text={shareText}
            imageUrl={imageUrl}
            imageFilename={`milestone-${milestone.key}.png`}
            surface="citizen_milestone_stamp"
            metadata={{ milestone_key: milestone.key }}
            variant="compact"
          />
        )}
      </div>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────── */

export function MilestoneStamps({
  earned,
  recentKeys,
  maxVisible = 6,
  stakeAddress,
}: MilestoneStampsProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (earned.length === 0) {
    // Show first 5 milestones as locked previews so users know what's achievable
    const previews = CITIZEN_MILESTONES.slice(0, 5);
    return (
      <div className="space-y-3">
        <div className="flex gap-2 overflow-hidden">
          {previews.map((def) => {
            const Icon = ICON_MAP[def.icon] ?? Vote;
            return (
              <div
                key={def.key}
                className="flex w-16 h-16 flex-col items-center justify-center rounded-lg border border-border/30 bg-muted/10 shrink-0 opacity-40"
              >
                <div className="relative">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 text-center leading-tight line-clamp-2 px-0.5">
                  {def.label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Earn milestones by delegating, engaging with proposals, and building your governance
          footprint.
        </p>
      </div>
    );
  }

  const visible = earned.slice(0, maxVisible);
  const overflow = earned.length - maxVisible;

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto">
        {visible.map((milestone) => {
          const def = CITIZEN_MILESTONES.find((m) => m.key === milestone.key);
          const Icon = (def ? ICON_MAP[def.icon] : null) ?? Vote;
          const isRecent = recentKeys?.has(milestone.key);
          const isExpanded = expandedKey === milestone.key;

          return (
            <button
              key={milestone.key}
              type="button"
              onClick={() => setExpandedKey(isExpanded ? null : milestone.key)}
              className={cn(
                'flex w-16 h-16 flex-col items-center justify-center rounded-lg border shrink-0 transition-colors',
                'border-primary/30 bg-primary/5 hover:bg-primary/10',
                isRecent && 'ring-2 ring-amber-400/50',
                isExpanded && 'border-primary/50 bg-primary/10',
              )}
            >
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-muted-foreground mt-1 text-center leading-tight line-clamp-2 px-0.5">
                {milestone.label}
              </span>
            </button>
          );
        })}
        {overflow > 0 && (
          <div className="flex w-16 h-16 flex-col items-center justify-center rounded-lg border border-border/50 bg-muted/20 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">+{overflow} more</span>
          </div>
        )}
      </div>

      {/* Expanded stamp detail card */}
      {expandedKey &&
        (() => {
          const milestone = earned.find((m) => m.key === expandedKey);
          if (!milestone) return null;
          return (
            <StampDetailCard
              milestone={milestone}
              stakeAddress={stakeAddress}
              onClose={() => setExpandedKey(null)}
            />
          );
        })()}
    </div>
  );
}
