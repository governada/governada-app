import {
  CRITICAL_JOURNEYS,
  summarizeJourneyCoverage,
  type SystemsAction,
  type SystemsConfidence,
  type SystemsPromiseCard,
  type SystemsJourney,
  type SystemsStatus,
  worstStatus,
} from '@/lib/admin/systems';

export interface PromiseInput {
  availability: {
    status: SystemsStatus;
    summary: string;
    value: string;
  };
  freshness: {
    status: SystemsStatus;
    summary: string;
    value: string;
  };
  correctness: {
    status: SystemsStatus;
    summary: string;
    value: string;
  };
  performance: {
    status: SystemsStatus;
    summary: string;
    value: string;
  };
  changeSafety: {
    status: SystemsStatus;
    summary: string;
    value: string;
  };
  incidentResponse: {
    status: SystemsStatus;
    summary: string;
    value: string;
  };
  userHonesty: {
    status: SystemsStatus;
    summary: string;
    value: string;
  };
}

export function buildPromiseCards(
  input: PromiseInput,
  journeys: SystemsJourney[] = CRITICAL_JOURNEYS,
) {
  const coverage = summarizeJourneyCoverage(journeys);

  const cards: SystemsPromiseCard[] = [
    {
      id: 'availability',
      title: 'Availability',
      status: input.availability.status,
      confidence: 'live',
      metricLabel: 'Dependency health',
      currentValue: input.availability.value,
      target: 'Healthy or degraded, never critical',
      summary: input.availability.summary,
      actionLabel: 'Inspect pipeline',
      actionHref: '/admin/pipeline',
    },
    {
      id: 'freshness',
      title: 'Data freshness',
      status: input.freshness.status,
      confidence: 'live',
      metricLabel: 'Freshness window',
      currentValue: input.freshness.value,
      target: 'Fast < 90m, full < 26h',
      summary: input.freshness.summary,
      actionLabel: 'Open integrity',
      actionHref: '/admin/integrity',
    },
    {
      id: 'correctness',
      title: 'Intelligence correctness',
      status: input.correctness.status,
      confidence: 'live',
      metricLabel: 'Integrity state',
      currentValue: input.correctness.value,
      target: '0 critical integrity alerts',
      summary: input.correctness.summary,
      actionLabel: 'Review integrity',
      actionHref: '/admin/integrity',
    },
    {
      id: 'journeys',
      title: 'Critical journey success',
      status: coverage.status,
      confidence: 'partial',
      metricLabel: 'Automated coverage',
      currentValue: `${coverage.automatedCount}/${coverage.totalCount} critical journeys`,
      target: 'All L0 protected pre-merge; L1 deterministic where possible',
      summary:
        'Public entry, discovery, proposal, and match flows are covered. DRep and authoring flows still depend on lower-layer or manual verification.',
      actionLabel: 'Review journeys',
      actionHref: '/admin/systems#journeys',
    },
    {
      id: 'performance',
      title: 'Performance',
      status: input.performance.status,
      confidence: input.performance.status === 'bootstrap' ? 'bootstrap' : 'live',
      metricLabel: 'API and page speed',
      currentValue: input.performance.value,
      target: 'p95 key APIs < 500ms, LCP under launch bar',
      summary: input.performance.summary,
      actionLabel: 'Run baseline',
      actionHref: '/admin/systems#automation',
    },
    {
      id: 'change-safety',
      title: 'Change safety',
      status: input.changeSafety.status,
      confidence: 'bootstrap',
      metricLabel: 'Deploy discipline',
      currentValue: input.changeSafety.value,
      target: 'Reliable risk-based gates and post-deploy verification',
      summary: input.changeSafety.summary,
      actionLabel: 'Start weekly review',
      actionHref: '/admin/systems#actions',
    },
    {
      id: 'incident-response',
      title: 'Incident response',
      status: input.incidentResponse.status,
      confidence: 'bootstrap',
      metricLabel: 'Operator readiness',
      currentValue: input.incidentResponse.value,
      target: 'Alert, acknowledge, mitigate, learn',
      summary: input.incidentResponse.summary,
      actionLabel: 'Run first drill',
      actionHref: '/admin/systems#automation',
    },
    {
      id: 'user-honesty',
      title: 'User honesty',
      status: input.userHonesty.status,
      confidence: 'manual',
      metricLabel: 'Degraded-state clarity',
      currentValue: input.userHonesty.value,
      target: 'Users are told when confidence is reduced',
      summary: input.userHonesty.summary,
      actionLabel: 'Audit trust surfaces',
      actionHref: '/admin/integrity',
    },
  ];

  return { cards, coverage };
}

export function buildOverallNarrative(promises: SystemsPromiseCard[]): {
  status: SystemsStatus;
  headline: string;
  narrative: string;
  dataConfidence: SystemsConfidence;
} {
  const status = worstStatus(promises.map((promise) => promise.status));
  const criticalCount = promises.filter((promise) => promise.status === 'critical').length;
  const warningCount = promises.filter((promise) => promise.status === 'warning').length;
  const bootstrapCount = promises.filter((promise) => promise.status === 'bootstrap').length;

  if (status === 'critical') {
    return {
      status,
      headline: 'Act now on live system risk',
      narrative:
        criticalCount === 1
          ? 'One launch-critical promise is currently red. Address the live dependency, freshness, or correctness issue before relying on normal feature velocity.'
          : `${criticalCount} launch-critical promises are currently red. This is a stabilization moment, not a feature moment.`,
      dataConfidence: 'live',
    };
  }

  if (warningCount >= 1 || bootstrapCount >= 2) {
    return {
      status: 'warning',
      headline: 'Foundations are strong, but launch discipline is still uneven',
      narrative:
        'Governada already has real health, integrity, and public-path test coverage. The biggest gap is that operator-grade workflows and weekly operating loops are not yet fully hardened or automated.',
      dataConfidence: 'partial',
    };
  }

  return {
    status: 'good',
    headline: 'Systems posture looks strong right now',
    narrative:
      'Core promises are currently green, and the remaining work is mostly about deepening automation and keeping the operating loop disciplined.',
    dataConfidence: 'partial',
  };
}

export function buildRecommendedActions(promises: SystemsPromiseCard[]): SystemsAction[] {
  const actions: SystemsAction[] = [];

  const availability = promises.find((promise) => promise.id === 'availability');
  const correctness = promises.find((promise) => promise.id === 'correctness');
  const journeys = promises.find((promise) => promise.id === 'journeys');
  const performance = promises.find((promise) => promise.id === 'performance');
  const incidentResponse = promises.find((promise) => promise.id === 'incident-response');
  const changeSafety = promises.find((promise) => promise.id === 'change-safety');

  if (availability && availability.status !== 'good') {
    actions.push({
      id: 'stabilize-dependencies',
      title: 'Stabilize live dependencies',
      priority: 'P0',
      timeframe: 'now',
      summary: availability.summary,
      href: '/admin/pipeline',
      automationReady: true,
    });
  }

  if (correctness && correctness.status !== 'good') {
    actions.push({
      id: 'resolve-integrity-alerts',
      title: 'Resolve integrity alerts before more feature work',
      priority: 'P0',
      timeframe: 'now',
      summary: correctness.summary,
      href: '/admin/integrity',
      automationReady: true,
    });
  }

  if (journeys && journeys.status !== 'good') {
    actions.push({
      id: 'wire-premerge-gate',
      title: 'Lock the minimum pre-merge critical-path gate',
      priority: 'P0',
      timeframe: 'this-week',
      summary:
        'Public launch flows are covered, but DRep and authoring surfaces still rely too much on manual or lower-layer verification.',
      href: '/admin/systems#journeys',
      automationReady: false,
    });
  }

  if (performance && performance.status !== 'good') {
    actions.push({
      id: 'record-baseline',
      title: 'Run and record the first performance baseline',
      priority: performance.status === 'critical' ? 'P0' : 'P1',
      timeframe: 'this-week',
      summary: performance.summary,
      href: '/admin/systems#automation',
      automationReady: true,
    });
  }

  if (incidentResponse && incidentResponse.status !== 'good') {
    actions.push({
      id: 'run-first-drill',
      title: 'Start the failure drill and incident loop',
      priority: 'P1',
      timeframe: 'foundation',
      summary: incidentResponse.summary,
      href: '/admin/systems#automation',
      automationReady: true,
    });
  }

  if (changeSafety && changeSafety.status !== 'good') {
    actions.push({
      id: 'start-weekly-scorecard',
      title: 'Use this page as a weekly scorecard, not just a dashboard',
      priority: 'P1',
      timeframe: 'foundation',
      summary: changeSafety.summary,
      href: '/admin/systems',
      automationReady: true,
    });
  }

  return actions.slice(0, 4);
}
