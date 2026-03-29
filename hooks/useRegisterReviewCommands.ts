'use client';

import { useEffect, useRef } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  ChevronRight,
  ChevronLeft,
  SkipForward,
} from 'lucide-react';
import { commandRegistry } from '@/lib/workspace/commands';

interface ReviewCommandHandlers {
  onYes?: () => void;
  onNo?: () => void;
  onAbstain?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  /** Skip to the next unreviewed proposal (skips voted/snoozed) */
  onNextUnreviewed?: () => void;
}

/**
 * Registers review-specific commands into the command registry.
 *
 * These commands are context-dependent: they only appear when the review
 * workspace is mounted and handlers are provided.
 *
 * Replaces the old useKeyboardShortcuts hook for review-specific shortcuts.
 */
export function useRegisterReviewCommands(handlers: ReviewCommandHandlers) {
  // Use refs so the command execute functions always call the latest handlers
  // without needing to re-register on every handler change.
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  // Extract booleans for stable dependency tracking
  const hasYes = !!handlers.onYes;
  const hasNo = !!handlers.onNo;
  const hasAbstain = !!handlers.onAbstain;
  const hasNext = !!handlers.onNext;
  const hasPrev = !!handlers.onPrev;
  const hasNextUnreviewed = !!handlers.onNextUnreviewed;

  useEffect(() => {
    const unregisters: Array<() => void> = [];

    if (hasNext) {
      unregisters.push(
        commandRegistry.register({
          id: 'review.next',
          label: 'Next Proposal',
          shortcut: 'j',
          icon: ChevronRight,
          section: 'actions',
          execute: () => handlersRef.current.onNext?.(),
        }),
      );
      // Arrow key alias (hidden from palette — same action, different shortcut)
      unregisters.push(
        commandRegistry.register({
          id: 'review.next-arrow',
          label: 'Next Proposal',
          shortcut: 'arrowright',
          section: 'actions',
          execute: () => handlersRef.current.onNext?.(),
        }),
      );
    }

    if (hasPrev) {
      unregisters.push(
        commandRegistry.register({
          id: 'review.prev',
          label: 'Previous Proposal',
          shortcut: 'k',
          icon: ChevronLeft,
          section: 'actions',
          execute: () => handlersRef.current.onPrev?.(),
        }),
      );
      // Arrow key alias
      unregisters.push(
        commandRegistry.register({
          id: 'review.prev-arrow',
          label: 'Previous Proposal',
          shortcut: 'arrowleft',
          section: 'actions',
          execute: () => handlersRef.current.onPrev?.(),
        }),
      );
    }

    if (hasYes) {
      unregisters.push(
        commandRegistry.register({
          id: 'review.vote-yes',
          label: 'Vote Yes',
          shortcut: 'y',
          icon: ThumbsUp,
          section: 'actions',
          execute: () => handlersRef.current.onYes?.(),
        }),
      );
    }

    if (hasNo) {
      unregisters.push(
        commandRegistry.register({
          id: 'review.vote-no',
          label: 'Vote No',
          shortcut: 'n',
          icon: ThumbsDown,
          section: 'actions',
          execute: () => handlersRef.current.onNo?.(),
        }),
      );
    }

    if (hasAbstain) {
      unregisters.push(
        commandRegistry.register({
          id: 'review.vote-abstain',
          label: 'Vote Abstain',
          shortcut: 'a',
          icon: MinusCircle,
          section: 'actions',
          execute: () => handlersRef.current.onAbstain?.(),
        }),
      );
    }

    if (hasNextUnreviewed) {
      unregisters.push(
        commandRegistry.register({
          id: 'review.next-unreviewed',
          label: 'Next Unreviewed',
          shortcut: ']',
          icon: SkipForward,
          section: 'actions',
          execute: () => handlersRef.current.onNextUnreviewed?.(),
        }),
      );
    }

    return () => {
      for (const unregister of unregisters) {
        unregister();
      }
    };
  }, [hasYes, hasNo, hasAbstain, hasNext, hasPrev, hasNextUnreviewed]);
}
