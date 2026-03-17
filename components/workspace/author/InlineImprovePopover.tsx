'use client';

/**
 * InlineImprovePopover — the "Cursor moment" for governance proposals.
 *
 * Triggered by Ctrl+I on text selection in DraftForm. Shows an AI-improved
 * version as a word-level diff with Accept/Dismiss actions.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import { useAISkill } from '@/hooks/useAISkill';
import { ProvenanceBadge } from '@/components/workspace/shared/ProvenanceBadge';
import { computeWordDiff } from '@/lib/workspace/wordDiff';
import type { TextImproveOutput } from '@/lib/ai/skills/text-improve';

interface InlineImprovePopoverProps {
  selectedText: string;
  surroundingContext: string;
  proposalType: string;
  position: { top: number; left: number };
  draftId?: string;
  onAccept: (improvedText: string) => void;
  onDismiss: () => void;
}

export function InlineImprovePopover({
  selectedText,
  surroundingContext,
  proposalType,
  position,
  draftId,
  onAccept,
  onDismiss,
}: InlineImprovePopoverProps) {
  const skill = useAISkill<TextImproveOutput>();
  const popoverRef = useRef<HTMLDivElement>(null);
  const invokedRef = useRef(false);

  // Invoke skill on mount
  useEffect(() => {
    if (invokedRef.current) return;
    invokedRef.current = true;
    skill.mutate({
      skill: 'text-improve',
      input: { selectedText, surroundingContext, proposalType },
      draftId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onDismiss]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  const handleAccept = useCallback(() => {
    if (skill.data?.output?.improvedText) {
      onAccept(skill.data.output.improvedText);
    }
  }, [skill.data, onAccept]);

  const diffSegments = skill.data?.output?.improvedText
    ? computeWordDiff(selectedText, skill.data.output.improvedText)
    : null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[420px] max-h-[320px] overflow-y-auto rounded-xl border bg-popover p-4 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {/* Loading */}
      {skill.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Improving...
        </div>
      )}

      {/* Error */}
      {skill.isError && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">Improvement failed. Please try again.</p>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Success */}
      {diffSegments && skill.data && (
        <div className="space-y-3">
          {/* Diff display */}
          <div className="text-sm leading-relaxed">
            {diffSegments.map((seg, i) => {
              if (seg.type === 'unchanged') return <span key={i}>{seg.text}</span>;
              if (seg.type === 'removed') {
                return (
                  <span key={i} className="line-through text-rose-500 dark:text-rose-400">
                    {seg.text}
                  </span>
                );
              }
              return (
                <span
                  key={i}
                  className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-sm px-0.5"
                >
                  {seg.text}
                </span>
              );
            })}
          </div>

          {/* Explanation */}
          {skill.data.output.explanation && (
            <p className="text-xs text-muted-foreground">{skill.data.output.explanation}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleAccept}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Accept
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              Dismiss
            </Button>
            {skill.data.provenance && (
              <ProvenanceBadge
                model={skill.data.provenance.model}
                keySource={skill.data.provenance.keySource}
                skillName="text-improve"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
