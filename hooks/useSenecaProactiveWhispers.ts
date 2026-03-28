'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import posthog from 'posthog-js';

interface WhisperApiResponse {
  whispers: string[];
  epoch: number;
}

export interface UseSenecaProactiveWhispersResult {
  /** The current proactive whisper to display, or null */
  currentWhisper: string | null;
  /** Dismiss the current whisper */
  dismissWhisper: () => void;
  /** Whether the whisper system has data-driven content available */
  hasProactiveContent: boolean;
}

const WHISPER_DISPLAY_MS = 8000; // Data-driven whispers show longer (8s vs 5s)
const WHISPER_INITIAL_DELAY_MS = 3000; // Wait 3s after page load before first whisper
const WHISPER_ROTATE_INTERVAL_MS = 45000; // Rotate to next whisper every 45s

const SESSION_SHOWN_KEY = 'seneca_proactive_shown';

/** Track which whispers have been shown this session to avoid repetition. */
function getSessionShown(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SESSION_SHOWN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function addSessionShown(whisper: string) {
  if (typeof window === 'undefined') return;
  const shown = getSessionShown();
  shown.add(whisper);
  sessionStorage.setItem(SESSION_SHOWN_KEY, JSON.stringify([...shown]));
}

/**
 * Fetches personalized, data-driven whispers from the API and cycles through them.
 * Returns the highest-priority unshown whisper, auto-rotating on an interval.
 *
 * Designed to complement (not replace) the template-based `useWhisper` hook.
 * Proactive whispers take priority when available.
 */
export function useSenecaProactiveWhispers(
  isAuthenticated: boolean,
  enabled: boolean = true,
): UseSenecaProactiveWhispersResult {
  const [currentWhisper, setCurrentWhisper] = useState<string | null>(null);
  const shownRef = useRef<Set<string>>(new Set());
  const displayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownInitialRef = useRef(false);

  // Fetch whisper data — low frequency, long stale time
  const { data } = useQuery<WhisperApiResponse>({
    queryKey: ['seneca-whispers', isAuthenticated],
    queryFn: async () => {
      const res = await fetch('/api/you/whispers');
      if (!res.ok) throw new Error('Failed to fetch whispers');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const whispers = useMemo(() => data?.whispers ?? [], [data]);

  // Initialize session-shown set
  useEffect(() => {
    shownRef.current = getSessionShown();
  }, []);

  const dismissWhisper = useCallback(() => {
    if (currentWhisper) {
      posthog.capture('seneca_whisper_dismissed', { whisper: currentWhisper });
    }
    setCurrentWhisper(null);
    if (displayTimerRef.current) {
      clearTimeout(displayTimerRef.current);
      displayTimerRef.current = null;
    }
  }, [currentWhisper]);

  const showNextWhisper = useCallback(() => {
    if (whispers.length === 0) return;

    // Find the first unshown whisper
    const unshown = whispers.find((w) => !shownRef.current.has(w));
    if (!unshown) return; // All shown this session

    shownRef.current.add(unshown);
    addSessionShown(unshown);
    setCurrentWhisper(unshown);
    posthog.capture('seneca_whisper_shown', { whisper: unshown, source: 'proactive' });

    // Auto-dismiss after display duration
    displayTimerRef.current = setTimeout(() => {
      setCurrentWhisper(null);
    }, WHISPER_DISPLAY_MS);
  }, [whispers]);

  // Initial display: show first whisper after delay
  useEffect(() => {
    if (!enabled || whispers.length === 0 || hasShownInitialRef.current) return;

    initialDelayRef.current = setTimeout(() => {
      hasShownInitialRef.current = true;
      showNextWhisper();
    }, WHISPER_INITIAL_DELAY_MS);

    return () => {
      if (initialDelayRef.current) {
        clearTimeout(initialDelayRef.current);
        initialDelayRef.current = null;
      }
    };
  }, [enabled, whispers, showNextWhisper]);

  // Rotation: cycle through remaining whispers
  useEffect(() => {
    if (!enabled || whispers.length <= 1 || !hasShownInitialRef.current) return;

    rotateTimerRef.current = setInterval(() => {
      // Only rotate if no whisper is currently showing
      if (currentWhisper === null) {
        showNextWhisper();
      }
    }, WHISPER_ROTATE_INTERVAL_MS);

    return () => {
      if (rotateTimerRef.current) {
        clearInterval(rotateTimerRef.current);
        rotateTimerRef.current = null;
      }
    };
  }, [enabled, whispers, currentWhisper, showNextWhisper]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
      if (initialDelayRef.current) clearTimeout(initialDelayRef.current);
    };
  }, []);

  return {
    currentWhisper,
    dismissWhisper,
    hasProactiveContent: whispers.length > 0,
  };
}
