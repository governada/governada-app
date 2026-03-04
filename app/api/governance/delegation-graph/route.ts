import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import {
  extractAlignments,
  alignmentsToArray,
  getDominantDimension,
  type AlignmentDimension,
} from '@/lib/drepIdentity';
import { logger } from '@/lib/logger';

const CACHE_SECONDS = 300;

export interface DelegationGraphNode {
  id: string;
  name: string;
  score: number;
  delegatorCount: number;
  powerAda: number;
  concentrationPct: number | null;
  newDelegators: number;
  lostDelegators: number;
  dominant: AlignmentDimension;
  alignments: number[];
}

export interface DelegationGraphCluster {
  dimension: AlignmentDimension;
  count: number;
  totalPowerAda: number;
}

export interface DelegationGraphResponse {
  nodes: DelegationGraphNode[];
  clusters: DelegationGraphCluster[];
  epoch: number;
  totalDelegators: number;
  totalPowerAda: number;
}

export const GET = withRouteHandler(async (_request, { requestId }) => {
    const supabase = createClient();

    const [epochRes, statsRes] = await Promise.all([
      supabase
        .from('delegation_snapshots')
        .select('epoch')
        .order('epoch', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('governance_stats').select('current_epoch').eq('id', 1).maybeSingle(),
    ]);

    const epoch =
      epochRes.data?.epoch ??
      statsRes.data?.current_epoch ??
      blockTimeToEpoch(Math.floor(Date.now() / 1000));

    const { data: snapshots, error: snapError } = await supabase
      .from('delegation_snapshots')
      .select(
        'drep_id, delegator_count, total_power_lovelace, top_10_delegator_pct, new_delegators, lost_delegators',
      )
      .eq('epoch', epoch)
      .order('total_power_lovelace', { ascending: false, nullsFirst: false })
      .limit(200);

    if (snapError) {
      logger.error('Delegation graph snapshots error', { context: 'governance/delegation-graph', error: snapError?.message });
      return NextResponse.json({ error: 'Failed to fetch delegation snapshots' }, { status: 500 });
    }

    if (!snapshots?.length) {
      return NextResponse.json(
        {
          nodes: [],
          clusters: [],
          epoch,
          totalDelegators: 0,
          totalPowerAda: 0,
        } satisfies DelegationGraphResponse,
        {
          headers: {
            'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
          },
        },
      );
    }

    const drepIds = [...new Set(snapshots.map((s) => s.drep_id))];
    const BATCH = 50;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dreps: any[] = [];
    let drepsError: unknown = null;
    for (let i = 0; i < drepIds.length; i += BATCH) {
      const batch = drepIds.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from('dreps')
        .select(
          'id, score, info, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .in('id', batch);
      if (error) {
        drepsError = error;
        break;
      }
      if (data) dreps.push(...data);
    }

    if (drepsError) {
      logger.error('Delegation graph dreps error', { context: 'governance/delegation-graph', error: drepsError });
    }

    const drepsMap = new Map((dreps ?? []).map((d) => [d.id, d]));

    const clusterMap = new Map<AlignmentDimension, { count: number; totalPowerAda: number }>();
    const nodes: DelegationGraphNode[] = [];
    let totalDelegators = 0;
    let totalPowerAda = 0;

    for (const s of snapshots) {
      const drep = drepsMap.get(s.drep_id);
      const powerAda = Number(s.total_power_lovelace ?? 0) / 1_000_000;
      const delegatorCount = s.delegator_count ?? 0;
      totalDelegators += delegatorCount;
      totalPowerAda += powerAda;

      const alignments = drep ? extractAlignments(drep) : null;
      const dominant: AlignmentDimension = alignments
        ? getDominantDimension(alignments)
        : 'transparency';
      const alignmentsArr = alignments ? alignmentsToArray(alignments) : [50, 50, 50, 50, 50, 50];

      const info = (drep?.info as Record<string, unknown>) ?? {};
      const name =
        (info.name as string) ??
        (info.ticker as string) ??
        (info.handle as string) ??
        s.drep_id.slice(0, 12);

      const existing = clusterMap.get(dominant) ?? { count: 0, totalPowerAda: 0 };
      clusterMap.set(dominant, {
        count: existing.count + 1,
        totalPowerAda: existing.totalPowerAda + powerAda,
      });

      nodes.push({
        id: s.drep_id,
        name,
        score: drep?.score ?? 0,
        delegatorCount,
        powerAda,
        concentrationPct: s.top_10_delegator_pct ?? null,
        newDelegators: s.new_delegators ?? 0,
        lostDelegators: s.lost_delegators ?? 0,
        dominant,
        alignments: alignmentsArr,
      });
    }

    const clusters: DelegationGraphCluster[] = Array.from(clusterMap.entries()).map(
      ([dimension, { count, totalPowerAda: p }]) => ({
        dimension,
        count,
        totalPowerAda: p,
      }),
    );

    const response: DelegationGraphResponse = {
      nodes,
      clusters,
      epoch,
      totalDelegators,
      totalPowerAda,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
      },
    });
});
