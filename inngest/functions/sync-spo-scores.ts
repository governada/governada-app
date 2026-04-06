import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import {
  SyncLogger,
  batchUpsert,
  fetchAll,
  errMsg,
  emitPostHog,
  capMsg,
  alertCritical,
} from '@/lib/sync-utils';
import {
  buildPoolMetadataUpdate,
  buildPoolStakeUpdate,
  fetchKoiosPoolInfoBatches,
  type KoiosPoolInfo,
} from '@/lib/scoring/spoPoolInfo';
import { buildRelayLocationUpdates, geocodeRelayIps } from '@/lib/scoring/spoRelayLocations';
import {
  buildSpoScoreSyncArtifacts,
  type ClassificationRow,
  type PoolRow,
  type SpoProposalRow,
  type SpoScoreHistoryRow,
  type SpoVoteRow,
} from '@/lib/scoring/spoScoreSync';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';

const KOIOS_BASE = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';

function isPrivateIP(ip: string): boolean {
  if (
    ip === '0.0.0.0' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.')
  )
    return true;
  // 172.16.0.0/12 — 172.16.x.x through 172.31.x.x
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  // 100.64.0.0/10 — CGNAT (100.64.x.x through 100.127.x.x)
  if (ip.startsWith('100.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 64 && second <= 127) return true;
  }
  return false;
}

export const syncSpoScores = inngest.createFunction(
  {
    id: 'sync-spo-scores',
    retries: 3,
    concurrency: { limit: 1, scope: 'env', key: '"spo-scores"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[spo-scores] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'spo_scores')
        .is('finished_at', null);
      await alertCritical(
        'SPO Scoring Failed',
        `SPO scoring failed after all retries.\nError: ${msg}\nCheck logs for details.`,
      );
    },
    triggers: [{ event: 'drepscore/sync.spo-scores' }, { cron: '0 3 * * *' }],
  },
  async ({ step }) => {
    const identityEnabled = await step.run('check-feature-flag', async () => {
      return getFeatureFlag('spo_governance_identity', false);
    });

    const computeResult = await step.run('compute-scores', async () => {
      const supabase = getSupabaseAdmin();
      const syncLog = new SyncLogger(supabase, 'spo_scores');
      await syncLog.start();

      // Use fetchAll to paginate past PostgREST row limits
      const [voteRows, proposalRows, classificationRows, poolRows] = await Promise.all([
        fetchAll(() =>
          supabase
            .from('spo_votes')
            .select('pool_id, proposal_tx_hash, proposal_index, vote, block_time, epoch, tx_hash'),
        ),
        fetchAll(() =>
          supabase
            .from('proposals')
            .select(
              'tx_hash, proposal_index, proposal_type, treasury_tier, withdrawal_amount, block_time, proposed_epoch, expired_epoch, ratified_epoch, dropped_epoch',
            ),
        ),
        fetchAll(() => supabase.from('proposal_classifications').select('*')),
        fetchAll(() =>
          supabase
            .from('pools')
            .select(
              'pool_id, ticker, pool_name, governance_statement, homepage_url, social_links, metadata_hash_verified, delegator_count',
            ),
        ),
      ]);

      const { data: statsRow } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();

      const currentEpoch =
        statsRow?.current_epoch ?? blockTimeToEpoch(Math.floor(Date.now() / 1000));
      if (!voteRows?.length) {
        await syncLog.finalize(true, null, { skipped: true });
        return { success: true, skipped: true };
      }

      try {
        const { data: historyRows } = await supabase
          .from('spo_score_snapshots')
          .select('pool_id, governance_score, snapshot_at')
          .gte('snapshot_at', new Date(Date.now() - 30 * 86400000).toISOString());
        const { data: existingSybilFlags } = await supabase
          .from('spo_sybil_flags')
          .select('pool_a, pool_b, agreement_rate, resolved')
          .eq('resolved', false);

        const normalizedExistingSybilFlags = (existingSybilFlags || []).flatMap((flag) => {
          if (
            typeof flag.pool_a !== 'string' ||
            typeof flag.pool_b !== 'string' ||
            typeof flag.agreement_rate !== 'number'
          ) {
            return [];
          }

          return [
            {
              pool_a: flag.pool_a,
              pool_b: flag.pool_b,
              agreement_rate: flag.agreement_rate,
              resolved: flag.resolved ?? false,
            },
          ];
        });

        const artifacts = buildSpoScoreSyncArtifacts({
          voteRows: (voteRows || []) as SpoVoteRow[],
          proposalRows: (proposalRows || []) as SpoProposalRow[],
          classificationRows: (classificationRows || []) as ClassificationRow[],
          poolRows: (poolRows || []) as PoolRow[],
          historyRows: (historyRows || []) as SpoScoreHistoryRow[],
          existingSybilFlags: normalizedExistingSybilFlags,
          currentEpoch,
          identityEnabled,
        });

        if (artifacts.sybilFlagInserts.length > 0) {
          logger.warn('[sync-spo-scores] Sybil flags detected', {
            count: artifacts.sybilFlagInserts.length,
          });
          await batchUpsert(
            supabase,
            'spo_sybil_flags',
            artifacts.sybilFlagInserts as unknown as Record<string, unknown>[],
            'pool_a,pool_b,epoch_no',
            'spo_sybil_flags',
          );
        }

        if (artifacts.poolUpdates.length > 0) {
          await batchUpsert(
            supabase,
            'pools',
            artifacts.poolUpdates as unknown as Record<string, unknown>[],
            'pool_id',
            'pools',
          );
        }

        if (artifacts.scoreSnapshots.length > 0) {
          await batchUpsert(
            supabase,
            'spo_score_snapshots',
            artifacts.scoreSnapshots as unknown as Record<string, unknown>[],
            'pool_id,epoch_no',
            'spo_score_snapshots',
          );
        }

        if (artifacts.alignmentSnapshots.length > 0) {
          await batchUpsert(
            supabase,
            'spo_alignment_snapshots',
            artifacts.alignmentSnapshots as unknown as Record<string, unknown>[],
            'pool_id,epoch_no',
            'spo_alignment_snapshots',
          );
        }

        await supabase
          .from('snapshot_completeness_log')
          .upsert(artifacts.completenessLog, { onConflict: 'snapshot_type,epoch_no' });

        await syncLog.finalize(true, null, artifacts.summary);
        await emitPostHog(true, 'spo_scores', syncLog.elapsed, artifacts.summary);
        return artifacts.summary;
      } catch (err) {
        const msg = errMsg(err);
        await syncLog.finalize(false, msg, {});
        throw err;
      }
    });

    // Always run metadata + enrichment steps even if scoring was skipped —
    // pools may still be missing tickers, names, delegator counts, etc.
    await step.run('fetch-koios-metadata', async () => {
      const supabase = getSupabaseAdmin();
      // Fetch ALL pools that are missing metadata (ticker IS NULL)
      const { data: poolsNeedingMeta } = await supabase
        .from('pools')
        .select('pool_id')
        .is('ticker', null);

      if (!poolsNeedingMeta?.length) {
        logger.info('[sync-spo-scores] All pools already have metadata');
        return { fetched: 0, needed: 0 };
      }

      logger.info('[sync-spo-scores] Pools needing metadata', { count: poolsNeedingMeta.length });

      const allPoolIds = poolsNeedingMeta.map((p: { pool_id: string }) => p.pool_id);
      let totalUpdated = 0;
      const { failedPoolIds, pools } = await fetchKoiosPoolInfoBatches(allPoolIds, {
        batchSize: 50,
        timeoutMs: 20_000,
        onBatchError: ({ batchIds, error, status }) => {
          logger.warn('[sync-spo-scores] Koios pool_info batch failed', {
            status: status ?? null,
            batchSize: batchIds.length,
            error: errMsg(error),
          });
        },
      });

      const metaByPool = new Map<string, Record<string, unknown>>();
      for (const pool of pools) {
        const metadataUpdate = buildPoolMetadataUpdate(pool);
        if (!metadataUpdate || typeof metadataUpdate.pool_id !== 'string') continue;
        metaByPool.set(metadataUpdate.pool_id, metadataUpdate);
      }

      for (const poolId of allPoolIds) {
        const meta = metaByPool.get(poolId);
        if (!meta) continue;
        const { pool_id: _poolId, ...poolUpdate } = meta;
        const { error } = await supabase.from('pools').update(poolUpdate).eq('pool_id', poolId);
        if (!error) totalUpdated++;
      }

      logger.info('[sync-spo-scores] Metadata fetch complete', {
        needed: allPoolIds.length,
        updated: totalUpdated,
        errors: failedPoolIds.length,
      });
      return { fetched: totalUpdated, needed: allPoolIds.length, errors: failedPoolIds.length };
    });

    // Refresh delegator_count + live_stake for ALL pools that already have metadata
    await step.run('refresh-delegator-counts', async () => {
      const supabase = getSupabaseAdmin();
      const { data: enrichedPools } = await supabase
        .from('pools')
        .select('pool_id')
        .not('ticker', 'is', null)
        .not('pool_name', 'is', null);

      if (!enrichedPools?.length) return { refreshed: 0 };

      let refreshed = 0;

      const poolIds = enrichedPools.map((pool: { pool_id: string }) => pool.pool_id);
      const { pools } = await fetchKoiosPoolInfoBatches(poolIds, {
        batchSize: 100,
        timeoutMs: 15_000,
        onBatchError: ({ error, status }) => {
          logger.warn('[sync-spo-scores] delegator refresh batch failed', {
            status: status ?? null,
            error: errMsg(error),
          });
        },
      });

      for (const pool of pools) {
        const stakeUpdate = buildPoolStakeUpdate(pool);
        if (!stakeUpdate) continue;
        const { pool_id, ...poolUpdate } = stakeUpdate;
        const { error } = await supabase.from('pools').update(poolUpdate).eq('pool_id', pool_id);
        if (!error) refreshed++;
      }

      return { refreshed };
    });

    // Geocode SPO relay IPs for globe visualization
    await step.run('geocode-relay-ips', async () => {
      const supabase = getSupabaseAdmin();

      // Find pools not yet geocoded — process in small batches to avoid Koios 413
      const { data: poolsNeedingGeo } = await supabase
        .from('pools')
        .select('pool_id')
        .is('relay_locations', null)
        .gt('vote_count', 0)
        .limit(50);

      if (!poolsNeedingGeo?.length) return { geocoded: 0, reason: 'all processed' };

      const allPoolIds = poolsNeedingGeo.map((p: { pool_id: string }) => p.pool_id);
      const ipToPoolMap = new Map<string, string[]>();
      const dnsOnlyPools = new Set<string>();
      const KOIOS_BATCH = 25; // Koios returns 413 for batches > ~30 pool IDs

      // Fetch relay info in small batches
      for (let i = 0; i < allPoolIds.length; i += KOIOS_BATCH) {
        const batchIds = allPoolIds.slice(i, i + KOIOS_BATCH);
        try {
          const relayRes = await fetch(`${KOIOS_BASE}/pool_info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _pool_bech32_ids: batchIds }),
            signal: AbortSignal.timeout(15_000),
          });

          if (!relayRes.ok) {
            logger.warn('[sync-spo-scores] Koios pool_info (relays) failed', {
              status: relayRes.status,
            });
            continue;
          }

          const relayData = (await relayRes.json()) as KoiosPoolInfo[];

          for (const pool of relayData) {
            if (!pool.pool_id_bech32) continue;
            const relays = pool.relays ?? [];
            let hasPublicIp = false;

            for (const relay of relays) {
              const ip = relay.ipv4;
              if (!ip || isPrivateIP(ip)) continue;
              hasPublicIp = true;
              const pools = ipToPoolMap.get(ip) ?? [];
              pools.push(pool.pool_id_bech32);
              ipToPoolMap.set(ip, pools);
            }

            if (!hasPublicIp) {
              dnsOnlyPools.add(pool.pool_id_bech32);
            }
          }
        } catch (err) {
          logger.warn('[sync-spo-scores] relay fetch batch error', { error: errMsg(err) });
        }
      }

      // Mark DNS-only pools as processed so we don't re-query them
      for (const poolId of dnsOnlyPools) {
        await supabase.from('pools').update({ relay_locations: [] }).eq('pool_id', poolId);
      }

      if (ipToPoolMap.size === 0) {
        return { geocoded: 0, dnsOnly: dnsOnlyPools.size, reason: 'all DNS-only' };
      }

      let geocoded = 0;

      try {
        const ipGeo = await geocodeRelayIps([...ipToPoolMap.keys()], {
          maxIps: 100,
          timeoutMs: 10_000,
        });
        const relayUpdates = buildRelayLocationUpdates(ipToPoolMap, ipGeo);

        for (const relayUpdate of relayUpdates) {
          const { error } = await supabase
            .from('pools')
            .update({
              relay_lat: relayUpdate.relay_lat,
              relay_lon: relayUpdate.relay_lon,
              relay_locations: relayUpdate.relay_locations,
            })
            .eq('pool_id', relayUpdate.pool_id);
          if (!error) geocoded++;
        }
      } catch (err) {
        logger.warn('[sync-spo-scores] relay geocoding error', { error: errMsg(err) });
      }

      return { geocoded };
    });

    // Snapshot SPO power (delegator count + live stake) for trend tracking
    await step.run('snapshot-spo-power', async () => {
      const supabase = getSupabaseAdmin();

      const { data: statsRow } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();
      const currentEpoch =
        statsRow?.current_epoch ?? blockTimeToEpoch(Math.floor(Date.now() / 1000));

      const { data: scoredPools } = await supabase
        .from('pools')
        .select('pool_id, delegator_count, live_stake_lovelace')
        .gt('vote_count', 0);

      if (!scoredPools?.length) return { snapshotted: 0 };

      const rows = scoredPools.map(
        (p: {
          pool_id: string;
          delegator_count: number | null;
          live_stake_lovelace: number | null;
        }) => ({
          pool_id: p.pool_id,
          epoch_no: currentEpoch,
          delegator_count: p.delegator_count ?? 0,
          live_stake_lovelace: p.live_stake_lovelace ?? 0,
        }),
      );

      const BATCH_SIZE = 200;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('spo_power_snapshots')
          .upsert(batch, { onConflict: 'pool_id,epoch_no', ignoreDuplicates: true });
        if (error) {
          logger.error('[sync-spo-scores] spo_power_snapshots upsert error', {
            error: error.message,
          });
        }
      }

      return { snapshotted: rows.length };
    });

    // Tier assignment for SPOs (now confidence-aware)
    await step.run('assign-spo-tiers', async () => {
      const tiersEnabled = await getFeatureFlag('score_tiers', false);
      if (!tiersEnabled) return { tierChanges: 0 };

      const { computeTierWithCap, detectTierChange, computeTier } =
        await import('@/lib/scoring/tiers');
      const { getSpoTierCap } = await import('@/lib/scoring/confidence');
      const supabase = getSupabaseAdmin();

      const { data: currentPools } = await supabase
        .from('pools')
        .select('pool_id, governance_score, current_tier, confidence, vote_count')
        .gt('vote_count', 0);

      const tierChangeInserts: Record<string, unknown>[] = [];

      for (const pool of currentPools || []) {
        const newScore = pool.governance_score ?? 0;
        const voteCount = pool.vote_count ?? 0;
        const tierCap = getSpoTierCap(voteCount);
        const newTier = computeTierWithCap(newScore, tierCap);
        const oldTier = pool.current_tier ?? computeTier(0);

        if (oldTier !== newTier) {
          const change = detectTierChange('spo', pool.pool_id, 0, newScore);
          if (change) {
            tierChangeInserts.push({
              entity_type: 'spo',
              entity_id: pool.pool_id,
              old_tier: change.oldTier,
              new_tier: change.newTier,
              old_score: change.oldScore,
              new_score: change.newScore,
              epoch_no: null,
            });
          }
        }

        await supabase.from('pools').update({ current_tier: newTier }).eq('pool_id', pool.pool_id);
      }

      if (tierChangeInserts.length > 0) {
        const { batchUpsert } = await import('@/lib/sync-utils');
        await batchUpsert(supabase, 'tier_changes', tierChangeInserts, 'id', 'tier_changes');
      }

      return { tierChanges: tierChangeInserts.length };
    });

    if ('poolsScored' in computeResult) {
      await step.sendEvent('spo-scores-complete', {
        name: 'drepscore/sync.spo-scores.complete',
        data: {
          poolsScored: computeResult.poolsScored,
          votesProcessed: computeResult.votesProcessed,
        },
      });
    }

    return computeResult;
  },
);
