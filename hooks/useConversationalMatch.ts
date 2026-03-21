'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { QualityGates, MatchResult } from '@/lib/matching/conversationalMatch';

/* ─── Types ─────────────────────────────────────────────── */

interface QuestionOption {
  id: string;
  text: string;
}

interface Question {
  question: string;
  options: QuestionOption[];
}

interface AnswerResponse {
  sessionId: string;
  round: number;
  totalRounds: number;
  question: Question | null;
  readyToMatch: boolean;
  qualityGates: QualityGates;
  status: 'in_progress' | 'ready_to_match' | 'matched';
  preview: {
    personalityLabel: string;
    identityColor: string;
    dimensionalCoverage: number;
  };
}

interface MatchResponse {
  matches: MatchResult[];
  bridgeMatch: MatchResult | null;
  userAlignments: AlignmentScores;
  personalityLabel: string;
  identityColor: string;
  qualityGates: QualityGates;
  roundsCompleted: number;
  usedSemantic: boolean;
}

interface StartResponse {
  sessionId: string;
  round: number;
  totalRounds: number;
  question: Question;
  qualityGates: QualityGates;
  status: 'in_progress' | 'ready_to_match' | 'matched';
}

interface PersistedState {
  sessionId: string;
  round: number;
  question: Question | null;
  qualityGates: QualityGates;
  status: 'in_progress' | 'ready_to_match' | 'matched';
  preview: {
    personalityLabel: string;
    identityColor: string;
    dimensionalCoverage: number;
  } | null;
  timestamp: number;
}

export interface ConversationalMatchState {
  sessionId: string | null;
  round: number;
  question: Question | null;
  qualityGates: QualityGates | null;
  status: 'idle' | 'in_progress' | 'ready_to_match' | 'matched';
  preview: {
    personalityLabel: string;
    identityColor: string;
    dimensionalCoverage: number;
  } | null;
  matches: MatchResult[] | null;
  bridgeMatch: MatchResult | null;
  weights: Record<string, number> | null;
  userAlignments: AlignmentScores | null;
  personalityLabel: string | null;
  identityColor: string | null;
  usedSemantic: boolean;
  confidence: number;
  isLoading: boolean;
  error: string | null;
}

/* ─── Constants ─────────────────────────────────────────── */

const STORAGE_KEY = 'governada_conv_match_session';
const SESSION_TTL_MS = 25 * 60 * 1000; // 25 min (slightly under server's 30 min TTL)
const API_ENDPOINT = '/api/governance/match-conversation';

/* ─── Persistence helpers ───────────────────────────────── */

function savePartialState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable
  }
}

function loadPartialState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: PersistedState = JSON.parse(raw);
    // Expire if older than TTL
    if (Date.now() - parsed.timestamp > SESSION_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/* ─── Confidence derivation ─────────────────────────────── */

/**
 * Derive a 0-100 confidence value from quality gates.
 * Weights dimensional coverage (60%) and specificity (40%).
 * Max dimensional coverage = 6, max meaningful specificity ~ 40.
 */
function deriveConfidence(gates: QualityGates): number {
  const coverageScore = Math.min(gates.dimensionalCoverage / 6, 1) * 60;
  const specificityScore = Math.min(gates.specificity / 40, 1) * 40;
  return Math.round(coverageScore + specificityScore);
}

/* ─── Hook ──────────────────────────────────────────────── */

export function useConversationalMatch() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [qualityGates, setQualityGates] = useState<QualityGates | null>(null);
  const [status, setStatus] = useState<ConversationalMatchState['status']>('idle');
  const [preview, setPreview] = useState<ConversationalMatchState['preview']>(null);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [bridgeMatch, setBridgeMatch] = useState<MatchResult | null>(null);
  const [weights, setWeights] = useState<Record<string, number> | null>(null);
  const [userAlignments, setUserAlignments] = useState<AlignmentScores | null>(null);
  const [personalityLabel, setPersonalityLabel] = useState<string | null>(null);
  const [identityColor, setIdentityColor] = useState<string | null>(null);
  const [usedSemantic, setUsedSemantic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Derive confidence from quality gates
  const confidence = qualityGates ? deriveConfidence(qualityGates) : 0;

  // Restore persisted state on mount
  useEffect(() => {
    const saved = loadPartialState();
    if (saved && saved.sessionId && saved.status !== 'matched') {
      setSessionId(saved.sessionId);
      setRound(saved.round);
      setQuestion(saved.question);
      setQualityGates(saved.qualityGates);
      setStatus(saved.status);
      setPreview(saved.preview);
    }
  }, []);

  // Persist state on changes
  useEffect(() => {
    if (sessionId && status !== 'idle') {
      savePartialState({
        sessionId,
        round,
        question,
        qualityGates: qualityGates ?? {
          discriminativePower: 0,
          dimensionalCoverage: 0,
          specificity: 0,
          passed: false,
        },
        status,
        preview,
        timestamp: Date.now(),
      });
    }
  }, [sessionId, round, question, qualityGates, status, preview]);

  const startSession = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      const data: StartResponse = await res.json();
      setSessionId(data.sessionId);
      setRound(data.round);
      setQuestion(data.question);
      setQualityGates(data.qualityGates);
      setStatus(data.status);
      setPreview(null);
      setMatches(null);
      setBridgeMatch(null);
      setWeights(null);
      setUserAlignments(null);
      setPersonalityLabel(null);
      setIdentityColor(null);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitAnswer = useCallback(
    async (selectedPillIds: string[], rawText?: string) => {
      if (!sessionId) {
        setError('No active session. Please start a new session.');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'answer',
            sessionId,
            selectedOptionIds: selectedPillIds,
            rawText,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Server error: ${res.status}`);
        }

        const data: AnswerResponse = await res.json();
        setRound(data.round);
        setQuestion(data.question);
        setQualityGates(data.qualityGates);
        setStatus(data.readyToMatch ? 'ready_to_match' : data.status);
        setPreview(data.preview);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to submit answer');
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId],
  );

  const getMatches = useCallback(
    async (dimensionWeights?: Record<string, number>) => {
      if (!sessionId) {
        setError('No active session. Please start a new session.');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      // Use explicitly passed weights, or fall back to state weights
      const effectiveWeights = dimensionWeights ?? weights ?? undefined;

      try {
        const res = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'match',
            sessionId,
            ...(effectiveWeights ? { weights: effectiveWeights } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Server error: ${res.status}`);
        }

        const data: MatchResponse = await res.json();
        setMatches(data.matches);
        setBridgeMatch(data.bridgeMatch ?? null);
        setUserAlignments(data.userAlignments);
        setPersonalityLabel(data.personalityLabel);
        setIdentityColor(data.identityColor);
        setQualityGates(data.qualityGates);
        setUsedSemantic(data.usedSemantic);
        setStatus('matched');
        clearPersistedState();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to get matches');
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, weights],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSessionId(null);
    setRound(0);
    setQuestion(null);
    setQualityGates(null);
    setStatus('idle');
    setPreview(null);
    setMatches(null);
    setBridgeMatch(null);
    setWeights(null);
    setUserAlignments(null);
    setPersonalityLabel(null);
    setIdentityColor(null);
    setUsedSemantic(false);
    setIsLoading(false);
    setError(null);
    clearPersistedState();
  }, []);

  return {
    // State
    sessionId,
    round,
    question,
    qualityGates,
    status,
    preview,
    matches,
    bridgeMatch,
    weights,
    userAlignments,
    personalityLabel,
    identityColor,
    usedSemantic,
    confidence,
    isLoading,
    error,
    // Actions
    startSession,
    submitAnswer,
    getMatches,
    setWeights,
    reset,
  };
}
