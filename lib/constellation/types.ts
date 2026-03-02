import type { AlignmentDimension } from '@/lib/drepIdentity';

export interface ConstellationNode3D {
  id: string;
  name: string | null;
  power: number;
  score: number;
  dominant: AlignmentDimension;
  alignments: number[];
  position: [number, number, number];
  scale: number;
  isAnchor?: boolean;
}

export interface ConstellationEdge3D {
  from: [number, number, number];
  to: [number, number, number];
}

export interface FindMeTarget {
  type: 'delegated' | 'undelegated' | 'drep';
  drepId?: string;
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
    name: string | null;
    power: number;
    score: number;
    dominant: AlignmentDimension;
    alignments: number[];
  }>;
  recentEvents: ConstellationEvent[];
  stats: {
    totalAdaGoverned: string;
    activeProposals: number;
    votesThisWeek: number;
    activeDReps: number;
  };
}

export interface LayoutResult {
  nodes: ConstellationNode3D[];
  edges: ConstellationEdge3D[];
  nodeMap: Map<string, ConstellationNode3D>;
}
