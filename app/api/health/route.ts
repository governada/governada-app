import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

const THRESHOLDS: Record<string, number> = {
  proposals: 90,
  dreps: 720,
  votes: 720,
  secondary: 2880,
  slow: 2880,
  treasury: 2880,
  full: 1560,
  scoring: 720,
  alignment: 720,
  ghi: 2880,
  benchmarks: 11520,
  spo_votes: 720,
  cc_votes: 720,
  epoch_recaps: 8640,
  spo_scores: 2880,
  governance_epoch_stats: 2880,
  data_moat: 2880,
  catalyst: 2880,
  catalyst_proposals: 2880,
  catalyst_funds: 2880,
  delegator_snapshots: 2880,
  drep_lifecycle: 2880,
  epoch_summaries: 2880,
  committee_sync: 2880,
  metadata_archive: 2880,
};

export const GET = withRouteHandler(async () => {
  const supabase = createClient();
  const { data: rows } = await supabase.from('v_sync_health').select('*');

  if (!rows?.length) {
    return NextResponse.json({ status: 'unknown', message: 'No sync data', syncs: [] });
  }

  const now = Date.now();
  let worstLevel: 'healthy' | 'degraded' | 'critical' = 'healthy';

  const syncs = rows.map((row) => {
    const staleMins = row.last_run
      ? Math.round((now - new Date(row.last_run).getTime()) / 60000)
      : Infinity;
    const threshold = THRESHOLDS[row.sync_type] ?? 1560;
    const failed = row.last_success === false;
    const stale = staleMins > threshold;

    let level: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (failed) level = 'critical';
    else if (stale) level = staleMins > threshold * 2 ? 'critical' : 'degraded';

    if (level === 'critical') worstLevel = 'critical';
    else if (level === 'degraded' && worstLevel !== 'critical') worstLevel = 'degraded';

    return {
      type: row.sync_type,
      level,
      last_run: row.last_run,
      stale_mins: staleMins === Infinity ? null : staleMins,
      last_success: row.last_success,
      success_count: row.success_count,
      failure_count: row.failure_count,
    };
  });

  let snapshotHealth: Record<string, unknown> | null = null;
  try {
    const { data: statsRow } = await supabase
      .from('governance_stats')
      .select('current_epoch')
      .eq('id', 1)
      .single();
    const epoch = statsRow?.current_epoch ?? 0;

    if (epoch > 0) {
      const snapshotTables = [
        { name: 'drep_score_history', col: 'snapshot_date', isDate: true },
        { name: 'ghi_snapshots', col: 'epoch_no' },
        { name: 'decentralization_snapshots', col: 'epoch_no' },
        { name: 'treasury_snapshots', col: 'epoch_no' },
        { name: 'treasury_health_snapshots', col: 'epoch' },
        { name: 'inter_body_alignment_snapshots', col: 'epoch' },
        { name: 'governance_participation_snapshots', col: 'epoch' },
        { name: 'drep_power_snapshots', col: 'epoch_no' },
        { name: 'delegation_snapshots', col: 'epoch' },
        { name: 'alignment_snapshots', col: 'epoch' },
        { name: 'spo_score_snapshots', col: 'epoch_no' },
        { name: 'spo_alignment_snapshots', col: 'epoch_no' },
        { name: 'governance_epoch_stats', col: 'epoch_no' },
        { name: 'epoch_governance_summaries', col: 'epoch_no' },
        { name: 'drep_delegator_snapshots', col: 'epoch_no' },
      ];

      const snapshotChecks = await Promise.all(
        snapshotTables.map(
          async ({ name, col, isDate }: { name: string; col: string; isDate?: boolean }) => {
            const { data: latest } = await supabase
              .from(name)
              .select(col)
              .order(col, { ascending: false })
              .limit(1)
              .maybeSingle();

            if (isDate) {
              const latestDate = latest
                ? ((latest as unknown as Record<string, string>)[col] ?? null)
                : null;
              const today = new Date().toISOString().slice(0, 10);
              const dayGap = latestDate
                ? Math.round(
                    (new Date(today).getTime() - new Date(latestDate).getTime()) / 86_400_000,
                  )
                : null;
              return {
                table: name,
                latest_value: latestDate,
                expected: today,
                gap: dayGap,
                level:
                  dayGap === null
                    ? 'unknown'
                    : dayGap <= 1
                      ? 'healthy'
                      : dayGap <= 3
                        ? 'degraded'
                        : 'critical',
              };
            }

            const latestEpoch = latest
              ? ((latest as unknown as Record<string, number>)[col] ?? null)
              : null;
            const gap = latestEpoch != null ? epoch - latestEpoch : null;
            return {
              table: name,
              latest_value: latestEpoch,
              expected: epoch,
              gap,
              level:
                gap === null
                  ? 'unknown'
                  : gap <= 1
                    ? 'healthy'
                    : gap <= 3
                      ? 'degraded'
                      : 'critical',
            };
          },
        ),
      );

      snapshotHealth = { epoch, checks: snapshotChecks };
    }
  } catch {
    // snapshot health is best-effort
  }

  return NextResponse.json({ status: worstLevel, syncs, snapshots: snapshotHealth });
});
