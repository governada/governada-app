import type { AlignmentDimension } from '@/lib/drepIdentity';

export type GovernanceNodeType = 'drep' | 'spo' | 'cc' | 'user' | 'proposal';

export interface ConstellationNode3D {
  id: string;
  fullId: string;
  name: string | null;
  power: number;
  score: number;
  dominant: AlignmentDimension;
  alignments: number[];
  position: [number, number, number];
  scale: number;
  isAnchor?: boolean;
  nodeType: GovernanceNodeType;
  /** Real-world latitude from relay geolocation (SPOs only) */
  geoLat?: number;
  /** Real-world longitude from relay geolocation (SPOs only) */
  geoLon?: number;
  /** Actual ADA amount for DReps (voting power) */
  adaAmount?: number;
  /** DRep status (Active/Inactive/Retired) */
  drepStatus?: string;
  /** Number of delegators for DReps */
  delegatorCount?: number;
  /** Vote count for SPOs */
  voteCount?: number;
  /** CC fidelity grade (A-F) */
  fidelityGrade?: string;
}

export type EdgeType = 'proximity' | 'infrastructure' | 'lastmile' | 'orbital' | 'delegation';

export interface ConstellationEdge3D {
  from: [number, number, number];
  to: [number, number, number];
  edgeType?: EdgeType;
}

export interface FindMeTarget {
  type: 'delegated' | 'undelegated' | 'drep' | 'spo' | 'user';
  drepId?: string;
  poolId?: string;
}

export interface ConstellationEvent {
  type: 'vote' | 'delegation' | 'rationale' | 'proposal';
  drepId: string;
  detail?: string;
  vote?: 'Yes' | 'No' | 'Abstain';
  timestamp: number;
}

export interface ConstellationApiData {
  nodes: Array<{
    id: string;
    fullId: string;
    name: string | null;
    power: number;
    score: number;
    dominant: AlignmentDimension;
    alignments: number[];
    nodeType: GovernanceNodeType;
    geoLat?: number;
    geoLon?: number;
    adaAmount?: number;
    drepStatus?: string;
    delegatorCount?: number;
    voteCount?: number;
    fidelityGrade?: string;
  }>;
  recentEvents: ConstellationEvent[];
  stats: {
    totalAdaGoverned: string;
    activeProposals: number;
    votesThisWeek: number;
    activeDReps: number;
    activeSpOs: number;
    ccMembers: number;
  };
}

export interface LayoutResult {
  nodes: ConstellationNode3D[];
  edges: ConstellationEdge3D[];
  nodeMap: Map<string, ConstellationNode3D>;
}
