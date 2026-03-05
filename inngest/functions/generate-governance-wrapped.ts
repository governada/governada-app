import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';

export const generateGovernanceWrapped = inngest.createFunction(
  {
    id: 'generate-governance-wrapped',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"governance-wrapped"' },
  },
  [{ event: 'drepscore/sync.scores' }, { cron: '0 3 * * 0' }],
  async ({ event, step, logger }) => {
    const supabase = getSupabaseAdmin();

    const EPOCH_START_UNIX = 1596491091;
    const EPOCH_LENGTH = 432000;
    const currentEpoch = Math.floor(
      (Math.floor(Date.now() / 1000) - EPOCH_START_UNIX) / EPOCH_LENGTH,
    );
    const periodId = `epoch_${currentEpoch}`;

    const flagCheck = await step.run('check-flag', async () => {
      const { data } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'governance_wrapped')
        .single();
      return data?.enabled ?? false;
    });

    if (!flagCheck) {
      logger.info('[governance-wrapped] Feature flag disabled, skipping');
      return { skipped: true };
    }

    const drepResult = await step.run('generate-drep-wrapped', async () => {
      const { data: dreps } = await supabase
        .from('dreps')
        .select(
          'id, score, participation_rate, delegator_count, rationale_rate, total_votes, rationale_count',
        )
        .not('score', 'is', null)
        .limit(500);

      if (!dreps?.length) return { count: 0 };

      const { data: snapshots } = await supabase
        .from('drep_score_snapshots')
        .select('drep_id, score, epoch_no')
        .in(
          'drep_id',
          dreps.map((d) => d.id),
        )
        .eq('epoch_no', currentEpoch - 1);

      const snapshotMap = new Map(snapshots?.map((s) => [s.drep_id, s.score]) ?? []);

      const records = dreps.map((drep) => {
        const priorScore = snapshotMap.get(drep.id) ?? drep.score;
        return {
          entity_type: 'drep' as const,
          entity_id: drep.id,
          period_type: 'epoch' as const,
          period_id: periodId,
          data: {
            score_start: priorScore,
            score_end: drep.score,
            score_delta: (drep.score ?? 0) - (priorScore ?? 0),
            votes_cast: drep.total_votes ?? 0,
            rationales_written: drep.rationale_count ?? 0,
            rationale_rate: drep.rationale_rate ?? 0,
            delegators_end: drep.delegator_count ?? 0,
            participation_rate: drep.participation_rate ?? 0,
          },
        };
      });

      let upserted = 0;
      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50);
        await supabase
          .from('governance_wrapped')
          .upsert(batch, { onConflict: 'entity_type,entity_id,period_type,period_id' });
        upserted += batch.length;
      }
      return { count: upserted };
    });

    const spoResult = await step.run('generate-spo-wrapped', async () => {
      const { data: pools } = await supabase
        .from('pools')
        .select(
          'pool_id, governance_score, participation_rate, delegator_count, live_stake, vote_count',
        )
        .not('governance_score', 'is', null)
        .limit(1000);

      if (!pools?.length) return { count: 0 };

      const { data: snapshots } = await supabase
        .from('spo_score_snapshots')
        .select('pool_id, governance_score, epoch_no')
        .in(
          'pool_id',
          pools.map((p) => p.pool_id),
        )
        .eq('epoch_no', currentEpoch - 1);

      const snapshotMap = new Map(snapshots?.map((s) => [s.pool_id, s.governance_score]) ?? []);

      const records = pools.map((pool) => {
        const priorScore = snapshotMap.get(pool.pool_id) ?? pool.governance_score;
        return {
          entity_type: 'spo' as const,
          entity_id: pool.pool_id,
          period_type: 'epoch' as const,
          period_id: periodId,
          data: {
            score_start: priorScore,
            score_end: pool.governance_score,
            score_delta: (pool.governance_score ?? 0) - (priorScore ?? 0),
            votes_cast: pool.vote_count ?? 0,
            participation_rate: pool.participation_rate ?? 0,
            delegator_count_end: pool.delegator_count ?? 0,
            live_stake_end: pool.live_stake ?? 0,
          },
        };
      });

      let upserted = 0;
      for (let i = 0; i < records.length; i += 50) {
        await supabase.from('governance_wrapped').upsert(records.slice(i, i + 50), {
          onConflict: 'entity_type,entity_id,period_type,period_id',
        });
        upserted += 50;
      }
      return { count: upserted };
    });

    logger.info('[governance-wrapped] Complete', {
      drepCount: drepResult.count,
      spoCount: spoResult.count,
      periodId,
    });
    return { periodId, drepCount: drepResult.count, spoCount: spoResult.count };
  },
);
