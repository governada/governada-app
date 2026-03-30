/**
 * Inngest Function: snapshot-ghi
 *
 * Runs daily at 04:30 UTC (after sync-slow finishes at ~04:00).
 * Computes GHI and stores an epoch-level snapshot for trend tracking.
 * Also snapshots EDI decentralization metrics.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { computeGHI } from '@/lib/ghi';
import { blockTimeToEpoch } from '@/lib/koios';
import { SyncLogger, errMsg, capMsg } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';

export const snapshotGhi = inngest.createFunction(
  {
    id: 'snapshot-ghi',
    name: 'Snapshot GHI',
    retries: 3,
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[ghi] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'ghi')
        .is('finished_at', null);
    },
    triggers: [{ cron: '30 4 * * *' }, { event: 'drepscore/sync.ghi' }],
  },
  async ({ step }) => {
    const result = await step.run('compute-ghi', async () => {
      return computeGHI();
    });

    const epoch = await step.run('get-current-epoch', async () => {
      return blockTimeToEpoch(Math.floor(Date.now() / 1000));
    });

    await step.run('store-ghi-snapshot', async () => {
      const supabase = getSupabaseAdmin();
      const syncLog = new SyncLogger(supabase, 'ghi');
      await syncLog.start();

      try {
        const { error: ghiError } = await supabase.from('ghi_snapshots').upsert(
          {
            epoch_no: epoch,
            score: result.score,
            band: result.band,
            components: result.components,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'epoch_no' },
        );
        if (ghiError) {
          logger.error('[snapshot-ghi] Failed to upsert ghi_snapshots', {
            error: ghiError.message,
            epoch,
          });
          throw new Error(`ghi_snapshots upsert failed: ${ghiError.message}`);
        }

        const { error: compError } = await supabase.from('snapshot_completeness_log').upsert(
          {
            snapshot_type: 'ghi',
            epoch_no: epoch,
            snapshot_date: new Date().toISOString().slice(0, 10),
            record_count: 1,
            expected_count: 1,
            coverage_pct: 100,
            metadata: { score: result.score, band: result.band },
          },
          { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
        );
        if (compError) {
          logger.error('[snapshot-ghi] Failed to upsert completeness log', {
            error: compError.message,
            epoch,
          });
        }

        await syncLog.finalize(true, null, { epoch, score: result.score, band: result.band });
      } catch (err) {
        await syncLog.finalize(false, errMsg(err), { epoch });
        throw err;
      }
    });

    if (result.edi) {
      await step.run('store-decentralization-snapshot', async () => {
        const supabase = getSupabaseAdmin();
        const { breakdown } = result.edi!;

        const { error: ediError } = await supabase.from('decentralization_snapshots').upsert(
          {
            epoch_no: epoch,
            composite_score: result.edi!.compositeScore,
            nakamoto_coefficient: breakdown.nakamotoCoefficient,
            gini: breakdown.gini,
            shannon_entropy: breakdown.shannonEntropy,
            hhi: breakdown.hhi,
            theil_index: breakdown.theilIndex,
            concentration_ratio: breakdown.concentrationRatio,
            tau_decentralization: breakdown.tauDecentralization,
            active_drep_count: result.meta?.activeDrepCount ?? null,
          },
          { onConflict: 'epoch_no' },
        );
        if (ediError) {
          logger.error('[snapshot-ghi] Failed to upsert decentralization_snapshots', {
            error: ediError.message,
            epoch,
          });
        }

        const { error: ediCompError } = await supabase.from('snapshot_completeness_log').upsert(
          {
            snapshot_type: 'edi',
            epoch_no: epoch,
            snapshot_date: new Date().toISOString().slice(0, 10),
            record_count: 1,
            expected_count: 1,
            coverage_pct: 100,
            metadata: { composite_score: result.edi!.compositeScore },
          },
          { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
        );
        if (ediCompError) {
          logger.error('[snapshot-ghi] Failed to upsert EDI completeness log', {
            error: ediCompError.message,
            epoch,
          });
        }
      });
    }

    logger.info('[snapshot-ghi] Stored GHI snapshot', {
      epoch,
      score: result.score,
      band: result.band,
    });
    return { epoch, score: result.score, band: result.band, edi: !!result.edi };
  },
);
