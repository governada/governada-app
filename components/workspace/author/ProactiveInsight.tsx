'use client';

/**
 * ProactiveInsight — Ambient AI insight card for the author studio.
 *
 * Surfaces the most impactful suggestion from section analysis results
 * without the user asking. Renders below QualityPulse in the sidebar header.
 *
 * Shows max 1 insight at a time. Prioritizes:
 * 1. Completeness gaps (missing content)
 * 2. Vagueness issues (content exists but is weak)
 *
 * Auto-dismisses after 30s of no interaction.
 * Hidden while user is actively typing (3s idle timer).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Lightbulb, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectionAnalysisOutput } from '@/lib/ai/skills/section-analysis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProactiveInsightProps {
  /** Section analysis results keyed by field name */
  sectionResults: Record<string, SectionAnalysisOutput | null>;
  /** Whether any section analysis is currently loading */
  isAnalyzing?: boolean;
  /** Draft fields for tracking typing activity */
  fields: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  /** Called when user clicks "Apply" — triggers AI improvement for the section */
  onApply?: (field: string, suggestion: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<string, string> = {
  abstract: 'Abstract',
  motivation: 'Motivation',
  rationale: 'Rationale',
};

interface Insight {
  field: string;
  type: 'completeness' | 'vagueness';
  message: string;
  suggestion: string;
}

function extractTopInsight(results: Record<string, SectionAnalysisOutput | null>): Insight | null {
  // Priority 1: completeness gaps from sections marked needs_work
  for (const field of ['motivation', 'rationale', 'abstract'] as const) {
    const result = results[field];
    if (!result || result.overallQuality === 'strong') continue;

    if (result.completenessGaps && result.completenessGaps.length > 0) {
      const gap = result.completenessGaps[0];
      return {
        field,
        type: 'completeness',
        message: gap.label,
        suggestion: gap.suggestion,
      };
    }
  }

  // Priority 2: vagueness issues
  for (const field of ['motivation', 'rationale', 'abstract'] as const) {
    const result = results[field];
    if (!result || result.overallQuality === 'strong') continue;

    if (result.vaguenessIssues && result.vaguenessIssues.length > 0) {
      const issue = result.vaguenessIssues[0];
      return {
        field,
        type: 'vagueness',
        message: `"${issue.text.slice(0, 60)}${issue.text.length > 60 ? '...' : ''}" is vague`,
        suggestion: issue.suggestion,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProactiveInsight({
  sectionResults,
  isAnalyzing,
  fields,
  onApply,
}: ProactiveInsightProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastFieldsRef = useRef(fields);

  // Detect typing activity — hide insight while user is actively editing
  useEffect(() => {
    const changed =
      fields.abstract !== lastFieldsRef.current.abstract ||
      fields.motivation !== lastFieldsRef.current.motivation ||
      fields.rationale !== lastFieldsRef.current.rationale;
    lastFieldsRef.current = fields;

    if (changed) {
      setIsTyping(true);
      setDismissed(false); // Reset dismissal when content changes
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
    }

    return () => clearTimeout(typingTimerRef.current);
  }, [fields]);

  const insight = useMemo(() => extractTopInsight(sectionResults), [sectionResults]);

  // Auto-dismiss after 30s
  useEffect(() => {
    if (!insight || dismissed || isTyping) return;
    clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => setDismissed(true), 30_000);
    return () => clearTimeout(dismissTimerRef.current);
  }, [insight, dismissed, isTyping]);

  const handleApply = useCallback(() => {
    if (insight) {
      onApply?.(insight.field, insight.suggestion);
      setDismissed(true);
    }
  }, [insight, onApply]);

  // Don't render if: no insight, dismissed, typing, or still analyzing
  if (!insight || dismissed || isTyping || isAnalyzing) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-1.5 border-b border-border bg-muted/30">
      <Lightbulb className="h-3.5 w-3.5 text-[var(--wayfinder-amber)] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground/80">
            {SECTION_LABELS[insight.field] ?? insight.field}
          </span>
          {': '}
          {insight.message}
        </p>
        {onApply && (
          <button
            onClick={handleApply}
            className={cn(
              'mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
              'text-[var(--wayfinder-amber)] hover:bg-[color-mix(in_oklch,var(--wayfinder-amber),transparent_90%)] transition-colors cursor-pointer',
            )}
          >
            <Sparkles className="h-3 w-3" />
            Improve this section
          </button>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 min-h-[var(--min-tap-target)] min-w-[var(--min-tap-target)] flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer shrink-0"
        title="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
