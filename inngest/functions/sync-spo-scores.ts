import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { SyncLogger, batchUpsert, errMsg, emitPostHog, capMsg } from '@/lib/sync-utils';
import {
  computeSpoScores,
  computeProposalMarginMultipliers,
  type SpoVoteDataV3,
} from '@/lib/scoring/spoScore';
import {
  computeSpoGovernanceIdentity,
  type SpoProfileData,
} from '@/lib/scoring/spoGovernanceIdentity';
import { computeSpoDeliberationQuality } from '@/lib/scoring/spoDeliberationQuality';
import { computeConfidence } from '@/lib/scoring/confidence';
import { detectSybilPairs } from '@/lib/scoring/sybilDetection';
import { getExtendedImportanceWeight } from '@/lib/scoring';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';

interface SpoProposalRow {
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

interface SpoVoteRow {
  pool_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: string;
  block_time: number;
  epoch: number | null;
}

interface ClassificationRow {
  proposal_tx_hash: string;
  proposal_index: number;
  dim_treasury_conservative: number | null;
  dim_treasury_growth: number | null;
  dim_decentralization: number | null;
  dim_security: number | null;
  dim_innovation: number | null;
  dim_transparency: number | null;
}

interface PoolRow {
  pool_id: string;
  ticker: string | null;
  pool_name: string | null;
  governance_statement: string | null;
  homepage_url: string | null;
  social_links: Array<{ uri: string; label?: string }> | null;
  metadata_hash_verified: boolean | null;
  delegator_count: number | null;
}

interface KoiosPoolInfo {
  pool_id_bech32?: string;
  ticker?: string;
  meta_json?: { name?: string; description?: string; homepage?: string };
  pledge?: number;
  margin?: number;
  fixed_cost?: number;
  live_delegators?: number;
  live_stake?: number;
  pool_status?: string;
  retiring_epoch?: number | null;
  relays?: Array<{ dns?: string; srv?: string; ipv4?: string; ipv6?: string; port?: number }>;
}

const KOIOS_BASE = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';

/** Check if an IPv4 address is private/reserved (RFC 1918, RFC 6598, link-local) */
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
    },
  },
  [{ event: 'drepscore/sync.spo-scores' }, { cron: '0 3 * * *' }],
  async ({ step }) => {
    const identityEnabled = await step.run('check-feature-flag', async () => {
      return getFeatureFlag('spo_governance_identity', false);
    });

    const computeResult = await step.run('compute-scores', async () => {
      const supabase = getSupabaseAdmin();
      const syncLog = new SyncLogger(supabase, 'spo_scores');
      await syncLog.start();

      const [
        { data: voteRows },
        { data: proposalRows },
        { data: classificationRows },
        { data: statsRow },
        { data: poolRows },
      ] = await Promise.all([
        supabase
          .from('spo_votes')
          .select('pool_id, proposal_tx_hash, proposal_index, vote, block_time, epoch'),
        supabase
          .from('proposals')
          .select(
            'tx_hash, proposal_index, proposal_type, treasury_tier, withdrawal_amount, block_time, proposed_epoch, expired_epoch, ratified_epoch, dropped_epoch',
          ),
        supabase.from('proposal_classifications').select('*'),
        supabase.from('governance_stats').select('current_epoch').eq('id', 1).single(),
        supabase
          .from('pools')
          .select(
            'pool_id, ticker, pool_name, governance_statement, homepage_url, social_links, metadata_hash_verified, delegator_count',
          ),
      ]);

      const currentEpoch =
        statsRow?.current_epoch ?? blockTimeToEpoch(Math.floor(Date.now() / 1000));
      if (!voteRows?.length) {
        await syncLog.finalize(true, null, { skipped: true });
        return { success: true, skipped: true };
      }

      try {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const proposalContexts = new Map<string, { blockTime: number; importanceWeight: number }>();
        const allProposalTypes = new Set<string>();
        const proposalBlockTimes = new Map<string, number>();
        const proposalEpochs = new Map<string, number>();

        for (const p of (proposalRows || []) as SpoProposalRow[]) {
          const key = `${p.tx_hash}-${p.proposal_index}`;
          const weight = getExtendedImportanceWeight(
            p.proposal_type,
            p.treasury_tier,
            p.withdrawal_amount != null ? Number(p.withdrawal_amount) : null,
          );
          proposalContexts.set(key, {
            blockTime: p.block_time || 0,
            importanceWeight: weight,
          });
          proposalBlockTimes.set(key, p.block_time || 0);
          allProposalTypes.add(p.proposal_type);
          if (p.proposed_epoch != null) {
            proposalEpochs.set(key, p.proposed_epoch);
          }
        }

        // Build set of epochs that had votable proposals (for proposal-aware reliability)
        const activeEpochs = new Set<number>();
        for (const epoch of proposalEpochs.values()) {
          activeEpochs.add(epoch);
        }
        // Also include epochs where votes were cast
        for (const v of voteRows as SpoVoteRow[]) {
          const epoch = v.epoch ?? blockTimeToEpoch(v.block_time);
          activeEpochs.add(epoch);
        }

        let totalWeightedPool = 0;
        const { DECAY_LAMBDA } = await import('@/lib/scoring/types');
        for (const [, ctx] of proposalContexts) {
          const ageDays = Math.max(0, (nowSeconds - ctx.blockTime) / 86400);
          totalWeightedPool += ctx.importanceWeight * Math.exp(-DECAY_LAMBDA * ageDays);
        }

        // Build vote data with V3 fields
        const allVotes: SpoVoteDataV3[] = [];
        const poolVotes = new Map<string, SpoVoteDataV3[]>();
        const poolVoteMap = new Map<string, Map<string, 'Yes' | 'No' | 'Abstain'>>();

        for (const v of voteRows as SpoVoteRow[]) {
          const proposalKey = `${v.proposal_tx_hash}-${v.proposal_index}`;
          const ctx = proposalContexts.get(proposalKey);
          const proposal = ((proposalRows || []) as SpoProposalRow[]).find(
            (p) => `${p.tx_hash}-${p.proposal_index}` === proposalKey,
          );

          const voteData: SpoVoteDataV3 = {
            poolId: v.pool_id,
            proposalKey,
            vote: v.vote as 'Yes' | 'No' | 'Abstain',
            blockTime: v.block_time,
            epoch: v.epoch ?? blockTimeToEpoch(v.block_time),
            proposalType: proposal?.proposal_type ?? 'InfoAction',
            importanceWeight: ctx?.importanceWeight ?? 1,
            proposalBlockTime: proposalBlockTimes.get(proposalKey) ?? 0,
            hasRationale: false, // SPO votes don't have rationale anchors yet
          };

          allVotes.push(voteData);
          if (!poolVotes.has(v.pool_id)) poolVotes.set(v.pool_id, []);
          poolVotes.get(v.pool_id)!.push(voteData);

          // Build pool vote map for sybil detection
          if (!poolVoteMap.has(v.pool_id)) poolVoteMap.set(v.pool_id, new Map());
          poolVoteMap.get(v.pool_id)!.set(proposalKey, v.vote as 'Yes' | 'No' | 'Abstain');
        }

        // Compute V3 Deliberation Quality scores
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
          }>
        >();
        for (const [poolId, votes] of poolVotes) {
          deliberationVotes.set(
            poolId,
            votes.map((v) => ({
              proposalKey: v.proposalKey,
              vote: v.vote,
              blockTime: v.blockTime,
              proposalBlockTime: v.proposalBlockTime,
              proposalType: v.proposalType,
              importanceWeight: v.importanceWeight,
              hasRationale: v.hasRationale,
            })),
          );
        }
        const deliberationScores = computeSpoDeliberationQuality(
          deliberationVotes,
          allProposalTypes,
          nowSeconds,
        );

        // Compute confidence per pool
        const confidences = new Map<string, number>();
        for (const [poolId, votes] of poolVotes) {
          const epochs = new Set(votes.map((v) => v.epoch));
          const sortedEpochs = [...epochs].sort((a, b) => a - b);
          const epochSpan =
            sortedEpochs.length > 1 ? sortedEpochs[sortedEpochs.length - 1] - sortedEpochs[0] : 0;
          const types = new Set(votes.map((v) => v.proposalType));
          const typeCoverage = allProposalTypes.size > 0 ? types.size / allProposalTypes.size : 0;
          confidences.set(poolId, computeConfidence(votes.length, epochSpan, typeCoverage));
        }

        // Compute proposal-level margin multipliers
        const proposalMarginMultipliers = computeProposalMarginMultipliers(allVotes);

        // Build SPO profile data for Governance Identity pillar
        const spoProfiles = new Map<string, SpoProfileData>();
        const allDelegatorCounts: number[] = [];
        const poolMetaMap = new Map<string, PoolRow>();

        for (const p of (poolRows || []) as PoolRow[]) {
          poolMetaMap.set(p.pool_id, p);
          allDelegatorCounts.push(p.delegator_count ?? 0);
        }

        for (const poolId of poolVotes.keys()) {
          const meta = poolMetaMap.get(poolId);
          spoProfiles.set(poolId, {
            poolId,
            ticker: meta?.ticker ?? null,
            poolName: meta?.pool_name ?? null,
            governanceStatement: meta?.governance_statement ?? null,
            poolDescription: null,
            homepageUrl: meta?.homepage_url ?? null,
            socialLinks: Array.isArray(meta?.social_links) ? meta!.social_links : [],
            metadataHashVerified: meta?.metadata_hash_verified ?? false,
            delegatorCount: meta?.delegator_count ?? 0,
          });
          if (!poolMetaMap.has(poolId)) {
            allDelegatorCounts.push(0);
          }
        }

        const identityScores = identityEnabled
          ? computeSpoGovernanceIdentity(spoProfiles, allDelegatorCounts)
          : new Map<string, number>();

        // Load score history for momentum (30-day window for V3)
        const { data: historyRows } = await supabase
          .from('spo_score_snapshots')
          .select('pool_id, governance_score, snapshot_at')
          .gte('snapshot_at', new Date(Date.now() - 30 * 86400000).toISOString());

        const scoreHistory = new Map<string, { date: string; score: number }[]>();
        for (const h of historyRows || []) {
          if (!h.governance_score || !h.snapshot_at) continue;
          const arr = scoreHistory.get(h.pool_id) ?? [];
          arr.push({ date: h.snapshot_at.slice(0, 10), score: h.governance_score });
          scoreHistory.set(h.pool_id, arr);
        }

        // Compute V3 scores with all 10 arguments
        const finalScores = computeSpoScores(
          allVotes,
          totalWeightedPool,
          currentEpoch,
          allProposalTypes,
          identityScores,
          deliberationScores,
          confidences,
          scoreHistory,
          proposalMarginMultipliers,
          activeEpochs,
        );

        // Run sybil detection
        const sybilFlags = detectSybilPairs(poolVoteMap);
        if (sybilFlags.length > 0) {
          logger.warn('[sync-spo-scores] Sybil flags detected', { count: sybilFlags.length });
          const sybilInserts = sybilFlags.map((f) => ({
            pool_a: f.poolA,
            pool_b: f.poolB,
            agreement_rate: f.agreementRate,
            shared_votes: f.sharedVotes,
            detected_at: new Date().toISOString(),
            epoch_no: currentEpoch,
          }));
          await batchUpsert(
            supabase,
            'spo_sybil_flags',
            sybilInserts as unknown as Record<string, unknown>[],
            'pool_a,pool_b,epoch_no',
            'spo_sybil_flags',
          );
        }

        // Alignment computation
        const classificationMap = new Map<string, Record<string, number>>();
        for (const c of (classificationRows || []) as ClassificationRow[]) {
          const key = `${c.proposal_tx_hash}-${c.proposal_index}`;
          classificationMap.set(key, {
            treasury_conservative: c.dim_treasury_conservative ?? 0,
            treasury_growth: c.dim_treasury_growth ?? 0,
            decentralization: c.dim_decentralization ?? 0,
            security: c.dim_security ?? 0,
            innovation: c.dim_innovation ?? 0,
            transparency: c.dim_transparency ?? 0,
          });
        }

        const alignmentDims = [
          'treasury_conservative',
          'treasury_growth',
          'decentralization',
          'security',
          'innovation',
          'transparency',
        ] as const;

        const poolAlignments = new Map<string, Record<string, number>>();

        for (const [poolId, votes] of poolVotes) {
          const dimSums: Record<string, number> = {};
          const dimWeights: Record<string, number> = {};
          for (const d of alignmentDims) {
            dimSums[d] = 0;
            dimWeights[d] = 0;
          }

          for (const v of votes) {
            const cls = classificationMap.get(v.proposalKey);
            if (!cls) continue;
            const voteWeight = v.vote === 'Yes' ? 1 : v.vote === 'No' ? -1 : 0;
            if (voteWeight === 0) continue;

            for (const d of alignmentDims) {
              dimSums[d] += voteWeight * (cls[d] ?? 0);
              dimWeights[d] += Math.abs(voteWeight);
            }
          }

          const alignments: Record<string, number> = {};
          for (const d of alignmentDims) {
            const raw = dimWeights[d] > 0 ? dimSums[d] / dimWeights[d] : 0;
            alignments[d] = Math.round(((raw + 1) / 2) * 100);
          }
          poolAlignments.set(poolId, alignments);
        }

        // Upsert pools with V3 pillar breakdown
        const poolUpdates = [...finalScores.entries()].map(([poolId, s]) => {
          const align = poolAlignments.get(poolId) ?? {};
          const voteCount = poolVotes.get(poolId)?.length ?? 0;
          return {
            pool_id: poolId,
            governance_score: s.composite,
            participation_raw: Math.round(s.participationRaw),
            participation_pct: Math.round(s.participationPercentile),
            deliberation_raw: Math.round(s.deliberationRaw),
            deliberation_pct: Math.round(s.deliberationPercentile),
            // V2 compat columns
            consistency_raw: Math.round(s.consistencyRaw),
            consistency_pct: Math.round(s.consistencyPercentile),
            reliability_raw: Math.round(s.reliabilityRaw),
            reliability_pct: Math.round(s.reliabilityPercentile),
            governance_identity_raw: Math.round(s.governanceIdentityRaw),
            governance_identity_pct: Math.round(s.governanceIdentityPercentile),
            score_momentum: s.momentum,
            confidence: s.confidence,
            vote_count: voteCount,
            alignment_treasury_conservative: align.treasury_conservative ?? null,
            alignment_treasury_growth: align.treasury_growth ?? null,
            alignment_decentralization: align.decentralization ?? null,
            alignment_security: align.security ?? null,
            alignment_innovation: align.innovation ?? null,
            alignment_transparency: align.transparency ?? null,
            updated_at: new Date().toISOString(),
          };
        });

        if (poolUpdates.length > 0) {
          await batchUpsert(
            supabase,
            'pools',
            poolUpdates as unknown as Record<string, unknown>[],
            'pool_id',
            'pools',
          );
        }

        // Full pillar breakdown snapshots with V3 fields
        const scoreSnapshots = [...finalScores.entries()].map(([poolId, s]) => ({
          pool_id: poolId,
          epoch_no: currentEpoch,
          governance_score: s.composite,
          participation_rate: Math.round(s.participationRaw),
          participation_pct: Math.round(s.participationPercentile),
          deliberation_raw: Math.round(s.deliberationRaw),
          deliberation_pct: Math.round(s.deliberationPercentile),
          consistency_raw: Math.round(s.consistencyRaw),
          consistency_pct: Math.round(s.consistencyPercentile),
          reliability_raw: Math.round(s.reliabilityRaw),
          reliability_pct: Math.round(s.reliabilityPercentile),
          governance_identity_raw: Math.round(s.governanceIdentityRaw),
          governance_identity_pct: Math.round(s.governanceIdentityPercentile),
          score_momentum: s.momentum,
          confidence: s.confidence,
          rationale_rate: null,
          vote_count: poolVotes.get(poolId)?.length ?? 0,
        }));

        if (scoreSnapshots.length > 0) {
          await batchUpsert(
            supabase,
            'spo_score_snapshots',
            scoreSnapshots as unknown as Record<string, unknown>[],
            'pool_id,epoch_no',
            'spo_score_snapshots',
          );
        }

        const alignmentSnapshots = [...poolAlignments.entries()].map(([poolId, align]) => ({
          pool_id: poolId,
          epoch_no: currentEpoch,
          alignment_treasury_conservative: align.treasury_conservative ?? null,
          alignment_treasury_growth: align.treasury_growth ?? null,
          alignment_decentralization: align.decentralization ?? null,
          alignment_security: align.security ?? null,
          alignment_innovation: align.innovation ?? null,
          alignment_transparency: align.transparency ?? null,
        }));

        if (alignmentSnapshots.length > 0) {
          await batchUpsert(
            supabase,
            'spo_alignment_snapshots',
            alignmentSnapshots as unknown as Record<string, unknown>[],
            'pool_id,epoch_no',
            'spo_alignment_snapshots',
          );
        }

        // Completeness log
        await supabase.from('snapshot_completeness_log').upsert(
          {
            snapshot_type: 'spo_scores',
            epoch_no: currentEpoch,
            snapshot_date: new Date().toISOString().slice(0, 10),
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
          { onConflict: 'snapshot_type,epoch_no' },
        );

        const summary = {
          success: true,
          poolsScored: finalScores.size,
          votesProcessed: voteRows.length,
          identityEnabled,
          poolsWithIdentity: identityScores.size,
          sybilFlags: sybilFlags.length,
        };
        await syncLog.finalize(true, null, summary);
        await emitPostHog(true, 'spo_scores', syncLog.elapsed, summary);
        return summary;
      } catch (err) {
        const msg = errMsg(err);
        await syncLog.finalize(false, msg, {});
        throw err;
      }
    });

    if ('skipped' in computeResult && computeResult.skipped) return computeResult;

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
      const BATCH = 50; // Koios recommends batches of ~50
      let totalUpdated = 0;
      let totalErrors = 0;

      for (let i = 0; i < allPoolIds.length; i += BATCH) {
        const batchIds = allPoolIds.slice(i, i + BATCH);

        try {
          const res = await fetch(`${KOIOS_BASE}/pool_info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _pool_bech32_ids: batchIds }),
            signal: AbortSignal.timeout(20_000),
          });

          if (!res.ok) {
            logger.warn('[sync-spo-scores] Koios pool_info batch failed', {
              status: res.status,
              batch: i / BATCH + 1,
            });
            totalErrors += batchIds.length;
            continue;
          }

          const data = (await res.json()) as KoiosPoolInfo[];
          const metaByPool = new Map<string, Record<string, unknown>>();
          for (const p of data) {
            if (!p.pool_id_bech32) continue;
            metaByPool.set(p.pool_id_bech32, {
              ticker: p.ticker ?? null,
              pool_name: p.meta_json?.name ?? p.ticker ?? null,
              pledge_lovelace: p.pledge ?? 0,
              margin: p.margin ?? 0,
              fixed_cost_lovelace: p.fixed_cost ?? 0,
              delegator_count: p.live_delegators ?? 0,
              live_stake_lovelace: p.live_stake ?? 0,
              homepage_url: p.meta_json?.homepage ?? null,
              pool_status: p.pool_status ?? 'registered',
              retiring_epoch: p.retiring_epoch ?? null,
            });
          }

          for (const poolId of batchIds) {
            const meta = metaByPool.get(poolId);
            if (!meta) continue;
            const { error } = await supabase.from('pools').update(meta).eq('pool_id', poolId);
            if (!error) totalUpdated++;
          }

          logger.info('[sync-spo-scores] Metadata batch complete', {
            batch: i / BATCH + 1,
            koiosReturned: data.length,
            updated: totalUpdated,
          });
        } catch (err) {
          logger.warn('[sync-spo-scores] Koios metadata batch failed', {
            batch: i / BATCH + 1,
            error: errMsg(err),
          });
          totalErrors += batchIds.length;
        }
      }

      logger.info('[sync-spo-scores] Metadata fetch complete', {
        needed: allPoolIds.length,
        updated: totalUpdated,
        errors: totalErrors,
      });
      return { fetched: totalUpdated, needed: allPoolIds.length, errors: totalErrors };
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

      const BATCH = 100;
      let refreshed = 0;

      for (let i = 0; i < enrichedPools.length; i += BATCH) {
        const batch = enrichedPools.slice(i, i + BATCH);
        const poolIds = batch.map((p: { pool_id: string }) => p.pool_id);

        try {
          const res = await fetch(`${KOIOS_BASE}/pool_info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _pool_bech32_ids: poolIds }),
            signal: AbortSignal.timeout(15_000),
          });

          if (!res.ok) {
            logger.warn('[sync-spo-scores] delegator refresh batch failed', {
              status: res.status,
            });
            continue;
          }

          const data = (await res.json()) as KoiosPoolInfo[];
          for (const p of data) {
            if (!p.pool_id_bech32) continue;
            const { error } = await supabase
              .from('pools')
              .update({
                delegator_count: p.live_delegators ?? 0,
                live_stake_lovelace: p.live_stake ?? 0,
              })
              .eq('pool_id', p.pool_id_bech32);
            if (!error) refreshed++;
          }
        } catch (err) {
          logger.warn('[sync-spo-scores] delegator refresh batch error', { error: errMsg(err) });
        }
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
        // Batch geocode via ip-api.com (max 100 per request, free, no key needed)
        const ips = [...ipToPoolMap.keys()].slice(0, 100);
        const geoRes = await fetch(
          'http://ip-api.com/batch?fields=query,status,lat,lon,country,city',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ips.map((ip) => ({ query: ip }))),
            signal: AbortSignal.timeout(10_000),
          },
        );

        if (!geoRes.ok) {
          logger.warn('[sync-spo-scores] ip-api.com batch failed', { status: geoRes.status });
          return { geocoded: 0, reason: `ip-api ${geoRes.status}` };
        }

        const geoResults = (await geoRes.json()) as Array<{
          query: string;
          status: string;
          lat?: number;
          lon?: number;
          country?: string;
          city?: string;
        }>;

        // Build IP -> geo lookup
        const ipGeo = new Map<
          string,
          { lat: number; lon: number; country: string; city: string }
        >();
        for (const g of geoResults) {
          if (g.status === 'success' && g.lat != null && g.lon != null) {
            ipGeo.set(g.query, {
              lat: g.lat,
              lon: g.lon,
              country: g.country ?? '',
              city: g.city ?? '',
            });
          }
        }

        // Group geocoded results by pool
        const poolGeo = new Map<
          string,
          {
            lats: number[];
            lons: number[];
            locations: Array<{
              lat: number;
              lon: number;
              country: string;
              city: string;
              ip: string;
            }>;
          }
        >();

        for (const [ip, pools] of ipToPoolMap) {
          const geo = ipGeo.get(ip);
          if (!geo) continue;
          for (const poolId of pools) {
            const entry = poolGeo.get(poolId) ?? { lats: [], lons: [], locations: [] };
            entry.lats.push(geo.lat);
            entry.lons.push(geo.lon);
            entry.locations.push({ ...geo, ip });
            poolGeo.set(poolId, entry);
          }
        }

        for (const [poolId, data] of poolGeo) {
          // Use centroid of all relay locations as primary position
          const avgLat = data.lats.reduce((a, b) => a + b, 0) / data.lats.length;
          const avgLon = data.lons.reduce((a, b) => a + b, 0) / data.lons.length;
          const { error } = await supabase
            .from('pools')
            .update({
              relay_lat: avgLat,
              relay_lon: avgLon,
              relay_locations: data.locations,
            })
            .eq('pool_id', poolId);
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

      const { computeTier, detectTierChange } = await import('@/lib/scoring/tiers');
      const supabase = getSupabaseAdmin();

      const { data: currentPools } = await supabase
        .from('pools')
        .select('pool_id, governance_score, current_tier, confidence')
        .gt('vote_count', 0);

      const tierChangeInserts: Record<string, unknown>[] = [];

      for (const pool of currentPools || []) {
        const newScore = pool.governance_score ?? 0;
        const confidence = pool.confidence ?? undefined;
        const newTier = computeTier(newScore, confidence);
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
