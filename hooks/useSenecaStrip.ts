'use client';

/**
 * useSenecaStrip — Data hook for the Seneca Strip on the Cockpit homepage.
 *
 * Manages four modes:
 * 1. Boot narration (typewriter text during cascade)
 * 2. Normal rotation (cycling briefing insights)
 * 3. Hover-reactive (entity context when hovering globe nodes)
 * 4. Dead-time discovery (idle prompts when no urgent actions)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCockpitStore } from '@/stores/cockpitStore';
import { useEpochContext } from '@/hooks/useEpochContext';
import { useActionQueue } from '@/hooks/useActionQueue';
import { useSegment } from '@/components/providers/SegmentProvider';
import { OVERLAY_CONFIGS } from '@/lib/cockpit/overlayConfigs';
import type { ContextSynthesisResult } from '@/lib/intelligence/context';
import type { UserSegment } from '@/components/providers/SegmentProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SenecaStripMode = 'boot' | 'rotation' | 'hover' | 'discovery';

export interface SenecaStripInsight {
  text: string;
  /** Entity IDs mentioned in this insight (for globe commands) */
  entityIds: string[];
}

export interface SenecaStripState {
  mode: SenecaStripMode;
  /** Current insight text to display */
  currentText: string;
  /** For boot mode: how many characters to reveal */
  revealedChars: number;
  /** Whether boot streaming is complete */
  bootComplete: boolean;
  /** Current insight index in rotation */
  rotationIndex: number;
  /** All available insights for rotation */
  insights: SenecaStripInsight[];
  /** Whether data is still loading */
  isLoading: boolean;
  /** Entity IDs in current text (for globe commands) */
  currentEntityIds: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROTATION_INTERVAL_MS = 30_000;
const TYPEWRITER_INTERVAL_MS = 25;

function personaGreeting(segment: UserSegment): string {
  switch (segment) {
    case 'drep':
      return 'DRep station online.';
    case 'spo':
      return 'Pool operator console active.';
    case 'cc':
      return 'Committee interface ready.';
    case 'citizen':
      return 'Governance feed active.';
    default:
      return 'Governance intelligence online.';
  }
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

const DISCOVERY_PROMPTS: string[] = [
  'Something interesting: delegation patterns shifted 12% this epoch.',
  'Did you know? The most active proposal category this week is Treasury.',
  'Insight: voter participation is trending upward across all segments.',
  'Pattern detected: new DReps are claiming profiles 3x faster than last epoch.',
  'Observation: constitutional alignment scores are converging across top DReps.',
];

/** Extract entity-like IDs from text (drep1..., pool1..., stake1...) */
function extractEntityIds(text: string): string[] {
  const matches = text.match(/(?:drep|pool|stake)1[a-z0-9]{5,}/g);
  return matches ? [...new Set(matches)] : [];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSenecaStrip(): SenecaStripState {
  const bootPhase = useCockpitStore((s) => s.bootPhase);
  const hoveredNodeId = useCockpitStore((s) => s.hoveredNodeId);
  const senecaMode = useCockpitStore((s) => s.senecaMode);
  const temporalEpoch = useCockpitStore((s) => s.temporalEpoch);
  const activeOverlay = useCockpitStore((s) => s.activeOverlay);
  const { segment } = useSegment();
  const { epoch, day } = useEpochContext();
  const { data: actionData } = useActionQueue();

  // Fetch briefing insights from the context endpoint
  const { data: contextData, isLoading } = useQuery<ContextSynthesisResult>({
    queryKey: ['seneca-strip-context'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/context?path=/');
      if (!res.ok) throw new Error('Failed to fetch context');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Derive insights from context data
  const insights = useMemo<SenecaStripInsight[]>(() => {
    if (!contextData) return [];

    const result: SenecaStripInsight[] = [];

    // Main briefing as first insight
    if (contextData.briefing) {
      result.push({
        text: contextData.briefing,
        entityIds: extractEntityIds(contextData.briefing),
      });
    }

    // Each highlight becomes an insight
    for (const highlight of contextData.highlights ?? []) {
      const text = `${highlight.label}: ${highlight.value}`;
      result.push({ text, entityIds: extractEntityIds(text) });
    }

    // Suggested actions as insights
    for (const action of contextData.suggestedActions ?? []) {
      result.push({
        text: action.label ?? '',
        entityIds: [],
      });
    }

    return result.filter((i) => i.text.length > 0).slice(0, 5);
  }, [contextData]);

  // Urgent count from action queue
  const urgentCount = useMemo(() => {
    if (!actionData?.items) return 0;
    return actionData.items.filter((i) => i.priority === 'urgent' || i.priority === 'high').length;
  }, [actionData]);

  // Determine if we're in dead-time (no urgent/high actions)
  const isDeadTime = senecaMode === 'discovery' || urgentCount === 0;

  // ---------------------------------------------------------------------------
  // Boot narration
  // ---------------------------------------------------------------------------

  const bootNarration = useMemo(() => {
    const greeting = timeOfDayGreeting();
    const attentionPart =
      urgentCount > 0
        ? `${urgentCount} item${urgentCount > 1 ? 's' : ''} need${urgentCount === 1 ? 's' : ''} your attention.`
        : 'All systems nominal.';

    return `${greeting}. ${personaGreeting(segment)} Epoch ${epoch}, day ${day}. ${attentionPart}`;
  }, [segment, epoch, day, urgentCount]);

  const [revealedChars, setRevealedChars] = useState(0);
  const [bootComplete, setBootComplete] = useState(false);
  const bootTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start typewriter on boot cascade
  useEffect(() => {
    if (bootPhase !== 'cascade') return;

    // Reset
    setRevealedChars(0);
    setBootComplete(false);

    // Delay start by the seneca-strip boot delay (1000ms)
    const startTimer = setTimeout(() => {
      let charIndex = 0;
      bootTimerRef.current = setInterval(() => {
        charIndex++;
        setRevealedChars(charIndex);
        if (charIndex >= bootNarration.length) {
          if (bootTimerRef.current) clearInterval(bootTimerRef.current);
          bootTimerRef.current = null;
          setBootComplete(true);
        }
      }, TYPEWRITER_INTERVAL_MS);
    }, 1000);

    return () => {
      clearTimeout(startTimer);
      if (bootTimerRef.current) {
        clearInterval(bootTimerRef.current);
        bootTimerRef.current = null;
      }
    };
  }, [bootPhase, bootNarration]);

  // ---------------------------------------------------------------------------
  // Rotation
  // ---------------------------------------------------------------------------

  const [rotationIndex, setRotationIndex] = useState(0);

  useEffect(() => {
    if (bootPhase !== 'ready') return;
    if (hoveredNodeId) return; // pause rotation during hover
    if (insights.length <= 1) return;

    const timer = setInterval(() => {
      setRotationIndex((prev) => (prev + 1) % insights.length);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [bootPhase, hoveredNodeId, insights.length]);

  // ---------------------------------------------------------------------------
  // Determine current mode and text
  // ---------------------------------------------------------------------------

  const getState = useCallback((): {
    mode: SenecaStripMode;
    text: string;
    entityIds: string[];
  } => {
    // Boot mode
    if (bootPhase === 'cascade' || bootPhase === 'pending') {
      return {
        mode: 'boot',
        text: bootNarration,
        entityIds: [],
      };
    }

    // Temporal scrubbing mode — acknowledge historical view
    if (temporalEpoch !== null) {
      return {
        mode: 'rotation' as SenecaStripMode,
        text: `Viewing Epoch ${temporalEpoch}. Scrub to explore governance history.`,
        entityIds: [],
      };
    }

    // Hover-reactive mode — show entity-contextual text
    if (hoveredNodeId) {
      let hoverText: string;
      if (hoveredNodeId.startsWith('proposal-')) {
        hoverText = `Proposal in focus. Review alignment with your governance philosophy.`;
      } else if (hoveredNodeId.startsWith('pool-') || hoveredNodeId.startsWith('pool1')) {
        hoverText = `Stake pool governance profile. Check their voting record and delegation trends.`;
      } else if (hoveredNodeId.startsWith('cc-')) {
        hoverText = `Constitutional Committee member. Review their constitutional reasoning patterns.`;
      } else {
        // DRep or unknown
        const shortId =
          hoveredNodeId.length > 16
            ? hoveredNodeId.slice(0, 8) + '...' + hoveredNodeId.slice(-6)
            : hoveredNodeId;
        hoverText = `DRep ${shortId}. Explore alignment, voting record, and delegation stats.`;
      }
      return {
        mode: 'hover',
        text: hoverText,
        entityIds: [hoveredNodeId],
      };
    }

    // Dead-time discovery mode — activates when no urgent/high items
    if (isDeadTime) {
      const discoveryIndex =
        Math.floor(Date.now() / ROTATION_INTERVAL_MS) % DISCOVERY_PROMPTS.length;
      return {
        mode: 'discovery',
        text: DISCOVERY_PROMPTS[discoveryIndex],
        entityIds: [],
      };
    }

    // Normal rotation — overlay-aware (SV-2 fix)
    if (insights.length > 0) {
      const idx = rotationIndex % insights.length;
      const baseText = insights[idx].text;
      // Prepend overlay context hint when not on the default 'urgent' tab
      const overlayHint =
        activeOverlay !== 'urgent' ? OVERLAY_CONFIGS[activeOverlay].senecaHint : '';
      return {
        mode: 'rotation',
        text: overlayHint ? `${overlayHint} ${baseText}` : baseText,
        entityIds: insights[idx].entityIds,
      };
    }

    // Fallback — also overlay-aware
    const fallbackHint =
      activeOverlay !== 'urgent' ? OVERLAY_CONFIGS[activeOverlay].senecaHint : '';
    return {
      mode: 'rotation',
      text: fallbackHint || 'Governance intelligence active. Monitoring the Cardano network.',
      entityIds: [],
    };
  }, [
    bootPhase,
    hoveredNodeId,
    isDeadTime,
    insights,
    rotationIndex,
    bootNarration,
    temporalEpoch,
    activeOverlay,
  ]);

  const currentState = getState();

  return {
    mode: currentState.mode,
    currentText: currentState.text,
    revealedChars,
    bootComplete,
    rotationIndex,
    insights,
    isLoading,
    currentEntityIds: currentState.entityIds,
  };
}
