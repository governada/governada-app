'use client';

/**
 * ConstitutionalSection — constitutional compliance check for intelligence brief.
 *
 * Wraps the same useAISkill('constitutional-check') pattern as IntelPanel's
 * ConstitutionalCheckCard, but renders in the brief's section layout.
 * Lazy-loads: only fires the AI skill when the section is first expanded.
 */

import { useCallback, useRef, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAISkill } from '@/hooks/useAISkill';
import type { ConstitutionalCheckResult } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Types (AI skill output — has summary field not on the stored result)
// ---------------------------------------------------------------------------

interface ConstitutionalCheckOutput {
  flags: Array<{
    article: string;
    section?: string;
    concern: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  score: 'pass' | 'warning' | 'fail';
  summary: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConstitutionalSectionProps {
  proposalContent: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  proposalType: string;
  /** If available from ambient check, show cached result instead of re-running AI */
  cachedResult?: ConstitutionalCheckResult | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConstitutionalSection({
  proposalContent,
  proposalType,
  cachedResult,
}: ConstitutionalSectionProps) {
  const skill = useAISkill<ConstitutionalCheckOutput>();
  const hasFetched = useRef(false);

  // Use cached result if available, otherwise use skill result
  // Cached result (ConstitutionalCheckResult) lacks summary; AI output has it
  const skillOutput = skill.data?.output ?? null;
  const result: {
    flags: ConstitutionalCheckOutput['flags'];
    score: ConstitutionalCheckOutput['score'];
    summary: string;
  } | null = cachedResult
    ? { flags: cachedResult.flags, score: cachedResult.score, summary: '' }
    : skillOutput;
  const isLoading = !cachedResult && skill.isPending;

  // Auto-fetch on mount if no cached result
  const fetchIfNeeded = useCallback(() => {
    if (cachedResult || hasFetched.current || skill.isPending) return;
    hasFetched.current = true;
    skill.mutate({
      skill: 'constitutional-check',
      input: {
        title: proposalContent.title,
        abstract: proposalContent.abstract,
        proposalType,
        motivation: proposalContent.motivation,
        rationale: proposalContent.rationale,
      },
    });
  }, [cachedResult, skill, proposalContent, proposalType]);

  // Fire on mount if no cached result
  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const scoreIcon =
    result?.score === 'pass' ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
    ) : result?.score === 'warning' ? (
      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
    ) : result?.score === 'fail' ? (
      <XCircle className="h-3.5 w-3.5 text-red-400" />
    ) : null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Analyzing constitutional compliance...</span>
      </div>
    );
  }

  if (skill.isError && !cachedResult) {
    return <p className="text-xs text-red-400 py-1">{skill.error.message}</p>;
  }

  if (!result) {
    return (
      <p className="text-xs text-muted-foreground/60 py-1">
        Constitutional check not yet available
      </p>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        {scoreIcon}
        <span
          className={cn(
            'font-medium',
            result.score === 'pass' && 'text-emerald-400',
            result.score === 'warning' && 'text-amber-400',
            result.score === 'fail' && 'text-red-400',
          )}
        >
          {result.score === 'pass' ? 'Pass' : result.score === 'warning' ? 'Warning' : 'Fail'}
        </span>
        {result.flags.length > 0 && (
          <span className="text-[10px] text-muted-foreground/60">
            {result.flags.length} flag{result.flags.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {result.summary && <p className="text-muted-foreground leading-relaxed">{result.summary}</p>}
      {result.flags.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {result.flags.map((flag, i) => (
            <div
              key={i}
              className={cn(
                'rounded px-2 py-1.5 text-[11px] leading-relaxed',
                flag.severity === 'critical' && 'bg-red-500/10 text-red-300',
                flag.severity === 'warning' && 'bg-amber-500/10 text-amber-300',
                flag.severity === 'info' && 'bg-blue-500/10 text-blue-300',
              )}
            >
              <span className="font-medium">
                {flag.article}
                {flag.section ? `, ${flag.section}` : ''}
              </span>
              {' — '}
              {flag.concern}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
