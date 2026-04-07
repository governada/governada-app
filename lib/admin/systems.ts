export type SystemsStatus = 'good' | 'warning' | 'critical' | 'bootstrap';
export type SystemsConfidence = 'live' | 'partial' | 'manual' | 'bootstrap';
export type JourneyGateLevel = 'L0' | 'L1' | 'L2';
export type JourneyCoverage = 'automated' | 'partial' | 'manual';
export type SystemsCommitmentStatus = 'planned' | 'in_progress' | 'blocked' | 'done';
export type SystemsAutomationSeverity = 'warning' | 'critical';
export type SystemsAutomationFollowupStatus = 'open' | 'acknowledged' | 'resolved';
export type SystemsPerformanceBaselineEnvironment = 'production' | 'preview' | 'local';
export type SystemsLaunchDecision = 'ready' | 'risky' | 'blocked';
export type SystemsAutomationTriggerType =
  | 'review_discipline'
  | 'performance_baseline'
  | 'trust_surface_review'
  | 'drill_cadence'
  | 'incident_retro_followup'
  | 'overdue_commitment'
  | 'systems_action';
export type SystemsScorecardTrend = 'improving' | 'steady' | 'worsening' | 'new';
export type SystemsIncidentType = 'incident' | 'drill';
export type SystemsIncidentSeverity = 'drill' | 'p0' | 'p1' | 'p2' | 'near_miss';
export type SystemsIncidentStatus = 'open' | 'mitigated' | 'resolved' | 'follow_up_pending';

export interface SystemsPromiseCard {
  id: string;
  title: string;
  status: SystemsStatus;
  confidence: SystemsConfidence;
  metricLabel: string;
  currentValue: string;
  target: string;
  summary: string;
  actionLabel: string;
  actionHref?: string;
}

export interface SystemsAction {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  timeframe: 'now' | 'this-week' | 'foundation';
  summary: string;
  href?: string;
  automationReady: boolean;
}

export interface SystemsJourney {
  id: string;
  title: string;
  persona: string;
  gateLevel: JourneyGateLevel;
  coverage: JourneyCoverage;
  whyItMatters: string;
  currentEvidence: string;
  gap: string;
  nextStep: string;
}

export interface AutomationCandidate {
  id: string;
  title: string;
  trigger: string;
  action: string;
  whyItMatters: string;
}

export interface QuickLink {
  label: string;
  href: string;
  description: string;
}

export interface SystemsSloCard {
  id: string;
  title: string;
  status: SystemsStatus;
  objective: string;
  sli: string;
  currentValue: string;
  target: string;
  alertThreshold: string;
  summary: string;
  actionLabel: string;
  actionHref?: string;
}

export interface SystemsReviewStep {
  id: string;
  title: string;
  summary: string;
  output: string;
  automationReady: boolean;
}

export interface SystemsReviewLoop {
  cadence: string;
  owner: string;
  duration: string;
  output: string;
  currentFocus: string;
  narrative: string;
  steps: SystemsReviewStep[];
}

export interface SystemsCommitmentCard {
  id: string;
  reviewId?: string | null;
  title: string;
  summary: string;
  owner: string;
  status: SystemsCommitmentStatus;
  dueDate?: string | null;
  linkedSloIds: string[];
  createdAt: string;
  isOverdue: boolean;
  ageDays: number;
}

export interface SystemsReviewRecord {
  id: string;
  reviewDate: string;
  reviewedAt: string;
  overallStatus: SystemsStatus;
  focusArea: string;
  summary: string;
  topRisk: string;
  changeNotes?: string | null;
  linkedSloIds: string[];
  commitment?: {
    id: string;
    title: string;
    owner: string;
    status: SystemsCommitmentStatus;
    dueDate?: string | null;
  } | null;
}

export interface SystemsReviewDiscipline {
  status: SystemsStatus;
  headline: string;
  currentValue: string;
  target: string;
  summary: string;
  lastReviewedAt?: string | null;
  openCommitments: number;
  overdueCommitments: number;
}

export interface SystemsAutomationFollowup {
  sourceKey: string;
  triggerType: SystemsAutomationTriggerType;
  severity: SystemsAutomationSeverity;
  status: SystemsAutomationFollowupStatus;
  title: string;
  summary: string;
  recommendedAction: string;
  actionHref?: string | null;
  evidence?: Record<string, unknown>;
  updatedAt: string;
}

export interface SystemsAutomationRunRecord {
  actorType: 'manual' | 'cron';
  status: Exclude<SystemsStatus, 'bootstrap'>;
  summary: string;
  followupCount: number;
  criticalCount: number;
  openedCount: number;
  updatedCount: number;
  resolvedCount: number;
  createdAt: string;
}

export type SystemsAutomationActivityType =
  | 'sweep'
  | 'followup'
  | 'review_draft'
  | 'operator_escalation'
  | 'commitment_shepherd'
  | 'performance_baseline'
  | 'trust_surface_review';

export type SystemsAutomationActivityTone = 'good' | 'warning' | 'critical' | 'neutral';

export interface SystemsAutomationActivityMetric {
  label: string;
  value: string;
}

export interface SystemsAutomationActivityRecord {
  id: string;
  type: SystemsAutomationActivityType;
  actorType: 'manual' | 'cron' | 'system';
  statusLabel: string;
  tone: SystemsAutomationActivityTone;
  title: string;
  summary: string;
  createdAt: string;
  actionHref?: string | null;
  sourceKey?: string | null;
  metricItems: SystemsAutomationActivityMetric[];
}

export interface SystemsOperatorEscalationRecord {
  actorType: 'manual' | 'cron';
  status: 'sent' | 'failed';
  title: string;
  details: string;
  criticalCount: number;
  followupSourceKeys: string[];
  channelCount: number;
  channels: string[];
  createdAt: string;
}

export interface SystemsCommitmentShepherdRecord {
  actorType: 'manual' | 'cron';
  status: 'focus' | 'clear';
  title: string;
  summary: string;
  recommendedAction: string;
  commitmentId?: string | null;
  commitmentTitle?: string | null;
  commitmentStatus?: SystemsCommitmentStatus | null;
  owner?: string | null;
  dueDate?: string | null;
  reason?: 'blocked' | 'overdue' | null;
  actionHref?: string | null;
  createdAt: string;
}

export interface SystemsAutomationSummary {
  status: SystemsStatus;
  headline: string;
  currentValue: string;
  target: string;
  summary: string;
  lastSweepAt?: string | null;
}

export interface SystemsReviewDraft {
  actorType: 'manual' | 'cron';
  generatedAt: string;
  reviewDate: string;
  overallStatus: SystemsStatus;
  focusArea: string;
  topRisk: string;
  changeNotes: string;
  hardeningCommitmentTitle: string;
  hardeningCommitmentSummary: string;
  commitmentOwner: string;
  commitmentDueDate?: string | null;
  linkedSloIds: string[];
}

export interface SystemsPerformanceBaselineRecord {
  actorType: 'manual' | 'cron';
  loggedAt: string;
  baselineDate: string;
  environment: SystemsPerformanceBaselineEnvironment;
  scenarioLabel: string;
  concurrencyProfile: string;
  overallStatus: Exclude<SystemsStatus, 'bootstrap'>;
  summary: string;
  bottleneck: string;
  mitigationOwner: string;
  nextStep: string;
  artifactUrl?: string | null;
  notes?: string | null;
  apiHealthP95Ms: number;
  apiDrepsP95Ms: number;
  apiV1DrepsP95Ms: number;
  governanceHealthP95Ms: number;
  errorRatePct: number;
  maxObservedP95Ms: number;
  daysSinceBaseline: number;
  isStale: boolean;
}

export interface SystemsPerformanceBaselineSummary {
  status: SystemsStatus;
  headline: string;
  currentValue: string;
  target: string;
  summary: string;
  lastRecordedAt?: string | null;
  daysSinceBaseline?: number | null;
}

export interface SystemsTrustSurfaceReviewRecord {
  actorType: 'manual' | 'cron';
  loggedAt: string;
  reviewDate: string;
  overallStatus: Exclude<SystemsStatus, 'bootstrap'>;
  linkedSloIds: string[];
  reviewedSurfaces: string[];
  summary: string;
  currentUserState: string;
  honestyGap: string;
  nextFix: string;
  owner: string;
  artifactUrl?: string | null;
  notes?: string | null;
  daysSinceReview: number;
  isStale: boolean;
}

export interface SystemsTrustSurfaceReviewSummary {
  status: SystemsStatus;
  headline: string;
  currentValue: string;
  target: string;
  summary: string;
  lastReviewedAt?: string | null;
  daysSinceReview?: number | null;
  reviewRequired: boolean;
  linkedSloIds: string[];
}

export interface SystemsLaunchChecklistItem {
  id: string;
  title: string;
  decision: SystemsLaunchDecision;
  summary: string;
  threshold: string;
  evidence: string;
  href?: string;
}

export interface SystemsLaunchCadenceItem {
  day: string;
  focus: string;
  output: string;
  trigger: string;
}

export interface SystemsLaunchControlRoom {
  decision: SystemsLaunchDecision;
  headline: string;
  summary: string;
  currentCall: string;
  blockerCount: number;
  watchCount: number;
  checklist: SystemsLaunchChecklistItem[];
  blockers: string[];
  watchItems: string[];
  launchWeekCadence: SystemsLaunchCadenceItem[];
}

export interface SystemsScorecardReviewRecord {
  id: string;
  reviewDate: string;
  reviewedAt: string;
  overallStatus: SystemsStatus;
  focusArea: string;
  linkedSloIds: string[];
  commitmentTitle?: string | null;
  commitmentStatus?: SystemsCommitmentStatus | null;
}

export interface SystemsScorecardSync {
  status: SystemsStatus;
  headline: string;
  currentValue: string;
  target: string;
  summary: string;
  reviewCount: number;
  weeklyStreak: number;
  liveStatus: SystemsStatus;
  lastReviewStatus?: SystemsStatus | null;
  lastReviewedAt?: string | null;
  driftSloIds: string[];
  hotspotSloIds: string[];
  trend: SystemsScorecardTrend;
  recentReviews: SystemsScorecardReviewRecord[];
}

export interface SystemsIncidentRecord {
  id: string;
  loggedAt: string;
  incidentDate: string;
  entryType: SystemsIncidentType;
  severity: SystemsIncidentSeverity;
  status: SystemsIncidentStatus;
  title: string;
  summary: string;
  detectedBy: string;
  systemsAffected: string[];
  userImpact: string;
  rootCause: string;
  mitigation: string;
  permanentFix: string;
  followUpOwner: string;
  timeToAcknowledgeMinutes?: number | null;
  timeToMitigateMinutes?: number | null;
  timeToResolveMinutes?: number | null;
}

export interface SystemsIncidentSummary {
  status: SystemsStatus;
  headline: string;
  currentValue: string;
  target: string;
  summary: string;
  lastDrillAt?: string | null;
  lastIncidentAt?: string | null;
  openIncidentCount: number;
  drillCount: number;
  recentEntries: SystemsIncidentRecord[];
}

export interface SystemsDashboardData {
  generatedAt: string;
  overall: {
    status: SystemsStatus;
    headline: string;
    narrative: string;
    dataConfidence: SystemsConfidence;
  };
  story: {
    wins: string[];
    watchouts: string[];
    blockers: string[];
  };
  summary: {
    dependencyHealth: string;
    syncSuccessRate: string;
    integrityState: string;
    apiPerformance: string;
    criticalJourneyCoverage: string;
  };
  slos: SystemsSloCard[];
  promises: SystemsPromiseCard[];
  actions: SystemsAction[];
  reviewLoop: SystemsReviewLoop;
  reviewDiscipline: SystemsReviewDiscipline;
  scorecardSync: SystemsScorecardSync;
  incidentSummary: SystemsIncidentSummary;
  performanceBaselineSummary: SystemsPerformanceBaselineSummary;
  trustSurfaceReviewSummary: SystemsTrustSurfaceReviewSummary;
  launchControlRoom: SystemsLaunchControlRoom;
  automationSummary: SystemsAutomationSummary;
  automationFollowups: SystemsAutomationFollowup[];
  automationHistory: SystemsAutomationActivityRecord[];
  latestAutomationRun?: SystemsAutomationRunRecord | null;
  latestOperatorEscalation?: SystemsOperatorEscalationRecord | null;
  latestCommitmentShepherd?: SystemsCommitmentShepherdRecord | null;
  latestPerformanceBaseline?: SystemsPerformanceBaselineRecord | null;
  latestTrustSurfaceReview?: SystemsTrustSurfaceReviewRecord | null;
  suggestedReviewDraft?: SystemsReviewDraft | null;
  automationOpenCommitments: SystemsCommitmentCard[];
  openCommitments: SystemsCommitmentCard[];
  reviewHistory: SystemsReviewRecord[];
  incidentHistory: SystemsIncidentRecord[];
  performanceBaselineHistory: SystemsPerformanceBaselineRecord[];
  trustSurfaceReviewHistory: SystemsTrustSurfaceReviewRecord[];
  journeys: SystemsJourney[];
  automationCandidates: AutomationCandidate[];
  quickLinks: QuickLink[];
}

export const SYSTEMS_SLO_IDS = [
  'availability',
  'freshness',
  'correctness',
  'performance',
  'journeys',
] as const;

export const CRITICAL_JOURNEYS: SystemsJourney[] = [
  {
    id: 'J01',
    title: 'Land on home and see a working shell',
    persona: 'Anonymous citizen',
    gateLevel: 'L0',
    coverage: 'automated',
    whyItMatters: 'If the first screen fails, no other promise matters.',
    currentEvidence: 'Smoke + navigation E2E cover home shell and health reachability.',
    gap: 'Shell-only confidence; does not prove deeper personalized flows.',
    nextStep: 'Keep in the minimum pre-merge gate.',
  },
  {
    id: 'J02',
    title: 'Browse DReps and open a profile',
    persona: 'Anonymous citizen',
    gateLevel: 'L0',
    coverage: 'automated',
    whyItMatters: 'Discovery is a core launch promise for new users.',
    currentEvidence: 'Discover E2E covers browse state and profile navigation.',
    gap: 'Assertions are light on the actual content quality once a profile loads.',
    nextStep: 'Keep in the minimum pre-merge gate and deepen one profile assertion later.',
  },
  {
    id: 'J03',
    title: 'Browse proposals and open proposal detail',
    persona: 'Anonymous citizen',
    gateLevel: 'L0',
    coverage: 'automated',
    whyItMatters: 'Governance transparency has to work without account friction.',
    currentEvidence: 'Proposal E2E covers list rendering and detail navigation.',
    gap: 'Does not yet assert the most important intelligence blocks on detail pages.',
    nextStep: 'Keep in the minimum pre-merge gate and add a stronger detail assertion.',
  },
  {
    id: 'J04',
    title: 'Start Quick Match and progress through the quiz',
    persona: 'Anonymous citizen',
    gateLevel: 'L0',
    coverage: 'automated',
    whyItMatters: 'Match is one of the clearest value propositions at launch.',
    currentEvidence: 'Quick Match E2E covers redirect, start, and interaction.',
    gap: 'Does not yet verify result quality or persistence.',
    nextStep: 'Keep in the minimum pre-merge gate and add one result-state assertion.',
  },
  {
    id: 'J05',
    title: 'Health endpoint responds and shell does not hard fail',
    persona: 'Public platform',
    gateLevel: 'L0',
    coverage: 'automated',
    whyItMatters: 'Operational reachability is the base layer of trust.',
    currentEvidence: 'Smoke E2E + health API tests.',
    gap: 'Does not capture every degraded dependency path.',
    nextStep: 'Keep in the minimum pre-merge gate and pair with post-deploy smoke.',
  },
  {
    id: 'J06',
    title: 'Key public pages load without render-loop or console failure',
    persona: 'Anonymous citizen',
    gateLevel: 'L0',
    coverage: 'automated',
    whyItMatters: 'Obvious runtime breakage erodes trust immediately.',
    currentEvidence: 'Navigation E2E includes a console error guard.',
    gap: 'Coverage is sample-based, not exhaustive.',
    nextStep: 'Keep in the minimum pre-merge gate on the public path set.',
  },
  {
    id: 'J07',
    title: 'View delegation and governance coverage state',
    persona: 'Delegated citizen',
    gateLevel: 'L1',
    coverage: 'partial',
    whyItMatters: "Delegated citizens need to trust the product's representation view.",
    currentEvidence:
      'Coverage logic is shipped and verified in the build manifest, with lower-layer tests.',
    gap: 'No dedicated browser-level journey proves the delegated citizen read path.',
    nextStep: 'Add a targeted read-path test or manual launch checklist item.',
  },
  {
    id: 'J08',
    title: 'Authenticate and enter the personalized product',
    persona: 'Wallet user',
    gateLevel: 'L1',
    coverage: 'partial',
    whyItMatters: 'If auth is flaky, the personalized product feels unsafe.',
    currentEvidence: 'Auth API tests and wallet modal component tests exist.',
    gap: 'No deterministic browser-level auth flow runs in CI.',
    nextStep: 'Keep lower-layer coverage and build a deterministic browser harness later.',
  },
  {
    id: 'J09',
    title: 'Open DRep workspace review queue and inspect proposal intelligence',
    persona: 'DRep operator',
    gateLevel: 'L1',
    coverage: 'manual',
    whyItMatters: 'The workspace is a launch-critical trust surface for serious operators.',
    currentEvidence:
      'Workspace features are shipped and covered by lower-layer tests and manifest verification.',
    gap: 'No browser-level read journey proves the queue and intelligence blocks together.',
    nextStep: 'Create seeded or sandboxed workspace read E2E.',
  },
  {
    id: 'J10',
    title: 'Vote and submit rationale',
    persona: 'DRep operator',
    gateLevel: 'L1',
    coverage: 'manual',
    whyItMatters: 'This is one of the highest-stakes product actions.',
    currentEvidence: 'Lower-layer tests and shipped feature verification exist.',
    gap: 'On-chain and auth dependencies make deterministic CI coverage hard today.',
    nextStep: 'Keep manual pre-ship smoke until a harness exists.',
  },
  {
    id: 'J11',
    title: 'Create, review, and advance a proposal draft',
    persona: 'Proposal author',
    gateLevel: 'L1',
    coverage: 'manual',
    whyItMatters:
      'The authoring workspace must be dependable before it becomes a core growth loop.',
    currentEvidence: 'Feature-flagged authoring pipeline and lower-layer tests exist.',
    gap: 'No journey-level automation proves the full authoring loop.',
    nextStep: 'Add staging or sandbox verification before treating as fully protected.',
  },
  {
    id: 'J12',
    title: 'Detect stale sync or dependency degradation and know what to do',
    persona: 'Founder/operator',
    gateLevel: 'L1',
    coverage: 'partial',
    whyItMatters: 'Launch confidence depends on fast operator detection and action.',
    currentEvidence: 'Runbook, health endpoints, pipeline and integrity surfaces exist.',
    gap: 'No recurring drill cadence yet proves operator readiness.',
    nextStep: 'Start the failure drill program and incident log cadence.',
  },
  {
    id: 'J13',
    title: 'Core public pages meet basic accessibility expectations',
    persona: 'Anonymous citizen',
    gateLevel: 'L0',
    coverage: 'automated',
    whyItMatters: 'Premium UX includes accessibility and trustworthiness.',
    currentEvidence: 'A11y E2E covers key pages plus DRep and proposal detail.',
    gap: 'Coverage is still key-page based, not exhaustive.',
    nextStep: 'Keep in the minimum pre-merge gate for public pages.',
  },
  {
    id: 'J14',
    title: 'Major public surfaces avoid obvious visual regressions',
    persona: 'All public users',
    gateLevel: 'L2',
    coverage: 'partial',
    whyItMatters:
      'Visual polish affects premium feel, but should not create constant false alarms.',
    currentEvidence: 'Visual regression spec exists.',
    gap: 'Too noisy to be a universal PR blocker today.',
    nextStep: 'Keep advisory until flake and noise are low enough.',
  },
];

export const AUTOMATION_CANDIDATES: AutomationCandidate[] = [];

export const SYSTEMS_QUICK_LINKS: QuickLink[] = [
  {
    label: 'Launch control room',
    href: '/admin/systems#launch-control-room',
    description: 'Go or no-go call, blockers, watch items, and launch-week cadence.',
  },
  {
    label: 'Pipeline',
    href: '/admin/pipeline',
    description: 'Sync failures, stale runs, throughput, and recent errors.',
  },
  {
    label: 'Integrity',
    href: '/admin/integrity',
    description: 'Vote power coverage, reconciliation, summaries, and mismatch rates.',
  },
  {
    label: 'Governance',
    href: '/admin/governance',
    description: 'Tracked governance entities, GHI trends, and dataset growth.',
  },
  {
    label: 'Overview',
    href: '/admin',
    description: 'High-level operational snapshot and sync activity.',
  },
];

export function statusRank(status: SystemsStatus): number {
  switch (status) {
    case 'critical':
      return 3;
    case 'warning':
      return 2;
    case 'bootstrap':
      return 1;
    default:
      return 0;
  }
}

export function worstStatus(statuses: SystemsStatus[]): SystemsStatus {
  return statuses.reduce<SystemsStatus>((current, next) => {
    return statusRank(next) > statusRank(current) ? next : current;
  }, 'good');
}

export function summarizeJourneyCoverage(journeys: SystemsJourney[]) {
  const criticalJourneys = journeys.filter((journey) => journey.gateLevel !== 'L2');
  const automatedCount = criticalJourneys.filter(
    (journey) => journey.coverage === 'automated',
  ).length;
  const partialCount = criticalJourneys.filter((journey) => journey.coverage === 'partial').length;
  const totalCount = criticalJourneys.length;
  const percent = totalCount === 0 ? 0 : Math.round((automatedCount / totalCount) * 100);

  let status: SystemsStatus = 'critical';
  if (percent >= 80) status = 'good';
  else if (percent >= 40 || automatedCount + partialCount >= Math.ceil(totalCount / 2))
    status = 'warning';

  return {
    automatedCount,
    partialCount,
    totalCount,
    percent,
    status,
  };
}
