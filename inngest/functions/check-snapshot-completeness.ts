/**
 * Snapshot Completeness Check — daily backstop.
 * Runs at 06:00 UTC (after GHI at 04:30 and slow sync at 04:00).
 * Verifies every snapshot type has coverage for the current epoch/day.
 * Alerts Discord + PostHog on any gaps.
 */

import { inngest } from '@/lib/inngest';
import { captureServerEvent } from '@/lib/posthog-server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { alertCritical, alertDiscord, emitPostHog, type SyncType } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

/**
 * Maps snapshot table names to the Inngest event that populates them.
 * Only includes tables that CAN be retriggered — epoch-transition tables
 * (governance_participation_snapshots, epoch_recaps, governance_epoch_stats)
 * are excluded since they're written on epoch boundaries, not on demand.
 */
const SNAPSHOT_HEAL_MAP: Record<string, string> = {
  drep_score_history: 'drepscore/sync.scores',
  ghi_snapshots: 'drepscore/sync.ghi',
  decentralization_snapshots: 'drepscore/sync.ghi',
  alignment_snapshots: 'drepscore/sync.alignment',
  drep_power_snapshots: 'drepscore/sync.dreps',
  treasury_snapshots: 'drepscore/sync.treasury',
  treasury_health_snapshots: 'drepscore/sync.treasury',
  delegation_snapshots: 'drepscore/sync.dreps',
  spo_score_snapshots: 'drepscore/sync.spo-scores',
  spo_alignment_snapshots: 'drepscore/sync.spo-cc-votes',
  inter_body_alignment_snapshots: 'drepscore/sync.spo-cc-votes',
  epoch_governance_summaries: 'drepscore/sync.data-moat',
  drep_delegator_snapshots: 'drepscore/sync.data-moat',
  committee_members: 'drepscore/sync.data-moat',
  cc_fidelity_snapshots: 'drepscore/sync.cc-rationales',
  proposal_classifications: 'drepscore/sync.alignment',
};

export const checkSnapshotCompleteness = inngest.createFunction(
  {
    id: 'check-snapshot-completeness',
    name: 'Snapshot Completeness Check',
    retries: 2,
    triggers: { cron: '0 6 * * *' },
  },
  async ({ step }) => {
    const checkInId = cronCheckIn('check-snapshot-completeness', '0 6 * * *');
    try {
      const checks = await step.run('run-completeness-checks', async () => {
        const supabase = getSupabaseAdmin();
        const today = new Date().toISOString().slice(0, 10);
        const results: CheckResult[] = [];

        const { data: statsRow } = await supabase
          .from('governance_stats')
          .select('current_epoch')
          .eq('id', 1)
          .single();
        const epoch = statsRow?.current_epoch ?? 0;
        // Epoch-transition snapshots (participation, recaps, epoch_stats) are written
        // for the *previous* epoch when the new epoch is detected. So we check epoch-1
        // for those tables, since the current epoch's data won't exist until next transition.
        const prevEpoch = epoch > 0 ? epoch - 1 : 0;

        if (epoch === 0) {
          return [{ name: 'epoch', passed: false, detail: 'Could not determine current epoch' }];
        }

        const { count: activeDrepCount } = await supabase
          .from('dreps')
          .select('id', { count: 'exact', head: true });
        const expectedDreps = activeDrepCount ?? 0;

        // 1. Score history for today
        const { count: scoreCount } = await supabase
          .from('drep_score_history')
          .select('drep_id', { count: 'exact', head: true })
          .eq('snapshot_date', today);
        const scoreCoverage = expectedDreps > 0 ? ((scoreCount ?? 0) / expectedDreps) * 100 : 0;
        results.push({
          name: 'drep_score_history',
          passed: scoreCoverage >= 90,
          detail: `${scoreCount ?? 0}/${expectedDreps} DReps (${scoreCoverage.toFixed(1)}%)`,
        });

        // 2. GHI snapshot for current epoch
        const { data: ghiRow } = await supabase
          .from('ghi_snapshots')
          .select('epoch_no')
          .eq('epoch_no', epoch)
          .maybeSingle();
        results.push({
          name: 'ghi_snapshots',
          passed: !!ghiRow,
          detail: ghiRow ? `epoch ${epoch} present` : `epoch ${epoch} MISSING`,
        });

        // 3. Decentralization snapshot for current epoch
        const { data: ediRow } = await supabase
          .from('decentralization_snapshots')
          .select('epoch_no')
          .eq('epoch_no', epoch)
          .maybeSingle();
        results.push({
          name: 'decentralization_snapshots',
          passed: !!ediRow,
          detail: ediRow ? `epoch ${epoch} present` : `epoch ${epoch} MISSING`,
        });

        // 4. Alignment snapshots for current epoch
        const { count: alignCount } = await supabase
          .from('alignment_snapshots')
          .select('drep_id', { count: 'exact', head: true })
          .eq('epoch', epoch);
        const alignCoverage = expectedDreps > 0 ? ((alignCount ?? 0) / expectedDreps) * 100 : 0;
        results.push({
          name: 'alignment_snapshots',
          passed: alignCoverage >= 80,
          detail: `${alignCount ?? 0}/${expectedDreps} DReps (${alignCoverage.toFixed(1)}%)`,
        });

        // 5. Power snapshots for current epoch
        const { count: powerCount } = await supabase
          .from('drep_power_snapshots')
          .select('drep_id', { count: 'exact', head: true })
          .eq('epoch_no', epoch);
        const powerCoverage = expectedDreps > 0 ? ((powerCount ?? 0) / expectedDreps) * 100 : 0;
        results.push({
          name: 'drep_power_snapshots',
          passed: powerCoverage >= 80,
          detail: `${powerCount ?? 0}/${expectedDreps} DReps (${powerCoverage.toFixed(1)}%)`,
        });

        // 6. Treasury snapshot for current epoch
        const { data: treasuryRow } = await supabase
          .from('treasury_snapshots')
          .select('epoch_no')
          .eq('epoch_no', epoch)
          .maybeSingle();
        results.push({
          name: 'treasury_snapshots',
          passed: !!treasuryRow,
          detail: treasuryRow ? `epoch ${epoch} present` : `epoch ${epoch} MISSING`,
        });

        // 7. Treasury health snapshot for current epoch
        const { data: healthRow } = await supabase
          .from('treasury_health_snapshots')
          .select('epoch')
          .eq('epoch', epoch)
          .maybeSingle();
        results.push({
          name: 'treasury_health_snapshots',
          passed: !!healthRow,
          detail: healthRow ? `epoch ${epoch} present` : `epoch ${epoch} MISSING`,
        });

        // 8. Inter-body alignment snapshots for current epoch
        const { count: alignSnapCount } = await supabase
          .from('inter_body_alignment_snapshots')
          .select('proposal_tx_hash', { count: 'exact', head: true })
          .eq('epoch', epoch);
        const { count: alignCacheCount } = await supabase
          .from('inter_body_alignment')
          .select('proposal_tx_hash', { count: 'exact', head: true });
        const alignSnapCoverage =
          (alignCacheCount ?? 0) > 0
            ? ((alignSnapCount ?? 0) / (alignCacheCount ?? 1)) * 100
            : (alignSnapCount ?? 0) > 0
              ? 100
              : 0;
        results.push({
          name: 'inter_body_alignment_snapshots',
          passed: alignSnapCoverage >= 80 || (alignCacheCount ?? 0) === 0,
          detail: `${alignSnapCount ?? 0}/${alignCacheCount ?? 0} proposals (${alignSnapCoverage.toFixed(1)}%)`,
        });

        // 9. Proposal vote snapshots for current epoch
        const { count: voteSnapCount } = await supabase
          .from('proposal_vote_snapshots')
          .select('proposal_tx_hash', { count: 'exact', head: true })
          .eq('epoch', epoch);
        const { data: openProposalCount } = await supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .is('ratified_epoch', null)
          .is('enacted_epoch', null)
          .is('dropped_epoch', null)
          .is('expired_epoch', null);
        const openCount = (openProposalCount as unknown as number) ?? 0;
        results.push({
          name: 'proposal_vote_snapshots',
          passed: (voteSnapCount ?? 0) > 0 || openCount === 0,
          detail: `${voteSnapCount ?? 0} proposals snapshotted for epoch ${epoch}`,
        });

        // 10. Delegation snapshots for current epoch
        const { count: delegSnapCount } = await supabase
          .from('delegation_snapshots')
          .select('drep_id', { count: 'exact', head: true })
          .eq('epoch', epoch);
        const delegCoverage = expectedDreps > 0 ? ((delegSnapCount ?? 0) / expectedDreps) * 100 : 0;
        results.push({
          name: 'delegation_snapshots',
          passed: delegCoverage >= 80,
          detail: `${delegSnapCount ?? 0}/${expectedDreps} DReps (${delegCoverage.toFixed(1)}%)`,
        });

        // 11. Governance participation snapshots — written during epoch transition for prevEpoch
        const { data: partRow } = await supabase
          .from('governance_participation_snapshots')
          .select('epoch')
          .eq('epoch', prevEpoch)
          .maybeSingle();
        results.push({
          name: 'governance_participation_snapshots',
          passed: !!partRow,
          detail: partRow ? `epoch ${prevEpoch} present` : `epoch ${prevEpoch} MISSING`,
        });

        // 12. Proposal classifications — not epoch-scoped; verify coverage vs active proposals
        const { count: activeProposalCount } = await supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true });
        const { count: classifiedCount } = await supabase
          .from('proposal_classifications')
          .select('proposal_tx_hash', { count: 'exact', head: true });
        const classifiedTotal = classifiedCount ?? 0;
        const activeTotal = activeProposalCount ?? 0;
        const classifyCoverage = activeTotal > 0 ? (classifiedTotal / activeTotal) * 100 : 0;
        results.push({
          name: 'proposal_classifications',
          passed: classifyCoverage >= 50 || activeTotal === 0,
          detail: `${classifiedTotal}/${activeTotal} proposals classified (${classifyCoverage.toFixed(1)}%)`,
        });

        // 13. Epoch recaps — written during epoch transition for prevEpoch
        const { data: recapRow } = await supabase
          .from('epoch_recaps')
          .select('epoch')
          .eq('epoch', prevEpoch)
          .maybeSingle();
        results.push({
          name: 'epoch_recaps',
          passed: !!recapRow,
          detail: recapRow ? `epoch ${prevEpoch} present` : `epoch ${prevEpoch} MISSING`,
        });

        // 14. SPO score snapshots for current epoch (column is epoch_no, not epoch)
        const { count: spoScoreCount } = await supabase
          .from('spo_score_snapshots')
          .select('pool_id', { count: 'exact', head: true })
          .eq('epoch_no', epoch);
        results.push({
          name: 'spo_score_snapshots',
          passed: (spoScoreCount ?? 0) > 0,
          detail: `${spoScoreCount ?? 0} pools for epoch ${epoch}`,
        });

        // 15. SPO alignment snapshots for current epoch (column is epoch_no, not epoch)
        const { count: spoAlignCount } = await supabase
          .from('spo_alignment_snapshots')
          .select('pool_id', { count: 'exact', head: true })
          .eq('epoch_no', epoch);
        results.push({
          name: 'spo_alignment_snapshots',
          passed: (spoAlignCount ?? 0) > 0,
          detail: `${spoAlignCount ?? 0} pools for epoch ${epoch}`,
        });

        // 16. Governance epoch stats — written during epoch transition for prevEpoch
        const { data: govStatsRow } = await supabase
          .from('governance_epoch_stats')
          .select('epoch_no')
          .eq('epoch_no', prevEpoch)
          .maybeSingle();
        results.push({
          name: 'governance_epoch_stats',
          passed: !!govStatsRow,
          detail: govStatsRow ? `epoch ${prevEpoch} present` : `epoch ${prevEpoch} MISSING`,
        });

        // 17. Epoch governance summaries (data moat) for current epoch
        const { data: epochSummaryRow } = await supabase
          .from('epoch_governance_summaries')
          .select('epoch_no')
          .eq('epoch_no', epoch)
          .maybeSingle();
        results.push({
          name: 'epoch_governance_summaries',
          passed: !!epochSummaryRow,
          detail: epochSummaryRow ? `epoch ${epoch} present` : `epoch ${epoch} MISSING`,
        });

        // 18. Delegator snapshots (data moat) for current epoch
        const { count: delegatorSnapCount } = await supabase
          .from('drep_delegator_snapshots')
          .select('drep_id', { count: 'exact', head: true })
          .eq('epoch_no', epoch);
        const delegatorSnapCoverage =
          expectedDreps > 0 ? ((delegatorSnapCount ?? 0) / expectedDreps) * 100 : 0;
        results.push({
          name: 'drep_delegator_snapshots',
          passed: delegatorSnapCoverage >= 50,
          detail: `${delegatorSnapCount ?? 0}/${expectedDreps} DReps (${delegatorSnapCoverage.toFixed(1)}%)`,
        });

        // 19. Committee members (data moat) — not epoch-scoped; verify presence
        const { count: ccMemberCount } = await supabase
          .from('committee_members')
          .select('cc_hot_id', { count: 'exact', head: true });
        results.push({
          name: 'committee_members',
          passed: (ccMemberCount ?? 0) > 0,
          detail: `${ccMemberCount ?? 0} members tracked`,
        });

        // 20. CC Fidelity snapshots for current epoch
        const { count: ccTransCount } = await supabase
          .from('cc_fidelity_snapshots')
          .select('cc_hot_id', { count: 'exact', head: true })
          .eq('epoch_no', epoch);
        const ccTransExpected = ccMemberCount ?? 0;
        const ccTransCoverage =
          ccTransExpected > 0
            ? ((ccTransCount ?? 0) / ccTransExpected) * 100
            : (ccTransCount ?? 0) > 0
              ? 100
              : 0;
        results.push({
          name: 'cc_fidelity_snapshots',
          passed: ccTransCoverage >= 50 || ccTransExpected === 0,
          detail: `${ccTransCount ?? 0}/${ccTransExpected} members (${ccTransCoverage.toFixed(1)}%)`,
        });
        return results;
      });

      const failures = checks.filter((c) => !c.passed);

      if (failures.length > 0) {
        await step.run('alert-failures', async () => {
          const failureList = failures.map((f) => `- **${f.name}**: ${f.detail}`).join('\n');

          await alertCritical(
            'Snapshot Completeness Failed',
            `${failures.length} of ${checks.length} checks failed:\n${failureList}`,
          );

          for (const f of failures) {
            captureServerEvent('snapshot_missing', {
              table: f.name,
              detail: f.detail,
            });
          }

          await emitPostHog(false, 'scoring' as SyncType, 0, {
            event_override: 'snapshot_completeness_failed',
            failures: failures.map((f) => ({ name: f.name, detail: f.detail })),
            total_checks: checks.length,
          });
        });

        // Self-heal: retrigger the sync that populates each failed snapshot table.
        // Deduplicate events so we don't fire the same sync multiple times.
        const eventsToSend = new Set<string>();
        for (const f of failures) {
          const event = SNAPSHOT_HEAL_MAP[f.name];
          if (event) eventsToSend.add(event);
        }

        if (eventsToSend.size > 0) {
          await step.run('self-heal-snapshots', async () => {
            const supabase = getSupabaseAdmin();
            const healedNames: string[] = [];
            const skippedNames: string[] = [];
            const eventsToFire: string[] = [];

            for (const event of eventsToSend) {
              // Extract sync type from event name (e.g., 'drepscore/sync.treasury' -> 'treasury')
              const syncType = event.split('.').pop() ?? '';

              // Throttle: skip if 3+ failures in last 2 hours
              const { count: recentFailCount } = await supabase
                .from('sync_log')
                .select('id', { count: 'exact', head: true })
                .eq('sync_type', syncType)
                .eq('success', false)
                .gte('started_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

              if ((recentFailCount ?? 0) >= 3) {
                skippedNames.push(syncType);
                continue;
              }

              eventsToFire.push(event);
              healedNames.push(
                ...failures.filter((f) => SNAPSHOT_HEAL_MAP[f.name] === event).map((f) => f.name),
              );
            }

            if (eventsToFire.length > 0) {
              await inngest.send(eventsToFire.map((name) => ({ name })));
            }

            logger.info('[snapshot-completeness] Self-healing triggered', {
              healed: healedNames,
              skipped: skippedNames,
            });

            if (healedNames.length > 0) {
              await alertDiscord(
                'Snapshot Self-Heal Triggered',
                `Retriggered ${eventsToFire.length} sync(s) for ${healedNames.length} missing snapshots: ${healedNames.join(', ')}${skippedNames.length > 0 ? `. Throttled: ${skippedNames.join(', ')}` : ''}`,
              );
            }

            if (skippedNames.length > 0) {
              await alertCritical(
                'Snapshot Self-Heal Throttled',
                `${skippedNames.join(', ')} have 3+ failures in 2h — not retriggering. Manual investigation needed.`,
              );
            }
          });
        }
      }

      logger.info('[snapshot-completeness] Check complete', {
        passed: checks.length - failures.length,
        total: checks.length,
      });
      cronCheckOut('check-snapshot-completeness', checkInId, failures.length === 0);
      return {
        total: checks.length,
        passed: checks.length - failures.length,
        failed: failures.length,
        checks,
      };
    } catch (error) {
      cronCheckOut('check-snapshot-completeness', checkInId, false);
      throw error;
    }
  },
);
