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
import { SyncLogger, batchUpsert, errMsg } from '@/lib/sync-utils';
import { blockTimeToEpoch } from '@/lib/koios';
import {
  fetchDRepDelegatorsFull,
  fetchDRepUpdates,
  fetchDRepEpochSummary,
  fetchEpochInfo,
  fetchCommitteeInfo,
} from '@/utils/koios';
import { createHash } from 'crypto';

const DELEGATOR_CONCURRENCY = 5;
const DREP_UPDATE_BATCH = 50;

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
    const done = new Set((existing ?? []).map((r: any) => r.drep_id));
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
  let drepsProcessed = 0;

  try {
    // Get all DRep IDs
    const { data: dreps } = await supabase.from('dreps').select('id');

    if (!dreps?.length) {
      await syncLog.finalize(true, null, { eventsStored: 0 });
      return { eventsStored: 0, drepsProcessed: 0, errors: [] };
    }

    const drepIds = dreps.map((d) => d.id);

    // Batch fetch lifecycle events from Koios
    for (let i = 0; i < drepIds.length; i += DREP_UPDATE_BATCH) {
      const batch = drepIds.slice(i, i + DREP_UPDATE_BATCH);
      try {
        const updates = await fetchDRepUpdates(batch);
        drepsProcessed += batch.length;

        if (updates.length === 0) continue;

        const rows = updates.map((u) => ({
          drep_id: u.drep_id,
          action: u.action_type,
          tx_hash: u.update_tx_hash,
          epoch_no: u.epoch_no ?? (u.block_time ? blockTimeToEpoch(u.block_time) : 0),
          block_time: u.block_time,
          deposit: u.deposit,
          anchor_url: u.meta_url,
          anchor_hash: u.meta_hash,
        }));

        const result = await batchUpsert(
          supabase,
          'drep_lifecycle_events',
          rows,
          'drep_id,tx_hash',
          `lifecycle-batch-${Math.floor(i / DREP_UPDATE_BATCH)}`,
        );
        eventsStored += result.success;
      } catch (err) {
        errors.push(`Lifecycle batch ${Math.floor(i / DREP_UPDATE_BATCH)}: ${errMsg(err)}`);
      }
    }

    const metrics = { eventsStored, drepsProcessed, totalDreps: drepIds.length };
    await syncLog.finalize(errors.length === 0, errors.length ? errors.join('; ') : null, metrics);
    return { eventsStored, drepsProcessed, errors };
  } catch (err) {
    await syncLog.finalize(false, errMsg(err), { eventsStored, drepsProcessed });
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
  errors: string[];
}> {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'committee_sync');
  await syncLog.start();

  const errors: string[] = [];
  let membersStored = 0;

  try {
    const committeeData = await fetchCommitteeInfo();

    if (!committeeData?.members?.length) {
      await syncLog.finalize(true, null, { membersStored: 0 });
      return { membersStored: 0, errors: [] };
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

    await syncLog.finalize(true, null, { membersStored, total: committeeData.members.length });
    return { membersStored, errors };
  } catch (err) {
    await syncLog.finalize(false, errMsg(err), { membersStored });
    throw err;
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

export async function syncMetadataArchive(): Promise<{
  drepMetadataArchived: number;
  proposalMetadataArchived: number;
  rationaleMetadataArchived: number;
  errors: string[];
}> {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'metadata_archive');
  await syncLog.start();

  const errors: string[] = [];
  let drepMetadataArchived = 0;
  let proposalMetadataArchived = 0;
  let rationaleMetadataArchived = 0;

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

    // Archive vote rationale metadata (CIP-100) — from drep_votes.meta_json
    const { data: votesWithMeta } = await supabase
      .from('drep_votes')
      .select('vote_tx_hash, meta_url, meta_hash, meta_json')
      .not('meta_json', 'is', null);

    if (votesWithMeta?.length) {
      const rows = [];
      for (const v of votesWithMeta) {
        if (!v.meta_json) continue;

        const jsonStr = JSON.stringify(v.meta_json);
        const contentHash = hashContent(jsonStr);

        rows.push({
          entity_type: 'vote_rationale' as const,
          entity_id: v.vote_tx_hash,
          meta_url: v.meta_url,
          meta_hash: v.meta_hash,
          meta_json: v.meta_json,
          cip_standard: detectCipStandard(v.meta_json as Record<string, unknown>),
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
}
