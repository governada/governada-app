'use client';

import { useEffect } from 'react';
import { Eye, Vote, Shield, Crown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GlowBar } from '@/components/ui/GlowBar';
import { type GovernanceLevel, getLevelDefinition, getLevelProgress } from '@/lib/governanceLevels';
import { posthog } from '@/lib/posthog';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Eye,
  Vote,
  Shield,
  Crown,
};

const COLOR_MAP: Record<string, { badge: string; icon: string; bar: string; glow: string }> = {
  slate: {
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    icon: 'text-slate-500',
    bar: 'bg-slate-500',
    glow: '#64748b',
  },
  blue: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    icon: 'text-blue-500',
    bar: 'bg-blue-500',
    glow: '#3b82f6',
  },
  amber: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    icon: 'text-amber-500',
    bar: 'bg-amber-500',
    glow: '#f59e0b',
  },
  green: {
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    icon: 'text-green-500',
    bar: 'bg-green-500',
    glow: '#22c55e',
  },
};

interface GovernanceLevelBadgeProps {
  level: GovernanceLevel;
  pollCount: number;
  visitStreak: number;
  isDelegated?: boolean;
  compact?: boolean;
}

export function GovernanceLevelBadge({
  level,
  pollCount,
  visitStreak,
  isDelegated = false,
  compact = false,
}: GovernanceLevelBadgeProps) {
  const def = getLevelDefinition(level);
  const colors = COLOR_MAP[def.color] || COLOR_MAP.slate;
  const Icon = ICON_MAP[def.icon] || Eye;
  const progress = getLevelProgress(level, pollCount, visitStreak, isDelegated);

  useEffect(() => {
    posthog.capture('governance_level_viewed', { level });
  }, [level]);

  if (compact) {
    return (
      <Badge variant="secondary" className={`gap-1 ${colors.badge}`}>
        <Icon className="h-3 w-3" />
        {def.label}
      </Badge>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.badge}`}>
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </div>
          <div>
            <p className="font-semibold text-sm">{def.label}</p>
            <p className="text-xs text-muted-foreground">{def.description}</p>
          </div>
        </div>

        {progress.nextLabel && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Next: {progress.nextLabel}</span>
              <span>{progress.percent}%</span>
            </div>
            <GlowBar
              value={progress.percent}
              fillClass={colors.bar}
              glowColor={colors.glow}
              height={6}
            />
            {progress.hint && <p className="text-[10px] text-muted-foreground">{progress.hint}</p>}
          </div>
        )}

        {!progress.nextLabel && <p className="text-xs text-muted-foreground">Max level reached</p>}
      </CardContent>
    </Card>
  );
}
