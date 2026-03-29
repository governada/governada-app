'use client';

/**
 * SynthesizedFeedback — AI-synthesized severity-ranked feedback clusters.
 *
 * Rendered as a header section above FeedbackTriageBoard during
 * `response_revision` stage. Shows Critical/Important/Minor clusters
 * with suggested responses and "Apply Edit" buttons.
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, AlertCircle, Info, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAISkill } from '@/hooks/useAISkill';
import { posthog } from '@/lib/posthog';
import type { FeedbackSynthesisOutput } from '@/lib/ai/skills/feedback-synthesis';

interface FeedbackThemeInput {
  id: string;
  summary: string;
  category: 'concern' | 'support' | 'question' | 'suggestion';
  endorsementCount: number;
  keyVoices: Array<{ text: string }>;
}

interface SynthesizedFeedbackProps {
  themes: FeedbackThemeInput[];
  proposalContent: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  proposalType: string;
  onApplyEdit: (field: string, instruction: string) => void;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/30',
    label: 'Critical',
  },
  important: {
    icon: AlertCircle,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/30',
    label: 'Important',
  },
  minor: {
    icon: Info,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30 border-border/30',
    label: 'Minor',
  },
} as const;

export function SynthesizedFeedback({
  themes,
  proposalContent,
  proposalType,
  onApplyEdit,
}: SynthesizedFeedbackProps) {
  const skill = useAISkill<FeedbackSynthesisOutput>();
  const [result, setResult] = useState<FeedbackSynthesisOutput | null>(null);
  const initiatedRef = useRef(false);

  useEffect(() => {
    if (initiatedRef.current || result || themes.length === 0) return;
    initiatedRef.current = true;

    skill.mutate(
      {
        skill: 'feedback-synthesis',
        input: { themes, proposalContent, proposalType },
      },
      {
        onSuccess: (data) => {
          setResult(data.output);
          posthog.capture('feedback_synthesis_generated', {
            clusterCount: data.output.clusters.length,
            criticalCount: data.output.clusters.filter((c) => c.severity === 'critical').length,
          });
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (skill.isPending && !result) {
    return (
      <div className="flex items-center gap-2 py-2 px-3">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Analyzing feedback patterns...</span>
      </div>
    );
  }

  if (!result || result.clusters.length === 0) return null;

  // Sort: critical first, then important, then minor
  const sorted = [...result.clusters].sort((a, b) => {
    const order = { critical: 0, important: 1, minor: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="space-y-2 mb-3">
      {/* Overall assessment */}
      {result.overallAssessment && (
        <p className="text-xs text-foreground/80 leading-relaxed px-1">
          {result.overallAssessment}
        </p>
      )}

      {/* Risk warning */}
      {result.unaddressedRiskSummary && sorted.some((c) => c.severity === 'critical') && (
        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border border-red-400/20 bg-red-400/5 text-xs">
          <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-400/80">{result.unaddressedRiskSummary}</span>
        </div>
      )}

      {/* Clusters */}
      {sorted.map((cluster, i) => {
        const config = SEVERITY_CONFIG[cluster.severity];
        const SeverityIcon = config.icon;

        return (
          <div key={i} className={cn('rounded border px-2.5 py-2 space-y-1.5', config.bg)}>
            <div className="flex items-center gap-1.5">
              <SeverityIcon className={cn('h-3 w-3 shrink-0', config.color)} />
              <span className={cn('text-[10px] font-medium uppercase', config.color)}>
                {config.label}
              </span>
              <span className="text-xs font-medium text-foreground flex-1">{cluster.label}</span>
              <span className="text-[9px] text-muted-foreground">
                {cluster.themeIds.length} theme{cluster.themeIds.length !== 1 ? 's' : ''}
              </span>
            </div>

            <p className="text-[11px] text-foreground/70 leading-relaxed">
              {cluster.suggestedResponse}
            </p>

            {cluster.suggestedEdit && (
              <button
                onClick={() => {
                  posthog.capture('feedback_suggested_edit_applied', {
                    field: cluster.suggestedEdit!.field,
                    severity: cluster.severity,
                  });
                  onApplyEdit(cluster.suggestedEdit!.field, cluster.suggestedEdit!.instruction);
                }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Wand2 className="h-3 w-3" />
                Apply suggested edit to {cluster.suggestedEdit.field}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
