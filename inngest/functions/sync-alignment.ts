/**
 * Dedicated alignment sync function — runs after sync-dreps completes.
 *
 * Split into multiple Inngest steps to avoid step-level timeouts:
 *   0. init-sync-log — memoized SyncLogger entry (prevents ghost rows)
 *   1. classify-proposals — AI classification (cached, writes to DB)
 *   2. score-rationales — AI rationale scoring (cached, writes to DB)
 *   3. compute-and-persist — dimension scores, normalization, PCA, snapshots
 *   4. finalize-sync-log — update sync_log with result
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  classifyProposalsAI,
  type ProposalClassification,
} from '@/lib/alignment/classifyProposals';
import { buildVoteMatrix, type VoteMatrixInput } from '@/lib/alignment/voteMatrix';
import {
  computeDimensionScores,
  type DimensionInput,
  type DRepContext,
} from '@/lib/alignment/dimensions';
import { scoreRationalesBatch } from '@/lib/alignment/rationaleQuality';
import { normalizeToPercentiles, type RawScoreRow } from '@/lib/alignment/normalize';
import { computePCA, storePCAResults } from '@/lib/alignment/pca';
import { validateDimensionIndependence } from '@/lib/alignment/validate';
import { batchUpsert, errMsg, emitPostHog, capMsg } from '@/lib/sync-utils';
import type { ProposalInfo } from '@/types/koios';

/**
 * Map a DB proposals row to the ProposalInfo shape the alignment pipeline expects.
 * The DB uses different column names than the Koios API response.
 */
function mapDBProposal(row: Record<string, unknown>): ProposalInfo {
  const withdrawalAmount = row.withdrawal_amount as string | null;
  return {
    proposal_tx_hash: row.tx_hash as string,
    proposal_index: row.proposal_index as number,
    proposal_id: (row.proposal_id as string) || '',
    proposal_type: row.proposal_type as ProposalInfo['proposal_type'],
    proposal_description: null,
    deposit: '0',
    return_address: '',
    proposed_epoch: (row.proposed_epoch as number) || 0,
    ratified_epoch: (row.ratified_epoch as number) || null,
    enacted_epoch: (row.enacted_epoch as number) || null,
    dropped_epoch: (row.dropped_epoch as number) || null,
    expired_epoch: (row.expired_epoch as number) || null,
    expiration: (row.expiration_epoch as number) || null,
    meta_url: null,
    meta_hash: null,
    meta_json: (row.meta_json as ProposalInfo['meta_json']) || null,
    meta_comment: null,
    meta_is_valid: null,
    withdrawal: withdrawalAmount
      ? [{ stake_address: '', amount: String(withdrawalAmount) }]
      : null,
    param_proposal: (row.param_changes as Record<string, unknown>) || null,
    block_time: (row.block_time as number) || 0,
  };
}

const DB_PROPOSAL_COLUMNS =
  'tx_hash, proposal_index, proposal_id, proposal_type, meta_json, withdrawal_amount, param_changes, proposed_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, expiration_epoch, block_time';

export const syncAlignment = inngest.createFunction(
  {
    id: 'sync-alignment',
    retries: 3,
    concurrency: { limit: 1, scope: 'env', key: '"alignment-compute"' },
  },
  [{ event: 'drepscore/sync.alignment' }, { cron: '0 3 * * *' }],
  async ({ step }) => {
    const startTime = Date.now();

    // Step 0: Memoized sync_log entry (runs once, prevents ghost rows on replay)
    const logId = await step.run('init-sync-log', async () => {
      const sb = getSupabaseAdmin();
      const { data } = await sb
        .from('sync_log')
        .insert({
          sync_type: 'alignment',
          started_at: new Date().toISOString(),
          success: false,
        })
        .select('id')
        .single();
      return data?.id ?? null;
    });

    // Step 1: AI-classify proposals (slow — isolated to avoid timeout)
    const classifyResult = await step.run('classify-proposals', async () => {
      const sb = getSupabaseAdmin();
      const { data: dbRows } = await sb.from('proposals').select(DB_PROPOSAL_COLUMNS);

      if (!dbRows?.length) {
        return { classified: 0, skipped: true };
      }

      const proposals = dbRows.map(mapDBProposal);
      const classifications = await classifyProposalsAI(proposals);
      return { classified: classifications.length, skipped: false };
    });

    if (classifyResult.skipped) {
      await step.run('finalize-skipped', async () => {
        if (!logId) return;
        const sb = getSupabaseAdmin();
        await sb
          .from('sync_log')
          .update({
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            success: true,
            error_message: 'skipped: no proposals',
            metrics: { skipped: true, reason: 'no proposals' },
          })
          .eq('id', logId);
      });
      return { success: true, skipped: true };
    }

    // Step 2: Score unscored rationales via AI (slow — isolated)
    const rationaleResult = await step.run('score-rationales', async () => {
      const sb = getSupabaseAdmin();
      const { data: voteRows } = await sb
        .from('drep_votes')
        .select('drep_id, proposal_tx_hash, proposal_index, meta_url, rationale_quality')
        .not('meta_url', 'is', null)
        .is('rationale_quality', null);

      if (!voteRows?.length) return { scored: 0 };

      const forScoring = voteRows.map((v: any) => ({
        drepId: v.drep_id,
        proposalTxHash: v.proposal_tx_hash,
        proposalIndex: v.proposal_index,
        rationaleText: v.meta_url,
      }));

      const scores = await scoreRationalesBatch(forScoring);
      return { scored: scores.size };
    });

    // Step 3: Compute dimensions, normalize, PCA, persist (CPU-bound, no AI calls)
    const computeResult = await step.run('compute-and-persist', async () => {
      const sb = getSupabaseAdmin();
      const phaseTiming: Record<string, number> = {};

      try {
        const s1 = Date.now();
        const [{ data: dbRows }, { data: drepRows }, { data: voteRows }, { data: classRows }] =
          await Promise.all([
            sb.from('proposals').select(DB_PROPOSAL_COLUMNS),
            sb.from('dreps').select(
              'id, info, score, participation_rate, rationale_rate, size_tier',
            ),
            sb
              .from('drep_votes')
              .select(
                'drep_id, proposal_tx_hash, proposal_index, vote, block_time, meta_url, rationale_quality',
              ),
            sb.from('proposal_classifications').select('*'),
          ]);

        if (!dbRows?.length || !drepRows?.length || !voteRows?.length) {
          return { success: true, skipped: true, reason: 'insufficient data' };
        }

        const proposals = dbRows.map(mapDBProposal);
        phaseTiming.load_ms = Date.now() - s1;

        // Build classification map from DB
        const classMap = new Map<string, ProposalClassification>();
        for (const c of (classRows || []) as any[]) {
          classMap.set(`${c.proposal_tx_hash}-${c.proposal_index}`, {
            proposalTxHash: c.proposal_tx_hash,
            proposalIndex: c.proposal_index,
            dimTreasuryConservative: c.dim_treasury_conservative,
            dimTreasuryGrowth: c.dim_treasury_growth,
            dimDecentralization: c.dim_decentralization,
            dimSecurity: c.dim_security,
            dimInnovation: c.dim_innovation,
            dimTransparency: c.dim_transparency,
            aiSummary: c.ai_summary ?? null,
          });
        }

        const proposalTypeMap = new Map<string, string>();
        const proposalAmountMap = new Map<string, number | null>();
        for (const p of proposals) {
          const key = `${p.proposal_tx_hash}-${p.proposal_index}`;
          proposalTypeMap.set(key, p.proposal_type);
          const amount =
            p.withdrawal?.reduce(
              (sum, w) => {
                try {
                  return sum + Number(BigInt(w.amount || '0') / BigInt(1_000_000));
                } catch {
                  return sum;
                }
              },
              0,
            ) ?? null;
          proposalAmountMap.set(key, amount);
        }

        const votesByDrep = new Map<string, typeof voteRows>();
        for (const v of voteRows as any[]) {
          if (!votesByDrep.has(v.drep_id)) votesByDrep.set(v.drep_id, []);
          votesByDrep.get(v.drep_id)!.push(v);
        }

        // Compute dimension scores
        const s2 = Date.now();
        const rawScores: RawScoreRow[] = [];

        for (const row of drepRows as any[]) {
          const votes = votesByDrep.get(row.id) || [];

          const dimensionInputs: DimensionInput[] = votes.map((v: any) => {
            const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
            return {
              vote: v.vote as 'Yes' | 'No' | 'Abstain',
              blockTime: v.block_time,
              hasRationale: !!v.meta_url,
              rationaleQuality: v.rationale_quality ?? null,
              proposalType: proposalTypeMap.get(key) || 'InfoAction',
              withdrawalAmountAda: proposalAmountMap.get(key) ?? null,
              classification: classMap.get(key) || null,
            };
          });

          const drepContext: DRepContext = {
            sizeTier: row.size_tier || 'Medium',
            participationRate: row.participation_rate || 0,
            rationaleRate: row.rationale_rate || 0,
            totalVotes: votes.length,
          };

          rawScores.push({
            drepId: row.id,
            ...computeDimensionScores(dimensionInputs, drepContext),
          });
        }
        phaseTiming.dimensions_ms = Date.now() - s2;

        // Percentile normalize
        const s3 = Date.now();
        const normalized = normalizeToPercentiles(rawScores);
        phaseTiming.normalize_ms = Date.now() - s3;

        const validation = validateDimensionIndependence(normalized);

        // PCA
        const s4 = Date.now();
        const voteMatrixInputs: VoteMatrixInput[] = (voteRows as any[]).map((v) => ({
          drepId: v.drep_id,
          proposalTxHash: v.proposal_tx_hash,
          proposalIndex: v.proposal_index,
          vote: v.vote,
          blockTime: v.block_time,
        }));

        const proposalMeta = proposals.map((p) => ({
          txHash: p.proposal_tx_hash,
          index: p.proposal_index,
          type: p.proposal_type,
          withdrawalAmountAda:
            p.withdrawal?.reduce(
              (sum, w) => {
                try {
                  return sum + Number(BigInt(w.amount || '0') / BigInt(1_000_000));
                } catch {
                  return sum;
                }
              },
              0,
            ) ?? null,
        }));

        const classifications = Array.from(classMap.values());
        const voteMatrix = buildVoteMatrix(voteMatrixInputs, proposalMeta, classifications);
        let pcaResult = null;

        if (voteMatrix.matrix.length >= 3 && voteMatrix.matrix[0]?.length >= 3) {
          pcaResult = computePCA(
            voteMatrix.matrix,
            voteMatrix.drepIds,
            voteMatrix.proposalIds,
            classifications,
          );

          if (pcaResult) {
            await storePCAResults(
              pcaResult,
              voteMatrix.proposalIds,
              voteMatrix.drepIds.length,
              voteMatrix.proposalIds.length,
            );
          }
        }
        phaseTiming.pca_ms = Date.now() - s4;

        // Persist scores
        const s5 = Date.now();
        const drepUpdates = normalized.map((row) => ({
          id: row.drepId,
          alignment_treasury_conservative: row.percentile.treasuryConservative,
          alignment_treasury_growth: row.percentile.treasuryGrowth,
          alignment_decentralization: row.percentile.decentralization,
          alignment_security: row.percentile.security,
          alignment_innovation: row.percentile.innovation,
          alignment_transparency: row.percentile.transparency,
          alignment_treasury_conservative_raw: row.treasuryConservative,
          alignment_treasury_growth_raw: row.treasuryGrowth,
          alignment_decentralization_raw: row.decentralization,
          alignment_security_raw: row.security,
          alignment_innovation_raw: row.innovation,
          alignment_transparency_raw: row.transparency,
        }));

        await batchUpsert(
          sb,
          'dreps',
          drepUpdates as unknown as Record<string, unknown>[],
          'id',
          'Alignment scores',
        );

        // Snapshot for temporal trajectories
        const { data: tipData } = await sb
          .from('proposals')
          .select('proposed_epoch')
          .order('proposed_epoch', { ascending: false })
          .limit(1);

        const currentEpoch = (tipData as any)?.[0]?.proposed_epoch || 0;

        if (currentEpoch > 0) {
          const snapshots = normalized.map((row) => ({
            drep_id: row.drepId,
            epoch: currentEpoch,
            alignment_treasury_conservative: row.percentile.treasuryConservative,
            alignment_treasury_growth: row.percentile.treasuryGrowth,
            alignment_decentralization: row.percentile.decentralization,
            alignment_security: row.percentile.security,
            alignment_innovation: row.percentile.innovation,
            alignment_transparency: row.percentile.transparency,
            pca_coordinates: pcaResult?.coordinates.get(row.drepId) || null,
            snapshot_at: new Date().toISOString(),
          }));

          await batchUpsert(
            sb,
            'alignment_snapshots',
            snapshots as unknown as Record<string, unknown>[],
            'drep_id,epoch',
            'Alignment snapshots',
          );

          const activeDreps = drepRows?.length ?? 0;
          const snapshotted = snapshots.length;
          const coveragePct =
            activeDreps > 0 ? Math.round((snapshotted / activeDreps) * 10000) / 100 : 100;
          await sb.from('snapshot_completeness_log').upsert(
            {
              snapshot_type: 'alignment',
              epoch_no: currentEpoch,
              snapshot_date: new Date().toISOString().slice(0, 10),
              record_count: snapshotted,
              expected_count: activeDreps,
              coverage_pct: coveragePct,
            },
            { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
          );
        }

        phaseTiming.persist_ms = Date.now() - s5;

        return {
          success: true,
          drepsScored: normalized.length,
          proposalsClassified: classMap.size,
          pcaComponents: pcaResult?.explainedVariance.length ?? 0,
          pcaVarianceExplained: pcaResult
            ? `${(pcaResult.totalExplainedVariance * 100).toFixed(1)}%`
            : 'N/A',
          dimensionsIndependent: validation.allIndependent,
          flaggedPairs: validation.flaggedPairs.length,
          epoch: currentEpoch,
          phaseTiming,
        };
      } catch (err) {
        const msg = errMsg(err);
        console.error('[alignment] compute-and-persist error:', msg);
        throw err;
      }
    });

    // Step 4: Finalize sync_log (memoized step ensures it only runs once)
    const skipped = 'skipped' in computeResult && computeResult.skipped;
    const success = computeResult.success && !skipped;

    await step.run('finalize-sync-log', async () => {
      if (!logId) return;
      const sb = getSupabaseAdmin();
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          success,
          error_message: skipped
            ? capMsg(
                'skipped: ' +
                  (('reason' in computeResult && computeResult.reason) || 'unknown'),
              )
            : null,
          metrics: {
            ...computeResult,
            rationalesScored: rationaleResult.scored,
            proposalsClassified: classifyResult.classified,
          },
        })
        .eq('id', logId);
    });

    await emitPostHog(success, 'alignment', Date.now() - startTime, computeResult);
    console.log('[alignment] Sync complete:', JSON.stringify(computeResult, null, 2));
    return computeResult;
  },
);
