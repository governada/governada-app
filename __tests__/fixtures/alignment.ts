/**
 * Shared test fixtures for alignment test suites.
 * Includes vote matrix inputs and proposal classifications.
 */

import type { VoteMatrixInput } from '@/lib/alignment/voteMatrix';
import type { ProposalClassification } from '@/lib/alignment/classifyProposals';

// ── Factory: VoteMatrixInput ──

export function makeMatrixVote(overrides: Partial<VoteMatrixInput> = {}): VoteMatrixInput {
  return {
    drepId: 'drep1_test',
    proposalTxHash: 'tx_default',
    proposalIndex: 0,
    vote: 'Yes',
    blockTime: Math.floor(Date.now() / 1000) - 86400,
    ...overrides,
  };
}

// ── Factory: ProposalClassification ──

export function makeClassification(
  overrides: Partial<ProposalClassification> = {},
): ProposalClassification {
  return {
    proposalTxHash: 'tx_default',
    proposalIndex: 0,
    dimTreasuryConservative: 0.5,
    dimTreasuryGrowth: 0.5,
    dimDecentralization: 0.3,
    dimSecurity: 0.2,
    dimInnovation: 0.4,
    dimTransparency: 0.3,
    aiSummary: null,
    ...overrides,
  };
}

/**
 * Create a known small vote matrix for PCA testing.
 * 4 DReps × 4 Proposals with predictable structure:
 *   - DReps A,B vote similarly (Yes on treasury, No on governance)
 *   - DReps C,D vote oppositely (No on treasury, Yes on governance)
 * This creates a clear 1st principal component separating the two groups.
 */
export function makeKnownPCAMatrix() {
  const now = Math.floor(Date.now() / 1000);
  const drepIds = ['drepA', 'drepB', 'drepC', 'drepD'];
  const proposalIds = ['txP1-0', 'txP2-0', 'txP3-0', 'txP4-0'];

  // Votes: rows = DReps, cols = proposals
  // A: [+1, +1, -1, -1]  (pro-treasury, anti-governance)
  // B: [+1, +1, -1, -1]  (same pattern)
  // C: [-1, -1, +1, +1]  (anti-treasury, pro-governance)
  // D: [-1, -1, +1, +1]  (same pattern)
  const rawMatrix = [
    [1, 1, -1, -1],
    [1, 1, -1, -1],
    [-1, -1, 1, 1],
    [-1, -1, 1, 1],
  ];

  const votes: VoteMatrixInput[] = [];
  const voteMap: Record<number, 'Yes' | 'No' | 'Abstain'> = {
    1: 'Yes',
    [-1]: 'No',
    0: 'Abstain',
  };

  for (let i = 0; i < drepIds.length; i++) {
    for (let j = 0; j < proposalIds.length; j++) {
      const [txHash, idx] = proposalIds[j].split('-');
      votes.push({
        drepId: drepIds[i],
        proposalTxHash: txHash,
        proposalIndex: parseInt(idx),
        vote: voteMap[rawMatrix[i][j]] || 'Abstain',
        blockTime: now - 86400 * (10 - j),
      });
    }
  }

  const proposals = proposalIds.map((id, j) => {
    const [txHash, idx] = id.split('-');
    return {
      txHash,
      index: parseInt(idx),
      type: j < 2 ? 'TreasuryWithdrawals' : 'NoConfidence',
      withdrawalAmountAda: j < 2 ? 1000000 : null,
    };
  });

  const classifications: ProposalClassification[] = proposalIds.map((id, j) => {
    const [txHash, idx] = id.split('-');
    return makeClassification({
      proposalTxHash: txHash,
      proposalIndex: parseInt(idx),
      dimTreasuryConservative: j < 2 ? 0.9 : 0.1,
      dimTreasuryGrowth: j < 2 ? 0.8 : 0.1,
      dimDecentralization: j >= 2 ? 0.9 : 0.1,
      dimSecurity: j >= 2 ? 0.7 : 0.2,
      dimInnovation: 0.3,
      dimTransparency: 0.3,
    });
  });

  return { rawMatrix, drepIds, proposalIds, votes, proposals, classifications, now };
}

/**
 * Create a larger vote matrix for integration testing.
 * 6 DReps × 6 Proposals with varied voting patterns and NaN (missing) votes.
 */
export function makeSparseVoteMatrix() {
  const now = Math.floor(Date.now() / 1000);
  const drepIds = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
  const proposals = Array.from({ length: 6 }, (_, j) => ({
    txHash: `txS${j}`,
    index: 0,
    type: j < 3 ? 'TreasuryWithdrawals' : 'ParameterChange',
    withdrawalAmountAda: j < 3 ? (j + 1) * 100000 : null,
  }));

  const classifications = proposals.map((p) =>
    makeClassification({
      proposalTxHash: p.txHash,
      proposalIndex: p.index,
    }),
  );

  // Each DRep votes on 5 of 6 proposals (one missing each)
  const votes: VoteMatrixInput[] = [];
  const patterns: Array<Array<'Yes' | 'No' | 'Abstain' | null>> = [
    ['Yes', 'Yes', 'No', 'Yes', 'No', null],
    ['Yes', null, 'No', 'Yes', 'Yes', 'No'],
    ['No', 'No', 'Yes', null, 'Yes', 'Yes'],
    [null, 'Yes', 'Yes', 'No', 'No', 'Yes'],
    ['Yes', 'No', null, 'Yes', 'Yes', 'No'],
    ['No', 'Yes', 'Yes', 'No', null, 'Yes'],
  ];

  for (let i = 0; i < drepIds.length; i++) {
    for (let j = 0; j < proposals.length; j++) {
      if (patterns[i][j] === null) continue;
      votes.push({
        drepId: drepIds[i],
        proposalTxHash: proposals[j].txHash,
        proposalIndex: proposals[j].index,
        vote: patterns[i][j]!,
        blockTime: now - 86400 * (12 - j * 2),
      });
    }
  }

  return { drepIds, proposals, classifications, votes, now };
}
