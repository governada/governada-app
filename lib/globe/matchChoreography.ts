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

/** Delay per countdown flash step (non-top matches) */
const COUNTDOWN_STEP_MS = 650; // 450 pause + 200 flash
/** Delay for the top match reveal (longer pause for drama) */
const COUNTDOWN_TOP_MS = 1000; // 800 pause + 200 flash
/** Post-countdown camera fly + re-illuminate */
const POST_COUNTDOWN_MS = 1600; // cinematic 500 + flyTo 300 + cinematic 600 + highlight 200

/**
 * Total duration from the start of the reveal sequence to when the overlay
 * should appear. Depends on match count (up to 5 countdown steps).
 */
export function getRevealDurationMs(matchCount: number): number {
  const clampedCount = Math.min(matchCount, 5);
  if (clampedCount === 0) return 0;
  // 100ms initial dim + countdown steps + post-countdown
  const countdownMs =
    100 + (clampedCount - 1) * COUNTDOWN_STEP_MS + COUNTDOWN_TOP_MS + POST_COUNTDOWN_MS;
  return countdownMs;
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

  // Phase 3: Dramatic fly to top match (uses matchFlyTo for the 3-second cinematic lock)
  if (topMatches.length > 0) {
    steps.push({
      command: {
        type: 'cinematic',
        state: { dollyTarget: 10, orbitSpeed: 0.015, transitionDuration: 1.5 },
      },
      delayMs: 500,
    });
    steps.push({ command: { type: 'matchFlyTo', nodeId: topMatches[0].nodeId }, delayMs: 300 });
  }

  // Phase 4: All matches re-illuminate (DReps only)
  steps.push({
    command: { type: 'cinematic', state: { orbitSpeed: 0.02, transitionDuration: 1.0 } },
    delayMs: 600,
  });
  steps.push({
    command: { type: 'highlight', alignment, threshold, noZoom: true, drepOnly: true },
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
