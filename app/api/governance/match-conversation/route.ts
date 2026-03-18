/**
 * Conversational DRep Matching API — multi-round question-based matching.
 *
 * Actions:
 *   "start"  → create session in Redis, return sessionId + first question
 *   "answer" → process answer, check quality gates, return next question or readyToMatch
 *   "match"  → execute matching, return results
 *
 * Session state stored in Redis (Upstash): `conv-match:{sessionId}`, 30-min TTL.
 * Rate limiting: 10 sessions/IP/hour.
 *
 * Gated behind `conversational_matching` feature flag.
 */

import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getFeatureFlag } from '@/lib/featureFlags';
import { getRedis } from '@/lib/redis';
import { captureServerEvent } from '@/lib/posthog-server';
import {
  createSession,
  processAnswer,
  executeMatch,
  getNextQuestion,
  buildFullAlignment,
  MAX_ROUNDS,
  MAX_RAW_TEXT_LENGTH,
} from '@/lib/matching/conversationalMatch';
import type { ConversationSession } from '@/lib/matching/conversationalMatch';
import { getPersonalityLabel, getDominantDimension, getIdentityColor } from '@/lib/drepIdentity';

export const dynamic = 'force-dynamic';

const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes
const SESSION_PREFIX = 'conv-match:';

/* ─── Helpers ───────────────────────────────────────────── */

function sessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

async function loadSession(sessionId: string): Promise<ConversationSession | null> {
  const redis = getRedis();
  try {
    const data = await redis.get<ConversationSession>(sessionKey(sessionId));
    return data ?? null;
  } catch {
    return null;
  }
}

async function saveSession(session: ConversationSession): Promise<void> {
  const redis = getRedis();
  await redis.set(sessionKey(session.id), session, { ex: SESSION_TTL_SECONDS });
}

function formatQuestion(questionSet: { question: string; pills: { id: string; text: string }[] }) {
  return {
    question: questionSet.question,
    options: questionSet.pills.map((p) => ({ id: p.id, text: p.text })),
  };
}

/* ─── Route handler ─────────────────────────────────────── */

export const POST = withRouteHandler(
  async (request) => {
    // Feature flag gate
    const enabled = await getFeatureFlag('conversational_matching', false);
    if (!enabled) {
      return NextResponse.json(
        { error: 'Conversational matching is not enabled' },
        { status: 404 },
      );
    }

    let body: {
      action: 'start' | 'answer' | 'match';
      sessionId?: string;
      selectedOptionIds?: string[];
      rawText?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { action } = body;

    if (!action || !['start', 'answer', 'match'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start", "answer", or "match".' },
        { status: 400 },
      );
    }

    /* ── START ───────────────────────────────────── */

    if (action === 'start') {
      const sessionId = randomUUID();
      const session = createSession(sessionId);
      const firstQuestion = getNextQuestion(session);

      if (!firstQuestion) {
        return NextResponse.json({ error: 'No questions available' }, { status: 500 });
      }

      await saveSession(session);

      captureServerEvent('conversational_match_started', { sessionId });

      return NextResponse.json({
        sessionId,
        round: 1,
        totalRounds: MAX_ROUNDS,
        question: formatQuestion(firstQuestion),
        qualityGates: session.qualityGates,
        status: session.status,
      });
    }

    /* ── ANSWER ──────────────────────────────────── */

    if (action === 'answer') {
      const { sessionId, selectedOptionIds, rawText } = body;

      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }

      if (
        !selectedOptionIds ||
        !Array.isArray(selectedOptionIds) ||
        selectedOptionIds.length === 0
      ) {
        return NextResponse.json(
          { error: 'selectedOptionIds must be a non-empty array' },
          { status: 400 },
        );
      }

      // Validate raw text length
      if (rawText && rawText.length > MAX_RAW_TEXT_LENGTH) {
        return NextResponse.json(
          { error: `rawText must be ${MAX_RAW_TEXT_LENGTH} characters or fewer` },
          { status: 400 },
        );
      }

      const session = await loadSession(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found or expired. Please start a new session.' },
          { status: 404 },
        );
      }

      if (session.status !== 'in_progress') {
        return NextResponse.json(
          { error: 'Session is no longer accepting answers.' },
          { status: 400 },
        );
      }

      // Process the answer
      const updatedSession = processAnswer(session, selectedOptionIds, rawText);
      await saveSession(updatedSession);

      // Get next question if session is still in progress
      const nextQuestion = getNextQuestion(updatedSession);

      // Build partial alignment preview for the client
      const currentAlignment = buildFullAlignment(updatedSession.extractedAlignment);
      const personalityLabel = getPersonalityLabel(currentAlignment);
      const dominant = getDominantDimension(currentAlignment);
      const identityColor = getIdentityColor(dominant).hex;

      captureServerEvent('conversational_match_answered', {
        sessionId,
        round: updatedSession.rounds.length,
        selectedCount: selectedOptionIds.length,
        hasRawText: !!rawText,
        qualityPassed: updatedSession.qualityGates.passed,
      });

      return NextResponse.json({
        sessionId,
        round: updatedSession.rounds.length,
        totalRounds: MAX_ROUNDS,
        question: nextQuestion ? formatQuestion(nextQuestion) : null,
        readyToMatch: updatedSession.status === 'ready_to_match',
        qualityGates: updatedSession.qualityGates,
        status: updatedSession.status,
        preview: {
          personalityLabel,
          identityColor,
          dimensionalCoverage: updatedSession.qualityGates.dimensionalCoverage,
        },
      });
    }

    /* ── MATCH ───────────────────────────────────── */

    if (action === 'match') {
      const { sessionId } = body;

      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }

      const session = await loadSession(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found or expired. Please start a new session.' },
          { status: 404 },
        );
      }

      if (session.rounds.length === 0) {
        return NextResponse.json(
          { error: 'At least one round must be completed before matching.' },
          { status: 400 },
        );
      }

      // Check semantic feature flag
      const useSemantic = await getFeatureFlag('conversational_matching_semantic', false);

      const results = await executeMatch(session, {
        useSemantic,
        limit: 5,
      });

      // Mark session as matched
      session.status = 'matched';
      await saveSession(session);

      const userAlignment = buildFullAlignment(session.extractedAlignment);
      const personalityLabel = getPersonalityLabel(userAlignment);
      const dominant = getDominantDimension(userAlignment);
      const identityColor = getIdentityColor(dominant).hex;

      captureServerEvent('conversational_match_completed', {
        sessionId,
        roundsCompleted: session.rounds.length,
        qualityPassed: session.qualityGates.passed,
        matchCount: results.length,
        usedSemantic: useSemantic,
        topMatchScore: results[0]?.score ?? null,
      });

      return NextResponse.json({
        matches: results,
        userAlignments: userAlignment,
        personalityLabel,
        identityColor,
        qualityGates: session.qualityGates,
        roundsCompleted: session.rounds.length,
        usedSemantic: useSemantic,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  },
  {
    rateLimit: {
      max: 10,
      window: 3600, // 1 hour
      key: (req) => {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        return `conv-match:${createHash('sha256').update(ip).digest('hex').slice(0, 16)}`;
      },
    },
  },
);
