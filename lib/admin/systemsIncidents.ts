import { z } from 'zod';
import type {
  SystemsCommitmentCard,
  SystemsIncidentRecord,
  SystemsIncidentSeverity,
  SystemsIncidentStatus,
  SystemsIncidentSummary,
  SystemsIncidentType,
  SystemsStatus,
} from '@/lib/admin/systems';

export const SYSTEMS_INCIDENT_LOG_ACTION = 'log_systems_incident';

const DRILL_WARNING_DAYS = 35;
const DRILL_CRITICAL_DAYS = 60;
const MAX_RESPONSE_MINUTES = 7 * 24 * 60;
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type DrillScenarioId = 'data_freshness' | 'deploy_failure' | 'dependency_degradation';

type DrillScenario = {
  id: DrillScenarioId;
  title: string;
  summary: string;
  systems: string[];
  keywords: string[];
};

export type SystemsDrillCadenceTarget = {
  sourceKey: string;
  title: string;
  summary: string;
  recommendedAction: string;
  actionHref: string;
  severity: 'warning' | 'critical';
  reason: 'missing' | 'stale';
  drillCount: number;
  lastDrillAt: string | null;
  suggestedScenario: DrillScenarioId;
  suggestedTitle: string;
  suggestedSystems: string[];
};

export type SystemsIncidentRetroTarget = {
  sourceKey: string;
  title: string;
  summary: string;
  recommendedAction: string;
  actionHref: string;
  severity: 'warning' | 'critical';
  entryId: string;
  entryType: SystemsIncidentType;
  incidentDate: string;
  incidentTitle: string;
  followUpOwner: string;
  commitmentTitle: string;
  commitmentSummary: string;
  linkedSloIds: string[];
};

const DRILL_SCENARIOS: DrillScenario[] = [
  {
    id: 'data_freshness',
    title: 'Data freshness drill',
    summary:
      'Rehearse stale sync detection, founder communication, and the user-facing honesty path.',
    systems: ['pipeline', 'supabase', 'freshness'],
    keywords: ['freshness', 'stale', 'sync', 'supabase', 'reconciliation', 'data drift', 'drift'],
  },
  {
    id: 'deploy_failure',
    title: 'Deploy rollback drill',
    summary:
      'Rehearse a bad deploy, rollback decision, readiness checks, and public recovery posture.',
    systems: ['deploy', 'rollback', 'readiness'],
    keywords: ['deploy', 'rollback', 'release', 'readiness', 'build', 'migration'],
  },
  {
    id: 'dependency_degradation',
    title: 'Dependency degradation drill',
    summary:
      'Rehearse upstream dependency degradation and the fallback path before it happens under pressure.',
    systems: ['koios', 'redis', 'dependency'],
    keywords: ['koios', 'redis', 'dependency', 'upstream', 'outage', 'degradation'],
  },
];

const systemsIncidentPayloadSchema = z.object({
  incidentDate: dateString,
  entryType: z.enum(['incident', 'drill']),
  severity: z.enum(['drill', 'p0', 'p1', 'p2', 'near_miss']),
  status: z.enum(['open', 'mitigated', 'resolved', 'follow_up_pending']),
  title: z.string().trim().min(5).max(140),
  detectedBy: z.string().trim().min(3).max(80),
  systemsAffected: z.array(z.string().trim().min(1).max(80)).max(6),
  userImpact: z.string().trim().min(10).max(500),
  rootCause: z.string().trim().min(10).max(1200),
  mitigation: z.string().trim().min(10).max(1200),
  permanentFix: z.string().trim().min(10).max(1200),
  followUpOwner: z.string().trim().min(2).max(120),
  timeToAcknowledgeMinutes: z.number().int().min(0).max(MAX_RESPONSE_MINUTES).nullable().optional(),
  timeToMitigateMinutes: z.number().int().min(0).max(MAX_RESPONSE_MINUTES).nullable().optional(),
  timeToResolveMinutes: z.number().int().min(0).max(MAX_RESPONSE_MINUTES).nullable().optional(),
});

export const createSystemsIncidentSchema = systemsIncidentPayloadSchema.superRefine(
  (value, context) => {
    if (value.entryType === 'drill') {
      if (value.severity !== 'drill') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Drill entries must use drill severity',
          path: ['severity'],
        });
      }
      if (!['resolved', 'follow_up_pending'].includes(value.status)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Drill entries must be resolved or follow-up pending',
          path: ['status'],
        });
      }
      return;
    }

    if (value.severity === 'drill') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Incident entries must use a production severity',
        path: ['severity'],
      });
    }
  },
);

type IncidentAuditRow = {
  action: string;
  target: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function truncate(value: string, max = 180) {
  return value.length <= max ? value : `${value.slice(0, max - 3).trimEnd()}...`;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sortIncidentHistory(entries: SystemsIncidentRecord[]) {
  return [...entries].sort((left, right) => {
    if (left.incidentDate !== right.incidentDate) {
      return right.incidentDate.localeCompare(left.incidentDate);
    }

    return right.loggedAt.localeCompare(left.loggedAt);
  });
}

function daysSince(dateStringValue: string, now: Date) {
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(`${dateStringValue}T00:00:00.000Z`).getTime()) / 86400000),
  );
}

function drillLabel(lastDrillAt: string | null | undefined, now: Date) {
  if (!lastDrillAt) return 'no drill yet';
  const ageDays = daysSince(lastDrillAt, now);
  return ageDays === 0 ? 'drill today' : `last drill ${ageDays}d ago`;
}

function buildIncidentSummaryText(entry: z.infer<typeof createSystemsIncidentSchema>) {
  if (entry.entryType === 'drill') {
    return truncate(`Drill: ${entry.userImpact} Permanent fix: ${entry.permanentFix}`);
  }

  return truncate(entry.userImpact);
}

export function buildSystemsIncidentTarget(entry: z.infer<typeof createSystemsIncidentSchema>) {
  const titleKey = entry.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  return `${entry.entryType}:${entry.incidentDate}:${titleKey || 'entry'}`;
}

export function buildSystemsIncidentPayload(input: z.input<typeof createSystemsIncidentSchema>) {
  const parsed = createSystemsIncidentSchema.parse(input);
  return {
    ...parsed,
    summary: buildIncidentSummaryText(parsed),
  };
}

export function parseSystemsIncidentHistory(rows: IncidentAuditRow[]): SystemsIncidentRecord[] {
  const parsedEntries: SystemsIncidentRecord[] = [];

  for (const row of rows) {
    if (row.action !== SYSTEMS_INCIDENT_LOG_ACTION || !row.payload) continue;

    const parsed = systemsIncidentPayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;

    parsedEntries.push({
      id: row.target ?? `${row.created_at}:${parsedEntries.length}`,
      loggedAt: row.created_at,
      incidentDate: parsed.data.incidentDate,
      entryType: parsed.data.entryType,
      severity: parsed.data.severity,
      status: parsed.data.status,
      title: parsed.data.title,
      summary: buildIncidentSummaryText(parsed.data),
      detectedBy: parsed.data.detectedBy,
      systemsAffected: parsed.data.systemsAffected,
      userImpact: parsed.data.userImpact,
      rootCause: parsed.data.rootCause,
      mitigation: parsed.data.mitigation,
      permanentFix: parsed.data.permanentFix,
      followUpOwner: parsed.data.followUpOwner,
      timeToAcknowledgeMinutes: parsed.data.timeToAcknowledgeMinutes ?? null,
      timeToMitigateMinutes: parsed.data.timeToMitigateMinutes ?? null,
      timeToResolveMinutes: parsed.data.timeToResolveMinutes ?? null,
    });
  }

  return sortIncidentHistory(parsedEntries);
}

function severityRank(severity: SystemsIncidentSeverity) {
  switch (severity) {
    case 'p0':
      return 4;
    case 'p1':
      return 3;
    case 'p2':
      return 2;
    case 'near_miss':
      return 1;
    default:
      return 0;
  }
}

function buildRetroCommitmentTitle(entry: SystemsIncidentRecord) {
  return truncate(
    `${entry.entryType === 'drill' ? 'Close the drill follow-up from' : 'Close the incident follow-up from'} ${entry.title}`,
    140,
  );
}

function buildRetroCommitmentSummary(entry: SystemsIncidentRecord) {
  const systemsLabel =
    entry.systemsAffected.length > 0
      ? `Systems affected: ${entry.systemsAffected.join(', ')}. `
      : '';
  return truncate(`${systemsLabel}Permanent fix to operationalize: ${entry.permanentFix}`, 1000);
}

function buildIncidentRetroLinkedSloIds(entry: SystemsIncidentRecord) {
  const haystack = normalizeText(
    [entry.title, entry.userImpact, entry.rootCause, entry.mitigation, entry.permanentFix]
      .concat(entry.systemsAffected)
      .join(' '),
  );
  const matches: string[] = [];

  const rules: Array<{ sloId: string; keywords: string[] }> = [
    {
      sloId: 'availability',
      keywords: [
        'availability',
        'readiness',
        'outage',
        'deploy',
        'rollback',
        'redis',
        'koios',
        'supabase',
        'dependency',
        'downtime',
      ],
    },
    {
      sloId: 'freshness',
      keywords: ['freshness', 'stale', 'sync', 'pipeline', 'reconciliation', 'drift'],
    },
    {
      sloId: 'correctness',
      keywords: ['correctness', 'integrity', 'mismatch', 'hash', 'vote power', 'coverage'],
    },
    {
      sloId: 'performance',
      keywords: ['performance', 'latency', 'slow', 'timeout', 'response time', 'cache'],
    },
    {
      sloId: 'journeys',
      keywords: ['journey', 'auth', 'workspace', 'proposal', 'drep', 'match', 'shell', 'ui', 'ux'],
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      matches.push(rule.sloId);
    }
  }

  if (matches.length > 0) return matches.slice(0, 3);
  return entry.entryType === 'incident' ? ['availability'] : ['journeys'];
}

function existingCommitmentMatchesRetro(
  openCommitments: SystemsCommitmentCard[],
  commitmentTitle: string,
) {
  const normalizedCommitmentTitle = normalizeText(commitmentTitle);
  return openCommitments.some(
    (commitment) => normalizeText(commitment.title) === normalizedCommitmentTitle,
  );
}

function classifyDrillScenario(entry: SystemsIncidentRecord): DrillScenarioId | null {
  if (entry.entryType !== 'drill') return null;

  const haystack = [
    entry.title,
    entry.summary,
    entry.userImpact,
    entry.rootCause,
    entry.mitigation,
    entry.permanentFix,
    entry.systemsAffected.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  for (const scenario of DRILL_SCENARIOS) {
    if (scenario.keywords.some((keyword) => haystack.includes(keyword))) {
      return scenario.id;
    }
  }

  return null;
}

function chooseNextDrillScenario(history: SystemsIncidentRecord[]): DrillScenario {
  const drills = history.filter((entry) => entry.entryType === 'drill');
  const lastDrillByScenario = new Map<DrillScenarioId, string>();

  for (const drill of drills) {
    const scenarioId = classifyDrillScenario(drill);
    if (!scenarioId || lastDrillByScenario.has(scenarioId)) continue;
    lastDrillByScenario.set(scenarioId, drill.incidentDate);
  }

  for (const scenario of DRILL_SCENARIOS) {
    if (!lastDrillByScenario.has(scenario.id)) {
      return scenario;
    }
  }

  return [...DRILL_SCENARIOS].sort((left, right) =>
    (lastDrillByScenario.get(left.id) ?? '9999-12-31').localeCompare(
      lastDrillByScenario.get(right.id) ?? '9999-12-31',
    ),
  )[0]!;
}

export function buildSystemsDrillCadenceTarget(input: {
  summary: SystemsIncidentSummary;
  history: SystemsIncidentRecord[];
  now?: Date;
}): SystemsDrillCadenceTarget | null {
  const now = input.now ?? new Date();
  const lastDrillAt = input.summary.lastDrillAt ?? null;
  const lastDrillAgeDays = lastDrillAt ? daysSince(lastDrillAt, now) : null;

  if (lastDrillAt && (lastDrillAgeDays ?? 0) <= DRILL_WARNING_DAYS) {
    return null;
  }

  const nextScenario = chooseNextDrillScenario(input.history);
  const reason: SystemsDrillCadenceTarget['reason'] = lastDrillAt ? 'stale' : 'missing';
  const severity: SystemsDrillCadenceTarget['severity'] =
    lastDrillAt && (lastDrillAgeDays ?? 0) > DRILL_CRITICAL_DAYS ? 'critical' : 'warning';
  const title =
    reason === 'missing'
      ? `Run the first failure drill: ${nextScenario.title}`
      : `Refresh failure drill cadence: ${nextScenario.title}`;

  const cadenceSummary =
    reason === 'missing'
      ? 'No drill is logged yet, so response readiness is still theoretical.'
      : `The last logged drill was ${lastDrillAgeDays} days ago, so the monthly rehearsal loop has drifted.`;

  return {
    sourceKey: 'systems:drill-cadence',
    title,
    summary: `${cadenceSummary} Next scenario: ${nextScenario.summary}`,
    recommendedAction: `Run a ${nextScenario.title.toLowerCase()} this week, log it in /admin/systems#incident-log, capture the detection path, and carry one permanent-fix follow-up into the next weekly review.`,
    actionHref: '/admin/systems#incident-log',
    severity,
    reason,
    drillCount: input.summary.drillCount,
    lastDrillAt,
    suggestedScenario: nextScenario.id,
    suggestedTitle: nextScenario.title,
    suggestedSystems: nextScenario.systems,
  };
}

export function buildSystemsIncidentRetroTarget(input: {
  history: SystemsIncidentRecord[];
  openCommitments: SystemsCommitmentCard[];
}): SystemsIncidentRetroTarget | null {
  const candidate = input.history
    .filter((entry) => entry.status === 'follow_up_pending')
    .map((entry) => ({
      entry,
      commitmentTitle: buildRetroCommitmentTitle(entry),
    }))
    .filter(
      ({ commitmentTitle }) =>
        !existingCommitmentMatchesRetro(input.openCommitments, commitmentTitle),
    )
    .sort((left, right) => {
      const severityDelta = severityRank(right.entry.severity) - severityRank(left.entry.severity);
      if (severityDelta !== 0) return severityDelta;
      if (left.entry.entryType !== right.entry.entryType) {
        return left.entry.entryType === 'incident' ? -1 : 1;
      }
      if (left.entry.incidentDate !== right.entry.incidentDate) {
        return right.entry.incidentDate.localeCompare(left.entry.incidentDate);
      }
      return right.entry.loggedAt.localeCompare(left.entry.loggedAt);
    })[0];

  if (!candidate) return null;

  const { entry, commitmentTitle } = candidate;
  const linkedSloIds = buildIncidentRetroLinkedSloIds(entry);
  const commitmentSummary = buildRetroCommitmentSummary(entry);
  const severity = severityRank(entry.severity) >= 3 ? 'critical' : 'warning';

  return {
    sourceKey: `systems:incident-retro:${entry.id}`,
    title: `Turn ${entry.title} into this week's hardening commitment`,
    summary:
      entry.entryType === 'drill'
        ? `The drill is logged as follow-up pending, so the lesson still needs to become named operating work. Permanent fix: ${truncate(entry.permanentFix, 240)}`
        : `This incident is logged as follow-up pending, so the permanent fix is still not anchored in the weekly operating loop. Permanent fix: ${truncate(entry.permanentFix, 240)}`,
    recommendedAction: `Apply the suggested weekly commitment "${commitmentTitle}" under ${entry.followUpOwner}, use the permanent fix as the acceptance bar, and keep the incident loop open until that commitment is real.`,
    actionHref: '/admin/systems#weekly-review',
    severity,
    entryId: entry.id,
    entryType: entry.entryType,
    incidentDate: entry.incidentDate,
    incidentTitle: entry.title,
    followUpOwner: entry.followUpOwner,
    commitmentTitle,
    commitmentSummary,
    linkedSloIds,
  };
}

export function buildSystemsIncidentSummary(input: {
  history: SystemsIncidentRecord[];
  now?: Date;
}): SystemsIncidentSummary {
  const now = input.now ?? new Date();
  const history = sortIncidentHistory(input.history);
  const incidents = history.filter((entry) => entry.entryType === 'incident');
  const drills = history.filter((entry) => entry.entryType === 'drill');
  const openIncidents = incidents.filter((entry) => entry.status !== 'resolved');
  const criticalOpenCount = openIncidents.filter(
    (entry) => severityRank(entry.severity) >= 3,
  ).length;
  const lastDrillAt = drills[0]?.incidentDate ?? null;
  const lastIncidentAt = incidents[0]?.incidentDate ?? null;
  const lastDrillAgeDays = lastDrillAt ? daysSince(lastDrillAt, now) : null;

  let status: SystemsStatus = 'good';
  let headline = 'Incident and drill trail is current';
  let summary =
    'Recent incidents are resolved, and the drill cadence is fresh enough to keep operator response practiced instead of theoretical.';

  if (history.length === 0) {
    status = 'warning';
    headline = 'Incident and drill loop has not started yet';
    summary =
      'No incidents or drills are logged yet. Run the first tabletop drill so response readiness stops living only in the runbook.';
  } else if (criticalOpenCount > 0) {
    status = 'critical';
    headline = 'A high-severity incident is still open';
    summary =
      'At least one P0 or P1 incident is still unresolved. Treat this as active launch risk and close the mitigation plus permanent-fix loop before normal feature velocity.';
  } else if (openIncidents.length > 0) {
    status = 'warning';
    headline = 'Incident follow-through is still open';
    summary =
      'The incident trail is active, but there is still unresolved mitigation or follow-up work. Use the weekly review to make that hardening work explicit.';
  } else if (lastDrillAt === null) {
    status = 'warning';
    headline = 'Failure drills have not started yet';
    summary =
      'Real incidents may not happen on schedule, so drills are the only reliable way to practice detection and mitigation before launch pressure arrives.';
  } else if ((lastDrillAgeDays ?? 0) > DRILL_CRITICAL_DAYS) {
    status = 'critical';
    headline = 'Failure drill cadence is stale';
    summary = `The last logged drill was ${lastDrillAgeDays} days ago. The incident loop exists, but practiced response readiness has drifted beyond the monthly bar.`;
  } else if ((lastDrillAgeDays ?? 0) > DRILL_WARNING_DAYS) {
    status = 'warning';
    headline = 'Failure drill cadence needs a refresh';
    summary = `The last logged drill was ${lastDrillAgeDays} days ago. Queue the next tabletop exercise before operator readiness starts depending on memory again.`;
  }

  return {
    status,
    headline,
    currentValue: `${openIncidents.length} open incident${openIncidents.length === 1 ? '' : 's'} / ${drillLabel(
      lastDrillAt,
      now,
    )}`,
    target: 'Monthly drills with no unresolved high-severity incidents',
    summary,
    lastDrillAt,
    lastIncidentAt,
    openIncidentCount: openIncidents.length,
    drillCount: drills.length,
    recentEntries: history.slice(0, 8),
  };
}
