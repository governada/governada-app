/**
 * matchChoreography — Cerebro-style dive-through camera choreography.
 *
 * The camera dives INTO the constellation, weaving between nodes as it
 * progressively narrows toward DRep matches. Each answer approaches from
 * a different angle, creating the "hunting for your DRep" sensation.
 *
 * Globe rotates very slowly during match (ambient life) while the camera
 * does all the intentional motion. Non-DRep nodes are aggressively muted.
 *
 * Used by both CerebroMatchFlow and SenecaMatch.
 */

import type { GlobeCommand } from '@/hooks/useSenecaGlobeBridge';

type SequenceStep = { command: GlobeCommand; delayMs: number };

// Camera dive waypoints per round — each approaches from a different angle
const DIVE_ANGLES = [0.5, -0.8, 0.2, 0]; // azimuth offset (radians)
const DIVE_ELEVATIONS = [0.3, 0, -0.25, 0]; // vertical offset (radians)

// ---------------------------------------------------------------------------
// Stage 0: Match Start — camera pulls back, slow ambient rotation begins
// ---------------------------------------------------------------------------

export function buildMatchStartSequence(): GlobeCommand {
  return {
    type: 'sequence',
    steps: [
      // Very slow ambient rotation (scene stays alive while user reads questions)
      {
        command: {
          type: 'cinematic',
          state: {
            orbitSpeed: 0.02, // ~5 min/revolution — subtle ambient life
            dollyTarget: 20,
            dimTarget: 0.7,
            transitionDuration: 1.5,
          },
        },
        delayMs: 0,
      },
      { command: { type: 'dim' }, delayMs: 100 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Stages 1-4: Dive-through camera — weaving toward DRep cluster
// ---------------------------------------------------------------------------

export function buildAnswerSequence(
  roundIndex: number,
  alignment: number[],
  threshold: number,
): GlobeCommand {
  const steps: SequenceStep[] = [];

  // Q1 only: initial scan sweep to establish the visual language
  if (roundIndex === 0) {
    steps.push({
      command: { type: 'scan', alignment, durationMs: 800 },
      delayMs: 0,
    });
  }

  // Highlight DReps only, with camera dive angle for this round
  // The camera angle + zoomToCluster drives the smooth dive-through motion
  steps.push({
    command: {
      type: 'highlight',
      alignment,
      threshold,
      nodeTypeFilter: 'drep',
      zoomToCluster: true, // triggers smooth camera flight to cluster centroid
      cameraAngle: DIVE_ANGLES[roundIndex] ?? 0,
      cameraElevation: DIVE_ELEVATIONS[roundIndex] ?? 0,
    },
    delayMs: roundIndex === 0 ? 900 : 200,
  });

  return { type: 'sequence', steps };
}

// ---------------------------------------------------------------------------
// Stage 5: Match Reveal — blackout → countdown 5→4→3→2→1 → fly to #1
// ---------------------------------------------------------------------------

export function buildRevealSequence(
  topMatches: Array<{ nodeId: string }>,
  alignment: number[],
  threshold: number,
): GlobeCommand {
  const steps: SequenceStep[] = [];

  // Phase 1: Total darkness — camera near-stopped
  steps.push({
    command: {
      type: 'cinematic',
      state: { orbitSpeed: 0.01, dollyTarget: 12, dimTarget: 1.0, transitionDuration: 1.0 },
    },
    delayMs: 0,
  });
  steps.push({ command: { type: 'dim' }, delayMs: 100 });

  // Phase 2: Countdown reveal — matches emerge one by one (5→1)
  const reversed = [...topMatches].reverse().slice(0, 5);

  for (let i = 0; i < reversed.length; i++) {
    const match = reversed[i];
    const isTopMatch = i === reversed.length - 1;
    const pauseBefore = isTopMatch ? 800 : 450;

    steps.push({ command: { type: 'flash', nodeId: match.nodeId }, delayMs: pauseBefore });
    steps.push({ command: { type: 'pulse', nodeId: match.nodeId }, delayMs: 200 });
  }

  // Phase 3: Camera dives to top match
  if (topMatches.length > 0) {
    steps.push({
      command: {
        type: 'cinematic',
        state: { dollyTarget: 10, orbitSpeed: 0.015, transitionDuration: 1.5 },
      },
      delayMs: 500,
    });
    steps.push({ command: { type: 'flyTo', nodeId: topMatches[0].nodeId }, delayMs: 300 });
  }

  // Phase 4: All matches re-illuminate (DReps only)
  steps.push({
    command: { type: 'cinematic', state: { orbitSpeed: 0.02, transitionDuration: 1.0 } },
    delayMs: 600,
  });
  steps.push({
    command: { type: 'highlight', alignment, threshold, noZoom: true, nodeTypeFilter: 'drep' },
    delayMs: 200,
  });

  return { type: 'sequence', steps };
}

// ---------------------------------------------------------------------------
// Cleanup: restore globe to normal
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
