import { z } from 'zod';
import type {
  SystemsAutomationActivityRecord,
  SystemsPerformanceBaselineRecord,
  SystemsPerformanceBaselineSummary,
  SystemsStatus,
} from '@/lib/admin/systems';

export const SYSTEMS_PERFORMANCE_BASELINE_ACTION = 'systems_performance_baseline_logged';
export const SYSTEMS_PERFORMANCE_BASELINE_FRESHNESS_DAYS = 14;

type SystemsPerformanceBaselineAuditRow = {
  action: string;
  payload: unknown;
  created_at: string;
};

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const performanceBaselinePayloadSchema = z.object({
  actorType: z.enum(['manual', 'cron']),
  baselineDate: dateString,
  environment: z.enum(['production', 'preview', 'local']),
  scenarioLabel: z.string().trim().min(1).max(120),
  concurrencyProfile: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(500),
  bottleneck: z.string().trim().min(1).max(500),
  mitigationOwner: z.string().trim().min(1).max(120),
  nextStep: z.string().trim().min(1).max(600),
  artifactUrl: z.string().trim().url().nullable().optional(),
  notes: z.string().trim().max(1200).nullable().optional(),
  apiHealthP95Ms: z.number().int().nonnegative().max(60_000),
  apiDrepsP95Ms: z.number().int().nonnegative().max(60_000),
  apiV1DrepsP95Ms: z.number().int().nonnegative().max(60_000),
  governanceHealthP95Ms: z.number().int().nonnegative().max(60_000),
  errorRatePct: z.number().nonnegative().max(100),
});

export type SystemsPerformanceBaselinePayload = z.infer<typeof performanceBaselinePayloadSchema>;

export type SystemsPerformanceBaselineFollowupTarget = {
  sourceKey: string;
  severity: 'warning' | 'critical';
  title: string;
  summary: string;
  recommendedAction: string;
  actionHref: string;
  reason: 'missing' | 'stale' | 'bottleneck';
  evidence: Record<string, unknown>;
};

function normalizeString(input: string | null | undefined) {
  const cleaned = (input ?? '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function environmentLabel(environment: SystemsPerformanceBaselineRecord['environment']) {
  switch (environment) {
    case 'production':
      return 'Production';
    case 'preview':
      return 'Preview';
    default:
      return 'Local';
  }
}

function baselineStatusLabel(status: SystemsPerformanceBaselineRecord['overallStatus']) {
  switch (status) {
    case 'good':
      return 'Healthy baseline';
    case 'warning':
      return 'Watch baseline';
    default:
      return 'Critical baseline';
  }
}

function baselineDayAge(baselineDate: string, now = new Date()) {
  const baselineMs = Date.parse(`${baselineDate}T00:00:00Z`);
  const todayMs = Date.parse(now.toISOString().slice(0, 10) + 'T00:00:00Z');
  return Math.max(0, Math.floor((todayMs - baselineMs) / (1000 * 60 * 60 * 24)));
}

function maxObservedP95(payload: SystemsPerformanceBaselinePayload) {
  return Math.max(
    payload.apiHealthP95Ms,
    payload.apiDrepsP95Ms,
    payload.apiV1DrepsP95Ms,
    payload.governanceHealthP95Ms,
  );
}

function deriveOverallStatus(
  payload: Omit<SystemsPerformanceBaselinePayload, 'actorType'> & {
    actorType?: SystemsPerformanceBaselinePayload['actorType'];
  },
): SystemsPerformanceBaselineRecord['overallStatus'] {
  const slowestP95 = maxObservedP95({
    actorType: payload.actorType ?? 'manual',
    baselineDate: payload.baselineDate,
    environment: payload.environment,
    scenarioLabel: payload.scenarioLabel,
    concurrencyProfile: payload.concurrencyProfile,
    summary: payload.summary,
    bottleneck: payload.bottleneck,
    mitigationOwner: payload.mitigationOwner,
    nextStep: payload.nextStep,
    artifactUrl: payload.artifactUrl ?? null,
    notes: payload.notes ?? null,
    apiHealthP95Ms: payload.apiHealthP95Ms,
    apiDrepsP95Ms: payload.apiDrepsP95Ms,
    apiV1DrepsP95Ms: payload.apiV1DrepsP95Ms,
    governanceHealthP95Ms: payload.governanceHealthP95Ms,
    errorRatePct: payload.errorRatePct,
  });

  if (payload.errorRatePct > 5 || slowestP95 > 1_000) return 'critical';
  if (payload.errorRatePct > 1 || slowestP95 > 500) return 'warning';
  return 'good';
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function buildSystemsPerformanceBaselinePayload(input: unknown) {
  const raw = z
    .object({
      actorType: z.enum(['manual', 'cron']).optional(),
      baselineDate: dateString,
      environment: z.enum(['production', 'preview', 'local']),
      scenarioLabel: z.string(),
      concurrencyProfile: z.string(),
      summary: z.string(),
      bottleneck: z.string(),
      mitigationOwner: z.string(),
      nextStep: z.string(),
      artifactUrl: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      apiHealthP95Ms: z.number().int().nonnegative(),
      apiDrepsP95Ms: z.number().int().nonnegative(),
      apiV1DrepsP95Ms: z.number().int().nonnegative(),
      governanceHealthP95Ms: z.number().int().nonnegative(),
      errorRatePct: z.number().nonnegative(),
    })
    .parse(input);

  const payload = performanceBaselinePayloadSchema.parse({
    ...raw,
    actorType: raw.actorType ?? 'manual',
    scenarioLabel: normalizeString(raw.scenarioLabel),
    concurrencyProfile: normalizeString(raw.concurrencyProfile),
    summary: normalizeString(raw.summary),
    bottleneck: normalizeString(raw.bottleneck),
    mitigationOwner: normalizeString(raw.mitigationOwner),
    nextStep: normalizeString(raw.nextStep),
    artifactUrl: normalizeString(raw.artifactUrl),
    notes: normalizeString(raw.notes),
  });

  return {
    ...payload,
    overallStatus: deriveOverallStatus(payload),
  };
}

export function buildSystemsPerformanceBaselineTarget(payload: {
  baselineDate: string;
  environment: SystemsPerformanceBaselinePayload['environment'];
  scenarioLabel: string;
}) {
  return `performance-baseline:${payload.baselineDate}:${payload.environment}:${slugify(payload.scenarioLabel)}`;
}

export function parseSystemsPerformanceBaselineHistory(
  rows: SystemsPerformanceBaselineAuditRow[],
  now = new Date(),
): SystemsPerformanceBaselineRecord[] {
  const history: SystemsPerformanceBaselineRecord[] = [];

  for (const row of rows) {
    if (row.action !== SYSTEMS_PERFORMANCE_BASELINE_ACTION) continue;

    const parsed = performanceBaselinePayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;

    const daysSinceBaseline = baselineDayAge(parsed.data.baselineDate, now);
    history.push({
      actorType: parsed.data.actorType,
      loggedAt: row.created_at,
      baselineDate: parsed.data.baselineDate,
      environment: parsed.data.environment,
      scenarioLabel: parsed.data.scenarioLabel,
      concurrencyProfile: parsed.data.concurrencyProfile,
      overallStatus: deriveOverallStatus(parsed.data),
      summary: parsed.data.summary,
      bottleneck: parsed.data.bottleneck,
      mitigationOwner: parsed.data.mitigationOwner,
      nextStep: parsed.data.nextStep,
      artifactUrl: parsed.data.artifactUrl ?? null,
      notes: parsed.data.notes ?? null,
      apiHealthP95Ms: parsed.data.apiHealthP95Ms,
      apiDrepsP95Ms: parsed.data.apiDrepsP95Ms,
      apiV1DrepsP95Ms: parsed.data.apiV1DrepsP95Ms,
      governanceHealthP95Ms: parsed.data.governanceHealthP95Ms,
      errorRatePct: parsed.data.errorRatePct,
      maxObservedP95Ms: maxObservedP95(parsed.data),
      daysSinceBaseline,
      isStale: daysSinceBaseline > SYSTEMS_PERFORMANCE_BASELINE_FRESHNESS_DAYS,
    });
  }

  return history;
}

export function buildSystemsPerformanceBaselineSummary(
  latestBaseline: SystemsPerformanceBaselineRecord | null,
): SystemsPerformanceBaselineSummary {
  const target = `A fresh baseline every ${SYSTEMS_PERFORMANCE_BASELINE_FRESHNESS_DAYS} days and after risky route or caching changes`;

  if (!latestBaseline) {
    return {
      status: 'bootstrap',
      headline: 'Performance baseline has not been recorded yet',
      currentValue: 'No durable baseline logged',
      target,
      summary:
        'The cockpit has live API samples, but it still lacks a durable minimum-load baseline with a named bottleneck owner and next step.',
      lastRecordedAt: null,
      daysSinceBaseline: null,
    };
  }

  if (latestBaseline.overallStatus === 'critical') {
    return {
      status: 'critical',
      headline: 'Latest performance baseline is outside the launch bar',
      currentValue: `${latestBaseline.maxObservedP95Ms}ms slowest p95 / ${latestBaseline.errorRatePct.toFixed(1)}% 5xx`,
      target,
      summary: `${latestBaseline.bottleneck} ${latestBaseline.isStale ? `The recorded result is ${latestBaseline.daysSinceBaseline} days old, so rerunning it should happen only after the bottleneck owner has a sharper next move.` : `Owner: ${latestBaseline.mitigationOwner}.`}`,
      lastRecordedAt: latestBaseline.loggedAt,
      daysSinceBaseline: latestBaseline.daysSinceBaseline,
    };
  }

  if (latestBaseline.isStale) {
    return {
      status: 'warning',
      headline: 'Performance baseline is stale',
      currentValue: `${latestBaseline.daysSinceBaseline} days since the last baseline`,
      target,
      summary:
        'Risky route or caching changes can land without a fresh load signal if this baseline is not rerun and reattached to the cockpit.',
      lastRecordedAt: latestBaseline.loggedAt,
      daysSinceBaseline: latestBaseline.daysSinceBaseline,
    };
  }

  if (latestBaseline.overallStatus === 'warning') {
    return {
      status: 'warning',
      headline: 'Latest performance baseline needs follow-through',
      currentValue: `${latestBaseline.maxObservedP95Ms}ms slowest p95 / ${latestBaseline.errorRatePct.toFixed(1)}% 5xx`,
      target,
      summary: `${latestBaseline.bottleneck} Owner: ${latestBaseline.mitigationOwner}.`,
      lastRecordedAt: latestBaseline.loggedAt,
      daysSinceBaseline: latestBaseline.daysSinceBaseline,
    };
  }

  return {
    status: 'good',
    headline: 'Performance baseline is current',
    currentValue: `${latestBaseline.maxObservedP95Ms}ms slowest p95 / ${latestBaseline.errorRatePct.toFixed(1)}% 5xx`,
    target,
    summary:
      'A fresh minimum-load baseline is logged with a named bottleneck owner and next step, so performance discipline is part of the operating loop instead of a one-off doc.',
    lastRecordedAt: latestBaseline.loggedAt,
    daysSinceBaseline: latestBaseline.daysSinceBaseline,
  };
}

export function buildSystemsPerformanceBaselineFollowupTarget(input: {
  latestBaseline: SystemsPerformanceBaselineRecord | null;
  performanceStatus: SystemsStatus;
}): SystemsPerformanceBaselineFollowupTarget | null {
  if (!input.latestBaseline) {
    return {
      sourceKey: 'systems:performance-baseline',
      severity: input.performanceStatus === 'critical' ? 'critical' : 'warning',
      title: 'Record the performance baseline',
      summary:
        'The systems cockpit still has no durable minimum-load performance baseline with named ownership for the current bottleneck.',
      recommendedAction:
        'Run the minimum public baseline, log the result in /admin/systems, and leave behind the bottleneck owner plus the next mitigation step.',
      actionHref: '/admin/systems#performance-baseline',
      reason: 'missing',
      evidence: {
        reason: 'missing',
        baselineDate: null,
        baselineStatus: null,
        mitigationOwner: null,
        daysSinceBaseline: null,
      },
    };
  }

  if (input.latestBaseline.overallStatus !== 'good') {
    return {
      sourceKey: 'systems:performance-baseline',
      severity: input.latestBaseline.overallStatus === 'critical' ? 'critical' : 'warning',
      title: 'Close the performance bottleneck from the latest baseline',
      summary: `${input.latestBaseline.bottleneck} Latest ${environmentLabel(input.latestBaseline.environment).toLowerCase()} baseline was logged on ${input.latestBaseline.baselineDate}${input.latestBaseline.isStale ? ` and is now ${input.latestBaseline.daysSinceBaseline} days old` : ''}.`,
      recommendedAction: `${input.latestBaseline.mitigationOwner} owns the next move: ${input.latestBaseline.nextStep}`,
      actionHref: '/admin/systems#performance-baseline',
      reason: 'bottleneck',
      evidence: {
        reason: 'bottleneck',
        baselineDate: input.latestBaseline.baselineDate,
        baselineStatus: input.latestBaseline.overallStatus,
        bottleneck: input.latestBaseline.bottleneck,
        mitigationOwner: input.latestBaseline.mitigationOwner,
        daysSinceBaseline: input.latestBaseline.daysSinceBaseline,
      },
    };
  }

  if (input.latestBaseline.isStale) {
    return {
      sourceKey: 'systems:performance-baseline',
      severity: 'warning',
      title: 'Refresh the performance baseline',
      summary: `The latest minimum-load baseline is ${input.latestBaseline.daysSinceBaseline} days old, so route or caching changes can land without a fresh load signal.`,
      recommendedAction:
        'Rerun the minimum public baseline, update the bottleneck owner if it changed, and attach the new result to /admin/systems.',
      actionHref: '/admin/systems#performance-baseline',
      reason: 'stale',
      evidence: {
        reason: 'stale',
        baselineDate: input.latestBaseline.baselineDate,
        baselineStatus: input.latestBaseline.overallStatus,
        mitigationOwner: input.latestBaseline.mitigationOwner,
        daysSinceBaseline: input.latestBaseline.daysSinceBaseline,
      },
    };
  }

  return null;
}

export function buildSystemsPerformanceBaselineHistory(
  rows: SystemsPerformanceBaselineAuditRow[],
): SystemsAutomationActivityRecord[] {
  const history: SystemsAutomationActivityRecord[] = [];
  const parsedHistory = parseSystemsPerformanceBaselineHistory(rows);

  for (const entry of parsedHistory) {
    history.push({
      id: ['performance_baseline', entry.loggedAt, entry.baselineDate, entry.environment].join(':'),
      type: 'performance_baseline',
      actorType: entry.actorType,
      statusLabel: baselineStatusLabel(entry.overallStatus),
      tone: entry.overallStatus,
      title: `Performance baseline for ${entry.baselineDate}`,
      summary: `${entry.summary} Bottleneck: ${entry.bottleneck}`,
      createdAt: entry.loggedAt,
      actionHref: '/admin/systems#performance-baseline',
      metricItems: [
        { label: 'Environment', value: environmentLabel(entry.environment) },
        { label: 'Slowest p95', value: `${entry.maxObservedP95Ms}ms` },
        { label: '5xx rate', value: `${entry.errorRatePct.toFixed(1)}%` },
        { label: 'Owner', value: entry.mitigationOwner },
      ],
    });
  }

  return history;
}
