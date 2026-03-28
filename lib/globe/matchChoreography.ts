/**
 * matchChoreography — Cinematic globe choreography for the match flow.
 *
 * Uses `cinematic` GlobeCommands that drive per-frame smooth transitions:
 * camera orbits continuously, nodes glow/dim with exponential smoothing,
 * and everything transitions fluidly instead of snapping between states.
 *
 * The `sequence` command chains cinematic states with delays for the
 * reveal countdown, but each step transitions smoothly (not discretely).
 *
 * Used by both CerebroMatchFlow and SenecaMatch.
 */

import type { GlobeCommand } from '@/hooks/useSenecaGlobeBridge';

type SequenceStep = { command: GlobeCommand; delayMs: number };

// ---------------------------------------------------------------------------
// Stage 0: Match Start — "Seneca is waking up, scanning the constellation"
// Globe dims, orbit accelerates, camera pulls back to galaxy view
// ---------------------------------------------------------------------------

export function buildMatchStartSequence(): GlobeCommand {
  return {
    type: 'sequence',
    steps: [
      // Cinematic: start orbital motion + zoom out (smooth per-frame transition)
      {
        command: {
          type: 'cinematic',
          state: { orbitSpeed: 0.8, dollyTarget: 22, dimTarget: 0.85, transitionDuration: 1.2 },
        },
        delayMs: 0,
      },
      // Also dim via existing command (drives the match highlight state)
      { command: { type: 'dim' }, delayMs: 100 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Stages 1-4: Answer Choreography — progressive narrowing with smooth orbit
// Each answer: scan sweep + highlight narrowing + orbit deceleration + zoom in
// ---------------------------------------------------------------------------

export function buildAnswerSequence(
  roundIndex: number,
  alignment: number[],
  threshold: number,
): GlobeCommand {
  // Progressive orbit deceleration: 0.6 → 0.45 → 0.3 → 0.15
  const orbitSpeed = 0.6 - roundIndex * 0.15;
  // Progressive zoom-in: 20 → 17 → 14 → 11
  const dollyTarget = 20 - roundIndex * 3;
  // Progressive dimming of non-matches
  const dimTarget = 0.7 + roundIndex * 0.08;
  // Faster transitions in later rounds (urgency builds)
  const transitionDuration = 1.0 - roundIndex * 0.1;

  const steps: SequenceStep[] = [
    // Smooth cinematic state update (orbit + zoom transition over time)
    {
      command: {
        type: 'cinematic',
        state: { orbitSpeed, dollyTarget, dimTarget, transitionDuration },
      },
      delayMs: 0,
    },
  ];

  // Early rounds: scan sweep for visual drama
  if (roundIndex <= 1) {
    steps.push({
      command: { type: 'scan', alignment, durationMs: 800 - roundIndex * 200 },
      delayMs: 100,
    });
  }

  // Highlight with appropriate zoom behavior
  steps.push({
    command: {
      type: 'highlight',
      alignment,
      threshold,
      noZoom: roundIndex <= 1, // Q1-Q2: no camera snap (cinematic handles zoom)
      zoomToCluster: roundIndex >= 2, // Q3-Q4: camera drifts toward cluster
    },
    delayMs: roundIndex <= 1 ? 900 : 0,
  });

  return { type: 'sequence', steps };
}

// ---------------------------------------------------------------------------
// Stage 5: Match Reveal — dramatic blackout → countdown 5→4→3→2→1
// Each match fades in smoothly (cinematic transition), camera sweeps to #1
// ---------------------------------------------------------------------------

export function buildRevealSequence(
  topMatches: Array<{ nodeId: string }>,
  alignment: number[],
  threshold: number,
): GlobeCommand {
  const steps: SequenceStep[] = [];

  // Phase 1: Total darkness — orbit near-stopped, close-up
  steps.push({
    command: {
      type: 'cinematic',
      state: { orbitSpeed: 0.05, dollyTarget: 12, dimTarget: 1.0, transitionDuration: 0.8 },
    },
    delayMs: 0,
  });
  steps.push({ command: { type: 'dim' }, delayMs: 100 });

  // Phase 2: Countdown reveal — matches emerge one by one
  const reversed = [...topMatches].reverse().slice(0, 5);
  let accDelay = 1000; // initial dramatic pause

  for (let i = 0; i < reversed.length; i++) {
    const match = reversed[i];
    const isTopMatch = i === reversed.length - 1;
    const pauseBefore = isTopMatch ? 700 : 400;

    // Flash + pulse each match (these animate smoothly thanks to per-frame lerp)
    steps.push({ command: { type: 'flash', nodeId: match.nodeId }, delayMs: pauseBefore });
    steps.push({ command: { type: 'pulse', nodeId: match.nodeId }, delayMs: 200 });
    accDelay += pauseBefore + 200;
  }

  // Phase 3: Camera sweeps to top match
  if (topMatches.length > 0) {
    steps.push({
      command: {
        type: 'cinematic',
        state: { dollyTarget: 10, orbitSpeed: 0.15, transitionDuration: 1.5 },
      },
      delayMs: 400,
    });
    steps.push({ command: { type: 'flyTo', nodeId: topMatches[0].nodeId }, delayMs: 300 });
  }

  // Phase 4: All matches re-illuminate, gentle orbit resumes
  steps.push({
    command: {
      type: 'cinematic',
      state: { orbitSpeed: 0.2, transitionDuration: 1.0 },
    },
    delayMs: 500,
  });
  steps.push({
    command: { type: 'highlight', alignment, threshold, noZoom: true },
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
      // Restore normal orbit speed and camera distance
      {
        command: {
          type: 'cinematic',
          state: { orbitSpeed: 0, dollyTarget: 14, dimTarget: 0, transitionDuration: 1.0 },
        },
        delayMs: 0,
      },
      { command: { type: 'clear' }, delayMs: 200 },
      { command: { type: 'setRotation', speed: 1 }, delayMs: 300 },
      { command: { type: 'reset' }, delayMs: 500 },
    ],
  };
}
