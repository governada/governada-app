import type { ChainActivityEvent } from '@/lib/chain/activityReplay';
import type { ConstellationNode3D } from '@/lib/constellation/types';

export const LAYER1_REPLAY_WINDOW_HOURS = 24;
export const LAYER1_INITIAL_REPLAY_MS = 60_000;

export const VOTE_PARTICLE_FADE_MS = 500;
export const VOTE_PARTICLE_MIN_SCALE = 1.0;
export const VOTE_PARTICLE_MAX_SCALE = 2.0;
export const VOTE_PARTICLE_INFLUENCE_MIN_ADA = 1;
export const VOTE_PARTICLE_INFLUENCE_MAX_ADA = 1_000_000_000;
export const VOTE_PARTICLE_BASE_SIZE = 0.045;
export const VOTE_PARTICLE_ARC_HEIGHT = 0.6;
export const VOTE_PARTICLE_COLOR_INTENSITY = 2.2;
export const VOTE_PARTICLE_ALPHA = 0.8;

export const RATIONALE_FLICKER_EMISSIVE_BUMP = 0.2;
export const RATIONALE_FLICKER_DURATION_MS = 300;
export const RATIONALE_FLICKER_SIZE_MULTIPLIER = 1.6;
export const RATIONALE_FLICKER_BASE_INTENSITY = 2.0;

export const TREASURY_AMBER_MIN_ADA = 10_000;
export const TREASURY_AMBER_MAX_ADA = 100_000_000;
export const TREASURY_AMBER_MIN_SATURATION = 0.1;
export const TREASURY_AMBER_MAX_SATURATION = 1.0;
export const TREASURY_AMBER_HUE_DEGREES = 36;
export const TREASURY_AMBER_BASE_SATURATION_PERCENT = 90;
export const TREASURY_AMBER_LIGHTNESS_PERCENT = 55;

export interface Layer1VoteParticlePlan {
  id: string;
  from: [number, number, number];
  to: [number, number, number];
  control: [number, number, number];
  color: string;
  sizeMultiplier: number;
  replayOffsetMs: number;
  alphaMultiplier: number;
}

export interface Layer1RationaleFlickerPlan {
  id: string;
  position: [number, number, number];
  color: string;
  replayOffsetMs: number;
  emissiveBump: number;
}

export interface Layer1RenderPlan {
  voteParticles: Layer1VoteParticlePlan[];
  rationaleFlickers: Layer1RationaleFlickerPlan[];
  proposalBrightness: Map<string, number>;
  proposalColorOverrides: Map<string, string>;
}

export function clampMotionStrength(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

export function scaleInfluenceToParticleSize(influenceLovelace: number | null): number {
  if (!influenceLovelace || influenceLovelace <= 0) return VOTE_PARTICLE_MIN_SCALE;

  const ada = influenceLovelace / 1_000_000;
  const minLog = Math.log10(VOTE_PARTICLE_INFLUENCE_MIN_ADA);
  const maxLog = Math.log10(VOTE_PARTICLE_INFLUENCE_MAX_ADA);
  const valueLog = Math.log10(Math.max(VOTE_PARTICLE_INFLUENCE_MIN_ADA, ada));
  const normalized = (valueLog - minLog) / (maxLog - minLog);
  const clamped = Math.max(0, Math.min(1, normalized));

  return VOTE_PARTICLE_MIN_SCALE + clamped * (VOTE_PARTICLE_MAX_SCALE - VOTE_PARTICLE_MIN_SCALE);
}

export function computeTreasuryAmberSaturation(withdrawalAmountLovelace: number | null): number {
  if (!withdrawalAmountLovelace || withdrawalAmountLovelace <= 0) {
    return TREASURY_AMBER_MIN_SATURATION;
  }

  const ada = withdrawalAmountLovelace / 1_000_000;
  const minLog = Math.log10(TREASURY_AMBER_MIN_ADA);
  const maxLog = Math.log10(TREASURY_AMBER_MAX_ADA);
  const valueLog = Math.log10(Math.max(TREASURY_AMBER_MIN_ADA, ada));
  const normalized = (valueLog - minLog) / (maxLog - minLog);
  const clamped = Math.max(0, Math.min(1, normalized));

  return (
    TREASURY_AMBER_MIN_SATURATION +
    clamped * (TREASURY_AMBER_MAX_SATURATION - TREASURY_AMBER_MIN_SATURATION)
  );
}

export function getTreasuryAmberColor(withdrawalAmountLovelace: number): string {
  const saturation =
    computeTreasuryAmberSaturation(withdrawalAmountLovelace) *
    TREASURY_AMBER_BASE_SATURATION_PERCENT;

  return `hsl(${TREASURY_AMBER_HUE_DEGREES}, ${Math.round(
    saturation,
  )}%, ${TREASURY_AMBER_LIGHTNESS_PERCENT}%)`;
}

export function computeVotingWindowProgress(
  nowSeconds: number,
  openedAtSeconds: number | null,
  closedAtSeconds: number | null,
): number {
  if (!openedAtSeconds || !closedAtSeconds || closedAtSeconds <= openedAtSeconds) return 0;
  return Math.max(
    0,
    Math.min(1, (nowSeconds - openedAtSeconds) / (closedAtSeconds - openedAtSeconds)),
  );
}

export function computeLayer1ReplayAgeMs(elapsedMs: number, replayOffsetMs: number): number {
  return elapsedMs - replayOffsetMs;
}

export function isLayer1ReplayVisible(
  elapsedMs: number,
  replayOffsetMs: number,
  fadeMs: number,
): boolean {
  const ageMs = computeLayer1ReplayAgeMs(elapsedMs, replayOffsetMs);
  return ageMs >= 0 && ageMs <= fadeMs;
}

function stableBucket(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % 1_000;
}

function eventPassesMotionRate(event: ChainActivityEvent, motionStrength: number): boolean {
  if (motionStrength <= 0) return false;
  if (motionStrength >= 1) return true;
  return stableBucket(event.id) < Math.round(motionStrength * 1_000);
}

function buildNodeLookup(nodes: ConstellationNode3D[]): Map<string, ConstellationNode3D> {
  const lookup = new Map<string, ConstellationNode3D>();
  for (const node of nodes) {
    lookup.set(node.id, node);
    lookup.set(node.fullId, node);
  }
  return lookup;
}

function getInitialReplayOffsetMs(
  timestamp: number,
  minTimestamp: number,
  maxTimestamp: number,
): number {
  const span = Math.max(1, maxTimestamp - minTimestamp);
  const normalized = Math.max(0, Math.min(1, (timestamp - minTimestamp) / span));
  return Math.round(normalized * Math.max(0, LAYER1_INITIAL_REPLAY_MS - VOTE_PARTICLE_FADE_MS));
}

function getReplayOffsetMs(
  event: ChainActivityEvent,
  minTimestamp: number,
  maxTimestamp: number,
  replayStartedAtMs: number,
): number {
  if (event.replayPhase === 'live' && event.observedAtMs != null) {
    return Math.max(0, event.observedAtMs - replayStartedAtMs);
  }

  return getInitialReplayOffsetMs(event.timestamp, minTimestamp, maxTimestamp);
}

function getArcControlPoint(
  from: [number, number, number],
  to: [number, number, number],
): [number, number, number] {
  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ];
  const length = Math.hypot(mid[0], mid[1], mid[2]) || 1;

  return [
    mid[0] + (mid[0] / length) * VOTE_PARTICLE_ARC_HEIGHT,
    mid[1] + (mid[1] / length) * VOTE_PARTICLE_ARC_HEIGHT,
    mid[2] + (mid[2] / length) * VOTE_PARTICLE_ARC_HEIGHT,
  ];
}

export function buildLayer1RenderPlan({
  events,
  nodes,
  motionStrength,
  replayStartedAtMs = 0,
}: {
  events: ChainActivityEvent[];
  nodes: ConstellationNode3D[];
  motionStrength: number;
  replayStartedAtMs?: number;
}): Layer1RenderPlan {
  const strength = clampMotionStrength(motionStrength);
  const nodeLookup = buildNodeLookup(nodes);
  const timedEvents = events.filter((event) => Number.isFinite(event.timestamp));
  const timestamps = timedEvents.map((event) => event.timestamp);
  const minTimestamp = timestamps.length ? Math.min(...timestamps) : 0;
  const maxTimestamp = timestamps.length ? Math.max(...timestamps) : minTimestamp + 1;

  const plan: Layer1RenderPlan = {
    voteParticles: [],
    rationaleFlickers: [],
    proposalBrightness: new Map(),
    proposalColorOverrides: new Map(),
  };

  if (strength <= 0) return plan;

  for (const event of timedEvents) {
    if (event.type === 'vote_cast') {
      if (!eventPassesMotionRate(event, strength)) continue;
      const voter = nodeLookup.get(event.voterNodeId) ?? nodeLookup.get(event.voterFullId);
      const proposal = nodeLookup.get(event.proposalNodeId) ?? nodeLookup.get(event.proposalKey);
      if (!voter || !proposal) continue;

      plan.voteParticles.push({
        id: event.id,
        from: voter.position,
        to: proposal.position,
        control: getArcControlPoint(voter.position, proposal.position),
        color: event.voterIdentityColor,
        sizeMultiplier: scaleInfluenceToParticleSize(event.influenceLovelace),
        replayOffsetMs: getReplayOffsetMs(event, minTimestamp, maxTimestamp, replayStartedAtMs),
        alphaMultiplier: strength,
      });
      continue;
    }

    if (event.type === 'rationale_published') {
      if (!eventPassesMotionRate(event, strength)) continue;
      const drep = nodeLookup.get(event.drepNodeId) ?? nodeLookup.get(event.drepFullId);
      if (!drep) continue;

      plan.rationaleFlickers.push({
        id: event.id,
        position: drep.position,
        color: event.drepIdentityColor,
        replayOffsetMs: getReplayOffsetMs(event, minTimestamp, maxTimestamp, replayStartedAtMs),
        emissiveBump: RATIONALE_FLICKER_EMISSIVE_BUMP,
      });
      continue;
    }

    if (event.type === 'proposal_voting_window_progress') {
      const proposal = nodeLookup.get(event.proposalNodeId) ?? nodeLookup.get(event.proposalKey);
      if (proposal) {
        plan.proposalBrightness.set(proposal.id, event.progress * strength);
      }
      continue;
    }

    if (event.type === 'treasury_proposal_amber') {
      const proposal = nodeLookup.get(event.proposalNodeId) ?? nodeLookup.get(event.proposalKey);
      if (proposal) {
        plan.proposalColorOverrides.set(
          proposal.id,
          getTreasuryAmberColor(event.withdrawalAmountLovelace),
        );
      }
    }
  }

  return plan;
}
