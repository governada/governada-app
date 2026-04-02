# Governada Systems Operating System

**Status:** Active
**Date:** 2026-04-02
**Context:** Governada already has meaningful foundations for audits, runbooks, deploy verification, health checks, and load testing. This document turns those capabilities into a single operating model so product quality, reliability, and trust improve on purpose rather than by accident.

---

## Strategic Frame

Governada is not only shipping pages, APIs, and background jobs. It is shipping trust in governance data, trust in methodology, trust in recommendation quality, trust in representative workflows, and trust that the product behaves honestly when the system is degraded.

For this product, "systems" means the full set of control loops that protect those promises:

1. Product promises and user trust
2. Methodology and intelligence governance
3. Data integrity and freshness
4. Runtime reliability, performance, and cost discipline
5. Security, abuse resistance, and operational safety
6. Release, incident, and rollback execution
7. Learning loops that turn usage and failures into product improvement

The bar is not "add more process." The bar is "increase confidence without crushing speed."

---

## System Map

| System                              | Why it matters                                                                                      | Primary questions                                                                                                        | Existing anchors                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Product promise system              | Users need to know what Governada is promising and when it is safe to rely on the product           | What is the product guaranteeing? What is the degraded-mode behavior? What is the honest fallback when certainty is low? | `docs/strategy/context/build-manifest.md`, `docs/strategy/context/ux-constraints.md`                       |
| Methodology governance              | Scoring, alignment, and AI narratives are core product truth, not implementation details            | What changed? Why did it change? How was it validated? Can it be reproduced or rolled back?                              | `lib/scoring/`, `lib/alignment/`, `docs/strategy/context/audit-rubric.md`                                  |
| Data integrity and freshness        | The app is only as good as the pipeline from Koios through sync through Supabase through scoring    | Is the data current? Is it complete? Is it internally consistent? Can anomalies be detected before users notice?         | `docs/runbook.md`, `app/api/health/deep/route.ts`, `scripts/validate-integrity.ts`                         |
| Runtime reliability and performance | Reliability is part of UX, especially for public browse, match, and workspace journeys              | Are key routes fast enough? Are APIs resilient? Do failure modes degrade safely?                                         | `.github/workflows/ci.yml`, `.github/workflows/post-deploy.yml`, `docs/operations/performance-baseline.md` |
| Security and abuse resistance       | Wallet auth, API access, rate limits, and admin actions must stay trustworthy under load and attack | What can be abused? What happens when dependencies fail? Are privileged actions observable and constrained?              | `lib/api/rateLimit.ts`, `instrumentation.ts`, `docs/observability-setup.md`                                |
| Release and incident execution      | Shipping quickly only works if bad changes are detected, contained, and learned from                | How risky is a change? What verification is required? What is the rollback path?                                         | `CLAUDE.md`, `scripts/pre-merge-check.sh`, `scripts/rollback.sh`                                           |
| Learning loop                       | Product quality compounds only if signals from users, analytics, and incidents reach the roadmap    | Which journeys are succeeding? Where is trust breaking? Which system deserves the next hardening cycle?                  | PostHog, Sentry, audits, strategy docs                                                                     |

---

## Non-Negotiable Service Promises

These are the promises the product should be operated against. Every significant change should name which promise it helps or risks.

| Promise                     | Launch bar                                                                                                  | World-class bar                                                                  | Evidence source                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Public availability         | `governada.io` and deep health remain healthy or degraded, not critical, for 99.5% of 30-day windows        | 99.9%+ with clear component-level status and no silent degradations              | BetterStack, `/api/health`, `/api/health/deep`              |
| Data freshness              | No critical sync type is stale by more than one schedule interval plus 15 minutes                           | Critical data under 5 minutes, all freshness breaches auto-detected and surfaced | Sync freshness checks, health endpoints, Inngest monitoring |
| Correctness of intelligence | Zero unreviewed scoring or methodology changes reach production                                             | Versioned methodology, reproducible validation, and published quality metrics    | Audit reports, methodology changelog, integrity checks      |
| Critical journey success    | Match, browse, proposal read, and DRep workspace read paths succeed at >99% request-level success           | >99.7% with pre-merge gated journeys and failure drill coverage                  | Playwright, smoke tests, Sentry transactions                |
| Performance                 | Key pages hit p75 LCP < 2.5s and key APIs hit p95 < 500ms at launch baseline                                | p75 LCP < 1.5s, p95 APIs < 250ms, proactive capacity planning                    | Sentry Web Vitals, k6 baselines, bundle reports             |
| Change safety               | Fewer than 15% of deploys need hotfix or rollback                                                           | Fewer than 5% with reliable risk-based gates                                     | CI history, post-deploy results, incident log               |
| Incident response           | Acknowledge P1 issues in <15 minutes and mitigate in <60 minutes during active launch windows               | Acknowledge in <5 minutes, mitigate in <30 minutes, with practiced drills        | Alert logs, runbook timestamps, incident log                |
| User honesty                | When data is stale or a dependency is degraded, the UI is explicit instead of pretending everything is fine | Graceful degraded UX is designed for every critical surface                      | Banners, status cards, audits, product review               |

These promises should become the weekly operating scorecard.

---

## Launch Scorecard

Use this scorecard in the weekly systems review. Green means within bar, yellow means at risk, red means breaching or untrusted.

| Dimension         | Metric                                          | Green                        | Yellow                                 | Red                                    |
| ----------------- | ----------------------------------------------- | ---------------------------- | -------------------------------------- | -------------------------------------- |
| Availability      | 30-day uptime and current health status         | >=99.5% and no critical deps | 99.0-99.49% or repeated degraded state | <99.0% or critical state               |
| Freshness         | Critical sync age vs expected schedule          | Within schedule + 15m        | One breach in a week                   | Multiple breaches or unknown freshness |
| Correctness       | Open integrity anomalies older than 24h         | 0                            | 1                                      | 2+                                     |
| Performance       | p75 LCP / p95 key API latency                   | Under launch bar             | Within 20% of bar                      | Worse than bar                         |
| Change safety     | Deploys needing hotfix/rollback in last 30 days | 0-1                          | 2                                      | 3+                                     |
| Test health       | Critical journey suite pass rate                | 100%                         | 95-99%                                 | <95% or flaky                          |
| Incident response | Time to acknowledge / mitigate                  | Within target                | Missed once                            | Repeated misses                        |
| User trust        | Known stale-data or misleading UX issues        | 0                            | 1 known issue with mitigation          | 2+ or unresolved critical issue        |

---

## Agent Role Model

Agents should be treated as role players inside a control loop, not as generic task executors.

| Role            | Mission                                                                                  | Default output                                           |
| --------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Strategist      | Define the user promise, business importance, and system boundary before work starts     | Short spec with promise, constraints, and success metric |
| Architect       | Identify invariants, failure modes, data contracts, and verification needs               | Design note or implementation brief                      |
| Builder         | Implement the change with the smallest safe blast radius                                 | PR-sized code/doc change                                 |
| Breaker         | Attack the proposal for correctness, regressions, abuse risk, and degraded-mode failures | Findings list ordered by severity                        |
| Verifier        | Confirm behavior with tests, measurement, and manual journey checks                      | Verification report with pass/fail evidence              |
| Release captain | Control merge, deploy, post-deploy verification, and rollback if needed                  | Release decision and deploy notes                        |
| Scribe          | Keep the operating docs, runbooks, scorecards, and follow-ups current                    | Updated docs and follow-up log                           |

For risky work, the same agent should not be both Builder and final Verifier. A solo founder can still move fast, but every risky change needs at least one adversarial pass.

---

## Standard Workflow For Agentic Development

### 1. Intake

Every non-trivial task starts with a short systems brief:

```md
Change:
User promise affected:
Systems touched:
Risk class:
New invariant(s):
Failure mode(s):
Telemetry required:
Verification plan:
Rollback plan:
```

If an agent cannot fill this in, the task is under-specified.

### 2. Risk Classification

Use the highest matching class:

| Class | Examples                                                                                                                       | Required gates                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| R1    | Docs, copy, non-functional refactors, cosmetic UI                                                                              | Lint/format as needed, visual spot-check if UI                                                                                  |
| R2    | Read-only UI changes, non-critical analytics, small workflow improvements                                                      | Type-check, targeted tests, manual journey check                                                                                |
| R3    | Critical journeys, public API behavior, cache behavior, performance-sensitive routes, feature flags                            | Type-check, targeted tests, critical-path manual verification, adversarial review, post-deploy watch                            |
| R4    | Auth, migrations, sync pipeline, scoring/methodology, security, incident response, admin tools, writes to important data paths | Explicit design note, focused tests, adversarial review, rollback plan, runbook update, post-deploy validation, follow-up audit |

When in doubt, classify upward.

### 3. Build By System Boundary

Split work into PR-sized chunks by responsibility:

- Data integrity and pipeline
- Runtime and observability
- Critical user journey
- Methodology / scoring
- Security / admin
- Documentation / runbook / scorecard

Do not split work by arbitrary file count. The goal is isolated blast radius and clear ownership.

### 4. Mandatory Breaker Pass

Before merge on R3/R4 work, assign a breaker pass that asks:

1. What could silently corrupt data?
2. What could mislead the user while technically "working"?
3. What fails if Redis, Koios, Supabase, or Inngest is degraded?
4. What becomes flaky under concurrency or retry behavior?
5. What did the builder assume without evidence?

### 5. Verification

Verification should match the change:

- Unit/integration tests for behavior
- Health, smoke, and journey checks for live paths
- Load or latency measurement for performance-sensitive changes
- Integrity validation for data and methodology changes
- Screenshot or manual UI pass for experience-critical changes

### 6. Release

The release decision should answer:

1. Is the risk class satisfied?
2. Is the rollback path known and still valid?
3. Did post-deploy verification complete?
4. Does this change require a follow-up audit or instrumentation update?

### 7. Learn

Every incident, near miss, or surprising regression should update at least one of:

- Runbook
- Scorecard
- Test suite
- Risk classification examples
- Follow-up backlog

If nothing changed after a failure, the system did not learn.

---

## Operating Cadence

### Daily

Goal: detect drift before users do.

- Review CI, post-deploy verification, and open failures
- Check Sentry production issues and health endpoints
- Check sync freshness and any stale-data banners
- Review top user-facing anomalies or support notes
- Decide whether the highest-value work today is feature work, hardening, or remediation

### Weekly

Goal: keep the scorecard honest and reprioritize based on evidence.

- Update the Launch Scorecard
- Review the top 3 system risks
- Review critical journey regressions and flaky tests
- Review slow endpoints and bundle drift
- Choose one systems-hardening chunk for the next week even if features are shipping

### Monthly

Goal: practice for launch and reduce hidden fragility.

- Run `/audit-all quick` or equivalent cross-system review
- Run one failure drill
- Review incident log and repeat offenders
- Revisit SLOs and thresholds using real production evidence
- Cut stale work from the backlog that does not move a scorecard dimension

### Before Launch

Goal: operate like launch has already happened.

- Convert the scorecard into a go/no-go checklist
- Freeze risky methodology changes unless directly needed
- Run adversarial review on critical journeys and trust surfaces
- Rehearse rollback and stale-data communication
- Verify alert routes actually reach the founder fast enough

---

## Required Operating Artifacts

These artifacts should stay live. If they drift out of date, the operating system weakens.

| Artifact                                            | Purpose                                              | Current state                  |
| --------------------------------------------------- | ---------------------------------------------------- | ------------------------------ |
| `docs/strategy/context/strategic-state.md`          | Strategic memory for future sessions                 | Exists                         |
| `docs/strategy/context/audit-rubric.md`             | Repeatable scoring framework                         | Exists                         |
| `docs/runbook.md`                                   | Operational recovery steps                           | Exists                         |
| `docs/observability-setup.md`                       | Alerting/dashboard setup                             | Exists                         |
| `docs/operations/performance-baseline.md`           | Performance/load baseline and bottlenecks            | Exists                         |
| `docs/strategy/context/systems-operating-system.md` | Core systems operating model                         | New in this plan               |
| `docs/operations/systems-scorecard.md`              | Ongoing operating review                             | Created                        |
| `docs/operations/incident-log.md`                   | Record of real failures, mitigations, and lessons    | Created                        |
| `docs/operations/methodology-changelog.md`          | Version history for scoring/alignment logic          | Created                        |
| Data contract and reconciliation ledger             | Critical source -> transform -> storage expectations | Must be created and maintained |

---

## Recommended Recurring Agent Loops

These are the default loops to run as a solo founder.

### Daily Systems Sweep

Use when deciding what deserves attention today.

```
Act as Governada's reliability lead. Review the current status of CI, post-deploy verification,
health endpoints, sync freshness, Sentry issues, and any recent incidents or regressions.
Output:
1. Overall status: green/yellow/red
2. Top 3 risks by user impact
3. What should be fixed before more feature work
4. What can safely wait
```

### Weekly Systems Review

Use to update the scorecard and steer the backlog.

```
Act as Governada's CTO for systems excellence. Update the weekly scorecard against the launch bars
in systems-operating-system.md. Identify the largest current gap, the highest-leverage hardening task,
and the one feature or process we should stop doing if it hurts reliability.
```

### Adversarial Pre-Ship Review

Use on any R3 or R4 change.

```
Review this change as an adversary. Ignore style. Look for silent data corruption, stale-data exposure,
auth or permission mistakes, flaky behavior under retry/concurrency, misleading UX during degraded states,
and rollback weaknesses. Findings first, ordered by severity, with evidence.
```

### Monthly Failure Drill

Use to rehearse a bad day before launch.

```
Pick one failure mode in Governada's critical path and run a tabletop drill:
Koios outage, Supabase degradation, Redis outage, broken sync transform, failed deploy,
or stale intelligence output. Document detection path, user impact, mitigation steps, gaps,
and what must change in code, runbook, alerts, or UX.
```

---

## Decision Rule

When there is tension between feature speed and systems quality, ask:

1. Does this work increase or decrease trust in a core promise?
2. Does it make a future failure easier or harder to detect?
3. Does it reduce or increase hidden operational load on the founder?
4. Would I still ship this if launch traffic arrived tomorrow?

If the answer is wrong on trust, detection, or operational load, the work is not ready.
