'use client';

/**
 * useSectionAnalysis — manages per-section AI analysis with content-hash dedup.
 *
 * Triggered on field blur in DraftForm. Only re-analyzes when content actually changed.
 */

import { useState, useRef, useCallback } from 'react';
import { useAISkill } from './useAISkill';
import type { SectionAnalysisOutput } from '@/lib/ai/skills/section-analysis';
import type { ProposalDraft } from '@/lib/workspace/types';

type AnalysisField = 'abstract' | 'motivation' | 'rationale';

/** Simple FNV-1a hash for content dedup. */
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

export function useSectionAnalysis(draft: ProposalDraft | null) {
  const [results, setResults] = useState<Record<string, SectionAnalysisOutput | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const skill = useAISkill<SectionAnalysisOutput>();
  const hashRef = useRef<Record<string, number>>({});
  const timerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const analyzeSection = useCallback(
    (field: AnalysisField) => {
      if (!draft) return;
      const content = draft[field];
      if (!content || content.length < 20) return; // too short to analyze

      const hash = fnv1a(content);
      if (hashRef.current[field] === hash) return; // content unchanged

      // Clear any pending debounce for this field
      if (timerRef.current[field]) clearTimeout(timerRef.current[field]);

      timerRef.current[field] = setTimeout(() => {
        const currentHash = hash;
        hashRef.current[field] = currentHash;
        setLoading((prev) => ({ ...prev, [field]: true }));

        skill.mutate(
          {
            skill: 'section-analysis',
            input: {
              field,
              content,
              proposalType: draft.proposalType,
              fullDraftContext: {
                title: draft.title,
                abstract: draft.abstract,
                motivation: draft.motivation,
                rationale: draft.rationale,
              },
            },
            draftId: draft.id,
          },
          {
            onSuccess: (data) => {
              // Discard stale response if content changed since invocation
              if (hashRef.current[field] !== currentHash) return;
              setResults((prev) => ({ ...prev, [field]: data.output }));
              setLoading((prev) => ({ ...prev, [field]: false }));
            },
            onError: () => {
              setLoading((prev) => ({ ...prev, [field]: false }));
            },
          },
        );
      }, 1500);
    },
    [draft, skill],
  );

  return { results, loading, analyzeSection };
}
