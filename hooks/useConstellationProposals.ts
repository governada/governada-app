'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  computeSpherePosition,
  sphereToCartesian,
  GLOBE_RADIUS,
} from '@/lib/constellation/globe-layout';
import type { LayoutInput } from '@/lib/constellation/globe-layout';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { getDominantDimension } from '@/lib/drepIdentity';
import type { AlignmentScores } from '@/lib/drepIdentity';

interface ProposalSummary {
  txHash: string;
  index: number;
  title: string;
  type: string;
  status: string;
  adaAmount: number | null;
  submittedEpoch: number;
  expiryEpoch: number | null;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  dimTreasuryConservative: number | null;
  dimTreasuryGrowth: number | null;
  dimDecentralization: number | null;
  dimSecurity: number | null;
  dimInnovation: number | null;
  dimTransparency: number | null;
}

/** Cardano epoch is ~5 days. Urgency = 1.0 when within ~48h, 0 when 5+ epochs away. */
function computeUrgency(expiryEpoch: number | null, currentEpoch: number): number {
  if (expiryEpoch == null) return 0.3; // unknown expiry, moderate default
  const epochsRemaining = expiryEpoch - currentEpoch;
  if (epochsRemaining <= 0) return 1.0; // expired or expiring now
  // ~48h = ~0.4 epochs -> urgency 1.0
  // ~5 days = 1 epoch -> urgency 0.5
  // 5+ epochs remaining -> urgency ~0
  const urgency = 1.0 - Math.min(1, epochsRemaining / 5);
  return Math.max(0, Math.min(1, urgency));
}

function proposalToAlignments(p: ProposalSummary): number[] {
  return [
    p.dimTreasuryConservative ?? 50,
    p.dimTreasuryGrowth ?? 50,
    p.dimDecentralization ?? 50,
    p.dimSecurity ?? 50,
    p.dimInnovation ?? 50,
    p.dimTransparency ?? 50,
  ];
}

function proposalToAlignmentScores(p: ProposalSummary): AlignmentScores {
  return {
    treasuryConservative: p.dimTreasuryConservative,
    treasuryGrowth: p.dimTreasuryGrowth,
    decentralization: p.dimDecentralization,
    security: p.dimSecurity,
    innovation: p.dimInnovation,
    transparency: p.dimTransparency,
  };
}

const PROPOSAL_MIN_SCALE = 0.08;
const PROPOSAL_MAX_SCALE = 0.2;
// Proposal radius: slightly above the globe surface so they float visibly
const PROPOSAL_RADIUS = GLOBE_RADIUS + 0.5;

// Rough estimate: Cardano mainnet epoch as of early 2026. Updated each session via health-index.
const FALLBACK_EPOCH = 540;

export function useConstellationProposals(userAlignments?: number[]) {
  const { data: proposals, isLoading: proposalsLoading } = useQuery<ProposalSummary[]>({
    queryKey: ['constellation-proposals'],
    queryFn: async () => {
      const res = await fetch('/api/proposals');
      if (!res.ok) throw new Error('Failed to fetch proposals');
      const json = await res.json();
      // API may return { proposals: [...] } or a raw array
      return Array.isArray(json) ? json : (json.proposals ?? []);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: healthData } = useQuery<{ currentEpoch?: number }>({
    queryKey: ['constellation-current-epoch'],
    queryFn: async () => {
      const res = await fetch('/api/governance/health-index');
      if (!res.ok) return { currentEpoch: FALLBACK_EPOCH };
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const currentEpoch = healthData?.currentEpoch ?? FALLBACK_EPOCH;

  const proposalNodes = useMemo<ConstellationNode3D[]>(() => {
    if (!proposals) return [];

    const activeProposals = proposals.filter((p) => p.status === 'active');

    return activeProposals.map((p) => {
      const alignments = proposalToAlignments(p);
      const scores = proposalToAlignmentScores(p);
      const dominant = getDominantDimension(scores);
      const totalVotes = p.yesVotes + p.noVotes + p.abstainVotes;
      const urgency = computeUrgency(p.expiryEpoch, currentEpoch);

      // Power for layout sizing: normalize ADA amount (log scale) combined with vote activity
      const adaNorm = p.adaAmount ? Math.min(1, Math.log10(p.adaAmount + 1) / 10) : 0.3;
      const voteNorm = Math.min(1, totalVotes / 500);
      const power = adaNorm * 0.6 + voteNorm * 0.4;

      const layoutInput: LayoutInput = {
        id: `proposal-${p.txHash}-${p.index}`,
        fullId: `${p.txHash}#${p.index}`,
        name: p.title,
        power,
        score: urgency * 100, // use urgency as the "score" for positioning spread
        dominant,
        alignments,
        nodeType: 'proposal',
      };

      const [lon, lat] = computeSpherePosition(layoutInput);
      const pos = sphereToCartesian(lat, lon, PROPOSAL_RADIUS);

      // Scale: larger for higher ADA amounts and more urgent proposals
      const scale =
        PROPOSAL_MIN_SCALE +
        (power * 0.5 + urgency * 0.5) * (PROPOSAL_MAX_SCALE - PROPOSAL_MIN_SCALE);

      return {
        ...layoutInput,
        position: pos,
        scale,
      };
    });
  }, [proposals, currentEpoch, userAlignments]);

  return { proposalNodes, isLoading: proposalsLoading };
}
