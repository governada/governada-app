import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { SyncLogger, batchUpsert, errMsg, emitPostHog } from '@/lib/sync-utils';
import { computeSpoScores, type SpoVoteData } from '@/lib/scoring/spoScore';
import { getExtendedImportanceWeight } from '@/lib/scoring';

const KOIOS_BASE = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';

export const syncSpoScores = inngest.createFunction(
  {
    id: 'sync-spo-scores',
    retries: 3,
    concurrency: { limit: 1, scope: 'env', key: '"spo-scores"' },
  },
  [{ event: 'drepscore/sync.spo-scores' }, { cron: '0 3 * * *' }],
  async ({ step }) => {
    const computeResult = await step.run('compute-scores', async () => {
      const supabase = getSupabaseAdmin();
      const logger = new SyncLogger(supabase, 'spo_scores');
      await logger.start();

      const [
        { data: voteRows },
        { data: proposalRows },
        { data: classificationRows },
        { data: statsRow },
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
      ]);

      const currentEpoch =
        statsRow?.current_epoch ?? blockTimeToEpoch(Math.floor(Date.now() / 1000));
      if (!voteRows?.length) {
        await logger.finalize(true, null, { skipped: true });
        return { success: true, skipped: true };
      }

      try {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const proposalContexts = new Map<string, { blockTime: number; importanceWeight: number }>();
        const allProposalTypes = new Set<string>();

        for (const p of (proposalRows || []) as any[]) {
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
          allProposalTypes.add(p.proposal_type);
        }

        let totalWeightedPool = 0;
        const { DECAY_LAMBDA } = await import('@/lib/scoring/types');
        for (const [, ctx] of proposalContexts) {
          const ageDays = Math.max(0, (nowSeconds - ctx.blockTime) / 86400);
          totalWeightedPool += ctx.importanceWeight * Math.exp(-DECAY_LAMBDA * ageDays);
        }

        const allVotes: SpoVoteData[] = [];
        const poolVotes = new Map<string, SpoVoteData[]>();

        for (const v of voteRows as any[]) {
          const proposalKey = `${v.proposal_tx_hash}-${v.proposal_index}`;
          const ctx = proposalContexts.get(proposalKey);
          const proposal = ((proposalRows || []) as any[]).find(
            (p: any) => `${p.tx_hash}-${p.proposal_index}` === proposalKey,
          );

          const voteData: SpoVoteData = {
            poolId: v.pool_id,
            proposalKey,
            vote: v.vote,
            blockTime: v.block_time,
            epoch: v.epoch ?? blockTimeToEpoch(v.block_time),
            proposalType: proposal?.proposal_type ?? 'InfoAction',
            importanceWeight: ctx?.importanceWeight ?? 1,
          };

          allVotes.push(voteData);
          if (!poolVotes.has(v.pool_id)) poolVotes.set(v.pool_id, []);
          poolVotes.get(v.pool_id)!.push(voteData);
        }

        const finalScores = computeSpoScores(
          allVotes,
          totalWeightedPool,
          currentEpoch,
          allProposalTypes,
        );

        const classificationMap = new Map<string, Record<string, number>>();
        for (const c of (classificationRows || []) as any[]) {
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

        const poolUpdates = [...finalScores.entries()].map(([poolId, s]) => {
          const align = poolAlignments.get(poolId) ?? {};
          const voteCount = poolVotes.get(poolId)?.length ?? 0;
          return {
            pool_id: poolId,
            governance_score: s.composite,
            participation_raw: Math.round(s.participationRaw),
            participation_pct: Math.round(s.participationPercentile),
            consistency_raw: Math.round(s.consistencyRaw),
            consistency_pct: Math.round(s.consistencyPercentile),
            reliability_raw: Math.round(s.reliabilityRaw),
            reliability_pct: Math.round(s.reliabilityPercentile),
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

        const scoreSnapshots = [...finalScores.entries()].map(([poolId, s]) => ({
          pool_id: poolId,
          epoch_no: currentEpoch,
          governance_score: s.composite,
          participation_rate: Math.round(s.participationPercentile),
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

        const summary = {
          success: true,
          poolsScored: finalScores.size,
          votesProcessed: voteRows.length,
        };
        await logger.finalize(true, null, summary);
        await emitPostHog(true, 'spo_scores', logger.elapsed, summary);
        return summary;
      } catch (err) {
        const msg = errMsg(err);
        await logger.finalize(false, msg, {});
        throw err;
      }
    });

    if ('skipped' in computeResult && computeResult.skipped) return computeResult;

    await step.run('fetch-koios-metadata', async () => {
      const supabase = getSupabaseAdmin();
      const { data: poolsNeedingMeta } = await supabase
        .from('pools')
        .select('pool_id')
        .or('ticker.is.null,pool_name.is.null')
        .limit(100);

      if (!poolsNeedingMeta?.length) return { fetched: 0 };

      const poolIds = poolsNeedingMeta.map((p: any) => p.pool_id);

      try {
        const res = await fetch(`${KOIOS_BASE}/pool_info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _pool_bech32_ids: poolIds }),
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
          console.warn('[sync-spo-scores] Koios pool_info failed:', res.status);
          return { fetched: 0, error: res.status };
        }

        const data = (await res.json()) as any[];
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
          });
        }

        let updated = 0;
        for (const poolId of poolIds) {
          const meta = metaByPool.get(poolId);
          if (!meta) continue;
          const { error } = await supabase.from('pools').update(meta).eq('pool_id', poolId);
          if (!error) updated++;
        }
        return { fetched: updated };
      } catch (err) {
        console.warn('[sync-spo-scores] Koios metadata fetch failed:', errMsg(err));
        return { fetched: 0, error: errMsg(err) };
      }
    });

    return computeResult;
  },
);
