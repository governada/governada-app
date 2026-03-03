/**
 * Vote Matrix Builder — constructs a DRep × Proposal matrix from on-chain votes.
 * Supports amount-weighting for treasury proposals and temporal decay.
 */

import type { ProposalClassification } from './classifyProposals';

export interface VoteMatrixInput {
  drepId: string;
  proposalTxHash: string;
  proposalIndex: number;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
}

export interface ProposalMeta {
  txHash: string;
  index: number;
  type: string;
  withdrawalAmountAda: number | null;
  classification: ProposalClassification | null;
}

export interface VoteMatrixResult {
  matrix: number[][];
  drepIds: string[];
  proposalIds: string[];
  meta: ProposalMeta[];
}

const TEMPORAL_HALF_LIFE_MS = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 months
const LAMBDA = Math.LN2 / TEMPORAL_HALF_LIFE_MS;
const MIN_PARTICIPATION_RATE = 0.2;
const MIN_DREP_VOTES = 5;

/**
 * Build the DRep × Proposal vote matrix with amount-weighting and temporal decay.
 *
 * Vote encoding: Yes = +1, No = -1, Abstain = 0, No Vote = NaN
 */
export function buildVoteMatrix(
  votes: VoteMatrixInput[],
  proposals: {
    txHash: string;
    index: number;
    type: string;
    withdrawalAmountAda: number | null;
  }[],
  classifications: ProposalClassification[],
  opts?: { now?: number },
): VoteMatrixResult {
  const now = opts?.now ?? Date.now();

  const classMap = new Map<string, ProposalClassification>();
  for (const c of classifications) {
    classMap.set(`${c.proposalTxHash}-${c.proposalIndex}`, c);
  }

  // Group votes by DRep
  const drepVoteMap = new Map<string, Map<string, VoteMatrixInput>>();
  for (const v of votes) {
    const key = `${v.proposalTxHash}-${v.proposalIndex}`;
    if (!drepVoteMap.has(v.drepId)) drepVoteMap.set(v.drepId, new Map());
    drepVoteMap.get(v.drepId)!.set(key, v);
  }

  // Determine max withdrawal for amount-weight normalization
  const maxWithdrawal = Math.max(
    1,
    ...proposals
      .filter((p) => p.withdrawalAmountAda != null && p.withdrawalAmountAda > 0)
      .map((p) => p.withdrawalAmountAda!),
  );

  // Build proposal list + meta, filtering by participation rate
  const totalDreps = drepVoteMap.size;
  const proposalMeta: ProposalMeta[] = [];
  const proposalKeys: string[] = [];

  for (const p of proposals) {
    const key = `${p.txHash}-${p.index}`;
    let voterCount = 0;
    for (const [, voteMap] of drepVoteMap) {
      if (voteMap.has(key)) voterCount++;
    }
    if (totalDreps > 0 && voterCount / totalDreps < MIN_PARTICIPATION_RATE) continue;

    proposalKeys.push(key);
    proposalMeta.push({
      txHash: p.txHash,
      index: p.index,
      type: p.type,
      withdrawalAmountAda: p.withdrawalAmountAda,
      classification: classMap.get(key) || null,
    });
  }

  // Filter DReps with enough votes
  const qualifiedDrepIds: string[] = [];
  for (const [drepId, voteMap] of drepVoteMap) {
    let count = 0;
    for (const key of proposalKeys) {
      if (voteMap.has(key)) count++;
    }
    if (count >= MIN_DREP_VOTES) qualifiedDrepIds.push(drepId);
  }
  qualifiedDrepIds.sort();

  // Build matrix
  const matrix: number[][] = [];
  for (const drepId of qualifiedDrepIds) {
    const row: number[] = [];
    const voteMap = drepVoteMap.get(drepId)!;

    for (let j = 0; j < proposalKeys.length; j++) {
      const v = voteMap.get(proposalKeys[j]);
      if (!v) {
        row.push(NaN);
        continue;
      }

      let value: number;
      if (v.vote === 'Yes') value = 1;
      else if (v.vote === 'No') value = -1;
      else value = 0;

      // Temporal decay
      const age = now - v.blockTime * 1000;
      const decay = Math.exp(-LAMBDA * Math.max(0, age));
      value *= decay;

      // Amount-weight for treasury proposals
      const meta = proposalMeta[j];
      if (meta.withdrawalAmountAda != null && meta.withdrawalAmountAda > 0) {
        const amountWeight =
          Math.log10(meta.withdrawalAmountAda + 1) / Math.log10(maxWithdrawal + 1);
        value *= amountWeight;
      }

      row.push(value);
    }
    matrix.push(row);
  }

  return {
    matrix,
    drepIds: qualifiedDrepIds,
    proposalIds: proposalKeys,
    meta: proposalMeta,
  };
}

/**
 * Mean-impute NaN values in the matrix (per-column mean).
 * Returns a new matrix with no NaN values.
 */
export function imputeMatrix(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];

  const cols = matrix[0].length;
  const colMeans = new Array<number>(cols);

  for (let j = 0; j < cols; j++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < matrix.length; i++) {
      if (!isNaN(matrix[i][j])) {
        sum += matrix[i][j];
        count++;
      }
    }
    colMeans[j] = count > 0 ? sum / count : 0;
  }

  return matrix.map((row) => row.map((val, j) => (isNaN(val) ? colMeans[j] : val)));
}
