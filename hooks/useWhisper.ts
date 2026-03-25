'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseWhisperResult {
  currentWhisper: string | null;
  dismissWhisper: () => void;
}

interface WhisperOptions {
  activeProposals?: number;
  epochProgress?: number;
  daysRemaining?: number;
  governanceHealth?: number;
  isAuthenticated?: boolean;
}

type WhisperTemplateOpts = WhisperOptions;

const WHISPER_TEMPLATES: Record<string, (opts: WhisperTemplateOpts) => string[]> = {
  governance: (opts) => [
    `${opts.activeProposals ?? 'Several'} proposals are being decided right now.`,
    `Governance health is at ${opts.governanceHealth ?? 'moderate'} levels this epoch.`,
  ],
  proposals: (opts) => [
    `The most active proposal has the community split \u2014 worth a look.`,
    `${opts.activeProposals ?? 'Several'} proposals need votes before epoch end.`,
  ],
  dreps: () => [
    `Each of these representatives could vote on your behalf.`,
    `Looking for alignment? Try the match flow to find your representative.`,
  ],
  treasury: () => [
    `The treasury funds Cardano\u2019s future. Every ADA spent shapes the ecosystem.`,
    `Treasury spending trends reveal where the community\u2019s priorities lie.`,
  ],
  'proposals-detail': () => [`Want to understand the implications? I can break this down for you.`],
  'drep-detail': () => [
    `Check their voting history \u2014 it tells a story about their governance philosophy.`,
  ],
  homepage: (opts) => [
    `Welcome. ${opts.activeProposals ?? 'Several'} proposals are being decided by the community right now.`,
  ],
  you: () => [`This is your governance identity \u2014 everything about how you participate.`],
};

const MAX_WHISPERS_PER_SESSION = 5;
const WHISPER_DELAY_MS = 1500;
const WHISPER_DURATION_MS = 5000;

export function useWhisper(
  pageContext: string | undefined,
  options?: WhisperOptions,
): UseWhisperResult {
  const [currentWhisper, setCurrentWhisper] = useState<string | null>(null);
  const shownWhispersRef = useRef<Set<string>>(new Set());
  const whisperCountRef = useRef(0);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevContextRef = useRef<string | undefined>(undefined);

  const dismissWhisper = useCallback(() => {
    setCurrentWhisper(null);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Only trigger on page context changes
    if (pageContext === prevContextRef.current) return;
    prevContextRef.current = pageContext;

    // Clear any pending timers
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    // Clear current whisper on navigation
    setCurrentWhisper(null);

    if (!pageContext) return;
    if (whisperCountRef.current >= MAX_WHISPERS_PER_SESSION) return;

    const templateFn = WHISPER_TEMPLATES[pageContext];
    if (!templateFn) return;

    const opts = options ?? {};
    const candidates = templateFn(opts).filter((w) => !shownWhispersRef.current.has(w));
    if (candidates.length === 0) return;

    // Delay before showing whisper
    delayTimerRef.current = setTimeout(() => {
      // Re-check limit (could have changed during delay)
      if (whisperCountRef.current >= MAX_WHISPERS_PER_SESSION) return;

      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      shownWhispersRef.current.add(selected);
      whisperCountRef.current += 1;
      setCurrentWhisper(selected);

      // Auto-dismiss after duration
      dismissTimerRef.current = setTimeout(() => {
        setCurrentWhisper(null);
      }, WHISPER_DURATION_MS);
    }, WHISPER_DELAY_MS);

    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [pageContext, options]);

  return { currentWhisper, dismissWhisper };
}
