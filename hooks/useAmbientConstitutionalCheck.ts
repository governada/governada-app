'use client';

/**
 * useAmbientConstitutionalCheck — Auto-runs constitutional check when draft content changes.
 *
 * Debounces 2 seconds after the last content change to avoid flooding during active editing.
 * Uses content hash to skip re-checks when content hasn't actually changed.
 * Stores result on the draft via updateDraft mutation.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAISkill } from './useAISkill';
import { useUpdateDraft } from './useDrafts';
import type { ConstitutionalCheckResult, ProposalDraft } from '@/lib/workspace/types';

/** Simple FNV-1a hash for content dedup. */
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

interface AmbientConstitutionalCheckResult {
  /** Current constitutional check result (from latest check or draft cache) */
  result: ConstitutionalCheckResult | null;
  /** Whether a check is currently running */
  isLoading: boolean;
  /** Manually trigger a re-check */
  recheck: () => void;
}

export function useAmbientConstitutionalCheck(
  draft: ProposalDraft | null,
): AmbientConstitutionalCheckResult {
  const [isLoading, setIsLoading] = useState(false);
  const [localResult, setLocalResult] = useState<ConstitutionalCheckResult | null>(null);

  const skill = useAISkill<ConstitutionalCheckResult>();
  const updateDraft = useUpdateDraft(draft?.id ?? '');
  const lastHashRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, []);

  // Initialize local result from draft cache
  useEffect(() => {
    if (draft?.lastConstitutionalCheck && !localResult) {
      setLocalResult(draft.lastConstitutionalCheck);
    }
  }, [draft?.lastConstitutionalCheck, localResult]);

  const runCheck = useCallback(() => {
    if (!draft) return;

    // Need at least title and one other field to run a meaningful check
    const hasContent = draft.title && (draft.abstract || draft.motivation || draft.rationale);
    if (!hasContent) return;

    const contentStr = `${draft.title}|${draft.abstract}|${draft.motivation}|${draft.rationale}`;
    const hash = fnv1a(contentStr);

    // Skip if content unchanged since last check
    if (hash === lastHashRef.current) return;
    lastHashRef.current = hash;

    setIsLoading(true);

    skill.mutate(
      {
        skill: 'constitutional-check',
        input: {
          title: draft.title || '',
          abstract: draft.abstract || '',
          proposalType: draft.proposalType,
          motivation: draft.motivation || '',
          rationale: draft.rationale || '',
          typeSpecific: draft.typeSpecific ?? {},
        },
        draftId: draft.id,
      },
      {
        onSuccess: (data) => {
          if (!mountedRef.current) return;
          const result = data.output;
          if (result) {
            setLocalResult(result);
            // Persist to draft (fire-and-forget)
            updateDraft.mutate({ lastConstitutionalCheck: result });
          }
          setIsLoading(false);
        },
        onError: () => {
          if (!mountedRef.current) return;
          setIsLoading(false);
        },
      },
    );
  }, [draft, skill, updateDraft]);

  // Auto-trigger on content changes (debounced 2s for responsive margin traffic lights)
  useEffect(() => {
    if (!draft) return;

    const contentStr = `${draft.title}|${draft.abstract}|${draft.motivation}|${draft.rationale}`;
    const hash = fnv1a(contentStr);

    // No change from last check
    if (hash === lastHashRef.current) return;

    // Need meaningful content to check
    const hasContent = draft.title && (draft.abstract || draft.motivation || draft.rationale);
    if (!hasContent) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      runCheck();
    }, 2000);

    return () => clearTimeout(timerRef.current);
  }, [draft?.title, draft?.abstract, draft?.motivation, draft?.rationale, draft, runCheck]);

  return {
    result: localResult,
    isLoading,
    recheck: runCheck,
  };
}
