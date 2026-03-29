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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeyQuestionsSection({ proposalContent, proposalType }: KeyQuestionsSectionProps) {
  const skill = useAISkill<ResearchPrecedentOutput>();
  const hasFetched = useRef(false);

  // Auto-fetch on mount (one-shot via ref guard)
  useEffect(() => {
    if (hasFetched.current) return;
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
  }, []);

  if (skill.isPending) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Generating key questions...</span>
      </div>
    );
  }

  if (skill.isError) {
    return <p className="text-xs text-red-400 py-1">{skill.error.message}</p>;
  }

  const questions = skill.data?.output?.questionsToConsider ?? [];

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
