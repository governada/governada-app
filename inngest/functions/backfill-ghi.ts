/**
 * One-time backfill of historical GHI + DRep scores for epochs 530-621.
 *
 * Each epoch is an independent Inngest step so individual epochs can retry on failure.
 * DRep scores are computed first, then GHI (which depends on DRep scores for
 * the DRep Participation component).
 *
 * Trigger: send event `drepscore/backfill.ghi` with optional data:
 *   { startEpoch: 530, endEpoch: 621 }
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { computeDRepScoresForEpoch, epochToDate } from '@/lib/scoring/historical';
import { computeGHIForEpoch } from '@/lib/ghi/historical';
import { logger } from '@/lib/logger';

const SCORE_VERSION = 'v3.2-backfill';

export const backfillGhi = inngest.createFunction(
  {
    id: 'backfill-ghi',
    retries: 2,
    concurrency: { limit: 1 },
    triggers: [{ event: 'drepscore/backfill.ghi' }],
  },
  async ({ step, event }) => {
    const startEpoch = (event.data?.startEpoch as number) ?? 530;
    const endEpoch = (event.data?.endEpoch as number) ?? 621;
    const skipDrepScores = (event.data?.skipDrepScores as boolean) ?? false;
    const skipGhi = (event.data?.skipGhi as boolean) ?? false;

    const results: Array<{ epoch: number; drepCount: number; ghiScore: number | null }> = [];

    for (let epoch = startEpoch; epoch <= endEpoch; epoch++) {
      const result = await step.run(`epoch-${epoch}`, async () => {
        const supabase = getSupabaseAdmin();
        const epochDate = epochToDate(epoch).toISOString().slice(0, 10);
        let drepCount = 0;
        let ghiScore: number | null = null;

        // ── Phase A: DRep Scores ──────────────────────────────────
        if (!skipDrepScores) {
          try {
            const scores = await computeDRepScoresForEpoch(epoch);
            drepCount = scores.length;

            if (scores.length > 0) {
              // Batch upsert in chunks of 100
              for (let i = 0; i < scores.length; i += 100) {
                const batch = scores.slice(i, i + 100).map((s) => ({
                  drep_id: s.drepId,
                  score: s.score,
                  engagement_quality: s.engagementQuality,
                  effective_participation_v3: s.effectiveParticipationV3,
                  reliability_v3: s.reliabilityV3,
                  governance_identity: s.governanceIdentity,
                  engagement_quality_raw: s.engagementQualityRaw,
                  effective_participation_v3_raw: s.effectiveParticipationV3Raw,
                  reliability_v3_raw: s.reliabilityV3Raw,
                  governance_identity_raw: s.governanceIdentityRaw,
                  epoch_no: epoch,
                  snapshot_date: epochDate,
                  score_version: SCORE_VERSION,
                  // Legacy columns (required NOT NULL) — set to calibrated values
                  effective_participation: s.effectiveParticipationV3,
                  rationale_rate: s.engagementQualityRaw,
                  reliability_score: s.reliabilityV3,
                  profile_completeness: s.governanceIdentity,
                }));

                const { error } = await supabase
                  .from('drep_score_history')
                  .upsert(batch, { onConflict: 'drep_id,snapshot_date' });

                if (error) {
                  logger.error(`[backfill] DRep score upsert failed for epoch ${epoch}`, {
                    error: error.message,
                    chunk: i,
                  });
                }
              }
            }

            logger.info(`[backfill] Epoch ${epoch}: ${drepCount} DRep scores stored`);
          } catch (err) {
            logger.error(`[backfill] DRep scoring failed for epoch ${epoch}`, {
              error: String(err),
            });
            // Continue to GHI even if DRep scoring fails
          }
        }

        // ── Phase B: GHI Snapshot ─────────────────────────────────
        if (!skipGhi) {
          try {
            const ghi = await computeGHIForEpoch(epoch);
            ghiScore = ghi.score;

            // Store GHI snapshot
            const { error: ghiError } = await supabase.from('ghi_snapshots').upsert(
              {
                epoch_no: epoch,
                score: ghi.score,
                band: ghi.band,
                components: ghi.components,
                computed_at: new Date().toISOString(),
              },
              { onConflict: 'epoch_no' },
            );

            if (ghiError) {
              logger.error(`[backfill] GHI upsert failed for epoch ${epoch}`, {
                error: ghiError.message,
              });
            }

            // Store EDI / decentralization snapshot
            if (ghi.edi) {
              const { error: ediError } = await supabase.from('decentralization_snapshots').upsert(
                {
                  epoch_no: epoch,
                  composite_score: Math.round(ghi.edi.compositeScore),
                  nakamoto_coefficient: ghi.edi.breakdown.nakamotoCoefficient,
                  gini: ghi.edi.breakdown.gini,
                  shannon_entropy: ghi.edi.breakdown.shannonEntropy,
                  hhi: Math.round(ghi.edi.breakdown.hhi),
                  theil_index: ghi.edi.breakdown.theilIndex,
                  concentration_ratio: ghi.edi.breakdown.concentrationRatio,
                  tau_decentralization: ghi.edi.breakdown.tauDecentralization,
                  snapshot_at: new Date().toISOString(),
                },
                { onConflict: 'epoch_no' },
              );

              if (ediError) {
                logger.error(`[backfill] EDI upsert failed for epoch ${epoch}`, {
                  error: ediError.message,
                });
              }
            }

            logger.info(`[backfill] Epoch ${epoch}: GHI=${ghiScore} (${ghi.band})`);
          } catch (err) {
            logger.error(`[backfill] GHI computation failed for epoch ${epoch}`, {
              error: String(err),
            });
          }
        }

        return { epoch, drepCount, ghiScore };
      });

      results.push(result);
    }

    // Summary
    const totalEpochs = results.length;
    const withGhi = results.filter((r) => r.ghiScore !== null).length;
    const totalDreps = results.reduce((s, r) => s + r.drepCount, 0);

    logger.info(
      `[backfill] Complete: ${totalEpochs} epochs, ${withGhi} with GHI, ${totalDreps} total DRep scores`,
    );

    return {
      totalEpochs,
      epochsWithGhi: withGhi,
      totalDrepScores: totalDreps,
      firstEpoch: startEpoch,
      lastEpoch: endEpoch,
    };
  },
);
