import { NextResponse } from 'next/server';
import { getOpsEnvReport } from '@/lib/env';
import { getRuntimeRelease } from '@/lib/runtimeMetadata';
import { createClient, probeSupabaseReadClient } from '@/lib/supabase';
import { getSyncHealthLevel, getSyncPolicy, mergeSyncHealthLevel } from '@/lib/syncPolicy';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

const SNAPSHOT_PROBE_TIMEOUT_MS = 2_500;

type SyncHealthRow = {
  sync_type: string;
  last_run: string | null;
  last_success: boolean | null;
  success_count: number | null;
  failure_count: number | null;
};

type SyncHealthQueryResult = {
  data: SyncHealthRow[] | null;
  error: { message: string } | null;
};

type SnapshotProbeResult = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

type HealthResponseStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

function healthJson<T extends { status: HealthResponseStatus }>(body: T): NextResponse<T> {
  return NextResponse.json(body, { status: body.status === 'critical' ? 503 : 200 });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

async function withProbeTimeout<T>(operation: PromiseLike<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${SNAPSHOT_PROBE_TIMEOUT_MS}ms`)),
      SNAPSHOT_PROBE_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const GET = withRouteHandler(async () => {
  const operations = getOpsEnvReport();
  const readClient = await probeSupabaseReadClient();

  if (readClient.status !== 'healthy') {
    return healthJson({
      status: 'critical',
      message: 'Supabase read client is unavailable',
      reason: readClient.reason,
      syncs: [],
      snapshots: null,
      operations,
      read_client: readClient,
      release: getRuntimeRelease(),
    });
  }

  const supabase = createClient();
  let syncHealthResult: SyncHealthQueryResult;

  try {
    syncHealthResult = (await supabase.from('v_sync_health').select('*')) as SyncHealthQueryResult;
  } catch (error) {
    return healthJson({
      status: 'critical',
      message: 'Sync health query failed',
      reason: 'sync_health_query_exception',
      error: getErrorMessage(error),
      syncs: [],
      snapshots: null,
      operations,
      read_client: readClient,
      release: getRuntimeRelease(),
    });
  }

  const { data: rows, error: syncHealthError } = syncHealthResult;

  if (syncHealthError) {
    return healthJson({
      status: 'critical',
      message: 'Sync health query failed',
      reason: 'sync_health_query_error',
      error: syncHealthError.message,
      syncs: [],
      snapshots: null,
      operations,
      read_client: readClient,
      release: getRuntimeRelease(),
    });
  }

  if (!rows?.length) {
    return healthJson({
      status: operations.status === 'healthy' ? 'unknown' : 'degraded',
      reason: 'no_sync_data',
      message: 'No sync data',
      syncs: [],
      operations,
      read_client: readClient,
      release: getRuntimeRelease(),
    });
  }

  const now = Date.now();
  let worstLevel: 'healthy' | 'degraded' | 'critical' = operations.status;

  const syncs = rows.map((row) => {
    const staleMins = row.last_run
      ? Math.round((now - new Date(row.last_run).getTime()) / 60000)
      : Infinity;
    const policy = getSyncPolicy(row.sync_type);
    const level = getSyncHealthLevel(row.sync_type, staleMins, row.last_success as boolean | null);
    const overallLevel = policy.core ? level : level === 'critical' ? 'degraded' : level;
    worstLevel = mergeSyncHealthLevel(worstLevel, overallLevel);

    return {
      type: row.sync_type,
      label: policy.label,
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
            const query = supabase
              .from(name)
              .select(col)
              .order(col, { ascending: false })
              .limit(1)
              .maybeSingle() as PromiseLike<SnapshotProbeResult>;

            const { data: latest, error } = await withProbeTimeout(query, `snapshot ${name}`);

            if (error) {
              throw new Error(`${name}: ${error.message}`);
            }

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

      const snapshotLevel = snapshotChecks.reduce<'healthy' | 'degraded' | 'critical'>(
        (current, check) => {
          if (check.level === 'critical') return 'critical';
          if (check.level === 'degraded' && current !== 'critical') return 'degraded';
          return current;
        },
        'healthy',
      );

      snapshotHealth = { status: snapshotLevel, epoch, checks: snapshotChecks };
      worstLevel = mergeSyncHealthLevel(worstLevel, snapshotLevel);
    }
  } catch (error) {
    snapshotHealth = {
      status: 'unavailable',
      error: 'snapshot health check failed',
      reason: getErrorMessage(error),
    };
    worstLevel = mergeSyncHealthLevel(worstLevel, 'degraded');
  }

  return healthJson({
    status: worstLevel,
    syncs,
    snapshots: snapshotHealth,
    operations,
    read_client: readClient,
    release: getRuntimeRelease(),
  });
});
