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
 * Sequence: dim(0ms) → pause(800ms) → flash runners-up(500ms each) → flash #2(600ms)
 *   → flash #1(900ms) → flyTo delay(600ms) + 3s hold
 */
export function getRevealDurationMs(matchCount: number): number {
  const clampedCount = Math.min(matchCount, 5);
  if (clampedCount === 0) return 0;
  // 800ms tension pause + runner-up flashes + #2 flash + #1 flash + flyTo delay + 3s hold
  const runnerUpCount = Math.max(0, clampedCount - 2); // 5th, 4th, 3rd place
  const flashMs = runnerUpCount * 500 + (clampedCount >= 2 ? 600 : 0) + 900;
  return 800 + flashMs + 600 + 3000;
}

// ---------------------------------------------------------------------------
// Stage 0: Match Start — light all DReps, dim rest, camera pulls back
// ---------------------------------------------------------------------------

export function buildMatchStartSequence(): GlobeCommand {
  return {
    type: 'sequence',
    steps: [
      // Phase 1: Brief total darkness — the "powering down" before powering up
      { command: { type: 'dim' }, delayMs: 0 },
      // Phase 2: DReps illuminate outward as expanding shockwave (delays computed in matchStart)
      { command: { type: 'matchStart' }, delayMs: 400 },
      // Phase 3: Cinematic pullback — slow orbit, camera retreats for panoramic view
      {
        command: {
          type: 'cinematic',
          state: {
            orbitSpeed: 0.015, // slower, more deliberate scanning feel
            dollyTarget: 20,
            dimTarget: 0.7,
            transitionDuration: 2.0, // longer transition for smooth pullback
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

/** Progressive narrowing: how many DRep nodes to highlight per round.
 *  Q1: wide field (200). Q2: focused cluster (50). Q3: tight group (10). Q4: finalists (5). */
const TOP_N_PER_ROUND = [200, 50, 10, 5];

/** Scan progress per round (0-1): drives unfocused node fade intensity */
const SCAN_PROGRESS_PER_ROUND = [0.15, 0.4, 0.7, 0.95];

export function buildAnswerSequence(
  roundIndex: number,
  alignment: number[],
  _threshold: number,
): GlobeCommand {
  const topN = TOP_N_PER_ROUND[roundIndex] ?? 5;
  const scanProgress = SCAN_PROGRESS_PER_ROUND[roundIndex] ?? 0.95;

  // Single highlight command with topN — the globe computes the closest N DReps
  // and flies the camera to their centroid. Each round approaches from a different angle.
  return {
    type: 'highlight',
    alignment,
    threshold: 9999, // ignored when topN is set, but required by type
    drepOnly: true,
    zoomToCluster: true,
    cameraAngle: DIVE_ANGLES[roundIndex] ?? 0,
    cameraElevation: DIVE_ELEVATIONS[roundIndex] ?? 0,
    topN,
    scanProgressOverride: scanProgress,
  };
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

  // Phase 1: Tension build — dim everything, slow cinematic orbit
  steps.push({ command: { type: 'dim' }, delayMs: 0 });
  steps.push({
    command: {
      type: 'cinematic',
      state: { orbitSpeed: 0.008, dollyTarget: 14, dimTarget: 1, transitionDuration: 0.5 },
    },
    delayMs: 0,
  });

  // Phase 2: Dramatic pause — darkness builds anticipation (800ms of nothing)
  // The first flash carries the 800ms delay

  // Phase 3: Sequential illumination — top 5 in reverse (5th→4th→3rd→2nd→1st)
  // Escalating delays: 500ms for runners-up, 600ms for #2, 900ms for #1
  const reversed = [...topMatches].reverse().slice(0, 5);
  for (let i = 0; i < reversed.length; i++) {
    const match = reversed[i];
    const isTop = i === reversed.length - 1; // #1 match
    const isSecond = i === reversed.length - 2; // #2 match
    const isFirst = i === 0; // first flash (carries the dramatic pause)
    let delayMs: number;
    if (isFirst)
      delayMs = 800; // includes dramatic pause
    else if (isTop)
      delayMs = 900; // longest anticipation for #1
    else if (isSecond) delayMs = 600;
    else delayMs = 500;
    steps.push({ command: { type: 'flash', nodeId: match.nodeId }, delayMs });
  }

  // Phase 4: Lock-on — stop orbit, then dramatic fly to #1
  steps.push({
    command: {
      type: 'cinematic',
      state: { orbitSpeed: 0, dollyTarget: 14, dimTarget: 1, transitionDuration: 0.3 },
    },
    delayMs: 200,
  });
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
