'use client';

import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import type { DraftStatus } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------

const STAGES: Array<{ key: DraftStatus; label: string }> = [
  { key: 'draft', label: 'Draft' },
  { key: 'community_review', label: 'Community Review' },
  { key: 'response_revision', label: 'Response' },
  { key: 'final_comment', label: 'FCP' },
  { key: 'submitted', label: 'Submitted' },
];

const STAGE_INDEX: Record<string, number> = {};
STAGES.forEach((s, i) => {
  STAGE_INDEX[s.key] = i;
});

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(ms / (1000 * 60));
  return `${mins}m`;
}

function getTimeInfo(
  status: DraftStatus,
  stageEnteredAt: string | null,
  communityReviewStartedAt: string | null,
  fcpStartedAt: string | null,
): { elapsed: string; remaining: string | null } | null {
  if (!stageEnteredAt) return null;

  const elapsed = Date.now() - new Date(stageEnteredAt).getTime();

  // Community review minimum: 48h
  if (status === 'community_review' && communityReviewStartedAt) {
    const reviewElapsed = Date.now() - new Date(communityReviewStartedAt).getTime();
    const minMs = 48 * 60 * 60 * 1000;
    const remaining = minMs - reviewElapsed;
    return {
      elapsed: formatDuration(elapsed),
      remaining: remaining > 0 ? formatDuration(remaining) : null,
    };
  }

  // FCP minimum: 72h
  if (status === 'final_comment' && fcpStartedAt) {
    const fcpElapsed = Date.now() - new Date(fcpStartedAt).getTime();
    const minMs = 72 * 60 * 60 * 1000;
    const remaining = minMs - fcpElapsed;
    return {
      elapsed: formatDuration(elapsed),
      remaining: remaining > 0 ? formatDuration(remaining) : null,
    };
  }

  return { elapsed: formatDuration(elapsed), remaining: null };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LifecycleStatusProps {
  status: DraftStatus;
  stageEnteredAt: string | null;
  communityReviewStartedAt: string | null;
  fcpStartedAt: string | null;
}

export function LifecycleStatus({
  status,
  stageEnteredAt,
  communityReviewStartedAt,
  fcpStartedAt,
}: LifecycleStatusProps) {
  if (status === 'archived') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-2">
        <Badge variant="secondary">Archived</Badge>
      </div>
    );
  }

  const currentIndex = STAGE_INDEX[status] ?? 0;
  const timeInfo = getTimeInfo(status, stageEnteredAt, communityReviewStartedAt, fcpStartedAt);

  return (
    <div className="space-y-2">
      {/* Stage bar */}
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <div key={stage.key} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className={`h-0.5 w-4 sm:w-6 ${
                    isCompleted ? 'bg-primary' : 'bg-muted-foreground/20'
                  }`}
                />
              )}
              <Badge
                variant={isCurrent ? 'default' : isCompleted ? 'secondary' : 'outline'}
                className={`text-xs whitespace-nowrap ${
                  isCurrent
                    ? 'ring-2 ring-primary/30'
                    : isCompleted
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'text-muted-foreground'
                }`}
              >
                {isCompleted && <Check className="mr-1 h-3 w-3" />}
                <span className="hidden sm:inline">{stage.label}</span>
                <span className="sm:hidden">
                  {stage.label.length > 8 ? stage.label.slice(0, 6) + '..' : stage.label}
                </span>
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Time info */}
      {timeInfo && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>At stage for {timeInfo.elapsed}</span>
          {timeInfo.remaining && (
            <span className="text-amber-600 dark:text-amber-400">
              {timeInfo.remaining} remaining before next stage
            </span>
          )}
        </div>
      )}
    </div>
  );
}
