# Weekly Systems Scorecard

> **Purpose:** Weekly operating review for Governada's launch-critical systems.
> **Cadence:** Update once per week.
> **Primary references:** `docs/strategy/context/systems-operating-system.md`, `docs/operations/slo-ledger.md`, `docs/operations/weekly-systems-review.md`
> **Working surface:** `/admin/systems` now keeps the live review log, open hardening commitments, and a derived scorecard sync signal for streak, drift, and recurring hotspots.

---

## Current Week

- **Week of:** 2026-04-02
- **Updated by:** Codex initial systems setup
- **Overall status:** Yellow
- **Top system risk:** Launch-critical journeys are not yet explicitly gated pre-merge.
- **Most important action this week:** Define the critical journey matrix and decide the smallest stable pre-merge E2E gate.

---

## Scorecard

The live cockpit is now the operational source of truth for scorecard sync. Before logging the next weekly review, use `/admin/systems` to confirm:

- the latest durable review still matches the live posture
- the weekly streak is intact
- any current non-good SLOs are explicitly captured in the next review
- recurring hotspot SLOs are being turned into concrete commitments instead of repeated narration

| Dimension         | Metric                                             | Current status                                                                            | Evidence                                                         | Trend | Owner   | Action                                                   |
| ----------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----- | ------- | -------------------------------------------------------- |
| Availability      | 30-day uptime and current health status            | Unknown - monitoring exists, weekly review not started                                    | `docs/observability-setup.md`, `/api/health/deep`                | Flat  | Founder | Start weekly scorecard updates from live dashboards      |
| Freshness         | Critical sync age vs expected schedule             | Yellow - health and runbook exist, but weekly freshness review is not yet operationalized | `docs/runbook.md`, `app/api/health/deep/route.ts`                | Flat  | Founder | Review critical sync freshness weekly and log breaches   |
| Correctness       | Open integrity anomalies older than 24h            | Yellow - integrity script exists, recurring ledger does not                               | `scripts/validate-integrity.ts`                                  | Flat  | Founder | Turn integrity validation into a recurring check and log |
| Performance       | p75 LCP and p95 key API latency                    | Yellow - budgets defined conceptually, baselines not populated                            | `docs/operations/performance-baseline.md`                        | Flat  | Founder | Run the current k6 baseline and record actual numbers    |
| Change safety     | Deploys needing hotfix or rollback in last 30 days | Unknown - CI and post-deploy verification exist, no scorecard history yet                 | `.github/workflows/ci.yml`, `.github/workflows/post-deploy.yml`  | Flat  | Founder | Begin tracking change failure rate in this file          |
| Test health       | Critical journey suite pass rate and flake status  | Yellow - post-merge E2E exists, pre-merge critical gate is missing                        | `.github/workflows/e2e.yml`                                      | Flat  | Founder | Define and wire the smallest stable pre-merge gate       |
| Incident response | Time to acknowledge and mitigate recent incidents  | Unknown - alert paths documented, incident log just created                               | `docs/observability-setup.md`, `docs/operations/incident-log.md` | Flat  | Founder | Log first real incident or drill and record timings      |
| User trust        | Known stale-data or misleading UX issues           | Yellow - degraded-state philosophy exists, trust surfaces need explicit weekly review     | `docs/strategy/context/systems-operating-system.md`              | Flat  | Founder | Review user-facing stale-data and degraded UX weekly     |

---

## Evidence Sources

- CI / post-deploy: `.github/workflows/ci.yml`, `.github/workflows/post-deploy.yml`
- Sentry: Production issues, transactions, Web Vitals dashboards
- BetterStack / health endpoints: `docs/observability-setup.md`, `/api/health`, `/api/health/deep`
- Inngest / sync freshness: Inngest dashboard, `docs/runbook.md`
- Playwright / smoke tests: `.github/workflows/e2e.yml`, `npm run smoke-test`
- Load / performance: `docs/operations/performance-baseline.md`, `.github/workflows/load-test.yml`
- Support / founder observations: User reports, Discord, manual founder QA

---

## Top 3 Risks

1. Critical journeys are not yet explicitly defined and gated pre-merge.
2. Data integrity and methodology governance exist in pieces but are not yet run as recurring control loops.
3. Performance budgets exist on paper, but current baseline numbers are not yet recorded in the operating review.

---

## Decisions

- Continue: keep docs, runbook, CI, and post-deploy verification as the backbone of systems work
- Stop: treating reliability hardening as "after feature work"
- Start: one systems-hardening chunk every week until launch

---

## Follow-Ups

| Item                                         | Priority | Target week | Status      |
| -------------------------------------------- | -------- | ----------- | ----------- |
| Create the critical journey matrix           | P0       | 2026-04-06  | Done        |
| Decide the minimum stable pre-merge E2E gate | P0       | 2026-04-06  | In progress |
| Run and record the first k6 baseline         | P1       | 2026-04-13  | Planned     |
| Start logging incidents and drills           | P1       | 2026-04-13  | Planned     |
