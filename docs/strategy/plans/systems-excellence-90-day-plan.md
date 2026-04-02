# Systems Excellence 90-Day Plan

**Status:** Active plan
**Date:** 2026-04-02
**Primary context:** `docs/strategy/context/systems-operating-system.md`

---

## Objective

In 90 days, Governada should be operating with measurable confidence, not founder intuition.

That means:

- Core service promises are explicit and reviewed weekly
- Risky changes are classified and gated correctly
- Critical user journeys are tested before merge, not only after deploy
- Data freshness and integrity issues are detected before users report them
- Incidents, regressions, and near-misses produce permanent improvements
- Agents are working as a repeatable operating team, not as one-off helpers

---

## Day 90 Exit Criteria

By day 90, the following should be true:

1. The weekly systems scorecard has been updated for at least 6 consecutive weeks.
2. Every R3/R4 change uses the systems brief and risk classification.
3. A critical-path E2E suite gates the highest-risk merge paths pre-merge.
4. Data freshness and integrity checks cover the core sync -> Supabase -> intelligence path.
5. At least 3 failure drills have been run and documented.
6. There is a live incident log with actions taken and lessons learned.
7. Launch readiness can be judged from evidence in docs, dashboards, and test runs.

---

## Phase 1: Days 1-30 - Define The Bar

### Outcome

Governada stops using vague quality language and starts operating against declared promises, journeys, and risk classes.

### Required Deliverables

- Systems Operating System published and socialized
- Weekly systems scorecard template created
- Incident log created
- Methodology changelog created for scoring/alignment changes
- Critical journey matrix defined
- Risk classification and systems brief adopted for non-trivial work
- First weekly systems review completed

### Phase 1 Workstreams

#### Chunk 1: Weekly Scorecard And Incident Log

**Priority:** P0
**Effort:** S
**Audit dimension(s):** Performance & Reliability, Testing & Code Quality
**Expected score impact:** Performance & Reliability 6 -> 7, Testing & Code Quality 6 -> 7
**Depends on:** `systems-operating-system.md`
**PR group:** A

### Context

The repo has health checks, post-deploy verification, and observability guidance, but no single weekly operating record. Without a scorecard and incident log, the founder cannot tell whether the system is improving or merely changing.

### Scope

- Create a weekly scorecard document or template
- Create an incident log document with date, severity, impact, detection, mitigation, root cause, and follow-up fields
- Link both from the operating system doc

### Decision Points

None - execute directly.

### Verification

- Founder can update the scorecard in under 10 minutes
- New incidents can be logged in under 5 minutes

### Files To Read First

- `docs/strategy/context/systems-operating-system.md`
- `docs/runbook.md`
- `docs/observability-setup.md`

#### Chunk 2: Critical Journey Matrix

**Priority:** P0
**Effort:** M
**Audit dimension(s):** Citizen Experience, Governance Workspace, Performance & Reliability, Testing & Code Quality
**Expected score impact:** Citizen Experience 7 -> 8, Testing & Code Quality 6 -> 8
**Depends on:** None
**PR group:** B

### Context

Governada has broad feature depth, but pre-launch reliability depends on a small number of journeys that must not regress. Today the app has tests and post-merge E2E, but not an explicit matrix defining what is critical enough to gate before merge.

### Scope

- Define the canonical user journeys for anonymous citizen, delegated citizen, DRep reviewer, proposal author, and admin/operator
- Mark happy-path, degraded-mode, and recovery expectations
- Map each journey to existing or missing tests

### Decision Points

- Which journeys are true launch blockers versus important but non-blocking?

### Verification

- Every launch-critical surface has at least one owner journey
- Each journey has a named verification method

### Files To Read First

- `docs/strategy/context/build-manifest.md`
- `docs/strategy/context/ux-constraints.md`
- `playwright.config.ts`
- `.github/workflows/e2e.yml`

#### Chunk 3: Risk Classification Embedded In Build Workflow

**Priority:** P0
**Effort:** M
**Audit dimension(s):** Testing & Code Quality, Performance & Reliability
**Expected score impact:** Testing & Code Quality 6 -> 7
**Depends on:** `systems-operating-system.md`
**PR group:** C

### Context

The repo has strong norms, but verification depth still depends too much on memory. Risk class should drive the required proof for each change.

### Scope

- Add a reusable checklist or template for systems brief and risk class
- Integrate the checklist into the default working flow or PR flow
- Document required gates for R1-R4 work

### Decision Points

- Whether the checklist lives in PR template, docs, or both

### Verification

- A founder or agent can classify a change in under 2 minutes
- Required gates are obvious before implementation starts

### Files To Read First

- `CLAUDE.md`
- `docs/strategy/context/work-plan-template.md`
- `.github/workflows/ci.yml`

---

## Phase 2: Days 31-60 - Harden The Critical Path

### Outcome

Governada gains stronger evidence that its most important data flows and user journeys are correct under normal and degraded conditions.

### Required Deliverables

- Critical-path E2E suite running pre-merge for risky changes
- Data contract/reconciliation plan for core sync and scoring flows
- Methodology changelog in place
- Performance baseline executed with recorded numbers
- Alert thresholds tuned based on real evidence

### Phase 2 Workstreams

#### Chunk 4: Pre-Merge Critical Journey Gating

**Priority:** P0
**Effort:** L
**Audit dimension(s):** Testing & Code Quality, Performance & Reliability
**Expected score impact:** Testing & Code Quality 6 -> 8, Performance & Reliability 6 -> 7
**Depends on:** Chunk 2
**PR group:** D

### Context

Post-merge E2E is useful, but it is too late for the highest-risk regressions. A slim, stable set of critical journeys should run before merge on the changes that can hurt launch trust.

### Scope

- Identify the smallest reliable subset of Playwright tests that should gate risky PRs
- Wire those tests into CI or a dedicated pre-merge workflow
- Keep post-merge broader coverage for validation

### Decision Points

- Which specific journeys are stable enough to gate now

### Verification

- Risky PRs are blocked by critical-path failures before merge
- Flake rate is low enough that developers trust the gate

### Files To Read First

- `.github/workflows/ci.yml`
- `.github/workflows/e2e.yml`
- `e2e/`

#### Chunk 5: Data Contract And Reconciliation Ledger

**Priority:** P0
**Effort:** L
**Audit dimension(s):** Data Architecture & Compounding, Intelligence Engine Quality
**Expected score impact:** Data Architecture & Compounding 7 -> 8, Intelligence Engine Quality 7 -> 8
**Depends on:** None
**PR group:** E

### Context

The product moat is its data and intelligence engine. The next level is making source expectations, transforms, and reconciliation checks explicit so silent drift becomes visible.

### Scope

- Document the core source -> transform -> storage contracts for proposals, votes, DRep scores, and alignment outputs
- Define reconciliation checks and owners
- Identify which checks can be automated immediately versus later

### Decision Points

- Which entities are launch-critical enough to receive first-class reconciliation now

### Verification

- For each critical dataset, the expected freshness, completeness, and validation rule are documented
- At least one new automated or scriptable reconciliation pass exists for a critical dataset

### Files To Read First

- `docs/runbook.md`
- `scripts/validate-integrity.ts`
- `app/api/health/deep/route.ts`
- `lib/scoring/`
- `lib/alignment/`
- `lib/sync/`

#### Chunk 6: Methodology Governance

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Intelligence Engine Quality, Product Completeness vs. Vision
**Expected score impact:** Intelligence Engine Quality 7 -> 8
**Depends on:** Chunk 5
**PR group:** F

### Context

Changes to scoring, alignment, and AI interpretation are product changes, not invisible refactors. They need versioning, justification, and before/after validation.

### Scope

- Create a methodology changelog
- Define required evidence for scoring/alignment changes
- Document rollback expectations for bad methodology updates

### Decision Points

- How much validation is mandatory before launch versus post-launch research depth

### Verification

- A scoring change cannot be described only as "improved logic"
- A future agent can reconstruct why a methodology change shipped

### Files To Read First

- `docs/strategy/context/audit-rubric.md`
- `lib/scoring/`
- `lib/alignment/`

#### Chunk 7: Performance Budget And Baseline

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Performance & Reliability
**Expected score impact:** Performance & Reliability 6 -> 7
**Depends on:** None
**PR group:** G

### Context

The repo already has load scenarios and a baseline document, but the numbers are not yet an active operating input. Launch needs real baselines, budgets, and a plan for the most expensive paths.

### Scope

- Run and record current k6 baselines
- Set explicit budgets for key APIs and public pages
- Document the top 3 current bottlenecks and chosen mitigations

### Decision Points

- Which budgets are strict blockers before launch and which are watch items

### Verification

- `docs/operations/performance-baseline.md` contains real numbers
- At least one bottleneck has a chosen mitigation owner

### Files To Read First

- `docs/operations/performance-baseline.md`
- `.github/workflows/load-test.yml`
- `tests/load/scenarios/`

---

## Phase 3: Days 61-90 - Operate Like Launch Already Happened

### Outcome

Governada behaves like a disciplined launch candidate: the team rehearses failure, tracks scorecard drift, and can make a launch decision from evidence.

### Required Deliverables

- Monthly failure drill cadence started
- Rollback and stale-data communication rehearsed
- Launch control room / go-no-go checklist created
- At least one end-to-end systems review completed against the new operating model

### Phase 3 Workstreams

#### Chunk 8: Failure Drill Program

**Priority:** P1
**Effort:** S
**Audit dimension(s):** Performance & Reliability, Testing & Code Quality
**Expected score impact:** Performance & Reliability 7 -> 8
**Depends on:** Chunks 1, 5
**PR group:** H

### Context

A written runbook is not enough. Launch confidence comes from practicing realistic bad-day scenarios before users force the lesson.

### Scope

- Create a simple failure drill template
- Run at least one drill for data freshness, one for deploy failure, and one for dependency degradation
- Log the resulting gaps and actions

### Decision Points

None - execute directly.

### Verification

- At least 3 drills are documented
- Each drill yields a concrete code, doc, or alert improvement

### Files To Read First

- `docs/runbook.md`
- `docs/strategy/context/systems-operating-system.md`

#### Chunk 9: Launch Control Room

**Priority:** P0
**Effort:** M
**Audit dimension(s):** Product Completeness vs. Vision, Performance & Reliability
**Expected score impact:** Product Completeness vs. Vision 7 -> 8, Performance & Reliability 7 -> 8
**Depends on:** Chunks 1, 4, 5, 7, 8
**PR group:** I

### Context

By day 90, the founder needs a concrete way to decide whether launch is safe, risky, or blocked. That decision should come from a control room view, not a gut feeling.

### Scope

- Create a launch go/no-go checklist based on the scorecard and critical journeys
- Define launch blockers vs watch items
- Define the launch-week monitoring and response cadence

### Decision Points

- Which scorecard breaches are absolute launch blockers

### Verification

- The founder can answer "Are we launch-ready?" with evidence in one session
- The launch decision is tied to explicit thresholds

### Files To Read First

- `docs/strategy/context/systems-operating-system.md`
- `docs/strategy/context/strategic-state.md`
- `docs/strategy/context/build-manifest.md`
- `docs/runbook.md`

---

## Weekly Cadence For The Founder

Use this cadence during the 90-day plan:

| Day       | Focus                                               | Output                                              |
| --------- | --------------------------------------------------- | --------------------------------------------------- |
| Monday    | Systems scorecard review                            | Current status, top risk, systems task for the week |
| Tuesday   | Highest-risk hardening chunk                        | PR or design note                                   |
| Wednesday | Feature work, but only after systems blocker review | Progress with explicit risk class                   |
| Thursday  | Verification and adversarial review                 | Findings and fixes                                  |
| Friday    | Deploy confidence and cleanup                       | Follow-ups, doc updates, incident log if needed     |

This is intentionally biased toward one systems-hardening move every week even while features continue.

---

## Anti-Patterns To Avoid

- Shipping more features when the same recurring reliability problem is still unresolved
- Treating scoring or alignment changes like ordinary refactors
- Relying on post-merge detection for known critical regressions
- Running audits that do not create follow-up work with owners
- Keeping operational knowledge in chat history instead of repo docs
- Asking agents for exhaustive analysis without forcing a decision or next action

---

## Success Test

At day 90, ask:

1. Can we explain our launch risk in 5 minutes from artifacts in the repo?
2. Do we know the top 3 ways trust could fail and what we would do?
3. Are agents making the system more legible and dependable, not just faster-moving?
4. Would a bad week in production produce structured recovery instead of chaos?

If the answer is yes, the operating model is working.
