'use client';

/**
 * SuggestionResolutionBar — floating bar for authors to navigate and resolve
 * reviewer suggestions during `response_revision` stage.
 *
 * Shows count, prev/next navigation, and accept/reject/batch actions.
 * Each suggestion is rendered as an inline tracked change (blue AIDiffMark)
 * in the editor — this bar provides the controls to resolve them.
 */

import { useState, useCallback, useMemo } from 'react';
import { Check, X, ChevronLeft, ChevronRight, CheckCheck, XCircle } from 'lucide-react';
import { posthog } from '@/lib/posthog';
import type { SuggestionAnnotation } from '@/hooks/useSuggestionAnnotations';

interface SuggestionMapping {
  editId: string;
  annotationId: string;
  suggestion: SuggestionAnnotation;
}

interface SuggestionResolutionBarProps {
  mappings: SuggestionMapping[];
  /** Total active (unresolved) suggestions */
  activeCount: number;
  /** Total resolved so far (accepted + rejected) */
  resolvedCount: number;
  onAccept: (annotationId: string, editId: string) => void;
  onReject: (annotationId: string, editId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  /** Scroll editor to a specific editId */
  onNavigate?: (editId: string) => void;
  proposalId?: string;
}

export function SuggestionResolutionBar({
  mappings,
  activeCount,
  resolvedCount,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onNavigate,
  proposalId,
}: SuggestionResolutionBarProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const current = mappings[currentIndex] ?? null;
  const total = mappings.length;

  const navigate = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, total - 1));
      setCurrentIndex(clamped);
      const mapping = mappings[clamped];
      if (mapping) onNavigate?.(mapping.editId);
    },
    [total, mappings, onNavigate],
  );

  const handleAccept = useCallback(() => {
    if (!current) return;
    onAccept(current.annotationId, current.editId);
    posthog.capture('suggestion_accepted', {
      proposal_id: proposalId,
      annotation_id: current.annotationId,
    });
    // Move to next if available, or stay at clamped position
    if (currentIndex >= total - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [current, onAccept, proposalId, currentIndex, total]);

  const handleReject = useCallback(() => {
    if (!current) return;
    onReject(current.annotationId, current.editId);
    posthog.capture('suggestion_rejected', {
      proposal_id: proposalId,
      annotation_id: current.annotationId,
    });
    if (currentIndex >= total - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [current, onReject, proposalId, currentIndex, total]);

  const handleAcceptAll = useCallback(() => {
    onAcceptAll();
    posthog.capture('suggestion_batch_resolved', {
      proposal_id: proposalId,
      action: 'accept_all',
      count: activeCount,
    });
  }, [onAcceptAll, proposalId, activeCount]);

  const handleRejectAll = useCallback(() => {
    onRejectAll();
    posthog.capture('suggestion_batch_resolved', {
      proposal_id: proposalId,
      action: 'reject_all',
      count: activeCount,
    });
  }, [onRejectAll, proposalId, activeCount]);

  // Summary line (always a string — the 0/0 case is handled by the early return below)
  const summary = useMemo(() => {
    if (activeCount === 0) return `All ${resolvedCount} suggestions resolved`;
    return `${resolvedCount} of ${activeCount + resolvedCount} resolved`;
  }, [activeCount, resolvedCount]);

  if (activeCount === 0 && resolvedCount === 0) return null;

  // All resolved — show compact completion state
  if (activeCount === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 mb-4">
        <CheckCheck className="h-4 w-4 text-emerald-400 shrink-0" />
        <span className="text-sm text-emerald-300">{summary}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 mb-4">
      {/* Navigation */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => navigate(currentIndex - 1)}
          disabled={currentIndex <= 0}
          className="p-0.5 rounded hover:bg-white/5 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
          aria-label="Previous suggestion"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted-foreground tabular-nums min-w-[3ch] text-center">
          {total > 0 ? `${currentIndex + 1}/${total}` : '0/0'}
        </span>
        <button
          onClick={() => navigate(currentIndex + 1)}
          disabled={currentIndex >= total - 1}
          className="p-0.5 rounded hover:bg-white/5 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
          aria-label="Next suggestion"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Current suggestion context */}
      <div className="flex-1 min-w-0">
        {current ? (
          <p className="text-xs text-muted-foreground truncate">
            <span className="text-blue-400">
              {current.suggestion.suggestedText.explanation || 'Suggested change'}
            </span>
            {' \u2014 '}
            <span className="line-through opacity-60">
              {truncate(current.suggestion.suggestedText.original, 30)}
            </span>
            {' \u2192 '}
            <span className="text-blue-300">
              {truncate(current.suggestion.suggestedText.proposed, 30)}
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{summary}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleAccept}
          disabled={!current}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
          title="Accept suggestion (applies text change)"
        >
          <Check className="h-3 w-3" />
          Accept
        </button>
        <button
          onClick={handleReject}
          disabled={!current}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
          title="Reject suggestion (marks as considered)"
        >
          <X className="h-3 w-3" />
          Reject
        </button>

        {/* Batch actions (only when multiple) */}
        {total > 1 && (
          <div className="flex items-center gap-1 ml-1 pl-1 border-l border-white/10">
            <button
              onClick={handleAcceptAll}
              className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400/60 hover:text-emerald-400 transition-colors cursor-pointer"
              title="Accept all suggestions"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRejectAll}
              className="p-1 rounded hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors cursor-pointer"
              title="Reject all suggestions"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '\u2026';
}
