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
 * Used by SenecaMatch to orchestrate the globe during the match flow.
 */

import type { GlobeCommand } from '@/hooks/useSenecaGlobeBridge';

type SequenceStep = { command: GlobeCommand; delayMs: number };

// Camera dive waypoints per round — each approaches from a different angle
const DIVE_ANGLES = [0.5, -0.8, 0.2, 0]; // azimuth offset (radians)
const DIVE_ELEVATIONS = [0.3, 0, -0.25, 0]; // vertical offset (radians)

// ---------------------------------------------------------------------------
// Reveal timing — exported so SenecaMatch can sync overlay/countdown UI
// ---------------------------------------------------------------------------

/**
 * Total duration from the start of the reveal sequence to when the overlay
 * should appear. Depends on match count (up to 5 flash steps).
 *
 * Sequence: dim(0ms) → flash non-top(350ms each) → flash top(600ms) → matchFlyTo(400ms) + 3s hold
 */
export function getRevealDurationMs(matchCount: number): number {
  const clampedCount = Math.min(matchCount, 5);
  if (clampedCount === 0) return 0;
  // Non-top flashes + top flash + flyTo delay + 3s hold for the flyToMatch lock
  const flashMs = (clampedCount - 1) * 350 + 600;
  return flashMs + 400 + 3000;
}

// ---------------------------------------------------------------------------
// Stage 0: Match Start — light all DReps, dim rest, camera pulls back
// ---------------------------------------------------------------------------

export function buildMatchStartSequence(): GlobeCommand {
  return {
    type: 'sequence',
    steps: [
      // Light all DRep nodes, dim non-DReps — the "entering Cerebro" moment
      { command: { type: 'matchStart' }, delayMs: 0 },
      // Cinematic ambient: slow orbit, camera pulls back for panoramic view
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
        delayMs: 200,
      },
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
      drepOnly: true,
      zoomToCluster: true,
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
  _alignment: number[],
  _threshold: number,
): GlobeCommand {
  const steps: SequenceStep[] = [];

  if (topMatches.length === 0) {
    return { type: 'sequence', steps };
  }

  // Phase 1: Dim everything except matches — stay where the camera is (no pullback)
  steps.push({ command: { type: 'dim' }, delayMs: 0 });

  // Phase 2: Brief pause for the dimming to register, then flash top 5 matches
  // Flashes happen quickly — no long countdown, just a rapid "here they are" reveal
  const reversed = [...topMatches].reverse().slice(0, 5);
  for (let i = 0; i < reversed.length; i++) {
    const match = reversed[i];
    const isTopMatch = i === reversed.length - 1;
    steps.push({
      command: { type: 'flash', nodeId: match.nodeId },
      delayMs: isTopMatch ? 600 : 350,
    });
  }

  // Phase 3: Graceful fly to #1 match from current camera position — no jarring reset
  steps.push({
    command: { type: 'matchFlyTo', nodeId: topMatches[0].nodeId },
    delayMs: 400,
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
