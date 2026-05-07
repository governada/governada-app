import type { AnchoredCardDescriptor, AnchoredCardKind } from '@/components/globe/AnchoredCard';
import type { BehaviorContext, GlobeBehavior } from '@/lib/globe/behaviors/types';
import { getSharedIntent, setSharedIntent } from '@/lib/globe/focusIntent';
import type {
  CinematicArrivalCommand,
  CinematicCommandType,
  GlobeCommand,
} from '@/lib/globe/types';
import {
  proposalNodeId,
  governanceNodeId,
  readTier0TriggersFromPayload,
  type SerializedTier0AffectedRegion,
} from '@/lib/governance/tier0AffectedRegion';

export interface CinematicBehaviorConfig {
  id: string;
  commandType: CinematicCommandType;
  run: (command: CinematicArrivalCommand, ctx: BehaviorContext) => void;
}

export function createCinematicBehavior(config: CinematicBehaviorConfig): GlobeBehavior {
  return {
    id: config.id,
    handles: [config.commandType],
    execute(command: GlobeCommand, ctx: BehaviorContext) {
      if (command.type !== config.commandType) return;
      config.run(command, ctx);
    },
    cleanup() {
      const current = getSharedIntent();
      if (current.focusedIds !== null) {
        setSharedIntent({ focusedIds: null });
      }
    },
  };
}

export function establishCamera(ctx: BehaviorContext, dollyTarget = 18): void {
  ctx.dispatch({
    type: 'cinematic',
    state: {
      orbitSpeed: 0.003,
      dollyTarget,
      dimTarget: 0,
      transitionDuration: 1.5,
    },
  });
}

export function focusNodes(
  nodeIds: string[],
  options: {
    proximity?: 'overview' | 'cluster' | 'tight' | 'locked';
    dimStrength?: number;
    focusColor?: string;
    pulse?: boolean;
    focusSizeBoost?: number;
    intensity?: number;
    fly?: boolean;
  } = {},
): void {
  const ids = nodeIds.filter(Boolean);
  if (ids.length === 0) return;

  const focusedIds = new Set(ids);
  const intensities = new Map(ids.map((id) => [id, options.intensity ?? 1]));

  setSharedIntent({
    focusedIds,
    intensities,
    flyToFocus: options.fly ?? true,
    cameraProximity: options.proximity ?? (ids.length === 1 ? 'tight' : 'cluster'),
    dimStrength: options.dimStrength ?? 0.55,
    focusColor: options.focusColor,
    focusSizeBoost: options.focusSizeBoost ?? 1.18,
    bloomIntensity: options.pulse ? 1.1 : 0.7,
    atmosphereTemperature: 0.45,
    transitionDuration: 1.5,
    easingCurve: 'ease-in-out',
    pulsingNodeIds: options.pulse ? focusedIds : undefined,
    pulseFrequency: options.pulse ? 1.1 : undefined,
  });
}

export function ambientCluster(): void {
  setSharedIntent({
    focusedIds: null,
  });
}

export function dispatchPanel(
  ctx: BehaviorContext,
  command: CinematicArrivalCommand,
  presentation: Extract<GlobeCommand, { type: 'senecaPanel' }>['presentation'],
  open = true,
): void {
  ctx.dispatch({
    type: 'senecaPanel',
    open,
    state: command.cinematicState,
    itemId: command.itemId,
    reasoning: command.reasoning,
    presentation,
  });
}

export function dispatchCards(
  ctx: BehaviorContext,
  command: CinematicArrivalCommand,
  cards: AnchoredCardDescriptor[],
): void {
  ctx.dispatch({
    type: 'anchoredCards',
    state: command.cinematicState,
    itemId: command.itemId,
    cards,
  });
}

export function nodeIdFromValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? governanceNodeId(value.trim()) : null;
}

export function userNodeId(payload: unknown): string {
  const stakeAddress = readString(payload, 'stakeAddress') ?? readString(payload, 'stake_address');
  return `user-${stakeAddress ?? 'self'}`;
}

export function delegatedDrepNodeId(payload: unknown): string | null {
  return nodeIdFromValue(readString(payload, 'delegatedDrepId') ?? readString(payload, 'drepId'));
}

export function changedNodeId(payload: unknown): string {
  const direct =
    readString(payload, 'nodeId') ??
    readString(payload, 'drepId') ??
    readString(payload, 'poolId') ??
    readString(payload, 'ccHotId');
  if (direct) return governanceNodeId(direct);

  const proposal = proposalSignal(payload);
  if (proposal) return proposalNodeId(proposal.txHash, proposal.proposalIndex);

  return readString(payload, 'id') ?? 'score-momentum-drop';
}

export function firstProposalNodeId(payload: unknown): string {
  const signal = proposalSignal(payload);
  if (signal) return proposalNodeId(signal.txHash, signal.proposalIndex);

  const opportunities = readArray(payload, 'opportunities');
  const first = opportunities[0];
  const opportunity = proposalSignal(first);
  if (opportunity) return proposalNodeId(opportunity.txHash, opportunity.proposalIndex);

  const items = readArray(payload, 'items');
  const actionHref = readString(items[0], 'href');
  const parsed = actionHref ? proposalFromHref(actionHref) : null;
  if (parsed) return proposalNodeId(parsed.txHash, parsed.proposalIndex);

  return 'proposal-pending';
}

export function tier0LocusNodeIds(payload: unknown): string[] {
  const first = readTier0TriggersFromPayload(payload)[0];
  if (!first) return ['tier-0-event'];
  return [proposalNodeId(first.proposalTxHash, first.proposalIndex)];
}

export function tier0AffectedRegionFromPayload(
  payload: unknown,
): SerializedTier0AffectedRegion | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>).tier0AffectedRegion;
  if (!value || typeof value !== 'object') return null;

  const region = value as Record<string, unknown>;
  const affectedNodeIds = region.affectedNodeIds;
  if (!Array.isArray(affectedNodeIds)) return null;

  const nonVoterDim =
    typeof region.nonVoterDim === 'number' && Number.isFinite(region.nonVoterDim)
      ? region.nonVoterDim
      : 0.3;
  const spectatorDim =
    typeof region.spectatorDim === 'number' && Number.isFinite(region.spectatorDim)
      ? region.spectatorDim
      : 0.5;

  return {
    affectedNodeIds: affectedNodeIds.filter((id): id is string => typeof id === 'string'),
    nonVoterDim,
    spectatorDim,
  };
}

export function actionCards(payload: unknown): AnchoredCardDescriptor[] {
  const items = readArray(payload, 'items');
  return items.slice(0, 3).map((item, index) => {
    const href = readString(item, 'href');
    const parsed = href ? proposalFromHref(href) : null;
    const anchorNodeId = parsed
      ? proposalNodeId(parsed.txHash, parsed.proposalIndex)
      : `action-${index + 1}`;
    return makeCard({
      id: `action-${index + 1}`,
      kind: 'action',
      title: readString(item, 'title') ?? 'Action required',
      body: readString(item, 'deadline') ?? readString(item, 'subtitle') ?? undefined,
      anchorNodeId,
      href: href ?? undefined,
    });
  });
}

export function makeCard(input: {
  id: string;
  kind: AnchoredCardKind;
  title: string;
  body?: string;
  anchorNodeId: string;
  href?: string;
}): AnchoredCardDescriptor {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    anchorNodeId: input.anchorNodeId,
    href: input.href,
  };
}

function readString(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === 'string' && found.trim() ? found : null;
}

function readNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== 'object') return null;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === 'number' && Number.isFinite(found) ? found : null;
}

function readArray(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== 'object') return [];
  const found = (value as Record<string, unknown>)[key];
  return Array.isArray(found) ? found : [];
}

function proposalSignal(value: unknown): { txHash: string; proposalIndex: number } | null {
  const txHash =
    readString(value, 'txHash') ??
    readString(value, 'proposalTxHash') ??
    readString(value, 'proposal_tx_hash');
  const proposalIndex =
    readNumber(value, 'proposalIndex') ??
    readNumber(value, 'proposal_index') ??
    readNumber(value, 'index');

  return txHash && proposalIndex !== null ? { txHash, proposalIndex } : null;
}

function proposalFromHref(href: string): { txHash: string; proposalIndex: number } | null {
  const match = href.match(/\/proposal\/([^/]+)\/(\d+)/);
  if (!match) return null;
  return { txHash: match[1], proposalIndex: Number(match[2]) };
}
