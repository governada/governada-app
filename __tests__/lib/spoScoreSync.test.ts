import { describe, expect, it, vi } from 'vitest';
import { CURRENT_SPO_SCORE_VERSION } from '@/lib/scoring/versioning';
import {
  buildSpoScoreSyncArtifacts,
  type ClassificationRow,
  type PoolRow,
  type SpoProposalRow,
  type SpoScoreHistoryRow,
  type SpoVoteRow,
} from '@/lib/scoring/spoScoreSync';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: (uri: string) => {
    try {
      const url = new URL(uri);
      return ['twitter.com', 'x.com', 'github.com'].some(
        (domain) => url.hostname === domain || url.hostname === `www.${domain}`,
      );
    } catch {
      return false;
    }
  },
}));

const NOW_ISO = '2026-04-05T12:00:00.000Z';
const NOW_SECONDS = Math.floor(Date.parse(NOW_ISO) / 1000);

function makeProposal(index: number): SpoProposalRow {
  return {
    tx_hash: `tx-${index}`,
    proposal_index: 0,
    proposal_type: 'HardForkInitiation',
    treasury_tier: null,
    withdrawal_amount: null,
    block_time: NOW_SECONDS - (index + 2) * 86400,
    proposed_epoch: 520 + index,
    expired_epoch: null,
    ratified_epoch: null,
    dropped_epoch: null,
  };
}

function makeVote(
  poolId: string,
  proposal: SpoProposalRow,
  vote: 'Yes' | 'No',
  txSuffix: string,
): SpoVoteRow {
  return {
    pool_id: poolId,
    proposal_tx_hash: proposal.tx_hash,
    proposal_index: proposal.proposal_index,
    vote,
    block_time: proposal.block_time + 3600,
    epoch: proposal.proposed_epoch,
    tx_hash: `${proposal.tx_hash}-${txSuffix}`,
  };
}

describe('buildSpoScoreSyncArtifacts', () => {
  it('builds persistence artifacts and completeness metadata for the SPO sync run', () => {
    const proposals = Array.from({ length: 5 }, (_, index) => makeProposal(index));
    const votes: SpoVoteRow[] = proposals.flatMap((proposal, index) => [
      makeVote('pool-1', proposal, index % 2 === 0 ? 'Yes' : 'No', 'a'),
      makeVote('pool-2', proposal, index % 2 === 0 ? 'Yes' : 'No', 'b'),
    ]);
    const classifications: ClassificationRow[] = proposals.map((proposal, index) => ({
      proposal_tx_hash: proposal.tx_hash,
      proposal_index: proposal.proposal_index,
      dim_treasury_conservative: index % 2 === 0 ? 1 : 0,
      dim_treasury_growth: index % 2 === 0 ? 0 : 1,
      dim_decentralization: 1,
      dim_security: 1,
      dim_innovation: 0,
      dim_transparency: 1,
    }));
    const pools: PoolRow[] = ['pool-1', 'pool-2'].map((poolId) => ({
      pool_id: poolId,
      ticker: poolId.toUpperCase(),
      pool_name: `Pool ${poolId}`,
      governance_statement:
        'We vote, govern, and support transparent Cardano treasury accountability for delegates.',
      homepage_url: 'https://github.com/governada',
      social_links: [{ uri: 'https://twitter.com/governada' }],
      metadata_hash_verified: true,
      delegator_count: 25,
    }));
    const historyRows: SpoScoreHistoryRow[] = [
      {
        pool_id: 'pool-1',
        governance_score: 62,
        snapshot_at: '2026-03-20T00:00:00.000Z',
      },
    ];

    const artifacts = buildSpoScoreSyncArtifacts({
      voteRows: votes,
      proposalRows: proposals,
      classificationRows: classifications,
      poolRows: pools,
      historyRows,
      currentEpoch: 530,
      identityEnabled: true,
      nowIso: NOW_ISO,
      nowSeconds: NOW_SECONDS,
    });

    expect(artifacts.summary).toMatchObject({
      success: true,
      poolsScored: 2,
      votesProcessed: 10,
      identityEnabled: true,
      poolsWithIdentity: 2,
      sybilFlags: 1,
    });
    expect(artifacts.sybilFlagInserts).toHaveLength(1);
    expect(artifacts.sybilFlagInserts[0]).toMatchObject({
      pool_a: 'pool-1',
      pool_b: 'pool-2',
      epoch_no: 530,
      detected_at: NOW_ISO,
      shared_votes: 5,
    });

    expect(artifacts.poolUpdates).toHaveLength(2);
    expect(
      artifacts.poolUpdates.every((row) => row.score_version === CURRENT_SPO_SCORE_VERSION),
    ).toBe(true);
    expect(artifacts.scoreSnapshots).toHaveLength(2);
    expect(artifacts.alignmentSnapshots).toHaveLength(2);
    expect(artifacts.completenessLog).toMatchObject({
      snapshot_type: 'spo_scores',
      epoch_no: 530,
      snapshot_date: '2026-04-05',
      record_count: 2,
      expected_count: 2,
      coverage_pct: 100,
      metadata: {
        identityEnabled: true,
        votesProcessed: 10,
        poolsWithIdentity: 2,
        sybilFlagsDetected: 1,
        v3: true,
      },
    });
  });
});
