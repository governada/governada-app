/**
 * Dedicated alignment sync function — runs after sync-dreps completes.
 *
 * Split into granular Inngest steps to stay under Cloudflare's 100s timeout:
 *   0. init-sync-log
 *   1. classify-proposals — AI classification (cached)
 *   2. score-rationales — AI rationale scoring (cached)
 *   3. compute-scores — dimension scores, normalization (CPU-bound)
 *   4. persist-scores — batch upsert drep alignment scores
 *   5. compute-pca — PCA compute and persist
 *   6. persist-snapshots — alignment_snapshots + completeness log
 *   7. finalize-sync-log
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  classifyProposalsAI,
  type ProposalClassification,
} from '@/lib/alignment/classifyProposals';
import { analyzeConstitutionalAlignment } from '@/lib/alignment/constitutionalAnalysis';
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
import {
  batchUpsert,
  errMsg,
  emitPostHog,
  capMsg,
  fetchAll,
  alertCritical,
} from '@/lib/sync-utils';
import { logger } from '@/lib/logger';
import type { ProposalInfo } from '@/types/koios';

interface ClassificationRow {
  proposal_tx_hash: string;
  proposal_index: number;
  dim_treasury_conservative: number;
  dim_treasury_growth: number;
  dim_decentralization: number;
  dim_security: number;
  dim_innovation: number;
  dim_transparency: number;
  ai_summary?: string | null;
}

interface VoteRow {
  drep_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: string;
  block_time: number;
  meta_url?: string | null;
  rationale_quality?: number | null;
}

interface DRepRow {
  id: string;
  info: Record<string, unknown> | null;
  score: number | null;
  participation_rate: number | null;
  rationale_rate: number | null;
  size_tier: string | null;
}

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
    withdrawal: withdrawalAmount ? [{ stake_address: '', amount: String(withdrawalAmount) }] : null,
    param_proposal: (row.param_changes as Record<string, unknown>) || null,
    block_time: (row.block_time as number) || 0,
  };
}

const DB_PROPOSAL_COLUMNS =
  'tx_hash, proposal_index, proposal_id, proposal_type, meta_json, withdrawal_amount, param_changes, proposed_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, expiration_epoch, block_time';

interface SerializedScoreRow {
  drepId: string;
  treasuryConservative: number | null;
  treasuryGrowth: number | null;
  decentralization: number | null;
  security: number | null;
  innovation: number | null;
  transparency: number | null;
  pTreasuryConservative: number;
  pTreasuryGrowth: number;
  pDecentralization: number;
  pSecurity: number;
  pInnovation: number;
  pTransparency: number;
}

export const syncAlignment = inngest.createFunction(
  {
    id: 'sync-alignment',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"alignment-compute"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[alignment] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'alignment')
        .is('finished_at', null);
      await alertCritical(
        'Alignment Sync Failed',
        `Alignment sync failed after all retries.\nError: ${msg}\nCheck logs for details.`,
      );
    },
    triggers: [{ event: 'drepscore/sync.alignment' }, { cron: '0 3 * * *' }],
  },
  async ({ step }) => {
    const startTime = Date.now();

    // Step 0
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

    // Step 1: classify proposals (AI, cached)
    const classifyResult = await step.run('classify-proposals', async () => {
      const sb = getSupabaseAdmin();
      const { data: dbRows } = await sb.from('proposals').select(DB_PROPOSAL_COLUMNS);
      if (!dbRows?.length) return { classified: 0, skipped: true };
      const proposals = dbRows.map(mapDBProposal);
      const classifications = await classifyProposalsAI(proposals);
      return { classified: classifications.length, skipped: false };
    });

    // Step 1b: constitutional alignment analysis (AI, cached)
    const constitutionalResult = await step.run('analyze-constitutional-alignment', async () => {
      const sb = getSupabaseAdmin();
      const { data: dbRows } = await sb.from('proposals').select(DB_PROPOSAL_COLUMNS);
      if (!dbRows?.length) return { analyzed: 0 };
      const proposals = dbRows.map(mapDBProposal);
      const results = await analyzeConstitutionalAlignment(proposals);
      return { analyzed: results.size };
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

    // Step 2: score rationales using actual text from vote_rationales table.
    // Capped at 200 per run to stay under Cloudflare 100s timeout;
    // subsequent runs pick up the next unscored batch.
    const rationaleResult = await step.run('score-rationales', async () => {
      const STEP_BATCH_LIMIT = 50;
      const sb = getSupabaseAdmin();

      // Left-join to find rationales that haven't been quality-scored yet
      const { data: rationales } = await sb
        .from('vote_rationales')
        .select('drep_id, proposal_tx_hash, proposal_index, rationale_text')
        .not('rationale_text', 'is', null)
        .range(0, STEP_BATCH_LIMIT - 1);

      if (!rationales?.length) return { scored: 0, remaining: 0 };

      const forScoring = rationales.map((v) => ({
        drepId: v.drep_id,
        proposalTxHash: v.proposal_tx_hash,
        proposalIndex: v.proposal_index,
        rationaleText: v.rationale_text,
      }));

      const scores = await scoreRationalesBatch(forScoring);
      return { scored: scores.size, batchSize: rationales.length };
    });

    // Step 3: compute dimension scores + normalize (CPU-bound, no DB writes)
    const computeResult = await step.run('compute-scores', async () => {
      const sb = getSupabaseAdmin();
      const s1 = Date.now();

      const [dbRows, drepRows, voteRows, classRows] = await Promise.all([
        fetchAll(sb.from('proposals').select(DB_PROPOSAL_COLUMNS)),
        fetchAll(
          sb.from('dreps').select('id, info, score, participation_rate, rationale_rate, size_tier'),
        ),
        fetchAll(
          sb
            .from('drep_votes')
            .select(
              'drep_id, proposal_tx_hash, proposal_index, vote, block_time, meta_url, rationale_quality',
            ),
        ),
        fetchAll(sb.from('proposal_classifications').select('*')),
      ]);

      if (!dbRows.length || !drepRows.length || !voteRows.length) {
        return {
          skipped: true,
          reason: 'insufficient data',
          scores: [] as SerializedScoreRow[],
          classificationsCount: 0,
          dimensionsIndependent: true,
          flaggedPairs: 0,
          timing: { loadMs: 0, dimMs: 0, normMs: 0 },
        };
      }

      const proposals = dbRows.map(mapDBProposal);
      const loadMs = Date.now() - s1;

      const classMap = new Map<string, ProposalClassification>();
      for (const c of classRows as ClassificationRow[]) {
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
          p.withdrawal?.reduce((sum, w) => {
            try {
              return sum + Number(BigInt(w.amount || '0') / BigInt(1_000_000));
            } catch {
              return sum;
            }
          }, 0) ?? null;
        proposalAmountMap.set(key, amount);
      }

      const votesByDrep = new Map<string, VoteRow[]>();
      for (const v of voteRows as VoteRow[]) {
        if (!votesByDrep.has(v.drep_id)) votesByDrep.set(v.drep_id, []);
        votesByDrep.get(v.drep_id)!.push(v);
      }

      const s2 = Date.now();
      const rawScores: RawScoreRow[] = [];
      for (const row of drepRows as DRepRow[]) {
        const votes = votesByDrep.get(row.id) || [];
        const dimensionInputs: DimensionInput[] = votes.map((v) => {
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
      const dimMs = Date.now() - s2;

      const s3 = Date.now();
      const normalized = normalizeToPercentiles(rawScores);
      const normMs = Date.now() - s3;
      const validation = validateDimensionIndependence(normalized);

      // Serialize for passing between steps (no Maps)
      const scores: SerializedScoreRow[] = normalized.map((row) => ({
        drepId: row.drepId,
        treasuryConservative: row.treasuryConservative,
        treasuryGrowth: row.treasuryGrowth,
        decentralization: row.decentralization,
        security: row.security,
        innovation: row.innovation,
        transparency: row.transparency,
        pTreasuryConservative: row.percentile.treasuryConservative,
        pTreasuryGrowth: row.percentile.treasuryGrowth,
        pDecentralization: row.percentile.decentralization,
        pSecurity: row.percentile.security,
        pInnovation: row.percentile.innovation,
        pTransparency: row.percentile.transparency,
      }));

      return {
        skipped: false,
        scores,
        classificationsCount: classMap.size,
        dimensionsIndependent: validation.allIndependent,
        flaggedPairs: validation.flaggedPairs.length,
        timing: { loadMs, dimMs, normMs },
      };
    });

    if (computeResult.skipped) {
      await step.run('finalize-insufficient', async () => {
        if (!logId) return;
        const sb = getSupabaseAdmin();
        await sb
          .from('sync_log')
          .update({
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            success: true,
            error_message: capMsg(
              'skipped: ' + ('reason' in computeResult ? String(computeResult.reason) : 'unknown'),
            ),
            metrics: {
              skipped: true,
              reason: 'reason' in computeResult ? String(computeResult.reason) : 'unknown',
            },
          })
          .eq('id', logId);
      });
      return { success: true, skipped: true };
    }

    // Step 4: persist drep alignment scores (DB-heavy)
    await step.run('persist-scores', async () => {
      const sb = getSupabaseAdmin();
      const drepUpdates = computeResult.scores.map((row) => ({
        id: row.drepId,
        alignment_treasury_conservative: row.pTreasuryConservative,
        alignment_treasury_growth: row.pTreasuryGrowth,
        alignment_decentralization: row.pDecentralization,
        alignment_security: row.pSecurity,
        alignment_innovation: row.pInnovation,
        alignment_transparency: row.pTransparency,
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
      return { persisted: drepUpdates.length };
    });

    // Step 5: PCA compute + persist (CPU + DB)
    const pcaResult = await step.run('compute-pca', async () => {
      const sb = getSupabaseAdmin();
      const [dbRows, voteRows, classRows] = await Promise.all([
        fetchAll(sb.from('proposals').select(DB_PROPOSAL_COLUMNS)),
        fetchAll(
          sb
            .from('drep_votes')
            .select('drep_id, proposal_tx_hash, proposal_index, vote, block_time'),
        ),
        fetchAll(sb.from('proposal_classifications').select('*')),
      ]);

      if (!dbRows.length || !voteRows.length) return { pcaComponents: 0, variance: 'N/A' };

      const proposals = dbRows.map(mapDBProposal);
      const classMap = new Map<string, ProposalClassification>();
      for (const c of classRows as ClassificationRow[]) {
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

      const voteMatrixInputs: VoteMatrixInput[] = (voteRows as VoteRow[]).map((v) => ({
        drepId: v.drep_id,
        proposalTxHash: v.proposal_tx_hash,
        proposalIndex: v.proposal_index,
        vote: v.vote as 'Yes' | 'No' | 'Abstain',
        blockTime: v.block_time,
      }));

      const proposalMeta = proposals.map((p) => ({
        txHash: p.proposal_tx_hash,
        index: p.proposal_index,
        type: p.proposal_type,
        withdrawalAmountAda:
          p.withdrawal?.reduce((sum, w) => {
            try {
              return sum + Number(BigInt(w.amount || '0') / BigInt(1_000_000));
            } catch {
              return sum;
            }
          }, 0) ?? null,
      }));

      const classifications = Array.from(classMap.values());
      const voteMatrix = buildVoteMatrix(voteMatrixInputs, proposalMeta, classifications);

      if (voteMatrix.matrix.length < 3 || (voteMatrix.matrix[0]?.length ?? 0) < 3) {
        return { pcaComponents: 0, variance: 'N/A' };
      }

      const pca = computePCA(
        voteMatrix.matrix,
        voteMatrix.drepIds,
        voteMatrix.proposalIds,
        classifications,
      );

      if (pca) {
        await storePCAResults(
          pca,
          voteMatrix.proposalIds,
          voteMatrix.drepIds.length,
          voteMatrix.proposalIds.length,
        );
      }

      return {
        pcaComponents: pca?.explainedVariance.length ?? 0,
        variance: pca ? `${(pca.totalExplainedVariance * 100).toFixed(1)}%` : 'N/A',
      };
    });

    // Step 6: persist alignment snapshots (DB-heavy)
    const snapshotResult = await step.run('persist-snapshots', async () => {
      const sb = getSupabaseAdmin();

      // Use governance_stats.current_epoch so snapshots land in the same epoch
      // that check-snapshot-completeness queries. Previously derived from
      // proposals.proposed_epoch which could diverge.
      const { data: statsRow } = await sb
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();
      const currentEpoch = statsRow?.current_epoch ?? 0;
      if (currentEpoch === 0) return { epoch: 0, snapshots: 0 };

      const snapshots = computeResult.scores.map((row) => ({
        drep_id: row.drepId,
        epoch: currentEpoch,
        alignment_treasury_conservative: row.pTreasuryConservative,
        alignment_treasury_growth: row.pTreasuryGrowth,
        alignment_decentralization: row.pDecentralization,
        alignment_security: row.pSecurity,
        alignment_innovation: row.pInnovation,
        alignment_transparency: row.pTransparency,
        pca_coordinates: null,
        snapshot_at: new Date().toISOString(),
      }));

      await batchUpsert(
        sb,
        'alignment_snapshots',
        snapshots as unknown as Record<string, unknown>[],
        'drep_id,epoch',
        'Alignment snapshots',
      );

      const activeDreps = computeResult.scores.length;
      const coveragePct =
        activeDreps > 0 ? Math.round((snapshots.length / activeDreps) * 10000) / 100 : 100;
      await sb.from('snapshot_completeness_log').upsert(
        {
          snapshot_type: 'alignment',
          epoch_no: currentEpoch,
          snapshot_date: new Date().toISOString().slice(0, 10),
          record_count: snapshots.length,
          expected_count: activeDreps,
          coverage_pct: coveragePct,
        },
        { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
      );

      return { epoch: currentEpoch, snapshots: snapshots.length };
    });

    // Step 7: finalize sync_log
    const finalResult = {
      success: true,
      drepsScored: computeResult.scores.length,
      proposalsClassified: computeResult.classificationsCount,
      pcaComponents: pcaResult.pcaComponents,
      pcaVarianceExplained: pcaResult.variance,
      dimensionsIndependent: computeResult.dimensionsIndependent,
      flaggedPairs: computeResult.flaggedPairs,
      epoch: snapshotResult.epoch,
      timing: computeResult.timing,
    };

    await step.run('finalize-sync-log', async () => {
      if (!logId) return;
      const sb = getSupabaseAdmin();
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          success: true,
          metrics: {
            ...finalResult,
            rationalesScored: rationaleResult.scored,
            proposalsClassified: classifyResult.classified,
            constitutionalAnalyzed: constitutionalResult.analyzed,
          },
        })
        .eq('id', logId);
    });

    await emitPostHog(true, 'alignment', Date.now() - startTime, finalResult);
    logger.info('[alignment] Sync complete', finalResult);
    return finalResult;
  },
);
