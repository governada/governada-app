'use client';

/**
 * Hook to track batch review session progress.
 *
 * Manages local session state: proposals reviewed, time spent, estimated
 * time remaining. Persists to review_sessions table periodically.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { posthog } from '@/lib/posthog';

interface ReviewSessionState {
  /** Number of proposals reviewed in this session */
  reviewed: number;
  /** Total proposals in the queue */
  total: number;
  /** Average seconds per proposal (only valid after 2+ reviews) */
  avgSecondsPerProposal: number | null;
  /** Estimated remaining seconds (only valid after 2+ reviews) */
  estimatedRemaining: number | null;
  /** Whether all proposals have been reviewed */
  isComplete: boolean;
  /** Session start time */
  startedAt: Date;
  /** Mark a proposal as reviewed — updates counters and time estimates */
  markReviewed: () => void;
}

export function useReviewSession(total: number, voterId: string | undefined): ReviewSessionState {
  const [reviewed, setReviewed] = useState(0);
  const startedAtRef = useRef(new Date());
  const persistCountRef = useRef(0);

  const isComplete = total > 0 && reviewed >= total;

  // Calculate time estimates
  const elapsedMs = Date.now() - startedAtRef.current.getTime();
  const avgSecondsPerProposal = reviewed >= 2 ? Math.round(elapsedMs / 1000 / reviewed) : null;
  const estimatedRemaining =
    avgSecondsPerProposal != null && total > reviewed
      ? (total - reviewed) * avgSecondsPerProposal
      : null;

  const markReviewed = useCallback(() => {
    setReviewed((prev) => {
      const next = prev + 1;
      persistCountRef.current++;

      // Track analytics
      posthog.capture('batch_review_advanced', {
        reviewed: next,
        total,
        avgSecondsPerProposal:
          next >= 2
            ? Math.round((Date.now() - startedAtRef.current.getTime()) / 1000 / next)
            : null,
      });

      // Persist every 5 reviews
      if (persistCountRef.current % 5 === 0 && voterId) {
        persistSession(voterId, startedAtRef.current, next, total);
      }

      return next;
    });
  }, [total, voterId]);

  // Track session start
  useEffect(() => {
    if (total > 0) {
      posthog.capture('batch_review_started', { total });
    }
  }, [total]);

  // Track completion
  useEffect(() => {
    if (isComplete && reviewed > 0) {
      posthog.capture('batch_review_completed', {
        reviewed,
        total,
        totalSeconds: Math.round((Date.now() - startedAtRef.current.getTime()) / 1000),
      });
    }
  }, [isComplete, reviewed, total]);

  // Persist on unmount via beforeunload
  useEffect(() => {
    if (!voterId) return;

    const handleUnload = () => {
      if (reviewed > 0) {
        persistSession(voterId, startedAtRef.current, reviewed, total);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && reviewed > 0) {
        persistSession(voterId, startedAtRef.current, reviewed, total);
      }
    });

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [voterId, reviewed, total]);

  return {
    reviewed,
    total,
    avgSecondsPerProposal,
    estimatedRemaining,
    isComplete,
    startedAt: startedAtRef.current,
    markReviewed,
  };
}

// ---------------------------------------------------------------------------
// Persistence helper (fire-and-forget)
// ---------------------------------------------------------------------------

function persistSession(voterId: string, startedAt: Date, reviewed: number, total: number): void {
  const totalSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
  const avg = reviewed > 0 ? Math.round(totalSeconds / reviewed) : null;

  // Use sendBeacon for reliability during page unload
  const body = JSON.stringify({
    voterId,
    startedAt: startedAt.toISOString(),
    reviewed,
    total,
    totalSeconds,
    avgSecondsPerProposal: avg,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/workspace/review-session', body);
  } else {
    fetch('/api/workspace/review-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}
