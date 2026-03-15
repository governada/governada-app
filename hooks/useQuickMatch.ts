'use client';

import { useState, useCallback, useRef } from 'react';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { ConfidenceBreakdown } from '@/lib/matching/confidence';
import { saveMatchProfile, type StoredMatchProfile } from '@/lib/matchStore';
import { getStoredSession } from '@/lib/supabaseAuth';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { emitDiscoveryEvent } from '@/lib/discovery/events';

/* ─── Types ─────────────────────────────────────────────── */

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
  error: string | null;
  drepResult: QuickMatchResponse | null;
  spoResult: QuickMatchResponse | null;
}

export interface UseQuickMatchOptions {
  onComplete?: (drepResult: QuickMatchResponse, spoResult: QuickMatchResponse) => void;
  drepId?: string;
}

type MatchType = 'drep' | 'spo';

/* ─── Hook ──────────────────────────────────────────────── */

export function useQuickMatch(options?: UseQuickMatchOptions) {
  const [answers, setAnswersState] = useState<QuickMatchAnswers>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drepResult, setDrepResult] = useState<QuickMatchResponse | null>(null);
  const [spoResult, setSpoResult] = useState<QuickMatchResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isComplete = Boolean(
    answers.treasury && answers.protocol && answers.transparency && answers.decentralization,
  );

  const setAnswer = useCallback((question: string, answer: string) => {
    setAnswersState((prev) => ({ ...prev, [question]: answer }));
  }, []);

  const submit = useCallback(
    async (overrideAnswers?: QuickMatchAnswers) => {
      const finalAnswers = overrideAnswers ?? answers;

      // Require at least the original 3 questions for backward compatibility
      if (!finalAnswers.treasury || !finalAnswers.protocol || !finalAnswers.transparency) {
        setError('Please answer all required questions.');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSubmitting(true);
      setError(null);

      const fetchOne = async (type: MatchType) => {
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
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json() as Promise<QuickMatchResponse>;
      };

      try {
        const [drepData, spoData] = await Promise.all([fetchOne('drep'), fetchOne('spo')]);
        setDrepResult(drepData);
        setSpoResult(spoData);
        emitDiscoveryEvent('match_completed');

        // Funnel tracking
        trackFunnel(FUNNEL_EVENTS.MATCH_COMPLETED, {
          personality: drepData.personalityLabel,
          drep_matches: drepData.matches.length,
          spo_matches: spoData.matches.length,
        });
        trackFunnel(FUNNEL_EVENTS.MATCH_RESULT_VIEWED, {
          top_match_score: drepData.matches[0]?.matchScore ?? 0,
        });

        // Mark quick match as completed for authenticated users
        const token = getStoredSession();
        if (token) {
          fetch('/api/governance/quick-match/mark-completed', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }

        // Persist match profile
        const answersRecord: Record<string, string> = {};
        for (const [k, v] of Object.entries(finalAnswers)) {
          if (v) answersRecord[k] = v;
        }
        saveMatchProfile({
          userAlignments: drepData.userAlignments,
          personalityLabel: drepData.personalityLabel,
          identityColor: drepData.identityColor,
          matchType: 'drep',
          answers: answersRecord,
          timestamp: Date.now(),
        } satisfies StoredMatchProfile);

        options?.onComplete?.(drepData, spoData);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsSubmitting(false);
      }
    },
    [answers, options],
  );

  const reset = useCallback(() => {
    setAnswersState({});
    setIsSubmitting(false);
    setError(null);
    setDrepResult(null);
    setSpoResult(null);
  }, []);

  const state: QuickMatchState = {
    answers,
    isComplete,
    isSubmitting,
    error,
    drepResult,
    spoResult,
  };

  return { state, setAnswer, submit, reset };
}
