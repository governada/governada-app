'use client';

/**
 * ReviewFramework — checklist template for systematic proposal evaluation.
 *
 * Loads the default review framework template for the current proposal type,
 * renders as a checklist card. State is persisted to localStorage per-proposal.
 * Feature-gated under `review_framework_templates`.
 */

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useReviewTemplate } from '@/hooks/useReviewTemplate';

interface ReviewFrameworkProps {
  proposalTxHash: string;
  proposalIndex: number;
  proposalType: string;
}

const STORAGE_PREFIX = 'governada_review_checklist_';

function getStorageKey(txHash: string, index: number): string {
  return `${STORAGE_PREFIX}${txHash}-${index}`;
}

function loadCheckedState(txHash: string, index: number): Record<number, boolean> {
  try {
    const raw = localStorage.getItem(getStorageKey(txHash, index));
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, boolean>;
  } catch {
    return {};
  }
}

function saveCheckedState(txHash: string, index: number, state: Record<number, boolean>) {
  try {
    localStorage.setItem(getStorageKey(txHash, index), JSON.stringify(state));
  } catch {
    // Storage unavailable
  }
}

export function ReviewFramework({
  proposalTxHash,
  proposalIndex,
  proposalType,
}: ReviewFrameworkProps) {
  const { data: template, isLoading } = useReviewTemplate(proposalType);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  // Load persisted state when proposal changes
  useEffect(() => {
    setChecked(loadCheckedState(proposalTxHash, proposalIndex));
  }, [proposalTxHash, proposalIndex]);

  const toggleItem = useCallback(
    (idx: number) => {
      setChecked((prev) => {
        const next = { ...prev, [idx]: !prev[idx] };
        saveCheckedState(proposalTxHash, proposalIndex, next);

        // Track completion event
        const totalItems = template?.checklist.length ?? 0;
        const completedCount = Object.values(next).filter(Boolean).length;
        if (completedCount === totalItems && totalItems > 0) {
          import('@/lib/posthog')
            .then(({ posthog }) => {
              posthog.capture('review_template_completed', {
                proposal_tx_hash: proposalTxHash,
                proposal_index: proposalIndex,
                proposal_type: proposalType,
                template_name: template?.name,
              });
            })
            .catch(() => {});
        }

        return next;
      });
    },
    [proposalTxHash, proposalIndex, proposalType, template],
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading review framework...
        </CardContent>
      </Card>
    );
  }

  if (!template || template.checklist.length === 0) return null;

  const totalItems = template.checklist.length;
  const completedCount = Object.values(checked).filter(Boolean).length;
  const progressPct = Math.round((completedCount / totalItems) * 100);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Review Framework
          </div>
          <span
            className={cn(
              'text-[10px] font-medium tabular-nums',
              completedCount === totalItems ? 'text-emerald-500' : 'text-muted-foreground',
            )}
          >
            {completedCount} of {totalItems} reviewed
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden bg-muted">
          <div
            className={cn(
              'h-full transition-all duration-300',
              completedCount === totalItems ? 'bg-emerald-500' : 'bg-primary',
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Checklist */}
        <ul className="space-y-1.5">
          {template.checklist.map((item, idx) => {
            const isChecked = !!checked[idx];
            return (
              <li key={idx}>
                <button
                  onClick={() => toggleItem(idx)}
                  className={cn(
                    'flex items-start gap-2.5 w-full text-left rounded-md px-2 py-1.5',
                    'hover:bg-muted/30 transition-colors',
                  )}
                  role="checkbox"
                  aria-checked={isChecked}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center h-4 w-4 rounded border shrink-0 mt-0.5 transition-colors',
                      isChecked
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border bg-background',
                    )}
                  >
                    {isChecked && (
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={cn(
                        'text-xs leading-relaxed',
                        isChecked ? 'text-muted-foreground line-through' : 'text-foreground',
                      )}
                    >
                      {item.question}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                    {item.category}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
