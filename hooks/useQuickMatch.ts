'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { ConfidenceBreakdown } from '@/lib/matching/confidence';
import { saveMatchProfile, type StoredMatchProfile } from '@/lib/matchStore';
import { getStoredSession } from '@/lib/supabaseAuth';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { emitDiscoveryEvent } from '@/lib/discovery/events';

/* â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export interface MatchResult {
  drepId: string;
  drepName: string | null;
  drepScore: number;
  matchScore: number;
  identityColor: string;
  personalityLabel: string;
  alignments: AlignmentScores;
  agreeDimensions: string[];
  differDimensions: string[];
  voteCount?: number;
  participationPct?: number;
  rationaleRate?: number;
  delegatorCount?: number;
  tier?: string | null;
  signatureInsight?: string | null;
}

export interface QuickMatchResponse {
  matches: MatchResult[];
  nearMisses?: MatchResult[];
  userAlignments: AlignmentScores;
  personalityLabel: string;
  identityColor: string;
  confidenceBreakdown?: ConfidenceBreakdown;
}

export interface QuickMatchAnswers {
  treasury?: 'conservative' | 'growth' | 'balanced';
  protocol?: 'caution' | 'innovation' | 'case_by_case';
  transparency?: 'essential' | 'nice_to_have' | 'doesnt_matter';
  decentralization?: 'spread_widely' | 'concentrated' | 'current_fine';
}

export interface QuickMatchState {
  answers: QuickMatchAnswers;
  isComplete: boolean;
  isSubmitting: boolean;
  isSecondaryLoading: boolean;
  error: string | null;
  drepResult: QuickMatchResponse | null;
  spoResult: QuickMatchResponse | null;
}

export interface UseQuickMatchOptions {
  onComplete?: (drepResult: QuickMatchResponse, spoResult: QuickMatchResponse) => void;
  drepId?: string;
}

type MatchType = 'drep' | 'spo';

interface QuickMatchMutationResult {
  finalAnswers: QuickMatchAnswers;
  drepData: QuickMatchResponse;
}

function buildDeferredSpoResult(drepData: QuickMatchResponse): QuickMatchResponse {
  return {
    matches: [],
    nearMisses: [],
    userAlignments: drepData.userAlignments,
    personalityLabel: drepData.personalityLabel,
    identityColor: drepData.identityColor,
    confidenceBreakdown: drepData.confidenceBreakdown,
  };
}

async function fetchQuickMatch(
  finalAnswers: QuickMatchAnswers,
  type: MatchType,
  signal: AbortSignal,
): Promise<QuickMatchResponse> {
  const res = await fetch('/api/governance/quick-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      treasury: finalAnswers.treasury,
      protocol: finalAnswers.protocol,
      transparency: finalAnswers.transparency,
      decentralization: finalAnswers.decentralization,
      match_type: type,
    }),
    signal,
  });

  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json() as Promise<QuickMatchResponse>;
}

/* â”€â”€â”€ Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function useQuickMatch(options?: UseQuickMatchOptions) {
  const [answers, setAnswersState] = useState<QuickMatchAnswers>({});
  const [error, setError] = useState<string | null>(null);
  const [drepResult, setDrepResult] = useState<QuickMatchResponse | null>(null);
  const [spoResult, setSpoResult] = useState<QuickMatchResponse | null>(null);
  const [isSecondaryLoading, setIsSecondaryLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const isComplete = Boolean(
    answers.treasury && answers.protocol && answers.transparency && answers.decentralization,
  );

  const setAnswer = useCallback((question: string, answer: string) => {
    setAnswersState((prev) => ({ ...prev, [question]: answer }));
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const mutation = useMutation<QuickMatchMutationResult, Error, QuickMatchAnswers>({
    mutationFn: async (finalAnswers) => {
      if (!finalAnswers.treasury || !finalAnswers.protocol || !finalAnswers.transparency) {
        throw new Error('Please answer all required questions.');
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const drepData = await fetchQuickMatch(finalAnswers, 'drep', controller.signal);

      return { finalAnswers, drepData };
    },
    onMutate: () => {
      setError(null);
      setDrepResult(null);
      setSpoResult(null);
      setIsSecondaryLoading(false);
    },
    onSuccess: ({ finalAnswers, drepData }) => {
      setDrepResult(drepData);
      emitDiscoveryEvent('match_completed');

      trackFunnel(FUNNEL_EVENTS.MATCH_COMPLETED, {
        personality: drepData.personalityLabel,
        drep_matches: drepData.matches.length,
      });
      trackFunnel(FUNNEL_EVENTS.MATCH_RESULT_VIEWED, {
        top_match_score: drepData.matches[0]?.matchScore ?? 0,
      });

      const token = getStoredSession();
      if (token) {
        fetch('/api/governance/quick-match/mark-completed', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }

      const answersRecord: Record<string, string> = {};
      for (const [key, value] of Object.entries(finalAnswers)) {
        if (value) answersRecord[key] = value;
      }

      saveMatchProfile({
        userAlignments: drepData.userAlignments,
        personalityLabel: drepData.personalityLabel,
        identityColor: drepData.identityColor,
        matchType: 'drep',
        answers: answersRecord,
        timestamp: Date.now(),
      } satisfies StoredMatchProfile);

      const deferredSpoResult = buildDeferredSpoResult(drepData);
      options?.onComplete?.(drepData, deferredSpoResult);

      const controller = abortRef.current;
      if (!controller) return;

      setIsSecondaryLoading(true);
      void fetchQuickMatch(finalAnswers, 'spo', controller.signal)
        .then((spoData) => {
          if (controller.signal.aborted || abortRef.current !== controller) return;
          setSpoResult(spoData);
        })
        .catch((caught) => {
          const nextError = caught instanceof Error ? caught : null;
          if (nextError?.name === 'AbortError') return;
          if (abortRef.current !== controller) return;
          setSpoResult(deferredSpoResult);
        })
        .finally(() => {
          if (abortRef.current === controller && !controller.signal.aborted) {
            setIsSecondaryLoading(false);
          }
        });
    },
    onError: (err) => {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Something went wrong');
    },
  });

  const submit = useCallback(
    async (overrideAnswers?: QuickMatchAnswers) => {
      await mutation.mutateAsync(overrideAnswers ?? answers).catch(() => {});
    },
    [answers, mutation],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    mutation.reset();
    setAnswersState({});
    setError(null);
    setDrepResult(null);
    setSpoResult(null);
    setIsSecondaryLoading(false);
  }, [mutation]);

  const state: QuickMatchState = {
    answers,
    isComplete,
    isSubmitting: mutation.isPending,
    isSecondaryLoading,
    error,
    drepResult,
    spoResult,
  };

  return { state, setAnswer, submit, reset };
}
