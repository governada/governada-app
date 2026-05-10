export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSourceHealthSummary } from '@/lib/sourceHealth';
import type {
  SystemsLaunchDecision,
  SystemsProvenanceStamp,
  SystemsSourcesViewData,
  SystemsStatus,
  SystemsWorkspaceSummary,
} from '@/lib/admin/systems';

const DEFAULT_WINDOW_MINUTES = 24 * 60;

function sourceHealthStatus(rows: SystemsSourcesViewData['sourceHealth']): SystemsStatus {
  if (rows.length === 0) return 'warning';
  if (rows.some((row) => row.successRate < 0.9 || row.p95LatencyMs >= 10_000)) {
    return 'critical';
  }
  if (rows.some((row) => row.successRate < 0.98 || row.p95LatencyMs >= 5_000)) {
    return 'warning';
  }
  return 'good';
}

function decisionForStatus(status: SystemsStatus): SystemsLaunchDecision {
  if (status === 'critical') return 'blocked';
  if (status === 'warning') return 'risky';
  return 'ready';
}

function buildSummary(input: {
  generatedAt: string;
  status: SystemsStatus;
  rowCount: number;
  windowMinutes: number;
}): SystemsWorkspaceSummary {
  const proofStamp: SystemsProvenanceStamp = {
    kind: input.rowCount > 0 ? 'live_probe' : 'stale',
    label: input.rowCount > 0 ? 'source-health-events' : 'no-source-health-events',
    freshnessLabel: input.rowCount > 0 ? 'Live source events present' : 'No source events found',
    updatedAt: input.generatedAt,
    isStale: input.rowCount === 0,
    detail: `${input.windowMinutes} minute source-health window`,
  };

  return {
    generatedAt: input.generatedAt,
    section: 'sources',
    launchDecision: decisionForStatus(input.status),
    launchHeadline:
      input.status === 'good'
        ? 'Koios and Blockfrost are answering cleanly.'
        : input.status === 'critical'
          ? 'A source vendor is degraded enough to investigate now.'
          : 'Source health needs a closer look.',
    blockerCount: input.status === 'critical' ? 1 : 0,
    queueCount: input.status === 'warning' ? 1 : 0,
    proofFreshness:
      input.rowCount > 0
        ? `${input.rowCount} endpoint summaries from the last 24 hours.`
        : 'No source-health samples have landed in the current window yet.',
    proofStatus: input.status,
    proofStamps: [proofStamp],
  };
}

export const GET = withRouteHandler(
  async (_request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sourceHealth = await getSourceHealthSummary(DEFAULT_WINDOW_MINUTES);
    const status = sourceHealthStatus(sourceHealth);

    return NextResponse.json({
      summary: buildSummary({
        generatedAt: new Date().toISOString(),
        status,
        rowCount: sourceHealth.length,
        windowMinutes: DEFAULT_WINDOW_MINUTES,
      }),
      sourceHealth,
      windowMinutes: DEFAULT_WINDOW_MINUTES,
    } satisfies SystemsSourcesViewData);
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
