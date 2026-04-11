import { positionByAlignment, type LayoutInput } from '@/lib/constellation/globe-layout';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { getDominantDimension } from '@/lib/drepIdentity';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { TriBodyVotes } from '@/lib/governance/proposalSummary';

export interface ConstellationProposalSource {
  txHash: string;
  index: number;
  title: string | null;
  status: string;
  withdrawalAmount: number | null;
  expirationEpoch: number | null;
  relevantPrefs: string[] | null;
  triBody: TriBodyVotes | null;
}

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

const PROPOSAL_MIN_SCALE = 0.08;
const PROPOSAL_MAX_SCALE = 0.2;

function prefsToAlignments(prefs: string[] | null): AlignmentScores {
  const scores: AlignmentScores = {
    treasuryConservative: 50,
    treasuryGrowth: 50,
    decentralization: 50,
    security: 50,
    innovation: 50,
    transparency: 50,
  };

  if (!prefs) {
    return scores;
  }

  for (const pref of prefs) {
    const dim = PREF_TO_DIMENSION[pref];
    if (dim) {
      scores[dim] = 80;
    }
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

export function computeProposalUrgency(
  expirationEpoch: number | null,
  currentEpoch: number | null,
): number {
  if (expirationEpoch == null || currentEpoch == null) {
    return 0.3;
  }

  const remaining = expirationEpoch - currentEpoch;
  if (remaining <= 0) {
    return 1.0;
  }

  return Math.max(0, Math.min(1, 1 - remaining / 5));
}

export function buildProposalConstellationNodes(
  proposals: ConstellationProposalSource[],
  currentEpoch: number | null,
): ConstellationNode3D[] {
  return proposals
    .filter((proposal) => proposal.status === 'Open')
    .map((proposal) => {
      const scores = prefsToAlignments(proposal.relevantPrefs);
      const alignments = scoresToArray(scores);
      const dominant = getDominantDimension(scores);
      const drepVotes = proposal.triBody?.drep;
      const totalVotes = drepVotes ? drepVotes.yes + drepVotes.no + drepVotes.abstain : 0;
      const urgency = computeProposalUrgency(proposal.expirationEpoch, currentEpoch);
      const adaNorm = proposal.withdrawalAmount
        ? Math.min(1, Math.log10(proposal.withdrawalAmount + 1) / 10)
        : 0.3;
      const voteNorm = Math.min(1, totalVotes / 200);
      const power = adaNorm * 0.6 + voteNorm * 0.4;

      const layoutInput: LayoutInput = {
        id: `proposal-${proposal.txHash.slice(0, 12)}-${proposal.index}`,
        fullId: `${proposal.txHash}#${proposal.index}`,
        name: proposal.title,
        power,
        score: urgency * 100,
        dominant,
        alignments,
        nodeType: 'proposal',
      };

      const position = positionByAlignment(layoutInput);
      const scale =
        PROPOSAL_MIN_SCALE +
        (power * 0.5 + urgency * 0.5) * (PROPOSAL_MAX_SCALE - PROPOSAL_MIN_SCALE);

      return { ...layoutInput, position, scale };
    });
}
