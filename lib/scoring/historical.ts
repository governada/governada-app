/**
 * Historical DRep Scoring — epoch-scoped variant of the live scoring pipeline.
 *
 * Computes all 4 pillars (Engagement Quality, Effective Participation,
 * Reliability, Governance Identity) using only data available at a given epoch.
 *
 * Designed for the GHI historical backfill (epochs 530-621).
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { computeEngagementQuality } from './engagementQuality';
import {
  computeEffectiveParticipation,
  getExtendedImportanceWeight,
} from './effectiveParticipation';
import type { VoteData, ProposalScoringContext, ProposalVotingSummary } from './types';
import { computeReliability } from './reliability';
import { computeGovernanceIdentity } from './governanceIdentity';
import type { DRepProfileData, DelegationSnapshotData } from './types';
import { computeDRepScores } from './drepScore';
import { computeDRepConfidence } from './confidence';
import { logger } from '@/lib/logger';

// Cardano epoch 208 started 2020-07-29T21:44:51Z; each epoch = 5 days
const EPOCH_208_START_MS = new Date('2020-07-29T21:44:51Z').getTime();
const EPOCH_LENGTH_MS = 5 * 24 * 60 * 60 * 1000;

/** Approximate start date of a Cardano epoch */
export function epochToDate(epoch: number): Date {
  return new Date(EPOCH_208_START_MS + (epoch - 208) * EPOCH_LENGTH_MS);
}

/** Approximate end-of-epoch timestamp in seconds */
function epochEndSeconds(epoch: number): number {
  return Math.floor((EPOCH_208_START_MS + (epoch - 208 + 1) * EPOCH_LENGTH_MS) / 1000);
}

export interface EpochDRepScoreRow {
  drepId: string;
  score: number;
  engagementQuality: number;
  engagementQualityRaw: number;
  effectiveParticipationV3: number;
  effectiveParticipationV3Raw: number;
  reliabilityV3: number;
  reliabilityV3Raw: number;
  governanceIdentity: number;
  governanceIdentityRaw: number;
}

/**
 * Compute DRep scores using only data available at `targetEpoch`.
 * Returns scored DReps and their pillar breakdowns.
 */
export async function computeDRepScoresForEpoch(targetEpoch: number): Promise<EpochDRepScoreRow[]> {
  const supabase = getSupabaseAdmin();
  const nowSeconds = epochEndSeconds(targetEpoch);

  // ── Fetch epoch-scoped vote data ──────────────────────────────────────
  const { data: rawVotes } = await supabase
    .from('drep_votes')
    .select(
      'drep_id, proposal_tx_hash, proposal_index, vote, block_time, epoch_no, rationale_quality, meta_hash, meta_url',
    )
    .lte('epoch_no', targetEpoch)
    .order('block_time', { ascending: true })
    .range(0, 99999);

  if (!rawVotes?.length) {
    logger.info(`[historical] No votes found for epoch <= ${targetEpoch}`);
    return [];
  }

  // ── Fetch epoch-scoped proposals ──────────────────────────────────────
  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, proposal_type, proposed_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, treasury_withdrawal_amount, block_time',
    )
    .lte('proposed_epoch', targetEpoch)
    .range(0, 99999);

  // ── Fetch proposal voting summaries ───────────────────────────────────
  const { data: votingSummaries } = await supabase
    .from('proposal_voting_summary')
    .select(
      'proposal_tx_hash, proposal_index, drep_yes_vote_power, drep_no_vote_power, drep_abstain_vote_power',
    )
    .range(0, 99999);

  // ── Build typed maps ──────────────────────────────────────────────────

  // Group votes by DRep
  const drepVotes = new Map<string, VoteData[]>();
  const drepIds = new Set<string>();

  // Build proposal context map
  const proposalContextMap = new Map<string, ProposalScoringContext>();
  for (const p of proposals ?? []) {
    const key = `${p.tx_hash}-${p.proposal_index}`;
    const amount = p.treasury_withdrawal_amount
      ? Number(p.treasury_withdrawal_amount) / 1_000_000
      : null;
    let treasuryTier: string | null = null;
    if (amount !== null) {
      if (amount >= 10_000_000) treasuryTier = 'major';
      else if (amount >= 1_000_000) treasuryTier = 'significant';
      else treasuryTier = 'standard';
    }
    const proposalType = p.proposal_type ?? 'Unknown';
    proposalContextMap.set(key, {
      proposalKey: key,
      proposalType,
      treasuryTier,
      withdrawalAmount: amount,
      blockTime: (p.block_time as number) ?? 0,
      importanceWeight: getExtendedImportanceWeight(proposalType, treasuryTier, amount),
    });
  }

  // Proposal type counts (for coverage breadth)
  const proposalTypeCounts = new Map<string, number>();
  for (const p of proposals ?? []) {
    const t = p.proposal_type ?? 'Unknown';
    proposalTypeCounts.set(t, (proposalTypeCounts.get(t) ?? 0) + 1);
  }

  // Build vote data per DRep
  const voteChanges = new Set<string>(); // track vote changes
  const latestVotePerDRepProposal = new Map<string, (typeof rawVotes)[0]>();

  // First pass: detect vote changes
  for (const v of rawVotes) {
    const key = `${v.drep_id}:${v.proposal_tx_hash}-${v.proposal_index}`;
    if (latestVotePerDRepProposal.has(key)) {
      voteChanges.add(key);
    }
    latestVotePerDRepProposal.set(key, v);
  }

  // Second pass: build VoteData (use latest vote per DRep-proposal)
  for (const [key, v] of latestVotePerDRepProposal) {
    const proposalKey = `${v.proposal_tx_hash}-${v.proposal_index}`;
    const ctx = proposalContextMap.get(proposalKey);
    const voteData: VoteData = {
      drepId: v.drep_id,
      proposalKey,
      vote: v.vote as 'Yes' | 'No' | 'Abstain',
      blockTime: v.block_time ?? 0,
      proposalBlockTime: ctx?.blockTime ?? 0,
      proposalType: ctx?.proposalType ?? 'Unknown',
      rationaleQuality: v.rationale_quality as number | null,
      importanceWeight: ctx?.importanceWeight ?? 1,
      rationaleMetaHash: v.meta_hash as string | null,
      hasVoteChanged: voteChanges.has(key),
    };

    drepIds.add(v.drep_id);
    const existing = drepVotes.get(v.drep_id) ?? [];
    existing.push(voteData);
    drepVotes.set(v.drep_id, existing);
  }

  // ── Voting summaries map ──────────────────────────────────────────────
  const votingSummaryMap = new Map<string, ProposalVotingSummary>();
  for (const vs of votingSummaries ?? []) {
    const key = `${vs.proposal_tx_hash}-${vs.proposal_index}`;
    votingSummaryMap.set(key, {
      proposalKey: key,
      drepYesVotePower: Number(vs.drep_yes_vote_power ?? 0),
      drepNoVotePower: Number(vs.drep_no_vote_power ?? 0),
      drepAbstainVotePower: Number(vs.drep_abstain_vote_power ?? 0),
    });
  }

  // ── Semantic diversity from embeddings (not epoch-scoped) ─────────────
  let semanticDiversity: Map<string, number> | undefined;
  try {
    const { data: embeddings } = await supabase
      .from('embeddings')
      .select('entity_id, secondary_id, embedding')
      .eq('entity_type', 'rationale')
      .range(0, 9999);

    if (embeddings?.length && embeddings.length >= 2) {
      // Group by DRep (secondary_id is drep_id for rationale embeddings)
      const drepEmbeddings = new Map<string, number[][]>();
      for (const e of embeddings) {
        const drepId = e.secondary_id;
        if (!drepId) continue;
        const group = drepEmbeddings.get(drepId) ?? [];
        group.push(e.embedding as unknown as number[]);
        drepEmbeddings.set(drepId, group);
      }

      semanticDiversity = new Map();
      const { computePairwiseDiversity } = await import('@/lib/embeddings/quality');
      for (const [drepId, embs] of drepEmbeddings) {
        if (embs.length >= 2) {
          semanticDiversity.set(drepId, computePairwiseDiversity(embs) * 100);
        }
      }
    }
  } catch {
    // Embeddings not available — proceed without
  }

  // ── Compute Engagement Quality ────────────────────────────────────────
  const rawEngagement = computeEngagementQuality(
    drepVotes,
    votingSummaryMap,
    proposalTypeCounts,
    nowSeconds,
    semanticDiversity,
  );

  // ── Compute Effective Participation ───────────────────────────────────
  const rawParticipation = computeEffectiveParticipation(
    drepVotes,
    proposalContextMap,
    votingSummaryMap,
    nowSeconds,
  );

  // ── Compute Reliability ───────────────────────────────────────────────
  // Build epoch vote counts per DRep and proposal-epoch map
  const proposalEpochs = new Map<number, number>();
  for (const p of proposals ?? []) {
    const e = p.proposed_epoch as number;
    if (e > 0) proposalEpochs.set(e, (proposalEpochs.get(e) ?? 0) + 1);
  }

  const drepEpochData = new Map<string, { counts: number[]; firstEpoch: number }>();
  for (const [drepId, votes] of drepVotes) {
    const epochCounts = new Map<number, number>();
    let firstEpoch = targetEpoch;
    for (const v of votes) {
      // Extract epoch from block_time approximation
      const voteEpoch = Math.floor(
        (v.blockTime * 1000 - EPOCH_208_START_MS) / EPOCH_LENGTH_MS + 208,
      );
      epochCounts.set(voteEpoch, (epochCounts.get(voteEpoch) ?? 0) + 1);
      if (voteEpoch < firstEpoch) firstEpoch = voteEpoch;
    }
    // Build array indexed by epoch offset
    const counts: number[] = [];
    for (let e = firstEpoch; e <= targetEpoch; e++) {
      counts.push(epochCounts.get(e) ?? 0);
    }
    drepEpochData.set(drepId, { counts, firstEpoch });
  }

  const rawReliability = computeReliability(drepVotes, proposalEpochs, targetEpoch, drepEpochData);

  // ── Compute Governance Identity ───────────────────────────────────────
  // Use current metadata for all epochs (pragmatic decision — profiles rarely change)
  // Fetch ALL DReps with metadata — avoid .in() with 500+ IDs (PostgREST URL length limit)
  const { data: drepProfiles } = await supabase
    .from('dreps')
    .select(
      'id, metadata, delegator_count, metadata_hash_verified, profile_last_changed_at, updated_at',
    )
    .not('metadata', 'is', null)
    .range(0, 99999);

  const profiles = new Map<string, DRepProfileData>();
  for (const d of drepProfiles ?? []) {
    // Only include DReps that actually voted in the epoch range
    if (!drepIds.has(d.id)) continue;
    profiles.set(d.id, {
      drepId: d.id,
      metadata: d.metadata as Record<string, unknown> | null,
      delegatorCount: (d.delegator_count as number) ?? 0,
      metadataHashVerified: d.metadata_hash_verified ?? false,
      updatedAt: d.profile_last_changed_at
        ? Math.floor(new Date(d.profile_last_changed_at as string).getTime() / 1000)
        : d.updated_at
          ? Math.floor(new Date(d.updated_at as string).getTime() / 1000)
          : null,
      profileLastChangedAt: d.profile_last_changed_at
        ? Math.floor(new Date(d.profile_last_changed_at as string).getTime() / 1000)
        : null,
    });
  }

  // Delegation snapshots at target epoch for Community Presence
  const delegationSnapshots = new Map<string, DelegationSnapshotData>();
  if (targetEpoch >= 509) {
    const startEpoch = Math.max(509, targetEpoch - 10);
    const { data: snaps } = await supabase
      .from('delegation_snapshots')
      .select(
        'drep_id, epoch_no, delegator_count, new_delegators, lost_delegators, total_power_lovelace',
      )
      .gte('epoch_no', startEpoch)
      .lte('epoch_no', targetEpoch)
      .range(0, 99999);

    // Group by DRep
    const grouped = new Map<
      string,
      Array<{
        epoch: number;
        delegatorCount: number;
        totalPowerLovelace: number;
        newDelegators: number | null;
        lostDelegators: number | null;
      }>
    >();

    for (const s of snaps ?? []) {
      const arr = grouped.get(s.drep_id) ?? [];
      arr.push({
        epoch: s.epoch_no as number,
        delegatorCount: (s.delegator_count as number) ?? 0,
        totalPowerLovelace: Number(s.total_power_lovelace ?? 0),
        newDelegators: s.new_delegators as number | null,
        lostDelegators: s.lost_delegators as number | null,
      });
      grouped.set(s.drep_id, arr);
    }

    for (const [drepId, epochs] of grouped) {
      delegationSnapshots.set(drepId, {
        epochs: epochs.sort((a, b) => a.epoch - b.epoch),
      });
    }
  }

  const rawIdentity = computeGovernanceIdentity(profiles, delegationSnapshots, nowSeconds);

  // ── Compute confidence per DRep ───────────────────────────────────────
  const confidences = new Map<string, number>();
  for (const [drepId, votes] of drepVotes) {
    const voteCount = votes.length;
    const voteEpochs = new Set(
      votes.map((v) =>
        Math.floor((v.blockTime * 1000 - EPOCH_208_START_MS) / EPOCH_LENGTH_MS + 208),
      ),
    );
    const firstEpoch = Math.min(...voteEpochs);
    const epochSpan = targetEpoch - firstEpoch;
    const typesVoted = new Set(votes.map((v) => v.proposalType));
    const typeCoverage =
      proposalTypeCounts.size > 0 ? typesVoted.size / proposalTypeCounts.size : 0;
    confidences.set(drepId, computeDRepConfidence(voteCount, epochSpan, typeCoverage));
  }

  // ── Composite scoring ─────────────────────────────────────────────────
  const emptyHistory = new Map<string, { date: string; score: number }[]>();
  const results = computeDRepScores(
    rawEngagement,
    rawParticipation,
    rawReliability,
    rawIdentity,
    emptyHistory, // no momentum for backfill — it would be circular
    confidences,
  );

  // ── Map to output rows ────────────────────────────────────────────────
  const rows: EpochDRepScoreRow[] = [];
  for (const [drepId, result] of results) {
    rows.push({
      drepId,
      score: result.composite,
      engagementQuality: result.engagementQualityCalibrated,
      engagementQualityRaw: result.engagementQualityRaw,
      effectiveParticipationV3: result.effectiveParticipationCalibrated,
      effectiveParticipationV3Raw: result.effectiveParticipationRaw,
      reliabilityV3: result.reliabilityCalibrated,
      reliabilityV3Raw: result.reliabilityRaw,
      governanceIdentity: result.governanceIdentityCalibrated,
      governanceIdentityRaw: result.governanceIdentityRaw,
    });
  }

  logger.info(`[historical] Computed ${rows.length} DRep scores for epoch ${targetEpoch}`);
  return rows;
}
