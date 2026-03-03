/**
 * Dedicated alignment sync function — runs after sync-dreps completes.
 * Handles: AI classification, rationale scoring, dimension computation,
 * percentile normalization, PCA, temporal snapshots, and validation.
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
import { batchUpsert, SyncLogger, errMsg } from '@/lib/sync-utils';
import type { ProposalInfo, DRepVote } from '@/types/koios';

export const syncAlignment = inngest.createFunction(
  {
    id: 'sync-alignment',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"alignment-compute"' },
  },
  [{ event: 'drepscore/sync.alignment' }],
  async ({ step }) => {
    const result = await step.run('compute-alignment', async () => {
      const supabase = getSupabaseAdmin();
      const logger = new SyncLogger(supabase, 'alignment' as any);
      await logger.start();
      const phaseTiming: Record<string, number> = {};

      try {
        // Step 1: Load proposals from DB
        const s1 = Date.now();
        const { data: rawProposals } = await supabase.from('proposals').select('*');

        if (!rawProposals?.length) {
          console.log('[alignment] No proposals found, skipping');
          return { success: true, skipped: true };
        }

        const proposals = rawProposals as unknown as ProposalInfo[];
        phaseTiming.step1_load_proposals_ms = Date.now() - s1;

        // Step 2: AI classify proposals (cached — only new ones hit AI)
        const s2 = Date.now();
        const classifications = await classifyProposalsAI(proposals);
        phaseTiming.step2_classify_ms = Date.now() - s2;

        // Step 3: Load DReps + votes from DB
        const s3 = Date.now();
        const { data: drepRows } = await supabase
          .from('dreps')
          .select('id, info, score, participation_rate, rationale_rate, size_tier');

        const { data: voteRows } = await supabase
          .from('drep_votes')
          .select(
            'drep_id, proposal_tx_hash, proposal_index, vote, block_time, meta_url, rationale_text, rationale_quality',
          );

        if (!drepRows?.length || !voteRows?.length) {
          console.log('[alignment] No DReps or votes found');
          return { success: true, skipped: true };
        }
        phaseTiming.step3_load_data_ms = Date.now() - s3;

        // Step 4: Score rationales (cached — only unscored ones hit AI)
        const s4 = Date.now();
        const rationalesForScoring = voteRows
          .filter((v: any) => v.rationale_text && !v.rationale_quality)
          .map((v: any) => ({
            drepId: v.drep_id,
            proposalTxHash: v.proposal_tx_hash,
            proposalIndex: v.proposal_index,
            rationaleText: v.rationale_text,
          }));

        const rationaleScores = await scoreRationalesBatch(rationalesForScoring);
        phaseTiming.step4_rationale_scoring_ms = Date.now() - s4;

        // Step 5: Build classification + vote lookup maps
        const classMap = new Map<string, ProposalClassification>();
        for (const c of classifications) {
          classMap.set(`${c.proposalTxHash}-${c.proposalIndex}`, c);
        }

        const proposalTypeMap = new Map<string, string>();
        const proposalAmountMap = new Map<string, number | null>();
        for (const p of proposals) {
          const key = `${p.proposal_tx_hash}-${p.proposal_index}`;
          proposalTypeMap.set(key, p.proposal_type);
          const amount =
            p.withdrawal?.reduce(
              (sum, w) => sum + Number(BigInt(w.amount || '0') / BigInt(1_000_000)),
              0,
            ) ?? null;
          proposalAmountMap.set(key, amount);
        }

        // Group votes by DRep
        const votesByDrep = new Map<string, typeof voteRows>();
        for (const v of voteRows as any[]) {
          if (!votesByDrep.has(v.drep_id)) votesByDrep.set(v.drep_id, []);
          votesByDrep.get(v.drep_id)!.push(v);
        }

        // Step 6: Compute dimension scores for all DReps
        const s6 = Date.now();
        const rawScores: RawScoreRow[] = [];

        for (const row of drepRows as any[]) {
          const votes = votesByDrep.get(row.id) || [];
          const info = row.info as Record<string, unknown>;

          const dimensionInputs: DimensionInput[] = votes.map((v: any) => {
            const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
            const rKey = `${v.drep_id}-${v.proposal_tx_hash}-${v.proposal_index}`;
            return {
              vote: v.vote as 'Yes' | 'No' | 'Abstain',
              blockTime: v.block_time,
              hasRationale: !!(v.meta_url || v.rationale_text),
              rationaleQuality: rationaleScores.get(rKey) ?? v.rationale_quality ?? null,
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

          const scores = computeDimensionScores(dimensionInputs, drepContext);

          rawScores.push({
            drepId: row.id,
            ...scores,
          });
        }
        phaseTiming.step6_dimension_scores_ms = Date.now() - s6;

        // Step 7: Percentile normalize
        const s7 = Date.now();
        const normalized = normalizeToPercentiles(rawScores);
        phaseTiming.step7_normalize_ms = Date.now() - s7;

        // Step 8: Validate dimension independence
        const validation = validateDimensionIndependence(normalized);

        // Step 9: PCA on vote matrix
        const s9 = Date.now();
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
              (sum, w) => sum + Number(BigInt(w.amount || '0') / BigInt(1_000_000)),
              0,
            ) ?? null,
        }));

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
        phaseTiming.step9_pca_ms = Date.now() - s9;

        // Step 10: Persist scores to DB
        const s10 = Date.now();

        // Update dreps table with both percentile and raw scores
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
          supabase,
          'dreps',
          drepUpdates as unknown as Record<string, unknown>[],
          'id',
          'Alignment scores',
        );

        // Step 11: Snapshot for temporal trajectories
        const { data: tipData } = await supabase
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
            supabase,
            'alignment_snapshots',
            snapshots as unknown as Record<string, unknown>[],
            'drep_id,epoch',
            'Alignment snapshots',
          );
        }

        phaseTiming.step10_persist_ms = Date.now() - s10;

        const summary = {
          success: true,
          drepsScored: normalized.length,
          proposalsClassified: classifications.length,
          rationalesScored: rationalesForScoring.length,
          pcaComponents: pcaResult?.explainedVariance.length ?? 0,
          pcaVarianceExplained: pcaResult
            ? `${(pcaResult.totalExplainedVariance * 100).toFixed(1)}%`
            : 'N/A',
          dimensionsIndependent: validation.allIndependent,
          flaggedPairs: validation.flaggedPairs.length,
          epoch: currentEpoch,
          phaseTiming,
        };

        console.log('[alignment] Sync complete:', JSON.stringify(summary, null, 2));
        await logger.finalize(true, null, summary as Record<string, unknown>);
        return summary;
      } catch (err) {
        const msg = errMsg(err);
        console.error('[alignment] Fatal error:', msg);
        await logger.finalize(false, msg, phaseTiming);
        throw err;
      }
    });

    return result;
  },
);
