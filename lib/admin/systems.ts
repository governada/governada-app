export type SystemsStatus = 'good' | 'warning' | 'critical' | 'bootstrap';
export type SystemsConfidence = 'live' | 'partial' | 'manual' | 'bootstrap';
export type JourneyGateLevel = 'L0' | 'L1' | 'L2';
export type JourneyCoverage = 'automated' | 'partial' | 'manual';

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
  promises: SystemsPromiseCard[];
  actions: SystemsAction[];
  journeys: SystemsJourney[];
  automationCandidates: AutomationCandidate[];
  quickLinks: QuickLink[];
}

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

export const AUTOMATION_CANDIDATES: AutomationCandidate[] = [
  {
    id: 'systems-sweep',
    title: 'Daily systems sweep',
    trigger: 'Any promise turns red or the day starts without a fresh review.',
    action: 'Generate a founder-ready summary of health, freshness, integrity, and top risks.',
    whyItMatters: 'This can become a daily agent routine without changing the UI contract.',
  },
  {
    id: 'weekly-scorecard',
    title: 'Weekly scorecard refresh',
    trigger: 'Every Monday morning.',
    action:
      'Update the systems scorecard, summarize drift, and recommend the one highest-leverage hardening task.',
    whyItMatters: 'This turns the dashboard into a repeatable operating loop.',
  },
  {
    id: 'failure-drill',
    title: 'Monthly failure drill',
    trigger: 'Incident response remains bootstrap or no drill has been logged in 30 days.',
    action:
      'Run a tabletop for a dependency, data freshness, or deploy failure mode and log follow-up work.',
    whyItMatters: 'It converts passive runbooks into practiced launch readiness.',
  },
  {
    id: 'performance-baseline',
    title: 'Performance baseline rerun',
    trigger: 'Risky route or caching changes land without a fresh baseline.',
    action: 'Run the minimum k6 baseline and attach the result to the systems review.',
    whyItMatters: 'This lets performance discipline become an agentic maintenance loop.',
  },
];

export const SYSTEMS_QUICK_LINKS: QuickLink[] = [
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
