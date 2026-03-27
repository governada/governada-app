'use client';

/**
 * SenecaStrip — Single-line AI insight bar for the Cockpit homepage.
 *
 * Modes:
 * - Boot: typewriter character-by-character streaming during cascade
 * - Rotation: cycles through pre-fetched briefing insights every ~30s
 * - Hover: shows entity context when a globe node is hovered
 * - Discovery: idle prompts when no urgent governance actions
 *
 * Clicking "Ask more" opens the full Seneca thread with the current insight.
 */

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSenecaStrip } from '@/hooks/useSenecaStrip';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import { useCockpitStore } from '@/stores/cockpitStore';
import { CompassSigil } from '@/components/governada/CompassSigil';

// ---------------------------------------------------------------------------
// Globe command dispatch
// ---------------------------------------------------------------------------

function dispatchGlobeCommand(entityIds: string[]) {
  if (typeof window === 'undefined' || entityIds.length === 0) return;
  for (const nodeId of entityIds) {
    window.dispatchEvent(
      new CustomEvent('senecaGlobeCommand', {
        detail: { type: 'pulse', nodeId },
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SenecaStrip() {
  const prefersReduced = useReducedMotion();
  const bootPhase = useCockpitStore((s) => s.bootPhase);
  const startConversation = useSenecaThreadStore((s) => s.startConversation);

  const { mode, currentText, revealedChars, bootComplete, currentEntityIds } = useSenecaStrip();

  const prevEntityIdsRef = useRef<string[]>([]);

  // Dispatch globe commands when entity IDs change in rotation/discovery text
  useEffect(() => {
    if (mode === 'boot') return;
    const ids = currentEntityIds;
    if (ids.length === 0) return;

    // Only dispatch if IDs actually changed
    const prevIds = prevEntityIdsRef.current;
    const changed = ids.length !== prevIds.length || ids.some((id, i) => id !== prevIds[i]);
    if (!changed) return;

    prevEntityIdsRef.current = ids;
    dispatchGlobeCommand(ids);
  }, [currentEntityIds, mode]);

  // Handle "Ask more" click
  const handleAskMore = useCallback(() => {
    startConversation(currentText);
  }, [startConversation, currentText]);

  // Determine visible text
  const displayText =
    mode === 'boot' && !prefersReduced ? currentText.slice(0, revealedChars) : currentText;

  // Determine sigil state
  const sigilState =
    mode === 'boot' && !bootComplete ? 'speaking' : mode === 'hover' ? 'thinking' : 'idle';

  // Visibility: show during cascade (after seneca-strip delay) or when ready
  const isVisible = bootPhase === 'ready' || bootPhase === 'cascade';

  // Show cursor blink during boot typewriter
  const showCursor = mode === 'boot' && !bootComplete && !prefersReduced;

  return (
    <div
      className="pointer-events-auto transition-all duration-500"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
        transitionDelay: bootPhase === 'cascade' ? '1000ms' : '0ms',
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-1 bg-black/50 backdrop-blur-md border-b border-white/5"
        role="status"
        aria-label="Seneca AI insight"
        aria-live="polite"
      >
        {/* Compass sigil */}
        <CompassSigil state={sigilState} size={12} className="shrink-0 opacity-60" />

        {/* Insight text */}
        <div className="flex-1 min-w-0 flex items-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={mode === 'boot' ? 'boot' : `insight-${currentText.slice(0, 20)}`}
              className="text-xs text-muted-foreground truncate block"
              initial={prefersReduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {displayText}
              {showCursor && (
                <motion.span
                  className="inline-block w-[1px] h-3 bg-compass-teal/80 ml-px align-middle"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Ask more button — only show when not booting */}
        {mode !== 'boot' && (
          <button
            onClick={handleAskMore}
            className="shrink-0 text-[10px] text-compass-teal/60 hover:text-compass-teal transition-colors whitespace-nowrap"
            aria-label="Ask Seneca for more details"
          >
            Ask more &#9656;
          </button>
        )}
      </div>
    </div>
  );
}
