/**
 * Data Moat Collection Sync
 *
 * Collects historical data that compounds over time and becomes impossible
 * for competitors to replicate. Every epoch we don't collect is an epoch lost forever.
 *
 * 5 collection streams:
 * 1. DRep Delegator Snapshots (per-epoch delegation distribution)
 * 2. DRep Lifecycle Events (registration, updates, retirements)
 * 3. Epoch Governance Summaries (aggregate per-epoch stats)
 * 4. Committee Members (CC membership and terms)
 * 5. Metadata Archive (persistent CIP-119/108/136 blobs)
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { SyncLogger, batchUpsert, errMsg, fetchAll } from '@/lib/sync-utils';
import { blockTimeToEpoch } from '@/lib/koios';
import { getSyncCursorTimestamp, setSyncCursorTimestamp } from '@/lib/sync/cursors';
import {
  fetchDRepDelegatorsFull,
  fetchDRepUpdates,
  fetchDRepEpochSummary,
  fetchEpochInfo,
  fetchCommitteeInfo,
} from '@/utils/koios';
import { createHash } from 'crypto';

const DELEGATOR_CONCURRENCY = 5;
const DREP_METADATA_ARCHIVE_CURSOR = 'metadata_archive:drep';
const PROPOSAL_METADATA_ARCHIVE_CURSOR = 'metadata_archive:proposal';
const RATIONALE_METADATA_ARCHIVE_CURSOR = 'metadata_archive:rationale';
const DREP_METADATA_FETCH_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// 1. DRep Delegator Snapshots
// ---------------------------------------------------------------------------

/**
 * Prepare delegator snapshot: check coverage and return DRep IDs that still need processing.
 * Returns null if coverage is already sufficient (>= 95%).
 */
export async function prepareDelegatorSnapshot(): Promise<{
  epoch: number;
  drepIds: string[];
} | null> {
  const supabase = getSupabaseAdmin();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // Get active DReps
  const { data: dreps } = await supabase
    .from('dreps')
    .select('id')
    .filter('info->>isActive', 'eq', 'true');

  if (!dreps?.length) return null;

  // Check coverage: how many DReps already have snapshots this epoch?
  const { count: snappedDreps } = await supabase
    .from('drep_delegator_snapshots')
    .select('drep_id', { count: 'exact', head: true })
    .eq('epoch_no', currentEpoch);

  const coverage = (snappedDreps ?? 0) / dreps.length;
  if (coverage >= 0.95) {
    logger.info('[data-moat] Delegator snapshots already at sufficient coverage', {
      epoch: currentEpoch,
      snappedDreps,
      totalDreps: dreps.length,
      coverage: `${(coverage * 100).toFixed(1)}%`,
    });
    return null;
  }

  // If partially done, only return DReps not yet snapshotted
  let drepIds = dreps.map((d) => d.id);
  if ((snappedDreps ?? 0) > 0) {
    const { data: existing } = await supabase
      .from('drep_delegator_snapshots')
      .select('drep_id')
      .eq('epoch_no', currentEpoch);
    const done = new Set((existing ?? []).map((r) => r.drep_id));
    drepIds = drepIds.filter((id) => !done.has(id));
  }

  return { epoch: currentEpoch, drepIds };
}

/**
 * Process a chunk of DReps for delegator snapshots.
 * Designed to run within a single Inngest step (< 60s).
 */
export async function syncDelegatorSnapshotChunk(
  drepIds: string[],
  epoch: number,
): Promise<{ drepsProcessed: number; delegatorsSnapshotted: number; errors: string[] }> {
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];
  let drepsProcessed = 0;
  let delegatorsSnapshotted = 0;

  for (let i = 0; i < drepIds.length; i += DELEGATOR_CONCURRENCY) {
    const chunk = drepIds.slice(i, i + DELEGATOR_CONCURRENCY);

    const results = await Promise.allSettled(
      chunk.map(async (drepId) => {
        try {
          const delegators = await fetchDRepDelegatorsFull(drepId);
          if (delegators.length === 0) return 0;

          const rows = delegators.map((d) => ({
            drep_id: drepId,
            epoch_no: epoch,
            stake_address: d.stake_address,
            amount_lovelace: parseInt(d.amount || '0', 10),
          }));

          const result = await batchUpsert(
            supabase,
            'drep_delegator_snapshots',
            rows,
            'drep_id,epoch_no,stake_address',
            `delegator-snap-${drepId.slice(0, 12)}`,
          );
          return result.success;
        } catch (err) {
          errors.push(`${drepId.slice(0, 16)}: ${errMsg(err)}`);
          return 0;
        }
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        delegatorsSnapshotted += r.value;
        drepsProcessed++;
      }
    }
  }

  return { drepsProcessed, delegatorsSnapshotted, errors };
}

/**
 * Finalize delegator snapshot: write completeness log and sync_log.
 */
export async function finalizeDelegatorSnapshot(
  epoch: number,
  totalProcessed: number,
  totalSnapshotted: number,
  allErrors: string[],
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'delegator_snapshots');
  await syncLog.start();

  const { data: dreps } = await supabase
    .from('dreps')
    .select('id', { count: 'exact', head: true })
    .filter('info->>isActive', 'eq', 'true');

  const totalDreps = dreps?.length ?? totalProcessed;

  await supabase.from('snapshot_completeness_log').upsert(
    {
      snapshot_type: 'delegator_snapshots',
      epoch_no: epoch,
      snapshot_date: new Date().toISOString().slice(0, 10),
      record_count: totalSnapshotted,
      expected_count: totalDreps,
      coverage_pct: totalDreps > 0 ? Math.round((totalProcessed / totalDreps) * 10000) / 100 : 100,
    },
    { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
  );

  const metrics = {
    drepsProcessed: totalProcessed,
    delegatorsSnapshotted: totalSnapshotted,
    epoch,
  };
  await syncLog.finalize(
    allErrors.length === 0,
    allErrors.length ? allErrors.join('; ') : null,
    metrics,
  );
}

// ---------------------------------------------------------------------------
// 2. DRep Lifecycle Events
// ---------------------------------------------------------------------------

export async function syncDRepLifecycleEvents(): Promise<{
  eventsStored: number;
  drepsProcessed: number;
  errors: string[];
}> {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'drep_lifecycle');
  await syncLog.start();

  const errors: string[] = [];
  let eventsStored = 0;

  try {
    // Fetch ALL lifecycle events in one paginated call (GET, ~3-4K records).
    // The old POST /drep_updates was removed from Koios v1 — this uses the
    // GET endpoint which returns all DRep registration/update/deregistration events.
    const updates = await fetchDRepUpdates();

    if (updates.length === 0) {
      await syncLog.finalize(true, null, { eventsStored: 0, note: 'no_events_returned' });
      return { eventsStored: 0, drepsProcessed: 0, errors: [] };
    }

    const uniqueDreps = new Set(updates.map((u) => u.drep_id));

    // Map Koios action values to DB CHECK constraint values:
    // Koios returns 'registered'/'deregistered'/'updated'
    // DB CHECK expects 'registration'/'deregistration'/'update'
    const actionMap: Record<string, string> = {
      registered: 'registration',
      deregistered: 'deregistration',
      updated: 'update',
    };

    const rows = updates.map((u) => ({
      drep_id: u.drep_id,
      action: actionMap[u.action] ?? u.action,
      tx_hash: u.update_tx_hash,
      epoch_no: u.block_time ? blockTimeToEpoch(u.block_time) : 0,
      block_time: u.block_time,
      deposit: u.deposit,
      anchor_url: u.meta_url,
      anchor_hash: u.meta_hash,
    }));

    // Batch upsert (unique constraint: drep_id + tx_hash)
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      try {
        const result = await batchUpsert(
          supabase,
          'drep_lifecycle_events',
          batch,
          'drep_id,tx_hash',
          `lifecycle-batch-${Math.floor(i / 200)}`,
        );
        eventsStored += result.success;
      } catch (err) {
        errors.push(`Lifecycle batch ${Math.floor(i / 200)}: ${errMsg(err)}`);
      }
    }

    const metrics = {
      eventsStored,
      drepsProcessed: uniqueDreps.size,
      totalEvents: updates.length,
    };
    await syncLog.finalize(errors.length === 0, errors.length ? errors.join('; ') : null, metrics);
    return { eventsStored, drepsProcessed: uniqueDreps.size, errors };
  } catch (err) {
    await syncLog.finalize(false, errMsg(err), { eventsStored });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. Epoch Governance Summaries
// ---------------------------------------------------------------------------

export async function syncEpochGovernanceSummaries(): Promise<{
  epochsStored: number;
  errors: string[];
}> {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'epoch_summaries');
  await syncLog.start();

  const errors: string[] = [];
  let epochsStored = 0;

  try {
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    // Fetch DRep aggregate stats and epoch info in parallel
    const [drepSummaries, epochInfos] = await Promise.all([
      fetchDRepEpochSummary(),
      fetchEpochInfo(),
    ]);

    // Also get proposal/vote counts from our DB for epochs we have data for
    const { data: proposalCounts } = await supabase
      .from('proposals')
      .select('proposed_epoch')
      .gte('proposed_epoch', currentEpoch - 100);

    const { data: voteCounts } = await supabase
      .from('drep_votes')
      .select('epoch_no')
      .gte('epoch_no', currentEpoch - 100);

    // Build proposal count per epoch
    const proposalsByEpoch = new Map<number, number>();
    for (const p of proposalCounts || []) {
      const e = p.proposed_epoch;
      if (e != null) proposalsByEpoch.set(e, (proposalsByEpoch.get(e) || 0) + 1);
    }

    // Build vote count per epoch
    const votesByEpoch = new Map<number, number>();
    for (const v of voteCounts || []) {
      const e = v.epoch_no;
      if (e != null) votesByEpoch.set(e, (votesByEpoch.get(e) || 0) + 1);
    }

    // Index epoch info by epoch
    const epochInfoMap = new Map(epochInfos.map((e) => [e.epoch_no, e]));

    // Build rows from DRep summaries enriched with epoch info
    const rows = drepSummaries.map((ds) => {
      const ei = epochInfoMap.get(ds.epoch_no);
      return {
        epoch_no: ds.epoch_no,
        total_dreps: ds.drep_count,
        active_dreps: ds.active_drep_count,
        total_voting_power_lovelace: parseInt(ds.total_active_voting_power || '0', 10),
        total_proposals: proposalsByEpoch.get(ds.epoch_no) || null,
        total_votes: votesByEpoch.get(ds.epoch_no) || null,
        block_count: ei?.blk_count || null,
        tx_count: ei?.tx_count || null,
        fees_lovelace: ei ? parseInt(ei.fees || '0', 10) : null,
        active_stake_lovelace: ei ? parseInt(ei.active_stake || '0', 10) : null,
      };
    });

    if (rows.length > 0) {
      const result = await batchUpsert(
        supabase,
        'epoch_governance_summaries',
        rows,
        'epoch_no',
        'epoch-gov-summaries',
      );
      epochsStored = result.success;
    }

    const metrics = { epochsStored, epochsFetched: drepSummaries.length };
    await syncLog.finalize(true, errors.length ? errors.join('; ') : null, metrics);
    return { epochsStored, errors };
  } catch (err) {
    await syncLog.finalize(false, errMsg(err), { epochsStored });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 4. Committee Members
// ---------------------------------------------------------------------------

export async function syncCommitteeMembers(): Promise<{
  membersStored: number;
  alignmentsComputed: number;
  errors: string[];
}> {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'committee_sync');
  await syncLog.start();

  const errors: string[] = [];
  let membersStored = 0;
  let alignmentsComputed = 0;

  try {
    const committeeData = await fetchCommitteeInfo();

    if (!committeeData?.members?.length) {
      await syncLog.finalize(true, null, { membersStored: 0 });
      return { membersStored: 0, alignmentsComputed: 0, errors: [] };
    }

    const rows = committeeData.members.map((m) => ({
      cc_hot_id: m.cc_hot_id,
      cc_cold_id: m.cc_cold_id,
      status: m.status || 'active',
      start_epoch: m.start_epoch,
      expiration_epoch: m.expiration_epoch,
      last_synced_at: new Date().toISOString(),
    }));

    const result = await batchUpsert(
      supabase,
      'committee_members',
      rows,
      'cc_hot_id',
      'committee-members',
    );
    membersStored = result.success;

    // --- Compute CC alignment from voting correlation with DRep landscape ---
    alignmentsComputed = await computeCCAlignments(supabase, errors);

    await syncLog.finalize(true, null, {
      membersStored,
      alignmentsComputed,
      total: committeeData.members.length,
    });
    return { membersStored, alignmentsComputed, errors };
  } catch (err) {
    await syncLog.finalize(false, errMsg(err), { membersStored, alignmentsComputed });
    throw err;
  }
}

/**
 * Compute governance alignment for CC members based on how their votes
 * correlate with the DRep alignment landscape. For each proposal a CC member
 * voted on, find DReps who voted the same way and average their alignment
 * vectors. This positions CC members near the DReps they philosophically
 * align with in the constellation.
 */
async function computeCCAlignments(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  errors: string[],
): Promise<number> {
  try {
    // Fetch CC votes, DRep votes (recent 5000), and DRep alignment data
    const [ccVotesRes, drepVotesRes, drepsRes] = await Promise.all([
      supabase
        .from('cc_votes')
        .select('cc_hot_id, proposal_tx_hash, vote')
        .order('block_time', { ascending: false })
        .limit(2000),
      supabase
        .from('drep_votes')
        .select('drep_id, proposal_tx_hash, vote')
        .order('block_time', { ascending: false })
        .limit(5000),
      supabase
        .from('dreps')
        .select(
          'id, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .gt('info->>votingPowerLovelace', '0'),
    ]);

    const ccVotes = ccVotesRes.data ?? [];
    const drepVotes = drepVotesRes.data ?? [];
    const dreps = drepsRes.data ?? [];

    if (ccVotes.length === 0 || drepVotes.length === 0 || dreps.length === 0) {
      return 0;
    }

    // Build DRep vote map: drepId (truncated) → Map<proposalTxHash, vote>
    const drepVoteMaps = new Map<string, Map<string, string>>();
    for (const v of drepVotes) {
      const id = (v.drep_id as string).slice(0, 16);
      let map = drepVoteMaps.get(id);
      if (!map) {
        map = new Map();
        drepVoteMaps.set(id, map);
      }
      map.set(v.proposal_tx_hash as string, v.vote as string);
    }

    // Build DRep alignment refs (DReps with non-neutral alignment who have votes)
    const drepRefs: Array<{ id: string; alignments: number[]; votes: Map<string, string> }> = [];
    for (const d of dreps) {
      const aligns = [
        Number(d.alignment_treasury_conservative ?? 50),
        Number(d.alignment_treasury_growth ?? 50),
        Number(d.alignment_decentralization ?? 50),
        Number(d.alignment_security ?? 50),
        Number(d.alignment_innovation ?? 50),
        Number(d.alignment_transparency ?? 50),
      ];
      const id = (d.id as string).slice(0, 16);
      const voteMap = drepVoteMaps.get(id);
      if (!voteMap || voteMap.size === 0) continue;
      if (!aligns.some((v) => Math.abs(v - 50) > 5)) continue;
      drepRefs.push({ id, alignments: aligns, votes: voteMap });
    }

    if (drepRefs.length === 0) return 0;

    // Group CC votes by member
    const ccVotesByMember = new Map<string, Array<{ proposalKey: string; vote: string }>>();
    for (const v of ccVotes) {
      const id = v.cc_hot_id as string;
      let list = ccVotesByMember.get(id);
      if (!list) {
        list = [];
        ccVotesByMember.set(id, list);
      }
      list.push({ proposalKey: v.proposal_tx_hash as string, vote: v.vote as string });
    }

    // Compute and store alignment for each CC member
    let updated = 0;
    for (const [ccHotId, memberVotes] of ccVotesByMember) {
      if (memberVotes.length < 3) continue;

      // For each proposal this CC member voted on, average the alignment of
      // DReps who voted the same way
      const accumulated = new Float64Array(6);
      let totalWeight = 0;

      for (const entityVote of memberVotes) {
        const agreeing: typeof drepRefs = [];
        for (const drep of drepRefs) {
          if (drep.votes.get(entityVote.proposalKey) === entityVote.vote) {
            agreeing.push(drep);
          }
        }
        if (agreeing.length < 2) continue;

        const avg = new Float64Array(6);
        for (const drep of agreeing) {
          for (let d = 0; d < 6; d++) avg[d] += drep.alignments[d];
        }
        for (let d = 0; d < 6; d++) avg[d] /= agreeing.length;

        const weight = Math.min(agreeing.length / 10, 1);
        for (let d = 0; d < 6; d++) accumulated[d] += avg[d] * weight;
        totalWeight += weight;
      }

      if (totalWeight < 1) continue;

      const alignment = Array.from({ length: 6 }, (_, d) =>
        Math.round(Math.max(0, Math.min(100, accumulated[d] / totalWeight))),
      );

      const { error } = await supabase
        .from('cc_members')
        .update({
          alignment_treasury_conservative: alignment[0],
          alignment_treasury_growth: alignment[1],
          alignment_decentralization: alignment[2],
          alignment_security: alignment[3],
          alignment_innovation: alignment[4],
          alignment_transparency: alignment[5],
        })
        .eq('cc_hot_id', ccHotId);

      if (error) {
        errors.push(`CC alignment update failed for ${ccHotId.slice(0, 20)}: ${error.message}`);
      } else {
        updated++;
      }
    }

    logger.info('CC alignment computation complete', { updated, total: ccVotesByMember.size });
    return updated;
  } catch (err) {
    errors.push(`CC alignment computation failed: ${errMsg(err)}`);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 5. Metadata Archive
// ---------------------------------------------------------------------------

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function detectCipStandard(
  json: Record<string, unknown>,
): 'CIP-100' | 'CIP-108' | 'CIP-119' | 'CIP-136' | 'unknown' {
  const body = json.body as Record<string, unknown> | undefined;

  // CIP-119: DRep metadata (has givenName)
  if (body?.givenName || json.givenName) return 'CIP-119';

  // CIP-108: Proposal metadata (has title + abstract under body)
  if (body?.title && body?.abstract) return 'CIP-108';

  // CIP-136: CC vote rationale (has comment from CC context)
  // Hard to distinguish from CIP-100 without context, so caller should hint
  if (body?.comment && !body?.title) return 'CIP-100';

  // CIP-100: Base standard (has hashAlgorithm or authors)
  if (json.hashAlgorithm || json.authors) return 'CIP-100';

  return 'unknown';
}

function maxTimestamp(current: string | null, candidate: string | null | undefined): string | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return current > candidate ? current : candidate;
}

async function commitMetadataArchiveCursor(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  syncType: string,
  startCursor: string | null,
  maxSeenTimestamp: string | null,
  completedAt: string,
  hadErrors: boolean,
): Promise<void> {
  if (hadErrors) return;

  const nextCursor = maxSeenTimestamp ?? (startCursor === null ? completedAt : null);
  if (!nextCursor) return;

  await setSyncCursorTimestamp(supabase, syncType, nextCursor);
}

async function syncMetadataArchiveIncremental(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  syncLog: SyncLogger,
): Promise<{
  drepMetadataArchived: number;
  proposalMetadataArchived: number;
  rationaleMetadataArchived: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let drepMetadataArchived = 0;
  let proposalMetadataArchived = 0;
  let rationaleMetadataArchived = 0;

  try {
    const completedAt = new Date().toISOString();

    const drepCursor = await getSyncCursorTimestamp(supabase, DREP_METADATA_ARCHIVE_CURSOR);
    const drepCandidates = await fetchAll(() => {
      let query = supabase
        .from('dreps')
        .select('id, anchor_url, anchor_hash, profile_last_changed_at')
        .not('anchor_url', 'is', null)
        .order('profile_last_changed_at', { ascending: true });

      if (drepCursor !== null) {
        query = query
          .not('profile_last_changed_at', 'is', null)
          .gt('profile_last_changed_at', drepCursor);
      }

      return query;
    });

    let maxDrepCursor: string | null = null;
    if (drepCandidates.length > 0) {
      const { fetchDRepMetadata } = await import('@/utils/koios');

      for (let i = 0; i < drepCandidates.length; i += DREP_METADATA_FETCH_BATCH_SIZE) {
        const batch = drepCandidates.slice(i, i + DREP_METADATA_FETCH_BATCH_SIZE);
        const drepIds = batch.map((drep) => drep.id as string);

        try {
          const metadataResponse = await fetchDRepMetadata(drepIds);
          const rows = metadataResponse
            .filter((meta) => meta.meta_json)
            .map((meta) => {
              const jsonStr = JSON.stringify(meta.meta_json);
              return {
                entity_type: 'drep' as const,
                entity_id: meta.drep_id,
                meta_url: meta.meta_url,
                meta_hash: meta.meta_hash,
                meta_json: meta.meta_json,
                cip_standard: detectCipStandard(meta.meta_json as Record<string, unknown>),
                fetch_status: (meta.is_valid === false ? 'hash_mismatch' : 'success') as
                  | 'success'
                  | 'hash_mismatch',
                content_hash: hashContent(jsonStr),
              };
            });

          if (rows.length > 0) {
            const result = await batchUpsert(
              supabase,
              'metadata_archive',
              rows,
              'entity_type,entity_id,content_hash',
              'metadata-archive-drep',
            );
            drepMetadataArchived += result.success;
            if (result.errors > 0) {
              errors.push(`DRep metadata upsert errors: ${result.errors}`);
            }
          }
        } catch (err) {
          errors.push(
            `DRep metadata fetch batch ${Math.floor(i / DREP_METADATA_FETCH_BATCH_SIZE)}: ${errMsg(err)}`,
          );
        }

        for (const candidate of batch) {
          maxDrepCursor = maxTimestamp(
            maxDrepCursor,
            (candidate.profile_last_changed_at as string | null) ?? null,
          );
        }
      }
    }

    await commitMetadataArchiveCursor(
      supabase,
      DREP_METADATA_ARCHIVE_CURSOR,
      drepCursor,
      maxDrepCursor,
      completedAt,
      errors.some((error) => error.startsWith('DRep metadata')),
    );

    const proposalCursor = await getSyncCursorTimestamp(supabase, PROPOSAL_METADATA_ARCHIVE_CURSOR);
    const proposalsWithMeta = await fetchAll(() => {
      let query = supabase
        .from('proposals')
        .select('tx_hash, proposal_index, meta_url, meta_hash, meta_json, updated_at')
        .not('meta_json', 'is', null)
        .order('updated_at', { ascending: true });

      if (proposalCursor !== null) {
        query = query.not('updated_at', 'is', null).gt('updated_at', proposalCursor);
      }

      return query;
    });

    let maxProposalCursor: string | null = null;
    if (proposalsWithMeta.length > 0) {
      const rows = proposalsWithMeta
        .filter((proposal) => proposal.meta_json)
        .map((proposal) => {
          const jsonStr = JSON.stringify(proposal.meta_json);
          return {
            entity_type: 'proposal' as const,
            entity_id: `${proposal.tx_hash}#${proposal.proposal_index}`,
            meta_url: proposal.meta_url,
            meta_hash: proposal.meta_hash,
            meta_json: proposal.meta_json,
            cip_standard: 'CIP-108' as const,
            fetch_status: 'success' as const,
            content_hash: hashContent(jsonStr),
          };
        });

      if (rows.length > 0) {
        const result = await batchUpsert(
          supabase,
          'metadata_archive',
          rows,
          'entity_type,entity_id,content_hash',
          'metadata-archive-proposal',
        );
        proposalMetadataArchived += result.success;
        if (result.errors > 0) {
          errors.push(`Proposal metadata upsert errors: ${result.errors}`);
        }
      }

      for (const proposal of proposalsWithMeta) {
        maxProposalCursor = maxTimestamp(
          maxProposalCursor,
          (proposal.updated_at as string | null) ?? null,
        );
      }
    }

    await commitMetadataArchiveCursor(
      supabase,
      PROPOSAL_METADATA_ARCHIVE_CURSOR,
      proposalCursor,
      maxProposalCursor,
      completedAt,
      errors.some((error) => error.startsWith('Proposal metadata')),
    );

    const rationaleCursor = await getSyncCursorTimestamp(
      supabase,
      RATIONALE_METADATA_ARCHIVE_CURSOR,
    );
    const votesWithRationales = await fetchAll(() => {
      let query = supabase
        .from('vote_rationales')
        .select('vote_tx_hash, meta_url, rationale_text, fetched_at')
        .not('rationale_text', 'is', null)
        .neq('rationale_text', '')
        .order('fetched_at', { ascending: true });

      if (rationaleCursor !== null) {
        query = query.not('fetched_at', 'is', null).gt('fetched_at', rationaleCursor);
      }

      return query;
    });

    let maxRationaleCursor: string | null = null;
    if (votesWithRationales.length > 0) {
      const txHashes = votesWithRationales.map((vote) => vote.vote_tx_hash as string);
      const metaHashByVote = new Map<string, string | null>();
      for (let i = 0; i < txHashes.length; i += 1000) {
        const { data: voteHashes } = await supabase
          .from('drep_votes')
          .select('vote_tx_hash, meta_hash')
          .in('vote_tx_hash', txHashes.slice(i, i + 1000));
        for (const vote of voteHashes || []) {
          metaHashByVote.set(vote.vote_tx_hash, vote.meta_hash);
        }
      }

      const rows = votesWithRationales.map((vote) => {
        const metaJson = { rationale: vote.rationale_text };
        return {
          entity_type: 'vote_rationale' as const,
          entity_id: vote.vote_tx_hash,
          meta_url: vote.meta_url,
          meta_hash: metaHashByVote.get(vote.vote_tx_hash as string) ?? null,
          meta_json: metaJson,
          cip_standard: 'CIP-100' as const,
          fetch_status: 'success' as const,
          content_hash: hashContent(JSON.stringify(metaJson)),
        };
      });

      if (rows.length > 0) {
        const result = await batchUpsert(
          supabase,
          'metadata_archive',
          rows,
          'entity_type,entity_id,content_hash',
          'metadata-archive-rationale',
        );
        rationaleMetadataArchived += result.success;
        if (result.errors > 0) {
          errors.push(`Rationale metadata upsert errors: ${result.errors}`);
        }
      }

      for (const vote of votesWithRationales) {
        maxRationaleCursor = maxTimestamp(
          maxRationaleCursor,
          (vote.fetched_at as string | null) ?? null,
        );
      }
    }

    await commitMetadataArchiveCursor(
      supabase,
      RATIONALE_METADATA_ARCHIVE_CURSOR,
      rationaleCursor,
      maxRationaleCursor,
      completedAt,
      errors.some((error) => error.startsWith('Rationale metadata')),
    );

    const metrics = {
      drepMetadataArchived,
      proposalMetadataArchived,
      rationaleMetadataArchived,
    };
    await syncLog.finalize(errors.length === 0, errors.length ? errors.join('; ') : null, metrics);
    return { ...metrics, errors };
  } catch (err) {
    await syncLog.finalize(false, errMsg(err), {
      drepMetadataArchived,
      proposalMetadataArchived,
      rationaleMetadataArchived,
    });
    throw err;
  }
}

export async function syncMetadataArchive(): Promise<{
  drepMetadataArchived: number;
  proposalMetadataArchived: number;
  rationaleMetadataArchived: number;
  errors: string[];
}> {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'metadata_archive');
  await syncLog.start();
  return syncMetadataArchiveIncremental(supabase, syncLog);
  /*
  try {
    // Archive DRep metadata (CIP-119) — fetch fresh from Koios to get raw JSON
    // The dreps table stores parsed fields; we archive the full raw metadata blob.
    const { data: drepsWithAnchors } = await supabase
      .from('dreps')
      .select('id, anchor_url, anchor_hash')
      .not('anchor_url', 'is', null);

    if (drepsWithAnchors?.length) {
      // Fetch metadata from Koios in batches (it returns the full meta_json)
      const { fetchDRepMetadata } = await import('@/utils/koios');
      const METADATA_BATCH = 50;

      for (let i = 0; i < drepsWithAnchors.length; i += METADATA_BATCH) {
        const batch = drepsWithAnchors.slice(i, i + METADATA_BATCH);
        const drepIds = batch.map((d) => d.id);

        try {
          const metadataResponse = await fetchDRepMetadata(drepIds);

          const rows = [];
          for (const meta of metadataResponse) {
            if (!meta.meta_json) continue;

            const jsonStr = JSON.stringify(meta.meta_json);
            const contentHash = hashContent(jsonStr);

            rows.push({
              entity_type: 'drep' as const,
              entity_id: meta.drep_id,
              meta_url: meta.meta_url,
              meta_hash: meta.meta_hash,
              meta_json: meta.meta_json,
              cip_standard: detectCipStandard(meta.meta_json as Record<string, unknown>),
              fetch_status: (meta.is_valid === false ? 'hash_mismatch' : 'success') as
                | 'success'
                | 'hash_mismatch',
              content_hash: contentHash,
            });
          }

          if (rows.length > 0) {
            const { error } = await supabase
              .from('metadata_archive')
              .upsert(rows, { onConflict: 'entity_type,entity_id,content_hash' });
            if (error) {
              errors.push(`DRep metadata batch ${i}: ${error.message}`);
            } else {
              drepMetadataArchived += rows.length;
            }
          }
        } catch (err) {
          errors.push(`DRep metadata fetch batch ${i}: ${errMsg(err)}`);
        }
      }
    }

    // Archive proposal metadata (CIP-108) — from proposals.meta_json
    const { data: proposalsWithMeta } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, meta_url, meta_hash, meta_json')
      .not('meta_json', 'is', null);

    if (proposalsWithMeta?.length) {
      const rows = [];
      for (const p of proposalsWithMeta) {
        if (!p.meta_json) continue;

        const jsonStr = JSON.stringify(p.meta_json);
        const contentHash = hashContent(jsonStr);

        rows.push({
          entity_type: 'proposal' as const,
          entity_id: `${p.tx_hash}#${p.proposal_index}`,
          meta_url: p.meta_url,
          meta_hash: p.meta_hash,
          meta_json: p.meta_json,
          cip_standard: 'CIP-108' as const,
          fetch_status: 'success' as const,
          content_hash: contentHash,
        });
      }

      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100);
          const { error } = await supabase
            .from('metadata_archive')
            .upsert(batch, { onConflict: 'entity_type,entity_id,content_hash' });
          if (error) {
            errors.push(`Proposal metadata batch: ${error.message}`);
          } else {
            proposalMetadataArchived += batch.length;
          }
        }
      }
    }

    // Archive vote rationale content from the normalized rationale cache.
    // The drep_votes contract no longer persists raw meta_json.
    const { data: votesWithRationales } = await supabase
      .from('vote_rationales')
      .select('vote_tx_hash, meta_url, rationale_text')
      .not('rationale_text', 'is', null)
      .neq('rationale_text', '');

    if (votesWithRationales?.length) {
      const txHashes = votesWithRationales.map((vote) => vote.vote_tx_hash);
      const metaHashByVote = new Map<string, string | null>();
      for (let i = 0; i < txHashes.length; i += 1000) {
        const { data: voteHashes } = await supabase
          .from('drep_votes')
          .select('vote_tx_hash, meta_hash')
          .in('vote_tx_hash', txHashes.slice(i, i + 1000));
        for (const vote of voteHashes || []) {
          metaHashByVote.set(vote.vote_tx_hash, vote.meta_hash);
        }
      }
      const rows = [];
      for (const vote of votesWithRationales) {
        const metaJson = { rationale: vote.rationale_text };
        const jsonStr = JSON.stringify(metaJson);
        const contentHash = hashContent(jsonStr);

        rows.push({
          entity_type: 'vote_rationale' as const,
          entity_id: vote.vote_tx_hash,
          meta_url: vote.meta_url,
          meta_hash: metaHashByVote.get(vote.vote_tx_hash) ?? null,
          meta_json: metaJson,
          cip_standard: 'CIP-100' as const,
          fetch_status: 'success' as const,
          content_hash: contentHash,
        });
      }

      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100);
          const { error } = await supabase
            .from('metadata_archive')
            .upsert(batch, { onConflict: 'entity_type,entity_id,content_hash' });
          if (error) {
            errors.push(`Rationale metadata batch: ${error.message}`);
          } else {
            rationaleMetadataArchived += batch.length;
          }
        }
      }
    }

    const metrics = {
      drepMetadataArchived,
      proposalMetadataArchived,
      rationaleMetadataArchived,
    };
    await syncLog.finalize(errors.length === 0, errors.length ? errors.join('; ') : null, metrics);
    return { ...metrics, errors };
  } catch (err) {
    await syncLog.finalize(false, errMsg(err), {
      drepMetadataArchived,
      proposalMetadataArchived,
      rationaleMetadataArchived,
    });
    throw err;
  }
  */
}
