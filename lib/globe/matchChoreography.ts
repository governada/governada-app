/**
 * matchChoreography — Cinematic globe choreography for the match flow.
 *
 * Uses `cinematic` GlobeCommands that drive per-frame smooth transitions:
 * camera orbits gently, DRep nodes progressively narrow toward matches,
 * and everything transitions fluidly.
 *
 * Key design principles:
 * - Only DRep nodes highlight (nodeTypeFilter: 'drep') — SPO/CC/proposals stay dimmed
 * - Each round additively narrows the highlighted set (no full reset between rounds)
 * - Orbit speed is subtle — user should focus on the converging nodes, not the spinning
 * - The reveal is a deliberate countdown that hones in on the final matches
 *
 * Used by both CerebroMatchFlow and SenecaMatch.
 */

import type { GlobeCommand } from '@/hooks/useSenecaGlobeBridge';

type SequenceStep = { command: GlobeCommand; delayMs: number };

// ---------------------------------------------------------------------------
// Stage 0: Match Start — subtle spin-up, camera pulls back
// ---------------------------------------------------------------------------

export function buildMatchStartSequence(): GlobeCommand {
  return {
    type: 'sequence',
    steps: [
      {
        command: {
          type: 'cinematic',
          state: { orbitSpeed: 0.35, dollyTarget: 20, dimTarget: 0.8, transitionDuration: 1.5 },
        },
        delayMs: 0,
      },
      { command: { type: 'dim' }, delayMs: 100 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Stages 1-4: Progressive narrowing — each answer tightens the DRep focus
// No scan sweeps after Q1 to avoid "jumpiness" — just smooth narrowing
// ---------------------------------------------------------------------------

export function buildAnswerSequence(
  roundIndex: number,
  alignment: number[],
  threshold: number,
): GlobeCommand {
  // Gentle orbit deceleration: 0.3 → 0.22 → 0.15 → 0.08
  const orbitSpeed = 0.3 - roundIndex * 0.075;
  // Progressive zoom-in: 19 → 16 → 13 → 11
  const dollyTarget = 19 - roundIndex * 2.5;
  // Faster transitions in later rounds (urgency builds)
  const transitionDuration = 1.2 - roundIndex * 0.15;

  const steps: SequenceStep[] = [
    // Smooth cinematic state update (orbit + zoom)
    {
      command: {
        type: 'cinematic',
        state: { orbitSpeed, dollyTarget, transitionDuration },
      },
      delayMs: 0,
    },
  ];

  // Q1 only: one scan sweep to establish the visual language
  if (roundIndex === 0) {
    steps.push({
      command: { type: 'scan', alignment, durationMs: 800 },
      delayMs: 100,
    });
  }

  // Highlight with DRep-only filter — this is the key convergence step
  steps.push({
    command: {
      type: 'highlight',
      alignment,
      threshold,
      nodeTypeFilter: 'drep',
      noZoom: roundIndex <= 1,
      zoomToCluster: roundIndex >= 2,
    },
    delayMs: roundIndex === 0 ? 900 : 200, // Q1 waits for scan; Q2-Q4 transition immediately
  });

  return { type: 'sequence', steps };
}

// ---------------------------------------------------------------------------
// Stage 5: Match Reveal — blackout → countdown 5→4→3→2→1 → camera to #1
// ---------------------------------------------------------------------------

export function buildRevealSequence(
  topMatches: Array<{ nodeId: string }>,
  alignment: number[],
  threshold: number,
): GlobeCommand {
  const steps: SequenceStep[] = [];

  // Phase 1: Total darkness — orbit nearly stopped, close-up
  steps.push({
    command: {
      type: 'cinematic',
      state: { orbitSpeed: 0.03, dollyTarget: 12, dimTarget: 1.0, transitionDuration: 1.0 },
    },
    delayMs: 0,
  });
  steps.push({ command: { type: 'dim' }, delayMs: 100 });

  // Phase 2: Countdown reveal — matches emerge one by one (5→1)
  const reversed = [...topMatches].reverse().slice(0, 5);
  let accDelay = 1200; // dramatic pause before first reveal

  for (let i = 0; i < reversed.length; i++) {
    const match = reversed[i];
    const isTopMatch = i === reversed.length - 1;
    const pauseBefore = isTopMatch ? 800 : 450;

    steps.push({ command: { type: 'flash', nodeId: match.nodeId }, delayMs: pauseBefore });
    steps.push({ command: { type: 'pulse', nodeId: match.nodeId }, delayMs: 200 });
    accDelay += pauseBefore + 200;
  }

  // Phase 3: Camera sweeps to top match
  if (topMatches.length > 0) {
    steps.push({
      command: {
        type: 'cinematic',
        state: { dollyTarget: 10, orbitSpeed: 0.1, transitionDuration: 1.5 },
      },
      delayMs: 500,
    });
    steps.push({ command: { type: 'flyTo', nodeId: topMatches[0].nodeId }, delayMs: 300 });
  }

  // Phase 4: All matches re-illuminate (DReps only), gentle orbit
  steps.push({
    command: { type: 'cinematic', state: { orbitSpeed: 0.12, transitionDuration: 1.0 } },
    delayMs: 500,
  });
  steps.push({
    command: { type: 'highlight', alignment, threshold, noZoom: true, nodeTypeFilter: 'drep' },
    delayMs: 200,
  });

  return { type: 'sequence', steps };
}

// ---------------------------------------------------------------------------
// Cleanup: smoothly restore globe to normal state
// ---------------------------------------------------------------------------

export function buildMatchCleanupSequence(): GlobeCommand {
  return {
    type: 'sequence',
    steps: [
      {
        command: {
          type: 'cinematic',
          state: { orbitSpeed: 0, dollyTarget: 14, dimTarget: 0, transitionDuration: 1.0 },
        },
        delayMs: 0,
      },
      { command: { type: 'clear' }, delayMs: 300 },
      { command: { type: 'setRotation', speed: 1 }, delayMs: 400 },
      { command: { type: 'reset' }, delayMs: 600 },
    ],
  };
}
