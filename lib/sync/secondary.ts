import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { SyncLogger, batchUpsert, errMsg, emitPostHog } from '@/lib/sync-utils';
import { fetchDRepDelegatorCount } from '@/utils/koios';
import { blockTimeToEpoch } from '@/lib/koios';
import * as Sentry from '@sentry/nextjs';

const BATCH_SIZE = 100;
const DELEGATOR_CONCURRENCY = 20;

/**
 * Core secondary sync logic — callable from both Inngest and the HTTP route.
 * Throws on fatal errors (Inngest retries); returns result on success/degraded.
 */
export async function executeSecondarySync(): Promise<Record<string, unknown>> {
  return Sentry.startSpan({ name: 'sync.secondary', op: 'task' }, async () => {
    const supabase = getSupabaseAdmin();
    const syncLog = new SyncLogger(supabase, 'secondary');
    await syncLog.start();

    const errors: string[] = [];
    let delegatorsUpdated = 0;
    let powerSnapshots = 0;
    let integritySaved = 0;

    try {
      // Step 1: Delegator counts — must complete BEFORE power snapshots
      // so that drep_power_snapshots have fresh Koios delegator counts.
      const step1Result = await Promise.allSettled([
        (async () => {
          const { data: dreps } = await supabase
            .from('dreps')
            .select('id, info')
            .filter('info->>isActive', 'eq', 'true');

          if (!dreps?.length) return 0;

          let updated = 0;
          for (let i = 0; i < dreps.length; i += DELEGATOR_CONCURRENCY) {
            const chunk = dreps.slice(i, i + DELEGATOR_CONCURRENCY);
            const chunkUpdates: Record<string, unknown>[] = [];
            await Promise.allSettled(
              chunk.map(async (drep) => {
                const count = await fetchDRepDelegatorCount(drep.id);
                const existing = (drep.info as Record<string, unknown>) ?? {};
                if (existing.delegatorCount === count) return;
                chunkUpdates.push({
                  id: drep.id,
                  info: { ...existing, delegatorCount: count },
                });
              }),
            );
            if (chunkUpdates.length > 0) {
              const result = await batchUpsert(
                supabase,
                'dreps',
                chunkUpdates,
                'id',
                'DelegatorCounts',
              );
              updated += result.success;
            }
          }
          return updated;
        })(),
      ]);

      if (step1Result[0].status === 'fulfilled') {
        delegatorsUpdated = step1Result[0].value;
      } else {
        errors.push(`Delegators: ${errMsg(step1Result[0].reason)}`);
      }

      // Step 2 + 3: Power snapshots (reads fresh delegator counts) + Integrity — parallel
      const results = await Promise.allSettled([
        // Step 2: Power snapshots (reads fresh delegator counts written by Step 1)
        (async () => {
          const { data: dreps } = await supabase
            .from('dreps')
            .select('id, info')
            .filter('info->>isActive', 'eq', 'true');

          if (!dreps?.length) return 0;

          const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
          const rows = dreps
            .filter((d) => {
              const info = d.info as Record<string, unknown> | null;
              return info?.votingPowerLovelace != null;
            })
            .map((d) => {
              const info = (d.info || {}) as Record<string, unknown>;
              return {
                drep_id: d.id as string,
                epoch_no: currentEpoch,
                amount_lovelace: parseInt(String(info.votingPowerLovelace || '0'), 10),
                delegator_count: (info.delegatorCount as number) || 0,
              };
            });

          if (!rows.length) return 0;

          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const { error: batchErr } = await supabase
              .from('drep_power_snapshots')
              .upsert(batch, { onConflict: 'drep_id,epoch_no' });
            if (batchErr)
              logger.error('[Secondary] power_snapshots batch upsert error', {
                error: batchErr.message,
              });
          }
          return rows.length;
        })(),

        // Step 3: Integrity snapshot
        (async () => {
          const [snapVpc, snapAi, snapHv, snapCs, snapStats] = await Promise.all([
            supabase.from('v_vote_power_coverage').select('*').single(),
            supabase.from('v_ai_summary_coverage').select('*').single(),
            supabase.from('v_hash_verification').select('*').single(),
            supabase.from('v_canonical_summary_coverage').select('*').single(),
            supabase.from('v_system_stats').select('*').single(),
          ]);

          const vpc = snapVpc.data ?? {};
          const ai = snapAi.data ?? {};
          const hv = snapHv.data ?? {};
          const cs = snapCs.data ?? {};
          const stats = snapStats.data ?? {};

          const csTotalProposals = cs.total_proposals ?? 0;
          const csCanonicalPct =
            csTotalProposals > 0 ? ((cs.with_canonical_summary ?? 0) / csTotalProposals) * 100 : 0;
          const aiTotalProposals = ai.total_proposals ?? 0;
          const aiProposalPct =
            aiTotalProposals > 0 ? ((ai.proposals_with_summary ?? 0) / aiTotalProposals) * 100 : 0;
          const aiTotalRationales = ai.rationales_with_text ?? 0;
          const aiRationalePct =
            aiTotalRationales > 0
              ? ((ai.rationales_with_summary ?? 0) / aiTotalRationales) * 100
              : 0;

          const row = {
            snapshot_date: new Date().toISOString().slice(0, 10),
            vote_power_coverage_pct: vpc.coverage_pct ?? 0,
            canonical_summary_pct: Math.round(csCanonicalPct * 100) / 100,
            ai_proposal_pct: Math.round(aiProposalPct * 100) / 100,
            ai_rationale_pct: Math.round(aiRationalePct * 100) / 100,
            hash_mismatch_rate_pct: hv.mismatch_rate_pct ?? 0,
            total_dreps: stats.total_dreps ?? 0,
            total_votes: stats.total_votes ?? 0,
            total_proposals: stats.total_proposals ?? 0,
            total_rationales: stats.total_rationales ?? 0,
            metrics_json: { vpc, ai, hv, cs, stats },
          };

          const { error } = await supabase
            .from('integrity_snapshots')
            .upsert(row, { onConflict: 'snapshot_date' });

          if (error) throw new Error(error.message);
          return 1;
        })(),
      ]);

      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          const label = ['Power snapshots', 'Integrity'][i];
          errors.push(`${label}: ${errMsg(r.reason)}`);
        }
      });

      if (results[0].status === 'fulfilled') powerSnapshots = results[0].value;
      if (results[1].status === 'fulfilled') integritySaved = results[1].value;
    } catch (err) {
      errors.push(`Unhandled: ${errMsg(err)}`);
    }

    const success = errors.length === 0;
    const metrics = {
      delegators_updated: delegatorsUpdated,
      power_snapshots: powerSnapshots,
      integrity_saved: integritySaved,
    };

    await syncLog.finalize(success, errors.length > 0 ? errors.join('; ') : null, metrics);
    await emitPostHog(success, 'secondary', syncLog.elapsed, metrics);

    if (!success) {
      throw new Error(errors.join('; '));
    }

    return {
      success,
      ...metrics,
      durationSeconds: (syncLog.elapsed / 1000).toFixed(1),
      timestamp: new Date().toISOString(),
    };
  });
}
