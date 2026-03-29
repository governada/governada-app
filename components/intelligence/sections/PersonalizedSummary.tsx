'use client';

/**
 * PersonalizedSummary — AI-generated personalized proposal summary.
 *
 * Replaces the static aiSummary string in ExecutiveSummary when the
 * `personalized_briefing` flag is enabled. Falls back to static summary
 * on error or when personal context is empty.
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAISkill } from '@/hooks/useAISkill';
import { posthog } from '@/lib/posthog';
import type { PersonalizedBriefingOutput } from '@/lib/ai/skills/personalized-briefing';

interface PersonalizedSummaryProps {
  proposalContent: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  proposalType: string;
  interBodyVotes?: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  };
  withdrawalAmount?: number;
  fallbackSummary: string | null;
}

const DIRECTION_STYLES = {
  aligned: {
    icon: ArrowUpRight,
    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  },
  misaligned: {
    icon: ArrowDownRight,
    color: 'text-red-400 bg-red-400/10 border-red-400/30',
  },
  neutral: {
    icon: Minus,
    color: 'text-muted-foreground bg-muted/30 border-border/30',
  },
} as const;

export function PersonalizedSummary({
  proposalContent,
  proposalType,
  interBodyVotes,
  withdrawalAmount,
  fallbackSummary,
}: PersonalizedSummaryProps) {
  const skill = useAISkill<PersonalizedBriefingOutput>();
  const [result, setResult] = useState<PersonalizedBriefingOutput | null>(null);
  const [failed, setFailed] = useState(false);
  const initiatedRef = useRef(false);

  useEffect(() => {
    if (initiatedRef.current || result || failed) return;
    initiatedRef.current = true;

    skill.mutate(
      {
        skill: 'personalized-briefing',
        input: {
          proposalContent,
          proposalType,
          interBodyVotes,
          withdrawalAmount,
        },
      },
      {
        onSuccess: (data) => {
          setResult(data.output);
          posthog.capture('personalized_briefing_viewed');
        },
        onError: () => {
          setFailed(true);
          posthog.capture('personalized_briefing_fallback');
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loading state
  if (skill.isPending && !result) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Personalizing briefing...</span>
      </div>
    );
  }

  // Fallback to static summary
  if (failed || !result) {
    if (!fallbackSummary) {
      return (
        <p className="text-xs text-muted-foreground/60 py-1">
          AI summary not yet available for this proposal
        </p>
      );
    }
    return <p className="text-xs text-foreground/80 leading-relaxed">{fallbackSummary}</p>;
  }

  const directionStyle = DIRECTION_STYLES[result.alignmentSignal.direction];
  const DirectionIcon = directionStyle.icon;

  return (
    <div className="space-y-2.5">
      {/* Personalized summary */}
      <p className="text-xs text-foreground/80 leading-relaxed">{result.personalizedSummary}</p>

      {/* Alignment signal */}
      <div
        className={cn(
          'flex items-start gap-2 px-2 py-1.5 rounded border text-xs',
          directionStyle.color,
        )}
      >
        <DirectionIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">{result.alignmentSignal.label}</div>
          {result.alignmentSignal.explanation && (
            <div className="text-[10px] opacity-80 mt-0.5">
              {result.alignmentSignal.explanation}
            </div>
          )}
        </div>
      </div>

      {/* Quick takeaway */}
      {result.quickTakeaway && (
        <p className="text-[10px] text-muted-foreground italic">{result.quickTakeaway}</p>
      )}

      {/* Key tensions */}
      {result.keyTensions.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide">
            Key tensions
          </div>
          {result.keyTensions.map((t, i) => (
            <div key={i} className="text-[10px] border border-border/20 rounded px-2 py-1">
              <span className="font-medium text-foreground">{t.aspect}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-muted-foreground">You:</span>
                <span className="text-foreground/70">{t.yourPosition}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Proposal:</span>
                <span className="text-foreground/70">{t.proposalPosition}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
