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

export const snapshotGhi = inngest.createFunction(
  {
    id: 'snapshot-ghi',
    name: 'Snapshot GHI',
    retries: 2,
  },
  { cron: '30 4 * * *' },
  async ({ step }) => {
    const result = await step.run('compute-ghi', async () => {
      return computeGHI();
    });

    const epoch = await step.run('get-current-epoch', async () => {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();
      return data?.current_epoch ?? 0;
    });

    if (epoch === 0) {
      console.warn('[snapshot-ghi] Could not determine current epoch, skipping');
      return { skipped: true };
    }

    await step.run('store-ghi-snapshot', async () => {
      const supabase = getSupabaseAdmin();
      await supabase.from('ghi_snapshots').upsert(
        {
          epoch_no: epoch,
          score: result.score,
          band: result.band,
          components: result.components,
        },
        { onConflict: 'epoch_no' },
      );
    });

    // Store decentralization snapshot if EDI was computed
    if (result.edi) {
      await step.run('store-decentralization-snapshot', async () => {
        const supabase = getSupabaseAdmin();
        const { breakdown } = result.edi!;

        await supabase.from('decentralization_snapshots').upsert(
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
      });
    }

    console.log(
      `[snapshot-ghi] Stored GHI snapshot for epoch ${epoch}: ${result.score} (${result.band})`,
    );
    return { epoch, score: result.score, band: result.band, edi: !!result.edi };
  },
);
