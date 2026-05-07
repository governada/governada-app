import type { AnchoredCardDescriptor, AnchoredCardKind } from '@/components/globe/AnchoredCard';
import type { BehaviorContext, GlobeBehavior } from '@/lib/globe/behaviors/types';
import { getSharedIntent, setSharedIntent } from '@/lib/globe/focusIntent';
import { deriveCameraDistance } from '@/lib/globe/focusEngine';
import type {
  CinematicArrivalCommand,
  CinematicCommandType,
  GlobeCommand,
} from '@/lib/globe/types';
import type { FocusIntent } from '@/lib/globe/types';
import {
  proposalNodeId,
  governanceNodeId,
  readTier0TriggersFromPayload,
  type SerializedTier0AffectedRegion,
} from '@/lib/governance/tier0AffectedRegion';
import { getViewportClassSnapshot, type ViewportClass } from '@/hooks/useViewportClass';

export interface CinematicBehaviorConfig {
  id: string;
  commandType: CinematicCommandType;
  run: (command: CinematicArrivalCommand, ctx: BehaviorContext) => void;
}

type Vec3 = [number, number, number];

export interface MobileCameraNode {
  id: string;
  position: Vec3;
  radius?: number;
  scale?: number;
}

export interface MobileCameraOptions {
  origin?: Vec3;
  targetNodeId?: string;
  nodes?: MobileCameraNode[];
}

const CAMERA_NEUTRAL_DISTANCE = 14;
const MOBILE_TRAVERSAL_MULTIPLIER = 0.5;
const MOBILE_MAX_TRANSITION_SECONDS = 1.5;
const DEFAULT_NODE_BOUNDING_RADIUS = 0.55;

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
  ctx.dispatch(
    mobileAdjustCamera({
      type: 'cinematic',
      state: {
        orbitSpeed: 0.003,
        dollyTarget,
        dimTarget: 0,
        transitionDuration: 1.5,
      },
    }),
  );
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
    transitionDuration?: number;
  } = {},
): void {
  const ids = nodeIds.filter(Boolean);
  if (ids.length === 0) return;

  const viewportClass = getViewportClassSnapshot();
  const adjustedOptions = mobileAdjustFocusOptions(options, viewportClass, ids.length);
  const focusedIds = new Set(ids);
  const intensities = new Map(ids.map((id) => [id, adjustedOptions.intensity ?? 1]));

  setSharedIntent({
    focusedIds,
    intensities,
    flyToFocus: adjustedOptions.fly ?? true,
    cameraProximity: adjustedOptions.proximity ?? (ids.length === 1 ? 'tight' : 'cluster'),
    cameraDistanceOverride: adjustedOptions.cameraDistanceOverride,
    dimStrength: adjustedOptions.dimStrength ?? 0.55,
    focusColor: adjustedOptions.focusColor,
    focusSizeBoost: adjustedOptions.focusSizeBoost ?? 1.18,
    bloomIntensity: adjustedOptions.pulse ? 1.1 : 0.7,
    atmosphereTemperature: 0.45,
    transitionDuration: Math.min(adjustedOptions.transitionDuration ?? 1.5, 1.5),
    easingCurve: 'ease-in-out',
    pulsingNodeIds: adjustedOptions.pulse ? focusedIds : undefined,
    pulseFrequency: adjustedOptions.pulse ? 1.1 : undefined,
  });
}

export function mobileAdjustCamera(
  command: GlobeCommand,
  viewportClass: ViewportClass = getViewportClassSnapshot(),
  options: MobileCameraOptions = {},
): GlobeCommand {
  if (viewportClass !== 'mobile') return command;

  switch (command.type) {
    case 'cinematic':
      return {
        ...command,
        state: {
          ...command.state,
          dollyTarget:
            command.state.dollyTarget === undefined
              ? undefined
              : halveTraversal(command.state.dollyTarget, CAMERA_NEUTRAL_DISTANCE),
          transitionDuration:
            command.state.transitionDuration === undefined
              ? undefined
              : clampMobileTransition(command.state.transitionDuration),
        },
      };

    case 'flyToPosition': {
      const nextTarget = wouldFlyThrough(command.target, options)
        ? orbitAroundTarget(command.target)
        : command.target;
      return {
        ...command,
        target: nextTarget,
        distance:
          command.distance === undefined
            ? command.distance
            : halveTraversal(command.distance, CAMERA_NEUTRAL_DISTANCE),
        duration:
          command.duration === undefined
            ? command.duration
            : clampMobileTransition(command.duration),
      };
    }

    case 'zoomOut':
      return {
        ...command,
        distance:
          command.distance === undefined
            ? command.distance
            : halveTraversal(command.distance, CAMERA_NEUTRAL_DISTANCE),
      };

    default:
      return command;
  }
}

export function mobileAdjustFocusOptions<
  T extends Partial<FocusIntent> & { proximity?: FocusIntent['cameraProximity'] },
>(
  options: T,
  viewportClass: ViewportClass = getViewportClassSnapshot(),
  focusCount = 1,
): T & Pick<FocusIntent, 'cameraDistanceOverride' | 'transitionDuration'> {
  if (viewportClass !== 'mobile') return options;
  const desktopProximity = options.proximity ?? (focusCount === 1 ? 'tight' : 'cluster');
  const desktopDistance = deriveCameraDistance(focusCount, desktopProximity);
  return {
    ...options,
    proximity: lessAggressiveProximity(desktopProximity),
    cameraDistanceOverride: halveTraversal(desktopDistance, CAMERA_NEUTRAL_DISTANCE),
    transitionDuration: clampMobileTransition(
      options.transitionDuration ?? MOBILE_MAX_TRANSITION_SECONDS,
    ),
  };
}

export function pathIntersectsBoundingSphere(
  origin: Vec3,
  target: Vec3,
  sphereCenter: Vec3,
  radius: number,
): boolean {
  const [ox, oy, oz] = origin;
  const [tx, ty, tz] = target;
  const [cx, cy, cz] = sphereCenter;
  const dx = tx - ox;
  const dy = ty - oy;
  const dz = tz - oz;
  const lengthSq = dx * dx + dy * dy + dz * dz;
  if (lengthSq === 0) {
    return distance(origin, sphereCenter) <= radius;
  }

  const t = Math.max(0, Math.min(1, ((cx - ox) * dx + (cy - oy) * dy + (cz - oz) * dz) / lengthSq));
  const closest: Vec3 = [ox + dx * t, oy + dy * t, oz + dz * t];
  return distance(closest, sphereCenter) <= radius;
}

function wouldFlyThrough(target: Vec3, options: MobileCameraOptions): boolean {
  if (!options.nodes?.length) return false;
  const origin = options.origin ?? [0, 3, CAMERA_NEUTRAL_DISTANCE];
  return options.nodes.some((node) => {
    if (node.id === options.targetNodeId) return false;
    const radius = node.radius ?? Math.max(DEFAULT_NODE_BOUNDING_RADIUS, (node.scale ?? 1) * 1.4);
    return pathIntersectsBoundingSphere(origin, target, node.position, radius);
  });
}

function orbitAroundTarget(target: Vec3): Vec3 {
  const angle = Math.PI / 5;
  const [x, y, z] = target;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - z * sin, y + 0.8, x * sin + z * cos];
}

function halveTraversal(value: number, neutral: number): number {
  return neutral + (value - neutral) * MOBILE_TRAVERSAL_MULTIPLIER;
}

function clampMobileTransition(value: number): number {
  return Math.min(value, MOBILE_MAX_TRANSITION_SECONDS);
}

function lessAggressiveProximity(
  proximity: FocusIntent['cameraProximity'],
): FocusIntent['cameraProximity'] {
  switch (proximity) {
    case 'locked':
    case 'tight':
      return 'cluster';
    case 'cluster':
      return 'overview';
    default:
      return proximity;
  }
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
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

export function tier0LocusHrefFromPayload(payload: unknown): string | undefined {
  const first = readTier0TriggersFromPayload(payload)[0];
  if (!first) return undefined;
  return `/proposal/${first.proposalTxHash}/${first.proposalIndex}`;
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
