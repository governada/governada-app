/**
 * Globe system types — canonical type definitions for the entire Seneca + Globe system.
 *
 * All globe-related types live here. Components, hooks, and behaviors import from this
 * single module rather than reaching into component files.
 */

import type {
  ConstellationNode3D,
  ConstellationEdge3D,
  FindMeTarget,
} from '@/lib/constellation/types';

export type { FindMeTarget };

// ---------------------------------------------------------------------------
// ConstellationRef — imperative API exposed by the globe component
// ---------------------------------------------------------------------------

export interface ConstellationRef {
  findMe: (target: FindMeTarget) => Promise<void>;
  flyToNode: (nodeId: string) => Promise<ConstellationNode3D | null>;
  pulseNode: (drepId: string) => void;
  resetCamera: () => void;
  highlightMatches: (
    userAlignment: number[],
    threshold: number,
    options?: HighlightOptions,
  ) => void;
  flyToMatch: (drepId: string) => Promise<void>;
  /** Light up all DRep nodes and dim non-DReps — the "entering Cerebro" moment */
  matchStart: () => void;
  clearMatches: () => void;
  /** Dim all nodes — focus active with no focused nodes = everything unfocused */
  dimAll: () => void;
  /** Color DRep nodes by their vote on a proposal. Pass null to clear. */
  setVoteSplit: (map: Map<string, 'Yes' | 'No' | 'Abstain'> | null) => void;
  /** Set temporal replay progress (0-1) with vote events up to that point */
  setTemporalState: (progress: number, voteMap: Map<string, 'Yes' | 'No' | 'Abstain'>) => void;
  /** Exit temporal replay mode */
  clearTemporal: () => void;
  /** Highlight a single node (no camera move). Pass null to clear. */
  highlightNode: (nodeId: string | null) => void;
  /** Set globe rotation speed multiplier (1 = default, 0 = stopped, 3 = fast spin) */
  setRotationSpeed: (multiplier: number) => void;
  /** Dolly camera to a specific distance from origin */
  zoomToDistance: (distance: number) => void;
  /** Brief emissive flash on a node (300ms burst) */
  flashNode: (nodeId: string) => void;
  /** Set cinematic animation state for smooth per-frame transitions */
  setCinematicState: (state: CinematicStateInput) => void;
  /** Fly camera to an arbitrary 3D position (no node needed) */
  flyToPosition: (
    target: [number, number, number],
    options?: { distance?: number; duration?: number },
  ) => Promise<void>;
  /** Focus on specific node IDs — dims others, flies to centroid */
  narrowTo: (nodeIds: string[], options?: NarrowToOptions) => void;
}

export interface NarrowToOptions {
  cameraAngle?: number;
  cameraElevation?: number;
  scanProgress?: number;
  /** Fly to centroid of the narrowed nodes (default: true) */
  fly?: boolean;
  /** Dim non-focused nodes (default: true) */
  dimOthers?: boolean;
}

export interface HighlightOptions {
  noZoom?: boolean;
  zoomToCluster?: boolean;
  nodeTypeFilter?: string;
  cameraAngle?: number;
  cameraElevation?: number;
  drepOnly?: boolean;
  topN?: number;
  scanProgressOverride?: number;
}

// ---------------------------------------------------------------------------
// CinematicStateInput — controls smooth camera animation
// ---------------------------------------------------------------------------

/** Input for continuous cinematic animation — partial updates merge with current state */
export interface CinematicStateInput {
  /** Camera orbit speed in radians/sec (0 = stopped, 0.3 = gentle, 0.8 = fast) */
  orbitSpeed?: number;
  /** Target camera distance from origin */
  dollyTarget?: number;
  /** Target dim level for non-matched nodes (0 = all visible, 1 = fully dimmed) */
  dimTarget?: number;
  /** How many seconds this transition should take (0.4 - 2.0) */
  transitionDuration?: number;
}

// ---------------------------------------------------------------------------
// FocusState — universal focus/unfocus abstraction for node visual treatment
// ---------------------------------------------------------------------------

/**
 * Every visual mode (match flow, single node flyTo, vote split, temporal replay,
 * warm topic, overlay modes) writes to this single state. NodePoints reads ONLY
 * this to decide how to render each node — producing consistent "Cerebro" visuals
 * regardless of the trigger.
 */
export interface FocusState {
  /** Whether any focus mode is active — when true, unfocused nodes dim */
  active: boolean;
  /** Set of node IDs that are "in focus" — these glow, everything else dims */
  focusedIds: Set<string>;
  /** Per-node intensity (0-1) for focused nodes — drives glow strength, size boost */
  intensities: Map<string, number>;
  /** 0-1 scan progress — drives progressive unfocused fade (match flow advances this) */
  scanProgress: number;
  /** Optional color override per node (vote split colors, overlay modes) */
  colorOverrides: Map<string, string> | null;
  /** When set, only this node type can be focused — others are always unfocused */
  nodeTypeFilter: string | null;
  /** Staggered activation delays (seconds) per node — enables shockwave/sweep effects */
  activationDelays: Map<string, number> | null;
  /** Intermediate-brightness nodes ("maybes") with brightness level 0-1 */
  intermediateIds: Map<string, number> | null;
}

export const DEFAULT_FOCUS: FocusState = {
  active: false,
  focusedIds: new Set(),
  intensities: new Map(),
  scanProgress: 0,
  colorOverrides: null,
  nodeTypeFilter: null,
  activationDelays: null,
  intermediateIds: null,
};

// ---------------------------------------------------------------------------
// SceneState — internal state of the globe component
// ---------------------------------------------------------------------------

export interface SceneState {
  nodes: ConstellationNode3D[];
  edges: ConstellationEdge3D[];
  nodeMap: Map<string, ConstellationNode3D>;
  pulseId: string | null;
  animating: boolean;
  flyToTarget: [number, number, number] | null;
  flyToActive: boolean;
  /** Universal focus state — the single source of truth for node visual treatment */
  focus: FocusState;
  /** Raw vote data — feeds into focus.colorOverrides but needed by temporal scrubber UI */
  voteSplitMap: Map<string, 'Yes' | 'No' | 'Abstain'> | null;
  /** Temporal replay: 0-1 progress through an epoch's governance events */
  temporalProgress: number;
  /** Temporal replay: cumulative vote map built as progress advances */
  temporalVoteMap: Map<string, 'Yes' | 'No' | 'Abstain'>;
  /** Whether temporal replay mode is active */
  temporalActive: boolean;
}

// ---------------------------------------------------------------------------
// GlobeCommand — the typed DSL for all globe choreography
// ---------------------------------------------------------------------------

export type GlobeCommand =
  | { type: 'flyTo'; nodeId: string }
  | { type: 'pulse'; nodeId: string }
  | {
      type: 'highlight';
      alignment: number[];
      threshold: number;
      noZoom?: boolean;
      zoomToCluster?: boolean;
      /** Filter to specific node type (e.g., 'drep') — others stay dimmed */
      nodeTypeFilter?: string;
      /** Camera azimuth offset for dive variety (radians) */
      cameraAngle?: number;
      /** Camera elevation offset for dive variety (radians) */
      cameraElevation?: number;
      drepOnly?: boolean;
      /** Take top N closest nodes instead of threshold — guarantees progressive narrowing */
      topN?: number;
      /** Override scan progress (0-1) when using topN instead of threshold */
      scanProgressOverride?: number;
    }
  | { type: 'voteSplit'; proposalRef: string }
  | { type: 'reset' }
  | { type: 'clear' }
  /** Dim all nodes — used before progressive reveal during tool execution */
  | { type: 'dim' }
  /** Light up all DRep nodes, dim non-DReps — the "entering Cerebro" moment */
  | { type: 'matchStart' }
  /** Dramatic cinematic fly to a match result (3-second hold) */
  | { type: 'matchFlyTo'; nodeId: string }
  /** Scanning sweep — highlight with wide threshold then narrow, simulating a search */
  | { type: 'scan'; alignment: number[]; durationMs?: number }
  /** Warm specific nodes by topic — subtle highlight without camera movement */
  | { type: 'warmTopic'; topic: 'treasury' | 'participation' | 'delegation' | 'proposals' }
  /** Sequenced choreography — execute commands in order with delays */
  | { type: 'sequence'; steps: Array<{ command: GlobeCommand; delayMs: number }> }
  /** Set globe rotation speed multiplier (1=default, 0=stop, 3=fast) */
  | { type: 'setRotation'; speed: number }
  /** Dolly camera to a specific distance from origin */
  | { type: 'zoomOut'; distance?: number }
  /** Brief emissive flash on a node (reveal moment) */
  | { type: 'flash'; nodeId: string }
  /** Cinematic state — smooth per-frame camera orbit + node transitions */
  | { type: 'cinematic'; state: CinematicStateInput }
  /** Highlight a governance faction cluster — dims non-members, glows members */
  | { type: 'highlightCluster'; clusterId: string }
  /** Fly camera to an arbitrary 3D position (region, cluster centroid, empty space) */
  | {
      type: 'flyToPosition';
      target: [number, number, number];
      distance?: number;
      duration?: number;
    }
  /** Focus on specific node IDs — dims others, flies to their centroid */
  | {
      type: 'narrowTo';
      nodeIds: string[];
      cameraAngle?: number;
      cameraElevation?: number;
      scanProgress?: number;
      fly?: boolean;
    }
  /** Discovery: highlight an entity's spatial neighbors */
  | { type: 'showNeighborhood'; entityId: string; entityType: string; count: number }
  /** Discovery: show voting controversy on a proposal — colored by stance */
  | { type: 'showControversy'; proposalId: string }
  /** Discovery: highlight recently active entities */
  | { type: 'showActiveEntities'; entityType: string; entityIds: string[] };

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------

export const DREP_COLOR = '#2dd4bf';
export const SPO_COLOR = '#a78bfa'; // purple — visually distinct from teal DReps
export const USER_COLOR = '#f0e6d0'; // warm white-gold — personal, clearly "you"
export const PROPOSAL_COLOR = '#d4a050'; // warm amber — active governance events
export const MATCH_COLOR = '#f59e0b'; // Warm amber — distinct from teal, purple, gold

// ---------------------------------------------------------------------------
// Camera defaults
// ---------------------------------------------------------------------------

/** Earth-like axial tilt: 23.4 degrees */
export const AXIAL_TILT = 23.4 * (Math.PI / 180);
export const INITIAL_CAMERA: [number, number, number] = [0, 3, 14];
export const INITIAL_TARGET: [number, number, number] = [0, 0, 0];
export const DEFAULT_ROTATION_SPEED = 0.005; // slow, contemplative rotation (~21 min/revolution)

// ---------------------------------------------------------------------------
// Shader scale constant
// ---------------------------------------------------------------------------

export const POINT_SCALE = 3.0;

// ---------------------------------------------------------------------------
// Network edge colors
// ---------------------------------------------------------------------------

export const NETWORK_EDGE_COLORS: Record<string, string> = {
  delegation: '#2dd4bf',
  alignment: '#fbbf24',
  'cc-drep': '#a78bfa',
};

// ---------------------------------------------------------------------------
// Pulse colors per edge type
// ---------------------------------------------------------------------------

export const PULSE_COLORS: Record<string, [number, number, number]> = {
  orbital: [1.0, 0.75, 0.15], // gold
  infrastructure: [0.65, 0.55, 0.95], // purple
  proximity: [0.18, 0.83, 0.75], // teal
  lastmile: [0.3, 0.5, 0.6], // muted blue
};

export const PULSE_COUNT = 70;
