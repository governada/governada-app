'use client';

/**
 * ProactiveInsightStack — renders up to 3 concurrent AI insights
 * as a vertical stack with severity ordering and auto-dismiss.
 *
 * Replaces the single ProactiveInsight component when the
 * `proactive_interventions` flag is enabled.
 *
 * Each card: severity icon + message + "Improve" button (if suggestion) + dismiss X
 * Auto-dismiss after 30s per card (staggered). Hidden while typing (3s idle).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Lightbulb, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import type { ProactiveInsight } from '@/lib/ai/skills/proactive-analysis';

interface ProactiveInsightStackProps {
  insights: ProactiveInsight[];
  onApply: (insightId: string, field: string, suggestion: string) => void;
  onDismiss: (insightId: string) => void;
  isAnalyzing: boolean;
  /** Current content fields — used to detect typing */
  fields: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
}

const SECTION_LABELS: Record<string, string> = {
  title: 'Title',
  abstract: 'Abstract',
  motivation: 'Motivation',
  rationale: 'Rationale',
};

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    color: 'text-red-400',
    borderColor: 'border-red-400/30',
    bgColor: 'bg-red-400/5',
  },
  warning: {
    icon: AlertCircle,
    color: 'text-amber-400',
    borderColor: 'border-amber-400/30',
    bgColor: 'bg-amber-400/5',
  },
  info: {
    icon: Lightbulb,
    color: 'text-[var(--wayfinder-amber)]',
    borderColor: 'border-border',
    bgColor: 'bg-muted/30',
  },
} as const;

const AUTO_DISMISS_MS = 30_000;

export function ProactiveInsightStack({
  insights,
  onApply,
  onDismiss,
  isAnalyzing,
  fields,
}: ProactiveInsightStackProps) {
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastFieldsRef = useRef(fields);
  const autoDismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Detect typing — hide insights while user is actively editing
  useEffect(() => {
    const changed =
      fields.abstract !== lastFieldsRef.current.abstract ||
      fields.motivation !== lastFieldsRef.current.motivation ||
      fields.rationale !== lastFieldsRef.current.rationale ||
      fields.title !== lastFieldsRef.current.title;
    lastFieldsRef.current = fields;

    if (changed) {
      setIsTyping(true);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
    }

    return () => clearTimeout(typingTimerRef.current);
  }, [fields]);

  // Auto-dismiss timers for each insight (staggered by index)
  useEffect(() => {
    if (isTyping) return;

    const currentIds = new Set(insights.map((i) => i.id));

    // Clear timers for insights that have been removed
    for (const [id, timer] of autoDismissTimersRef.current.entries()) {
      if (!currentIds.has(id)) {
        clearTimeout(timer);
        autoDismissTimersRef.current.delete(id);
      }
    }

    // Set timers for new insights only
    for (const [i, insight] of insights.entries()) {
      if (autoDismissTimersRef.current.has(insight.id)) continue;
      const staggerMs = AUTO_DISMISS_MS + i * 5000;
      const timer = setTimeout(() => {
        onDismiss(insight.id);
        autoDismissTimersRef.current.delete(insight.id);
      }, staggerMs);
      autoDismissTimersRef.current.set(insight.id, timer);
    }
  }, [insights, isTyping, onDismiss]);

  const handleApply = useCallback(
    (insight: ProactiveInsight) => {
      posthog.capture('proactive_insight_applied', {
        insightId: insight.id,
        category: insight.category,
        severity: insight.severity,
        field: insight.field,
      });
      onApply(insight.id, insight.field ?? 'motivation', insight.suggestion ?? insight.message);
    },
    [onApply],
  );

  const handleDismiss = useCallback(
    (id: string) => {
      posthog.capture('proactive_insight_dismissed', { insightId: id });
      const timer = autoDismissTimersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        autoDismissTimersRef.current.delete(id);
      }
      onDismiss(id);
    },
    [onDismiss],
  );

  // Track which insights have been captured for analytics (avoid re-firing on re-render)
  const capturedInsightsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const insight of insights) {
      if (!capturedInsightsRef.current.has(insight.id)) {
        capturedInsightsRef.current.add(insight.id);
        posthog.capture('proactive_insight_shown', {
          insightId: insight.id,
          category: insight.category,
          severity: insight.severity,
        });
      }
    }
  }, [insights]);

  // Don't render while typing or if no insights
  if (isTyping || (insights.length === 0 && !isAnalyzing)) return null;

  return (
    <div className="space-y-1">
      {insights.map((insight) => {
        const config = SEVERITY_CONFIG[insight.severity];
        const SeverityIcon = config.icon;

        return (
          <div
            key={insight.id}
            className={cn(
              'flex items-start gap-2 px-3 py-1.5 border-b',
              config.borderColor,
              config.bgColor,
            )}
          >
            <SeverityIcon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', config.color)} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {insight.field && (
                  <>
                    <span className="font-medium text-foreground/80">
                      {SECTION_LABELS[insight.field] ?? insight.field}
                    </span>
                    {': '}
                  </>
                )}
                {insight.message}
              </p>
              {insight.suggestion && (
                <button
                  onClick={() => handleApply(insight)}
                  className={cn(
                    'mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
                    'text-primary hover:bg-primary/10 transition-colors cursor-pointer',
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  Improve this
                </button>
              )}
            </div>
            <button
              onClick={() => handleDismiss(insight.id)}
              className="p-0.5 min-h-[var(--min-tap-target)] min-w-[var(--min-tap-target)] flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
