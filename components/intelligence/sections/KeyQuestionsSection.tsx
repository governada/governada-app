'use client';

/**
 * KeyQuestionsSection — AI-generated questions for review brief.
 *
 * Uses the research-precedent skill output's questionsToConsider field.
 * Lazy-loads on mount.
 */

import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAISkill } from '@/hooks/useAISkill';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResearchPrecedentOutput {
  similarProposals: unknown[];
  precedentSummary: string;
  questionsToConsider: string[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KeyQuestionsSectionProps {
  proposalContent: {
    title: string;
    abstract: string;
  };
  proposalType: string;
  /** Pre-computed questions from intelligence cache — skips AI call if provided */
  cachedQuestions?: string[] | null;
  /** Pre-computed precedent summary from intelligence cache */
  cachedPrecedentSummary?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeyQuestionsSection({
  proposalContent,
  proposalType,
  cachedQuestions,
  cachedPrecedentSummary,
}: KeyQuestionsSectionProps) {
  const skill = useAISkill<ResearchPrecedentOutput>();
  const hasFetched = useRef(false);

  // Use cached data if available, otherwise fetch on mount
  const hasCachedData = cachedQuestions && cachedQuestions.length > 0;

  useEffect(() => {
    if (hasCachedData || hasFetched.current) return;
    hasFetched.current = true;
    skill.mutate({
      skill: 'research-precedent',
      input: {
        proposalTitle: proposalContent.title,
        proposalAbstract: proposalContent.abstract,
        proposalType,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot fetch guarded by ref
  }, [hasCachedData]);

  if (!hasCachedData && skill.isPending) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Generating key questions...</span>
      </div>
    );
  }

  if (!hasCachedData && skill.isError) {
    return <p className="text-xs text-red-400 py-1">{skill.error.message}</p>;
  }

  const questions = hasCachedData
    ? cachedQuestions
    : (skill.data?.output?.questionsToConsider ?? []);
  void cachedPrecedentSummary; // Available for future use (tooltip/detail)

  if (questions.length === 0) {
    return <p className="text-xs text-muted-foreground/60 py-1">No key questions generated</p>;
  }

  return (
    <ul className="space-y-1.5 text-xs">
      {questions.map((q, i) => (
        <li
          key={i}
          className="text-muted-foreground leading-relaxed pl-2.5 border-l-2 border-[var(--compass-teal)]/30"
        >
          {q}
        </li>
      ))}
    </ul>
  );
}
