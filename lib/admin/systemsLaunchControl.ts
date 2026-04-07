import {
  summarizeJourneyCoverage,
  type SystemsAutomationFollowup,
  type SystemsAutomationSummary,
  type SystemsIncidentSummary,
  type SystemsJourney,
  type SystemsLaunchCadenceItem,
  type SystemsLaunchChecklistItem,
  type SystemsLaunchControlRoom,
  type SystemsLaunchDecision,
  type SystemsPerformanceBaselineSummary,
  type SystemsReviewDiscipline,
  type SystemsScorecardSync,
  type SystemsSloCard,
  type SystemsStatus,
  type SystemsTrustSurfaceReviewSummary,
} from '@/lib/admin/systems';

function statusToDecision(status: SystemsStatus): SystemsLaunchDecision {
  switch (status) {
    case 'good':
      return 'ready';
    case 'critical':
      return 'blocked';
    default:
      return 'risky';
  }
}

function worstDecision(decisions: SystemsLaunchDecision[]): SystemsLaunchDecision {
  if (decisions.includes('blocked')) return 'blocked';
  if (decisions.includes('risky')) return 'risky';
  return 'ready';
}

function buildLaunchWeekCadence(decision: SystemsLaunchDecision): SystemsLaunchCadenceItem[] {
  return [
    {
      day: 'Monday',
      focus: 'Re-read the launch call from the control room',
      output:
        decision === 'blocked'
          ? 'Explicit no-go call plus blocker owners'
          : decision === 'risky'
            ? 'Conditional launch call plus watch owners'
            : 'Confirmed go call plus watch plan',
      trigger: 'Before any feature or marketing work',
    },
    {
      day: 'Tuesday',
      focus: 'Clear the highest-risk blocker or watch item',
      output: 'One material hardening move and fresh evidence',
      trigger: 'After the Monday launch review',
    },
    {
      day: 'Wednesday',
      focus: 'Gate new work against the launch call',
      output: 'Only blocker-reducing changes continue',
      trigger: 'Any time scope tries to expand',
    },
    {
      day: 'Thursday',
      focus: 'Run adversarial verification and drill rehearsal',
      output: 'Breaker findings, rollback confidence, and trust-surface review',
      trigger: 'Before the final launch decision window',
    },
    {
      day: 'Friday',
      focus: 'Operate the ship window',
      output: 'Deploy decision, live health watch, and incident-response readiness',
      trigger: 'During launch or any launch-like release window',
    },
  ];
}

function findSlo(slos: SystemsSloCard[], id: string) {
  return slos.find((slo) => slo.id === id) ?? null;
}

function summarizeChecklist(items: SystemsLaunchChecklistItem[]) {
  return {
    blockers: items
      .filter((item) => item.decision === 'blocked')
      .map((item) => `${item.title}: ${item.summary}`),
    watchItems: items
      .filter((item) => item.decision === 'risky')
      .map((item) => `${item.title}: ${item.summary}`),
  };
}

export function buildSystemsLaunchControlRoom(input: {
  slos: SystemsSloCard[];
  journeys: SystemsJourney[];
  reviewDiscipline: SystemsReviewDiscipline;
  scorecardSync: SystemsScorecardSync;
  incidentSummary: SystemsIncidentSummary;
  performanceBaselineSummary: SystemsPerformanceBaselineSummary;
  trustSurfaceReviewSummary: SystemsTrustSurfaceReviewSummary;
  automationSummary: SystemsAutomationSummary;
  automationFollowups: SystemsAutomationFollowup[];
}): SystemsLaunchControlRoom {
  const availability = findSlo(input.slos, 'availability');
  const freshness = findSlo(input.slos, 'freshness');
  const correctness = findSlo(input.slos, 'correctness');
  const performance = findSlo(input.slos, 'performance');

  const coreDecision = worstDecision(
    [availability, freshness, correctness]
      .filter((item): item is SystemsSloCard => Boolean(item))
      .map((item) => statusToDecision(item.status)),
  );

  const journeyCoverage = summarizeJourneyCoverage(input.journeys);
  const l0Gaps = input.journeys.filter(
    (journey) => journey.gateLevel === 'L0' && journey.coverage !== 'automated',
  );
  const l1Manual = input.journeys.filter(
    (journey) => journey.gateLevel === 'L1' && journey.coverage === 'manual',
  );
  const journeyDecision =
    l0Gaps.length > 0
      ? 'blocked'
      : journeyCoverage.status === 'good' && l1Manual.length === 0
        ? 'ready'
        : 'risky';

  const operatorDecision = worstDecision([
    statusToDecision(input.reviewDiscipline.status),
    statusToDecision(input.incidentSummary.status),
    statusToDecision(input.automationSummary.status),
    input.automationFollowups.some((followup) => followup.severity === 'critical')
      ? 'blocked'
      : 'ready',
  ]);

  const performanceDecision = worstDecision([
    performance ? statusToDecision(performance.status) : 'risky',
    statusToDecision(input.performanceBaselineSummary.status),
  ]);
  const trustDecision = statusToDecision(input.trustSurfaceReviewSummary.status);
  const evidenceDecision = statusToDecision(input.scorecardSync.status);

  const checklist: SystemsLaunchChecklistItem[] = [
    {
      id: 'core-promises',
      title: 'Core service promises',
      decision: coreDecision,
      summary:
        coreDecision === 'ready'
          ? 'Availability, freshness, and correctness are within the launch bar right now.'
          : coreDecision === 'blocked'
            ? 'At least one core promise is red, so the product should not be treated as launch-safe.'
            : 'Core promises are not red, but at least one is close enough to the edge that the launch call still needs caution.',
      threshold: 'Availability, freshness, and correctness stay green. Any red bar blocks launch.',
      evidence: [availability, freshness, correctness]
        .filter((item): item is SystemsSloCard => Boolean(item))
        .map((item) => `${item.title}: ${item.currentValue}`)
        .join(' | '),
      href: '/admin/systems#slos',
    },
    {
      id: 'critical-journeys',
      title: 'Critical journeys',
      decision: journeyDecision,
      summary:
        journeyDecision === 'ready'
          ? 'All L0 journeys are automated, and the remaining L1 coverage is acceptable for launch.'
          : journeyDecision === 'blocked'
            ? 'At least one L0 launch path still lacks deterministic automation, so the launch surface is under-defended.'
            : 'Public launch paths are protected, but operator-grade journeys still rely too much on manual proof.',
      threshold:
        'All L0 journeys automated; L1 launch paths have explicit proof or an explicit manual launch check.',
      evidence: `${journeyCoverage.automatedCount}/${journeyCoverage.totalCount} automated | ${l0Gaps.length} L0 gaps | ${l1Manual.length} L1 manual`,
      href: '/admin/systems#journeys',
    },
    {
      id: 'performance-discipline',
      title: 'Performance discipline',
      decision: performanceDecision,
      summary:
        performanceDecision === 'ready'
          ? 'Live latency and the latest durable baseline both support the launch bar.'
          : performanceDecision === 'blocked'
            ? 'Performance is outside the launch bar or missing enough discipline that the launch surface is not trustworthy.'
            : 'Performance is not red, but the baseline or live signal still needs a named bottleneck fix or refresh.',
      threshold:
        'Key APIs under the launch bar and a current durable baseline attached to a named next step.',
      evidence: `${performance?.currentValue ?? 'No live performance card'} | Baseline: ${input.performanceBaselineSummary.currentValue}`,
      href: '/admin/systems#performance-baseline',
    },
    {
      id: 'operator-loop',
      title: 'Operator control loop',
      decision: operatorDecision,
      summary:
        operatorDecision === 'ready'
          ? 'Weekly review, incident response, and automation follow-through are current enough to support launch.'
          : operatorDecision === 'blocked'
            ? 'The operator loop is stale or carrying critical unresolved follow-ups, so the launch call is not credible yet.'
            : 'The operator loop exists, but one or more control loops still need fresher evidence or follow-through.',
      threshold:
        'Fresh weekly review, no unresolved critical follow-ups, and a practiced drill / incident loop.',
      evidence: `${input.reviewDiscipline.currentValue} | ${input.incidentSummary.currentValue} | ${input.automationSummary.currentValue}`,
      href: '/admin/systems#automation',
    },
    {
      id: 'user-honesty',
      title: 'Degraded-state honesty',
      decision: trustDecision,
      summary:
        trustDecision === 'ready'
          ? 'The current trust-surface review says the degraded user experience is honest enough for launch.'
          : trustDecision === 'blocked'
            ? 'The latest trust-surface review found a misleading degraded-state UX that should block launch until fixed.'
            : 'The degraded-state UX still has a known honesty gap or needs a fresher review before launch confidence is real.',
      threshold:
        'When launch-trust signals degrade, the UI is explicit and the latest review is still current.',
      evidence: input.trustSurfaceReviewSummary.currentValue,
      href: '/admin/systems#trust-surface-review',
    },
    {
      id: 'scorecard-evidence',
      title: 'Scorecard evidence freshness',
      decision: evidenceDecision,
      summary:
        evidenceDecision === 'ready'
          ? 'The durable scorecard is keeping up with the live cockpit, so the launch decision has current evidence.'
          : evidenceDecision === 'blocked'
            ? 'The live cockpit has drifted too far from the last durable review for a credible launch call.'
            : 'The live posture and the last durable review are not fully aligned yet, so the launch record still needs tightening.',
      threshold: 'The durable weekly review matches the live cockpit and keeps the streak intact.',
      evidence: input.scorecardSync.currentValue,
      href: '/admin/systems#operating-rhythm',
    },
  ];

  const decision = worstDecision(checklist.map((item) => item.decision));
  const { blockers, watchItems } = summarizeChecklist(checklist);

  return {
    decision,
    headline:
      decision === 'blocked'
        ? 'Launch is blocked right now'
        : decision === 'risky'
          ? 'Launch is possible, but still risky'
          : 'Launch looks ready right now',
    summary:
      decision === 'blocked'
        ? `${blockers.length} blocker${blockers.length === 1 ? '' : 's'} still need to clear before the launch call is credible.`
        : decision === 'risky'
          ? `No hard blocker is red right now, but ${watchItems.length} watch item${watchItems.length === 1 ? '' : 's'} still need explicit owner discipline before launch.`
          : 'No launch blocker is active right now. The launch call should still be protected by the launch-week operating cadence.',
    currentCall:
      decision === 'blocked'
        ? 'No-go until every blocked checklist item is green and the affected paths have been re-verified.'
        : decision === 'risky'
          ? 'Treat launch as conditional. Keep the call open only if each watch item has an owner, a mitigation, and a fresh verification pass.'
          : 'Go is reasonable if the launch-week cadence stays active and any new blocker stops the line immediately.',
    blockerCount: blockers.length,
    watchCount: watchItems.length,
    checklist,
    blockers,
    watchItems,
    launchWeekCadence: buildLaunchWeekCadence(decision),
  };
}
