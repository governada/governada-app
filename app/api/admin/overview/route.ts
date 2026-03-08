export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const GET = withRouteHandler(
  async (_request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const [syncResult, drepsResult, proposalsResult, votesResult, failuresResult] =
      await Promise.all([
        // Latest sync per type (last run status)
        supabase.rpc('get_latest_syncs').select(),
        // Total DReps
        supabase.from('dreps').select('id', { count: 'exact', head: true }),
        // Total proposals
        supabase.from('proposals').select('tx_hash', { count: 'exact', head: true }),
        // Total votes
        supabase.from('drep_votes').select('vote_tx_hash', { count: 'exact', head: true }),
        // Recent failures (last 24h)
        supabase
          .from('sync_log')
          .select('id', { count: 'exact', head: true })
          .eq('success', false)
          .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);

    // Fallback: if the RPC doesn't exist yet, query directly
    let syncSummary = syncResult.data || [];
    if (syncResult.error) {
      const fallback = await supabase
        .from('sync_log')
        .select('sync_type, started_at, success, duration_ms')
        .order('started_at', { ascending: false })
        .limit(50);

      // Deduplicate to latest per sync_type
      const seen = new Set<string>();
      syncSummary = (fallback.data || []).reduce(
        (
          acc: Array<{
            sync_type: string;
            last_run: string;
            success: boolean;
            duration_ms: number | null;
          }>,
          row,
        ) => {
          if (!seen.has(row.sync_type)) {
            seen.add(row.sync_type);
            acc.push({
              sync_type: row.sync_type,
              last_run: row.started_at,
              success: row.success,
              duration_ms: row.duration_ms,
            });
          }
          return acc;
        },
        [],
      );
    }

    return NextResponse.json({
      sync_summary: syncSummary,
      total_dreps: drepsResult.count || 0,
      total_proposals: proposalsResult.count || 0,
      total_votes: votesResult.count || 0,
      recent_failures: failuresResult.count || 0,
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
