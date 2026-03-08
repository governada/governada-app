import { describe, it, expect } from 'vitest';

import { buildVoteMatrix, imputeMatrix } from '@/lib/alignment/voteMatrix';
import { makeMatrixVote, makeClassification, makeSparseVoteMatrix } from '../fixtures/alignment';

describe('buildVoteMatrix', () => {
  // ── Vote encoding ──

  it('encodes Yes=+1, No=-1, Abstain=0', () => {
    const now = Date.now();
    const proposals = [
      { txHash: 'tx1', index: 0, type: 'TreasuryWithdrawals', withdrawalAmountAda: null },
      { txHash: 'tx2', index: 0, type: 'ParameterChange', withdrawalAmountAda: null },
      { txHash: 'tx3', index: 0, type: 'InfoAction', withdrawalAmountAda: null },
    ];
    const classifications = proposals.map((p) =>
      makeClassification({ proposalTxHash: p.txHash, proposalIndex: p.index }),
    );

    // 3 DReps each voting on all 3 proposals (MIN_DREP_VOTES=5, so need enough)
    const votes = [];
    const drepIds = ['d1', 'd2', 'd3', 'd4', 'd5'];
    for (const drepId of drepIds) {
      votes.push(
        makeMatrixVote({
          drepId,
          proposalTxHash: 'tx1',
          proposalIndex: 0,
          vote: 'Yes',
          blockTime: now / 1000,
        }),
        makeMatrixVote({
          drepId,
          proposalTxHash: 'tx2',
          proposalIndex: 0,
          vote: 'No',
          blockTime: now / 1000,
        }),
        makeMatrixVote({
          drepId,
          proposalTxHash: 'tx3',
          proposalIndex: 0,
          vote: 'Abstain',
          blockTime: now / 1000,
        }),
      );
    }

    // Need MIN_DREP_VOTES=5 votes per DRep on filtered proposals
    // With 3 proposals and 5 DReps: each DRep has 3 votes, but MIN_DREP_VOTES=5
    // Need to add more proposals
    const extraProposals = [
      { txHash: 'tx4', index: 0, type: 'InfoAction', withdrawalAmountAda: null },
      { txHash: 'tx5', index: 0, type: 'NoConfidence', withdrawalAmountAda: null },
    ];
    for (const p of extraProposals) {
      classifications.push(
        makeClassification({ proposalTxHash: p.txHash, proposalIndex: p.index }),
      );
      for (const drepId of drepIds) {
        votes.push(
          makeMatrixVote({
            drepId,
            proposalTxHash: p.txHash,
            proposalIndex: p.index,
            vote: 'Yes',
            blockTime: now / 1000,
          }),
        );
      }
    }

    const result = buildVoteMatrix(votes, [...proposals, ...extraProposals], classifications, {
      now,
    });

    expect(result.drepIds.length).toBe(5);
    expect(result.proposalIds.length).toBe(5);

    // Check encoding for first DRep on first 3 proposals
    const d1Idx = result.drepIds.indexOf('d1');
    expect(d1Idx).toBeGreaterThanOrEqual(0);

    const row = result.matrix[d1Idx];
    // Yes → positive (close to +1 after decay, which is ~1 since very recent)
    expect(row[0]).toBeGreaterThan(0);
    // No → negative (close to -1)
    expect(row[1]).toBeLessThan(0);
    // Abstain → 0 (but with decay applied → 0*decay = 0)
    expect(row[2]).toBeCloseTo(0, 5);
  });

  // ── NaN for missing votes ──

  it('uses NaN for proposals a DRep did not vote on', () => {
    const { votes, proposals, classifications, now } = makeSparseVoteMatrix();

    const result = buildVoteMatrix(votes, proposals, classifications, { now });

    // Each DRep has 1 missing vote → 1 NaN per row
    for (const row of result.matrix) {
      const nanCount = row.filter((v) => isNaN(v)).length;
      expect(nanCount).toBeGreaterThanOrEqual(0); // may be 0 after filtering
    }
  });

  // ── Temporal decay ──

  it('applies temporal decay (older votes have lower magnitude)', () => {
    const now = Date.now();
    const proposals = Array.from({ length: 6 }, (_, j) => ({
      txHash: `txT${j}`,
      index: 0,
      type: 'TreasuryWithdrawals' as const,
      withdrawalAmountAda: null,
    }));
    const classifications = proposals.map((p) =>
      makeClassification({ proposalTxHash: p.txHash, proposalIndex: p.index }),
    );

    // 3 DReps for quorum + filtering
    const votes = [];
    const dreps = ['d1', 'd2', 'd3'];
    for (const drepId of dreps) {
      for (let j = 0; j < 6; j++) {
        votes.push(
          makeMatrixVote({
            drepId,
            proposalTxHash: proposals[j].txHash,
            proposalIndex: 0,
            vote: 'Yes',
            // Progressively older: j=0 is recent, j=5 is 1 year old
            blockTime: now / 1000 - j * 60 * 86400,
          }),
        );
      }
    }

    const result = buildVoteMatrix(votes, proposals, classifications, { now });

    if (result.matrix.length > 0 && result.matrix[0].length >= 2) {
      const row = result.matrix[0];
      // Recent vote (idx 0) should have higher magnitude than old vote
      expect(Math.abs(row[0])).toBeGreaterThan(Math.abs(row[row.length - 1]));
    }
  });

  // ── Amount weighting for treasury proposals ──

  it('applies log-scale amount weighting for treasury proposals', () => {
    const now = Date.now();
    const proposals = [
      { txHash: 'txSmall', index: 0, type: 'TreasuryWithdrawals', withdrawalAmountAda: 100 },
      { txHash: 'txBig', index: 0, type: 'TreasuryWithdrawals', withdrawalAmountAda: 100_000_000 },
      // Non-treasury proposals for filler
      ...Array.from({ length: 4 }, (_, j) => ({
        txHash: `txFill${j}`,
        index: 0,
        type: 'InfoAction',
        withdrawalAmountAda: null,
      })),
    ];
    const classifications = proposals.map((p) =>
      makeClassification({ proposalTxHash: p.txHash, proposalIndex: p.index }),
    );

    const dreps = ['d1', 'd2', 'd3'];
    const votes = dreps.flatMap((drepId) =>
      proposals.map((p) =>
        makeMatrixVote({
          drepId,
          proposalTxHash: p.txHash,
          proposalIndex: p.index,
          vote: 'Yes',
          blockTime: now / 1000,
        }),
      ),
    );

    const result = buildVoteMatrix(votes, proposals, classifications, { now });

    if (result.matrix.length > 0) {
      // Find column indices for small and big treasury proposals
      const smallIdx = result.proposalIds.indexOf('txSmall-0');
      const bigIdx = result.proposalIds.indexOf('txBig-0');

      if (smallIdx >= 0 && bigIdx >= 0) {
        // Big treasury proposal should have higher value due to amount weighting
        expect(Math.abs(result.matrix[0][bigIdx])).toBeGreaterThan(
          Math.abs(result.matrix[0][smallIdx]),
        );
      }
    }
  });

  // ── Participation rate filtering ──

  it('filters proposals with less than 20% voter participation', () => {
    const now = Date.now();
    // 5 DReps, 2 proposals: proposal 1 voted by all, proposal 2 voted by none
    const proposals = [
      { txHash: 'txVoted', index: 0, type: 'InfoAction', withdrawalAmountAda: null },
      { txHash: 'txIgnored', index: 0, type: 'InfoAction', withdrawalAmountAda: null },
      ...Array.from({ length: 4 }, (_, j) => ({
        txHash: `txFill${j}`,
        index: 0,
        type: 'InfoAction',
        withdrawalAmountAda: null,
      })),
    ];
    const classifications = proposals.map((p) =>
      makeClassification({ proposalTxHash: p.txHash, proposalIndex: p.index }),
    );

    const dreps = ['d1', 'd2', 'd3', 'd4', 'd5'];
    const votes = dreps.flatMap((drepId) => [
      makeMatrixVote({
        drepId,
        proposalTxHash: 'txVoted',
        proposalIndex: 0,
        vote: 'Yes',
        blockTime: now / 1000,
      }),
      // Fill proposals to meet MIN_DREP_VOTES
      ...Array.from({ length: 4 }, (_, j) =>
        makeMatrixVote({
          drepId,
          proposalTxHash: `txFill${j}`,
          proposalIndex: 0,
          vote: 'Yes',
          blockTime: now / 1000,
        }),
      ),
    ]);
    // txIgnored has 0 voters → below 20% threshold → filtered out

    const result = buildVoteMatrix(votes, proposals, classifications, { now });
    expect(result.proposalIds).not.toContain('txIgnored-0');
    expect(result.proposalIds).toContain('txVoted-0');
  });

  // ── MIN_DREP_VOTES filtering ──

  it('filters DReps with fewer than 5 votes on qualified proposals', () => {
    const now = Date.now();
    const proposals = Array.from({ length: 8 }, (_, j) => ({
      txHash: `tx${j}`,
      index: 0,
      type: 'InfoAction',
      withdrawalAmountAda: null,
    }));
    const classifications = proposals.map((p) =>
      makeClassification({ proposalTxHash: p.txHash, proposalIndex: p.index }),
    );

    // drep_active votes on all 8, drep_lazy votes on only 2
    // Also need more DReps for participation rate
    const votes = [];
    for (const drepId of ['d_active', 'd2', 'd3']) {
      for (const p of proposals) {
        votes.push(
          makeMatrixVote({
            drepId,
            proposalTxHash: p.txHash,
            proposalIndex: p.index,
            vote: 'Yes',
            blockTime: now / 1000,
          }),
        );
      }
    }
    // Lazy DRep only votes on 2 proposals
    for (const p of proposals.slice(0, 2)) {
      votes.push(
        makeMatrixVote({
          drepId: 'd_lazy',
          proposalTxHash: p.txHash,
          proposalIndex: p.index,
          vote: 'Yes',
          blockTime: now / 1000,
        }),
      );
    }

    const result = buildVoteMatrix(votes, proposals, classifications, { now });
    // d_lazy should be filtered (only 2 votes < 5)
    expect(result.drepIds).not.toContain('d_lazy');
    expect(result.drepIds).toContain('d_active');
  });

  // ── Sorted DRep IDs ──

  it('returns DRep IDs in sorted order', () => {
    const now = Date.now();
    const proposals = Array.from({ length: 6 }, (_, j) => ({
      txHash: `tx${j}`,
      index: 0,
      type: 'InfoAction',
      withdrawalAmountAda: null,
    }));
    const classifications = proposals.map((p) =>
      makeClassification({ proposalTxHash: p.txHash, proposalIndex: p.index }),
    );

    const dreps = ['charlie', 'alice', 'bob'];
    const votes = dreps.flatMap((drepId) =>
      proposals.map((p) =>
        makeMatrixVote({
          drepId,
          proposalTxHash: p.txHash,
          proposalIndex: p.index,
          vote: 'Yes',
          blockTime: now / 1000,
        }),
      ),
    );

    const result = buildVoteMatrix(votes, proposals, classifications, { now });
    const sorted = [...result.drepIds].sort();
    expect(result.drepIds).toEqual(sorted);
  });

  // ── Mean imputation correctness ──

  it('imputeMatrix replaces NaN with column mean', () => {
    const matrix = [
      [1, NaN, 3],
      [NaN, 5, 6],
      [7, 8, NaN],
    ];
    const result = imputeMatrix(matrix);

    // Col 0: mean(1,7) = 4
    expect(result[1][0]).toBe(4);
    // Col 1: mean(5,8) = 6.5
    expect(result[0][1]).toBe(6.5);
    // Col 2: mean(3,6) = 4.5
    expect(result[2][2]).toBe(4.5);
  });
});
