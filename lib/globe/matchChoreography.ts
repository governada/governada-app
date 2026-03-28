/**
 * matchChoreography — Theatrical globe animation sequences for the match flow.
 *
 * Each match stage dispatches a choreographed `sequence` GlobeCommand that
 * makes the constellation feel alive: spinning up, scanning, narrowing,
 * then a dramatic countdown reveal.
 *
 * Used by both CerebroMatchFlow and SenecaMatch.
 */

import type { GlobeCommand } from '@/hooks/useSenecaGlobeBridge';

type SequenceStep = { command: GlobeCommand; delayMs: number };

// ---------------------------------------------------------------------------
// Stage 0: Match Start — "Seneca is waking up"
// ---------------------------------------------------------------------------

export function buildMatchStartSequence(): GlobeCommand {
  const steps: SequenceStep[] = [
    { command: { type: 'dim' }, delayMs: 0 },
    { command: { type: 'setRotation', speed: 3 }, delayMs: 200 },
    { command: { type: 'zoomOut', distance: 22 }, delayMs: 300 },
  ];
  return { type: 'sequence', steps };
}

// ---------------------------------------------------------------------------
// Stages 1-4: Answer Choreography — progressive narrowing
// ---------------------------------------------------------------------------

export function buildAnswerSequence(
  roundIndex: number,
  alignment: number[],
  threshold: number,
): GlobeCommand {
  switch (roundIndex) {
    case 0:
      // Q1: Wide glow sweep — "the constellation starts responding"
      return {
        type: 'sequence',
        steps: [
          { command: { type: 'scan', alignment, durationMs: 800 }, delayMs: 0 },
          {
            command: { type: 'highlight', alignment, threshold, noZoom: true },
            delayMs: 900,
          },
          { command: { type: 'setRotation', speed: 2 }, delayMs: 100 },
        ],
      };

    case 1:
      // Q2: Tighter sweep + camera drifts toward cluster
      return {
        type: 'sequence',
        steps: [
          { command: { type: 'scan', alignment, durationMs: 600 }, delayMs: 0 },
          {
            command: { type: 'highlight', alignment, threshold, zoomToCluster: true },
            delayMs: 700,
          },
          { command: { type: 'setRotation', speed: 1.5 }, delayMs: 100 },
        ],
      };

    case 2:
      // Q3: Tight cluster, camera moves in — "holding its breath"
      return {
        type: 'sequence',
        steps: [
          {
            command: { type: 'highlight', alignment, threshold, zoomToCluster: true },
            delayMs: 0,
          },
          { command: { type: 'setRotation', speed: 0.8 }, delayMs: 600 },
        ],
      };

    case 3:
    default:
      // Q4: Brief blackout → tight cluster emerges — "matches crystallize"
      return {
        type: 'sequence',
        steps: [
          { command: { type: 'dim' }, delayMs: 0 },
          {
            command: { type: 'highlight', alignment, threshold, zoomToCluster: true },
            delayMs: 500,
          },
          { command: { type: 'setRotation', speed: 0.3 }, delayMs: 200 },
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Stage 5: Match Reveal — dramatic countdown 5→4→3→2→1
// ---------------------------------------------------------------------------

export function buildRevealSequence(
  topMatches: Array<{ nodeId: string }>,
  alignment: number[],
  threshold: number,
): GlobeCommand {
  const steps: SequenceStep[] = [];
  let delay = 0;

  // Total darkness
  steps.push({ command: { type: 'dim' }, delayMs: 0 });
  delay += 800; // dramatic pause

  // Reveal matches from worst to best (5→1)
  const reversed = [...topMatches].reverse().slice(0, 5);
  for (let i = 0; i < reversed.length; i++) {
    const match = reversed[i];
    const isTopMatch = i === reversed.length - 1;
    const pauseBefore = isTopMatch ? 600 : 350; // longer pause before #1

    steps.push({ command: { type: 'flash', nodeId: match.nodeId }, delayMs: pauseBefore });
    steps.push({ command: { type: 'pulse', nodeId: match.nodeId }, delayMs: 150 });
    delay += pauseBefore + 150;
  }

  // Camera sweeps to the #1 match
  if (topMatches.length > 0) {
    steps.push({ command: { type: 'flyTo', nodeId: topMatches[0].nodeId }, delayMs: 400 });
    delay += 400;
  }

  // Gentle rotation resumes + all matches re-illuminate
  steps.push({ command: { type: 'setRotation', speed: 0.5 }, delayMs: 300 });
  steps.push({
    command: { type: 'highlight', alignment, threshold, noZoom: true },
    delayMs: 200,
  });

  return { type: 'sequence', steps };
}

// ---------------------------------------------------------------------------
// Cleanup: restore globe to normal state
// ---------------------------------------------------------------------------

export function buildMatchCleanupSequence(): GlobeCommand {
  return {
    type: 'sequence',
    steps: [
      { command: { type: 'clear' }, delayMs: 0 },
      { command: { type: 'setRotation', speed: 1 }, delayMs: 200 },
      { command: { type: 'reset' }, delayMs: 300 },
    ],
  };
}
