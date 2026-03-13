/**
 * Snapshot Citizen Rings — stores epoch-level ring values for all active citizens.
 *
 * Triggered daily via cron. Computes ring values from existing data
 * (DRep scores + citizen impact scores) and upserts into citizen_ring_snapshots.
 *
 * This enables the Governance Pulse history chart (2D) showing trajectory over time.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';

export const snapshotCitizenRings = inngest.createFunction(
  {
    id: 'snapshot-citizen-rings',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"citizen-ring-snapshots"' },
  },
  { cron: '30 4 * * *' }, // Daily at 04:30 UTC
  async ({ step, logger }) => {
    const supabase = getSupabaseAdmin();

    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    // Step 1: Get all users who have impact scores (active citizens)
    const citizens = await step.run('fetch-active-citizens', async () => {
      const { data, error } = await supabase
        .from('citizen_impact_scores')
        .select('user_id, coverage_score, engagement_depth_score');

      if (error) throw error;
      return data ?? [];
    });

    if (citizens.length === 0) {
      logger.info('[citizen-ring-snapshots] No active citizens found');
      return { snapshotted: 0, epoch: currentEpoch };
    }

    // Step 2: Get DRep scores for citizens' delegated DReps
    const snapshots = await step.run('compute-ring-snapshots', async () => {
      // Get delegation info for all citizens
      const userIds = citizens.map((c) => c.user_id);
      const { data: wallets } = await supabase
        .from('user_wallets')
        .select('user_id, vote_delegation')
        .in('user_id', userIds)
        .not('vote_delegation', 'is', null);

      // Map user_id → delegated DRep ID
      const userDrepMap = new Map<string, string>();
      for (const w of wallets ?? []) {
        if (w.vote_delegation) userDrepMap.set(w.user_id, w.vote_delegation);
      }

      // Get all unique DRep IDs and their scores
      const drepIds = [...new Set(userDrepMap.values())];
      const drepScoreMap = new Map<string, number>();

      if (drepIds.length > 0) {
        const { data: dreps } = await supabase
          .from('dreps')
          .select('drep_id, score')
          .in('drep_id', drepIds);

        for (const d of dreps ?? []) {
          if (d.score != null) drepScoreMap.set(d.drep_id, d.score);
        }
      }

      // Compute ring values for each citizen
      const rows: Array<{
        user_id: string;
        epoch: number;
        delegation_ring: number;
        coverage_ring: number;
        engagement_ring: number;
        pulse: number;
      }> = [];

      for (const citizen of citizens) {
        const drepId = userDrepMap.get(citizen.user_id);
        const drepScore = drepId ? (drepScoreMap.get(drepId) ?? 0) : 0;

        // Same normalization as lib/governanceRings.ts
        const delegation = Math.min(Math.max(drepScore / 100, 0), 1);
        const coverage = Math.min((citizen.coverage_score ?? 0) / 25, 1);
        const engagement = Math.min((citizen.engagement_depth_score ?? 0) / 25, 1);

        const pulse = Math.round((delegation * 0.4 + coverage * 0.35 + engagement * 0.25) * 100);

        rows.push({
          user_id: citizen.user_id,
          epoch: currentEpoch,
          delegation_ring: Number(delegation.toFixed(3)),
          coverage_ring: Number(coverage.toFixed(3)),
          engagement_ring: Number(engagement.toFixed(3)),
          pulse,
        });
      }

      return rows;
    });

    // Step 3: Upsert snapshots in batches
    const result = await step.run('upsert-snapshots', async () => {
      const BATCH_SIZE = 500;
      let upserted = 0;

      for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
        const batch = snapshots.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('citizen_ring_snapshots')
          .upsert(batch, { onConflict: 'user_id,epoch' });

        if (error) {
          logger.error('[citizen-ring-snapshots] Batch upsert error', { error, batch: i });
          throw error;
        }
        upserted += batch.length;
      }

      return upserted;
    });

    logger.info(
      `[citizen-ring-snapshots] Snapshotted ${result} citizens for epoch ${currentEpoch}`,
    );
    return { snapshotted: result, epoch: currentEpoch };
  },
);
