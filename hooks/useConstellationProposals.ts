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

/**
 * Actual shape from GET /api/proposals
 */
interface ProposalFromAPI {
  txHash: string;
  index: number;
  title: string;
  type: string;
  status: string;
  withdrawalAmount: number | null;
  proposedEpoch: number;
  expirationEpoch: number | null;
  relevantPrefs: string[] | null;
  triBody: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  } | null;
}

// Map relevantPrefs tags to 6D alignment scores
const PREF_TO_DIMENSION: Record<string, keyof AlignmentScores> = {
  'treasury-conservative': 'treasuryConservative',
  'smart-treasury-growth': 'treasuryGrowth',
  'strong-decentralization': 'decentralization',
  'security-first': 'security',
  'innovation-friendly': 'innovation',
  'transparency-focused': 'transparency',
  treasury: 'treasuryConservative',
  decentralization: 'decentralization',
  security: 'security',
  innovation: 'innovation',
  transparency: 'transparency',
};

function prefsToAlignments(prefs: string[] | null): AlignmentScores {
  const scores: AlignmentScores = {
    treasuryConservative: 50,
    treasuryGrowth: 50,
    decentralization: 50,
    security: 50,
    innovation: 50,
    transparency: 50,
  };
  if (!prefs) return scores;
  for (const pref of prefs) {
    const dim = PREF_TO_DIMENSION[pref];
    if (dim) scores[dim] = 80;
  }
  return scores;
}

function scoresToArray(scores: AlignmentScores): number[] {
  return [
    scores.treasuryConservative ?? 50,
    scores.treasuryGrowth ?? 50,
    scores.decentralization ?? 50,
    scores.security ?? 50,
    scores.innovation ?? 50,
    scores.transparency ?? 50,
  ];
}

function computeUrgency(expirationEpoch: number | null, currentEpoch: number): number {
  if (expirationEpoch == null) return 0.3;
  const remaining = expirationEpoch - currentEpoch;
  if (remaining <= 0) return 1.0;
  return Math.max(0, Math.min(1, 1 - remaining / 5));
}

const PROPOSAL_MIN_SCALE = 0.08;
const PROPOSAL_MAX_SCALE = 0.2;
const PROPOSAL_RADIUS = GLOBE_RADIUS * 0.55; // Inside the globe — inner active layer
const CURRENT_EPOCH = 621;

export function useConstellationProposals(_userAlignments?: number[]) {
  const { data: proposals, isLoading: proposalsLoading } = useQuery<ProposalFromAPI[]>({
    queryKey: ['constellation-proposals'],
    queryFn: async () => {
      const res = await fetch('/api/proposals');
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : (json.proposals ?? []);
    },
    staleTime: 5 * 60_000,
  });

  const proposalNodes = useMemo<ConstellationNode3D[]>(() => {
    if (!proposals?.length) return [];

    return proposals
      .filter((p) => p.status === 'Open')
      .map((p) => {
        const scores = prefsToAlignments(p.relevantPrefs);
        const alignments = scoresToArray(scores);
        const dominant = getDominantDimension(scores);

        const drepVotes = p.triBody?.drep;
        const totalVotes = drepVotes ? drepVotes.yes + drepVotes.no + drepVotes.abstain : 0;
        const urgency = computeUrgency(p.expirationEpoch, CURRENT_EPOCH);

        const adaNorm = p.withdrawalAmount
          ? Math.min(1, Math.log10(p.withdrawalAmount + 1) / 10)
          : 0.3;
        const voteNorm = Math.min(1, totalVotes / 200);
        const power = adaNorm * 0.6 + voteNorm * 0.4;

        const layoutInput: LayoutInput = {
          id: `proposal-${p.txHash.slice(0, 12)}-${p.index}`,
          fullId: `${p.txHash}#${p.index}`,
          name: p.title,
          power,
          score: urgency * 100,
          dominant,
          alignments,
          nodeType: 'proposal',
        };

        const [lon, lat] = computeSpherePosition(layoutInput);
        const pos = sphereToCartesian(lat, lon, PROPOSAL_RADIUS);
        const scale =
          PROPOSAL_MIN_SCALE +
          (power * 0.5 + urgency * 0.5) * (PROPOSAL_MAX_SCALE - PROPOSAL_MIN_SCALE);

        return { ...layoutInput, position: pos, scale };
      });
  }, [proposals]);

  return { proposalNodes, isLoading: proposalsLoading };
}
