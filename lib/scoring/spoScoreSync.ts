import { blockTimeToEpoch } from '@/lib/koios';
import { getExtendedImportanceWeight } from '@/lib/scoring';
import { computeConfidence } from '@/lib/scoring/confidence';
import { computeSpoDeliberationQuality } from '@/lib/scoring/spoDeliberationQuality';
import {
  computeSpoGovernanceIdentity,
  type SpoProfileData,
} from '@/lib/scoring/spoGovernanceIdentity';
import {
  computeProposalMarginMultipliers,
  computeSpoScores,
  type SpoScoreResult,
  type SpoVoteDataV3,
} from '@/lib/scoring/spoScore';
import { CURRENT_SPO_SCORE_VERSION } from '@/lib/scoring/versioning';
import { detectSybilPairs, type SybilFlag } from '@/lib/scoring/sybilDetection';
import {
  applySybilPenalty,
  computeSybilConfidencePenalty,
  type SybilConfidenceFlag,
} from '@/lib/scoring/sybilPenalty';
import { DECAY_LAMBDA } from '@/lib/scoring/types';

export interface SpoProposalRow {
  tx_hash: string;
  proposal_index: number;
  proposal_type: string;
  treasury_tier: string | null;
  withdrawal_amount: number | null;
  block_time: number;
  proposed_epoch: number | null;
  expired_epoch: number | null;
  ratified_epoch: number | null;
  dropped_epoch: number | null;
}

export interface SpoVoteRow {
  pool_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: string;
  block_time: number;
  epoch: number | null;
  tx_hash: string;
}

export interface ClassificationRow {
  proposal_tx_hash: string;
  proposal_index: number;
  dim_treasury_conservative: number | null;
  dim_treasury_growth: number | null;
  dim_decentralization: number | null;
  dim_security: number | null;
  dim_innovation: number | null;
  dim_transparency: number | null;
}

export interface PoolRow {
  pool_id: string;
  ticker: string | null;
  pool_name: string | null;
  governance_statement: string | null;
  homepage_url: string | null;
  social_links: Array<{ uri: string; label?: string }> | null;
  metadata_hash_verified: boolean | null;
  delegator_count: number | null;
}

export interface SpoScoreHistoryRow {
  pool_id: string;
  governance_score: number | null;
  snapshot_at: string | null;
}

export interface ExistingSybilFlagRow {
  pool_a: string | null;
  pool_b: string | null;
  agreement_rate: number | null;
  resolved: boolean | null;
}

type AlignmentDimension =
  | 'treasury_conservative'
  | 'treasury_growth'
  | 'decentralization'
  | 'security'
  | 'innovation'
  | 'transparency';

type PoolAlignment = Record<AlignmentDimension, number>;

interface ProposalContext {
  blockTime: number;
  importanceWeight: number;
  proposalType: string;
}

export interface SpoPoolUpdateRow {
  pool_id: string;
  governance_score: number;
  participation_raw: number;
  participation_pct: number;
  deliberation_raw: number;
  deliberation_pct: number;
  consistency_raw: number;
  consistency_pct: number;
  reliability_raw: number;
  reliability_pct: number;
  governance_identity_raw: number;
  governance_identity_pct: number;
  score_momentum: number | null;
  confidence: number;
  vote_count: number;
  alignment_treasury_conservative: number | null;
  alignment_treasury_growth: number | null;
  alignment_decentralization: number | null;
  alignment_security: number | null;
  alignment_innovation: number | null;
  alignment_transparency: number | null;
  score_version: string;
  updated_at: string;
}

export interface SpoScoreSnapshotRow {
  pool_id: string;
  epoch_no: number;
  governance_score: number;
  participation_rate: number;
  participation_pct: number;
  deliberation_raw: number;
  deliberation_pct: number;
  consistency_raw: number;
  consistency_pct: number;
  reliability_raw: number;
  reliability_pct: number;
  governance_identity_raw: number;
  governance_identity_pct: number;
  score_momentum: number | null;
  confidence: number;
  rationale_rate: null;
  vote_count: number;
  score_version: string;
}

export interface SpoAlignmentSnapshotRow {
  pool_id: string;
  epoch_no: number;
  alignment_treasury_conservative: number | null;
  alignment_treasury_growth: number | null;
  alignment_decentralization: number | null;
  alignment_security: number | null;
  alignment_innovation: number | null;
  alignment_transparency: number | null;
}

export interface SpoSybilFlagInsertRow {
  pool_a: string;
  pool_b: string;
  agreement_rate: number;
  shared_votes: number;
  detected_at: string;
  epoch_no: number;
}

export interface SpoSnapshotCompletenessLogRow {
  snapshot_type: 'spo_scores';
  epoch_no: number;
  snapshot_date: string;
  record_count: number;
  expected_count: number;
  coverage_pct: number;
  metadata: {
    identityEnabled: boolean;
    votesProcessed: number;
    poolsWithIdentity: number;
    sybilFlagsDetected: number;
    v3: true;
  };
}

export interface SpoScoreSyncArtifacts {
  summary: {
    success: true;
    poolsScored: number;
    votesProcessed: number;
    identityEnabled: boolean;
    poolsWithIdentity: number;
    sybilFlags: number;
  };
  finalScores: Map<string, SpoScoreResult>;
  poolUpdates: SpoPoolUpdateRow[];
  scoreSnapshots: SpoScoreSnapshotRow[];
  alignmentSnapshots: SpoAlignmentSnapshotRow[];
  sybilFlagInserts: SpoSybilFlagInsertRow[];
  completenessLog: SpoSnapshotCompletenessLogRow;
}

interface BuildSpoScoreSyncArtifactsOptions {
  voteRows: SpoVoteRow[];
  proposalRows: SpoProposalRow[];
  classificationRows: ClassificationRow[];
  poolRows: PoolRow[];
  historyRows?: SpoScoreHistoryRow[];
  existingSybilFlags?: SybilConfidenceFlag[];
  currentEpoch: number;
  identityEnabled: boolean;
  nowIso?: string;
  nowSeconds?: number;
}

const SPO_ELIGIBLE_TYPES = new Set([
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitutionalCommittee',
  'ParameterChange',
]);

const ALIGNMENT_DIMS: AlignmentDimension[] = [
  'treasury_conservative',
  'treasury_growth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

function getProposalKey(txHash: string, proposalIndex: number): string {
  return `${txHash}-${proposalIndex}`;
}

function buildProposalContexts(proposalRows: SpoProposalRow[]) {
  const proposalContexts = new Map<string, ProposalContext>();
  const proposalBlockTimes = new Map<string, number>();
  const proposalEpochs = new Map<string, number>();
  const proposalByKey = new Map<string, SpoProposalRow>();
  const allProposalTypes = new Set<string>();

  for (const proposal of proposalRows) {
    const key = getProposalKey(proposal.tx_hash, proposal.proposal_index);
    const importanceWeight = getExtendedImportanceWeight(
      proposal.proposal_type,
      proposal.treasury_tier,
      proposal.withdrawal_amount != null ? Number(proposal.withdrawal_amount) : null,
    );

    proposalByKey.set(key, proposal);
    proposalContexts.set(key, {
      blockTime: proposal.block_time || 0,
      importanceWeight,
      proposalType: proposal.proposal_type,
    });
    proposalBlockTimes.set(key, proposal.block_time || 0);
    allProposalTypes.add(proposal.proposal_type);
    if (proposal.proposed_epoch != null) {
      proposalEpochs.set(key, proposal.proposed_epoch);
    }
  }

  return {
    allProposalTypes,
    proposalBlockTimes,
    proposalByKey,
    proposalContexts,
    proposalEpochs,
  };
}

function buildActiveEpochs(
  proposalContexts: Map<string, ProposalContext>,
  proposalEpochs: Map<string, number>,
  voteRows: SpoVoteRow[],
): Set<number> {
  const activeEpochs = new Set<number>();

  for (const [key, epoch] of proposalEpochs) {
    const context = proposalContexts.get(key);
    if (context && SPO_ELIGIBLE_TYPES.has(context.proposalType)) {
      activeEpochs.add(epoch);
    }
  }

  for (const vote of voteRows) {
    activeEpochs.add(vote.epoch ?? blockTimeToEpoch(vote.block_time));
  }

  return activeEpochs;
}

function buildTotalWeightedPool(
  proposalContexts: Map<string, ProposalContext>,
  nowSeconds: number,
): number {
  let totalWeightedPool = 0;

  for (const [, context] of proposalContexts) {
    if (!SPO_ELIGIBLE_TYPES.has(context.proposalType)) continue;
    const ageDays = Math.max(0, (nowSeconds - context.blockTime) / 86400);
    totalWeightedPool += context.importanceWeight * Math.exp(-DECAY_LAMBDA * ageDays);
  }

  return totalWeightedPool;
}

function detectVoteChanges(voteRows: SpoVoteRow[]): Set<string> {
  const voteChanges = new Set<string>();
  const poolProposalTxHashes = new Map<string, Set<string>>();

  for (const vote of voteRows) {
    const compositeKey = `${vote.pool_id}::${getProposalKey(vote.proposal_tx_hash, vote.proposal_index)}`;
    const txSet = poolProposalTxHashes.get(compositeKey) ?? new Set<string>();
    txSet.add(vote.tx_hash);
    poolProposalTxHashes.set(compositeKey, txSet);
  }

  for (const [compositeKey, txSet] of poolProposalTxHashes) {
    if (txSet.size > 1) {
      voteChanges.add(compositeKey);
    }
  }

  return voteChanges;
}

function buildVoteArtifacts(
  voteRows: SpoVoteRow[],
  proposalContexts: Map<string, ProposalContext>,
  proposalByKey: Map<string, SpoProposalRow>,
  proposalBlockTimes: Map<string, number>,
) {
  const allVotes: SpoVoteDataV3[] = [];
  const poolVotes = new Map<string, SpoVoteDataV3[]>();
  const poolVoteMap = new Map<string, Map<string, 'Yes' | 'No' | 'Abstain'>>();

  for (const vote of voteRows) {
    const proposalKey = getProposalKey(vote.proposal_tx_hash, vote.proposal_index);
    const proposalContext = proposalContexts.get(proposalKey);
    const proposal = proposalByKey.get(proposalKey);

    const voteData: SpoVoteDataV3 = {
      poolId: vote.pool_id,
      proposalKey,
      vote: vote.vote as 'Yes' | 'No' | 'Abstain',
      blockTime: vote.block_time,
      epoch: vote.epoch ?? blockTimeToEpoch(vote.block_time),
      proposalType: proposal?.proposal_type ?? 'InfoAction',
      importanceWeight: proposalContext?.importanceWeight ?? 1,
      proposalBlockTime: proposalBlockTimes.get(proposalKey) ?? 0,
      hasRationale: false,
    };

    allVotes.push(voteData);
    const existingVotes = poolVotes.get(vote.pool_id) ?? [];
    existingVotes.push(voteData);
    poolVotes.set(vote.pool_id, existingVotes);

    const existingVoteMap =
      poolVoteMap.get(vote.pool_id) ?? new Map<string, 'Yes' | 'No' | 'Abstain'>();
    existingVoteMap.set(proposalKey, vote.vote as 'Yes' | 'No' | 'Abstain');
    poolVoteMap.set(vote.pool_id, existingVoteMap);
  }

  return { allVotes, poolVoteMap, poolVotes };
}

function buildSpoMajorityByProposal(poolVotes: Map<string, SpoVoteDataV3[]>) {
  const proposalVoteCounts = new Map<string, { yes: number; no: number }>();
  const spoMajorityByProposal = new Map<string, 'Yes' | 'No' | null>();

  for (const votes of poolVotes.values()) {
    for (const vote of votes) {
      if (vote.vote === 'Abstain') continue;
      const current = proposalVoteCounts.get(vote.proposalKey) ?? { yes: 0, no: 0 };
      if (vote.vote === 'Yes') current.yes++;
      else current.no++;
      proposalVoteCounts.set(vote.proposalKey, current);
    }
  }

  for (const [proposalKey, counts] of proposalVoteCounts) {
    spoMajorityByProposal.set(
      proposalKey,
      counts.yes === counts.no ? null : counts.yes > counts.no ? 'Yes' : 'No',
    );
  }

  return spoMajorityByProposal;
}

function buildDeliberationVotes(
  poolVotes: Map<string, SpoVoteDataV3[]>,
  voteChanges: Set<string>,
  spoMajorityByProposal: Map<string, 'Yes' | 'No' | null>,
) {
  const deliberationVotes = new Map<
    string,
    Array<{
      proposalKey: string;
      vote: 'Yes' | 'No' | 'Abstain';
      blockTime: number;
      proposalBlockTime: number;
      proposalType: string;
      importanceWeight: number;
      hasRationale: boolean;
      spoMajorityVote?: 'Yes' | 'No' | null;
      hasVoteChanged?: boolean;
    }>
  >();

  for (const [poolId, votes] of poolVotes) {
    deliberationVotes.set(
      poolId,
      votes.map((vote) => ({
        proposalKey: vote.proposalKey,
        vote: vote.vote,
        blockTime: vote.blockTime,
        proposalBlockTime: vote.proposalBlockTime,
        proposalType: vote.proposalType,
        importanceWeight: vote.importanceWeight,
        hasRationale: vote.hasRationale,
        spoMajorityVote: spoMajorityByProposal.get(vote.proposalKey) ?? null,
        hasVoteChanged: voteChanges.has(`${poolId}::${vote.proposalKey}`),
      })),
    );
  }

  return deliberationVotes;
}

function buildConfidences(
  poolVotes: Map<string, SpoVoteDataV3[]>,
  spoEligibleProposalTypes: Set<string>,
): Map<string, number> {
  const confidences = new Map<string, number>();

  for (const [poolId, votes] of poolVotes) {
    const epochs = new Set(votes.map((vote) => vote.epoch));
    const sortedEpochs = [...epochs].sort((a, b) => a - b);
    const epochSpan =
      sortedEpochs.length > 1 ? sortedEpochs[sortedEpochs.length - 1] - sortedEpochs[0] : 0;
    const types = new Set(votes.map((vote) => vote.proposalType));
    const spoEligibleVotedTypes = new Set(
      [...types].filter((type) => SPO_ELIGIBLE_TYPES.has(type)),
    );
    const typeCoverage =
      spoEligibleProposalTypes.size > 0
        ? spoEligibleVotedTypes.size / spoEligibleProposalTypes.size
        : 0;

    confidences.set(poolId, computeConfidence(votes.length, epochSpan, typeCoverage));
  }

  return confidences;
}

function buildSpoProfiles(
  poolRows: PoolRow[],
  poolVotes: Map<string, SpoVoteDataV3[]>,
): Map<string, SpoProfileData> {
  const poolMetaMap = new Map<string, PoolRow>();
  for (const pool of poolRows) {
    poolMetaMap.set(pool.pool_id, pool);
  }

  const profiles = new Map<string, SpoProfileData>();
  for (const poolId of poolVotes.keys()) {
    const meta = poolMetaMap.get(poolId);
    profiles.set(poolId, {
      poolId,
      ticker: meta?.ticker ?? null,
      poolName: meta?.pool_name ?? null,
      governanceStatement: meta?.governance_statement ?? null,
      poolDescription: null,
      homepageUrl: meta?.homepage_url ?? null,
      socialLinks: Array.isArray(meta?.social_links) ? meta.social_links : [],
      metadataHashVerified: meta?.metadata_hash_verified ?? false,
      delegatorCount: meta?.delegator_count ?? 0,
      voteCount: poolVotes.get(poolId)?.length ?? 0,
    });
  }

  return profiles;
}

function buildScoreHistory(historyRows: SpoScoreHistoryRow[]) {
  const scoreHistory = new Map<string, { date: string; score: number }[]>();

  for (const historyRow of historyRows) {
    if (!historyRow.governance_score || !historyRow.snapshot_at) continue;
    const existing = scoreHistory.get(historyRow.pool_id) ?? [];
    existing.push({
      date: historyRow.snapshot_at.slice(0, 10),
      score: historyRow.governance_score,
    });
    scoreHistory.set(historyRow.pool_id, existing);
  }

  return scoreHistory;
}

function buildAlignmentMap(classificationRows: ClassificationRow[]) {
  const classificationMap = new Map<string, Record<AlignmentDimension, number>>();

  for (const classification of classificationRows) {
    classificationMap.set(
      getProposalKey(classification.proposal_tx_hash, classification.proposal_index),
      {
        treasury_conservative: classification.dim_treasury_conservative ?? 0,
        treasury_growth: classification.dim_treasury_growth ?? 0,
        decentralization: classification.dim_decentralization ?? 0,
        security: classification.dim_security ?? 0,
        innovation: classification.dim_innovation ?? 0,
        transparency: classification.dim_transparency ?? 0,
      },
    );
  }

  return classificationMap;
}

function buildPoolAlignments(
  poolVotes: Map<string, SpoVoteDataV3[]>,
  classificationMap: Map<string, Record<AlignmentDimension, number>>,
): Map<string, PoolAlignment> {
  const poolAlignments = new Map<string, PoolAlignment>();

  for (const [poolId, votes] of poolVotes) {
    const dimSums = Object.fromEntries(ALIGNMENT_DIMS.map((dim) => [dim, 0])) as Record<
      AlignmentDimension,
      number
    >;
    const dimWeights = Object.fromEntries(ALIGNMENT_DIMS.map((dim) => [dim, 0])) as Record<
      AlignmentDimension,
      number
    >;

    for (const vote of votes) {
      const classification = classificationMap.get(vote.proposalKey);
      if (!classification) continue;

      const voteWeight = vote.vote === 'Yes' ? 1 : vote.vote === 'No' ? -1 : 0;
      if (voteWeight === 0) continue;

      for (const dim of ALIGNMENT_DIMS) {
        dimSums[dim] += voteWeight * (classification[dim] ?? 0);
        dimWeights[dim] += Math.abs(voteWeight);
      }
    }

    poolAlignments.set(
      poolId,
      Object.fromEntries(
        ALIGNMENT_DIMS.map((dim) => {
          const raw = dimWeights[dim] > 0 ? dimSums[dim] / dimWeights[dim] : 0;
          return [dim, Math.round(((raw + 1) / 2) * 100)];
        }),
      ) as PoolAlignment,
    );
  }

  return poolAlignments;
}

function buildPoolUpdateRows(
  finalScores: Map<string, SpoScoreResult>,
  poolVotes: Map<string, SpoVoteDataV3[]>,
  poolAlignments: Map<string, PoolAlignment>,
  nowIso: string,
): SpoPoolUpdateRow[] {
  return [...finalScores.entries()].map(([poolId, score]) => {
    const alignments = poolAlignments.get(poolId);
    const voteCount = poolVotes.get(poolId)?.length ?? 0;

    return {
      pool_id: poolId,
      governance_score: score.composite,
      participation_raw: Math.round(score.participationRaw),
      participation_pct: Math.round(score.participationCalibrated),
      deliberation_raw: Math.round(score.deliberationRaw),
      deliberation_pct: Math.round(score.deliberationCalibrated),
      consistency_raw: Math.round(score.consistencyRaw),
      consistency_pct: Math.round(score.consistencyCalibrated),
      reliability_raw: Math.round(score.reliabilityRaw),
      reliability_pct: Math.round(score.reliabilityCalibrated),
      governance_identity_raw: Math.round(score.governanceIdentityRaw),
      governance_identity_pct: Math.round(score.governanceIdentityCalibrated),
      score_momentum: score.momentum,
      confidence: score.confidence,
      vote_count: voteCount,
      alignment_treasury_conservative: alignments?.treasury_conservative ?? null,
      alignment_treasury_growth: alignments?.treasury_growth ?? null,
      alignment_decentralization: alignments?.decentralization ?? null,
      alignment_security: alignments?.security ?? null,
      alignment_innovation: alignments?.innovation ?? null,
      alignment_transparency: alignments?.transparency ?? null,
      score_version: CURRENT_SPO_SCORE_VERSION,
      updated_at: nowIso,
    };
  });
}

function buildScoreSnapshotRows(
  finalScores: Map<string, SpoScoreResult>,
  poolVotes: Map<string, SpoVoteDataV3[]>,
  currentEpoch: number,
): SpoScoreSnapshotRow[] {
  return [...finalScores.entries()].map(([poolId, score]) => ({
    pool_id: poolId,
    epoch_no: currentEpoch,
    governance_score: score.composite,
    participation_rate: Math.round(score.participationRaw),
    participation_pct: Math.round(score.participationCalibrated),
    deliberation_raw: Math.round(score.deliberationRaw),
    deliberation_pct: Math.round(score.deliberationCalibrated),
    consistency_raw: Math.round(score.consistencyRaw),
    consistency_pct: Math.round(score.consistencyCalibrated),
    reliability_raw: Math.round(score.reliabilityRaw),
    reliability_pct: Math.round(score.reliabilityCalibrated),
    governance_identity_raw: Math.round(score.governanceIdentityRaw),
    governance_identity_pct: Math.round(score.governanceIdentityCalibrated),
    score_momentum: score.momentum,
    confidence: score.confidence,
    rationale_rate: null,
    vote_count: poolVotes.get(poolId)?.length ?? 0,
    score_version: CURRENT_SPO_SCORE_VERSION,
  }));
}

function buildAlignmentSnapshotRows(
  poolAlignments: Map<string, PoolAlignment>,
  currentEpoch: number,
): SpoAlignmentSnapshotRow[] {
  return [...poolAlignments.entries()].map(([poolId, alignments]) => ({
    pool_id: poolId,
    epoch_no: currentEpoch,
    alignment_treasury_conservative: alignments.treasury_conservative ?? null,
    alignment_treasury_growth: alignments.treasury_growth ?? null,
    alignment_decentralization: alignments.decentralization ?? null,
    alignment_security: alignments.security ?? null,
    alignment_innovation: alignments.innovation ?? null,
    alignment_transparency: alignments.transparency ?? null,
  }));
}

function buildSybilFlagInsertRows(
  sybilFlags: SybilFlag[],
  currentEpoch: number,
  nowIso: string,
): SpoSybilFlagInsertRow[] {
  return sybilFlags.map((flag) => ({
    pool_a: flag.poolA,
    pool_b: flag.poolB,
    agreement_rate: flag.agreementRate,
    shared_votes: flag.sharedVotes,
    detected_at: nowIso,
    epoch_no: currentEpoch,
  }));
}

export function buildSpoScoreSyncArtifacts({
  voteRows,
  proposalRows,
  classificationRows,
  poolRows,
  historyRows = [],
  existingSybilFlags = [],
  currentEpoch,
  identityEnabled,
  nowIso = new Date().toISOString(),
  nowSeconds = Math.floor(Date.now() / 1000),
}: BuildSpoScoreSyncArtifactsOptions): SpoScoreSyncArtifacts {
  const { allProposalTypes, proposalBlockTimes, proposalByKey, proposalContexts, proposalEpochs } =
    buildProposalContexts(proposalRows);
  const activeEpochs = buildActiveEpochs(proposalContexts, proposalEpochs, voteRows);
  const totalWeightedPool = buildTotalWeightedPool(proposalContexts, nowSeconds);
  const voteChanges = detectVoteChanges(voteRows);
  const { allVotes, poolVoteMap, poolVotes } = buildVoteArtifacts(
    voteRows,
    proposalContexts,
    proposalByKey,
    proposalBlockTimes,
  );
  const spoMajorityByProposal = buildSpoMajorityByProposal(poolVotes);
  const deliberationVotes = buildDeliberationVotes(poolVotes, voteChanges, spoMajorityByProposal);
  const spoEligibleProposalTypes = new Set(
    [...allProposalTypes].filter((proposalType) => SPO_ELIGIBLE_TYPES.has(proposalType)),
  );
  const deliberationScores = computeSpoDeliberationQuality(
    deliberationVotes,
    spoEligibleProposalTypes,
    nowSeconds,
  );
  const confidences = buildConfidences(poolVotes, spoEligibleProposalTypes);
  const profiles = buildSpoProfiles(poolRows, poolVotes);
  const identityScores = identityEnabled ? computeSpoGovernanceIdentity(profiles) : new Map();
  const scoreHistory = buildScoreHistory(historyRows);
  const sybilFlags = detectSybilPairs(poolVoteMap);

  const allSybilFlags: SybilConfidenceFlag[] = [
    ...existingSybilFlags,
    ...sybilFlags.map((flag) => ({
      pool_a: flag.poolA,
      pool_b: flag.poolB,
      agreement_rate: flag.agreementRate,
      resolved: false,
    })),
  ];

  for (const [poolId, baseConfidence] of confidences) {
    const penalty = computeSybilConfidencePenalty(poolId, allSybilFlags);
    if (penalty > 0) {
      confidences.set(poolId, applySybilPenalty(baseConfidence, penalty));
    }
  }

  const proposalMarginMultipliers = computeProposalMarginMultipliers(allVotes);
  const finalScores = computeSpoScores(
    allVotes,
    totalWeightedPool,
    currentEpoch,
    spoEligibleProposalTypes,
    identityScores,
    deliberationScores,
    confidences,
    scoreHistory,
    proposalMarginMultipliers,
    activeEpochs,
  );
  const classificationMap = buildAlignmentMap(classificationRows);
  const poolAlignments = buildPoolAlignments(poolVotes, classificationMap);
  const poolUpdates = buildPoolUpdateRows(finalScores, poolVotes, poolAlignments, nowIso);
  const scoreSnapshots = buildScoreSnapshotRows(finalScores, poolVotes, currentEpoch);
  const alignmentSnapshots = buildAlignmentSnapshotRows(poolAlignments, currentEpoch);
  const sybilFlagInserts = buildSybilFlagInsertRows(sybilFlags, currentEpoch, nowIso);

  return {
    summary: {
      success: true,
      poolsScored: finalScores.size,
      votesProcessed: voteRows.length,
      identityEnabled,
      poolsWithIdentity: identityScores.size,
      sybilFlags: sybilFlags.length,
    },
    finalScores,
    poolUpdates,
    scoreSnapshots,
    alignmentSnapshots,
    sybilFlagInserts,
    completenessLog: {
      snapshot_type: 'spo_scores',
      epoch_no: currentEpoch,
      snapshot_date: nowIso.slice(0, 10),
      record_count: finalScores.size,
      expected_count: poolVotes.size,
      coverage_pct:
        poolVotes.size > 0 ? Math.round((finalScores.size / poolVotes.size) * 100) : 100,
      metadata: {
        identityEnabled,
        votesProcessed: voteRows.length,
        poolsWithIdentity: identityScores.size,
        sybilFlagsDetected: sybilFlags.length,
        v3: true,
      },
    },
  };
}
