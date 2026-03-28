import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { requireAuth } from '@/lib/supabaseAuth';
import { isAdminWallet } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  // Allow cron jobs via CRON_SECRET bearer token
  const authHeader = request.headers.get('authorization');
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    // Require authenticated admin session
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!isAdminWallet(auth.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const supabase = createClient();

  const [votePower, aiSummary, hashVerify, metaVerify, canonicalSummary, syncHealth, systemStats] =
    await Promise.all([
      supabase.from('v_vote_power_coverage').select('*').single(),
      supabase.from('v_ai_summary_coverage').select('*').single(),
      supabase.from('v_hash_verification').select('*').single(),
      supabase.from('v_metadata_verification').select('*').single(),
      supabase.from('v_canonical_summary_coverage').select('*').single(),
      supabase.from('v_sync_health').select('*'),
      supabase.from('v_system_stats').select('*').single(),
    ]);

  // Recent sync history (last 20)
  const { data: syncHistory } = await supabase
    .from('sync_log')
    .select('id, sync_type, started_at, finished_at, duration_ms, success, error_message')
    .order('started_at', { ascending: false })
    .limit(20);

  // Previous day snapshot for KPI deltas
  const today = new Date().toISOString().split('T')[0];
  const { data: recentSnapshots } = await supabase
    .from('integrity_snapshots')
    .select('*')
    .lt('snapshot_date', today)
    .order('snapshot_date', { ascending: false })
    .limit(1);

  const now = new Date();
  const syncHealthMap: Record<string, unknown> = {};
  for (const row of syncHealth.data || []) {
    const lastRun = row.last_run ? new Date(row.last_run) : null;
    const staleMins = lastRun ? Math.round((now.getTime() - lastRun.getTime()) / 60000) : null;
    syncHealthMap[row.sync_type] = { ...row, stale_minutes: staleMins };
  }

  const alerts: {
    level: 'critical' | 'warning';
    metric: string;
    value: string;
    threshold: string;
  }[] = [];

  const vpc = votePower.data;
  if (vpc && parseFloat(vpc.coverage_pct) < 95) {
    alerts.push({
      level: 'critical',
      metric: 'Vote power coverage',
      value: `${vpc.coverage_pct}%`,
      threshold: '95%',
    });
  }

  const hv = hashVerify.data;
  if (hv && parseFloat(hv.mismatch_rate_pct) > 5) {
    alerts.push({
      level: 'warning',
      metric: 'Hash mismatch rate',
      value: `${hv.mismatch_rate_pct}%`,
      threshold: '5%',
    });
  }

  const ai = aiSummary.data;
  if (ai && ai.proposals_with_abstract > 0) {
    const pct = Math.round((ai.proposals_with_summary / ai.proposals_with_abstract) * 100);
    if (pct < 90) {
      alerts.push({
        level: 'warning',
        metric: 'Proposal AI summary coverage',
        value: `${pct}%`,
        threshold: '90%',
      });
    }
  }

  const fastSync = syncHealthMap['fast'] as Record<string, unknown> | undefined;
  if (fastSync && typeof fastSync.stale_minutes === 'number' && fastSync.stale_minutes > 90) {
    alerts.push({
      level: 'critical',
      metric: 'Fast sync stale',
      value: `${fastSync.stale_minutes} min`,
      threshold: '90 min',
    });
  }

  const fullSync = syncHealthMap['full'] as Record<string, unknown> | undefined;
  if (fullSync && typeof fullSync.stale_minutes === 'number' && fullSync.stale_minutes > 1560) {
    alerts.push({
      level: 'critical',
      metric: 'Full sync stale',
      value: `${Math.round(fullSync.stale_minutes / 60)} hr`,
      threshold: '26 hr',
    });
  }

  // Build KPI comparison from previous snapshot
  let comparison: Record<
    string,
    { previous: number; delta: number; snapshot_date: string }
  > | null = null;
  const prevSnap = recentSnapshots?.[0];
  const cs = canonicalSummary.data;
  if (prevSnap && vpc && ai && cs) {
    const currentVpPct = parseFloat(vpc.coverage_pct);
    const currentCanonicalPct =
      cs.total_proposals > 0
        ? Math.round((cs.with_canonical_summary / cs.total_proposals) * 100)
        : 0;
    const currentAiProposalPct =
      ai.proposals_with_abstract > 0
        ? Math.round((ai.proposals_with_summary / ai.proposals_with_abstract) * 100)
        : 100;
    const currentAiRationalePct =
      ai.rationales_with_text > 0
        ? Math.round((ai.rationales_with_summary / ai.rationales_with_text) * 100)
        : 100;
    const currentMismatchPct = hv ? parseFloat(hv.mismatch_rate_pct) : 0;

    const snap = prevSnap as Record<string, unknown>;
    const d = (field: string) => parseFloat(String(snap[field] ?? 0));

    comparison = {
      vote_power_coverage: {
        previous: d('vote_power_coverage_pct'),
        delta: currentVpPct - d('vote_power_coverage_pct'),
        snapshot_date: String(snap.snapshot_date),
      },
      canonical_summary: {
        previous: d('canonical_summary_pct'),
        delta: currentCanonicalPct - d('canonical_summary_pct'),
        snapshot_date: String(snap.snapshot_date),
      },
      ai_proposal: {
        previous: d('ai_proposal_pct'),
        delta: currentAiProposalPct - d('ai_proposal_pct'),
        snapshot_date: String(snap.snapshot_date),
      },
      ai_rationale: {
        previous: d('ai_rationale_pct'),
        delta: currentAiRationalePct - d('ai_rationale_pct'),
        snapshot_date: String(snap.snapshot_date),
      },
      hash_mismatch_rate: {
        previous: d('hash_mismatch_rate_pct'),
        delta: currentMismatchPct - d('hash_mismatch_rate_pct'),
        snapshot_date: String(snap.snapshot_date),
      },
      total_dreps: {
        previous: d('total_dreps'),
        delta: (systemStats.data?.total_dreps ?? 0) - d('total_dreps'),
        snapshot_date: String(snap.snapshot_date),
      },
      total_votes: {
        previous: d('total_votes'),
        delta: (systemStats.data?.total_votes ?? 0) - d('total_votes'),
        snapshot_date: String(snap.snapshot_date),
      },
      total_proposals: {
        previous: d('total_proposals'),
        delta: (systemStats.data?.total_proposals ?? 0) - d('total_proposals'),
        snapshot_date: String(snap.snapshot_date),
      },
      total_rationales: {
        previous: d('total_rationales'),
        delta: (systemStats.data?.total_rationales ?? 0) - d('total_rationales'),
        snapshot_date: String(snap.snapshot_date),
      },
    };
  }

  // Cross-reference reconciliation status
  const { data: reconcLatest } = await supabase
    .from('reconciliation_log')
    .select('checked_at, source, overall_status, results, mismatches, duration_ms, tier_scope')
    .order('checked_at', { ascending: false })
    .limit(5);

  const latestReconc = reconcLatest?.[0];
  if (latestReconc?.overall_status === 'mismatch') {
    alerts.push({
      level: 'critical',
      metric: 'Cross-reference mismatch',
      value: `${Array.isArray(latestReconc.mismatches) ? latestReconc.mismatches.length : 0} data points diverge`,
      threshold: '0 mismatches',
    });
  } else if (latestReconc?.overall_status === 'drift') {
    alerts.push({
      level: 'warning',
      metric: 'Cross-reference drift',
      value: `${Array.isArray(latestReconc.mismatches) ? latestReconc.mismatches.length : 0} data points drifting`,
      threshold: '0 drift',
    });
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    vote_power: votePower.data,
    ai_summaries: aiSummary.data,
    hash_verification: hashVerify.data,
    metadata_verification: metaVerify.data,
    canonical_summaries: canonicalSummary.data,
    sync_health: syncHealthMap,
    system_stats: systemStats.data,
    sync_history: syncHistory || [],
    alerts,
    comparison,
    reconciliation: {
      latest: latestReconc || null,
      history: reconcLatest || [],
    },
  });
});
