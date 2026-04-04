# Work Plan - 2026-04-02 - Platform Architecture Review Series

## Execution Principles

1. Keep chunks PR-sized and independently verifiable.
2. Sequence infrastructure before consumers.
3. Convert only validated findings into execution chunks.
4. Expand this backlog as each deep dive stabilizes.

## Chunk 0: Review Series Scaffold

**Priority:** P0
**Effort:** S
**Audit dimension(s):** Product Completeness vs. Vision, Testing and Code Quality
**Expected score impact:** Product Completeness vs. Vision: operational clarity, not a direct rubric score change
**Depends on:** None
**PR group:** A

### Context

The architecture review needs a durable handoff system before deeper analysis starts. Without that, findings will fragment across agent sessions.

### Scope

- Create a persistent review folder under `docs/strategy/context/architecture-review/`.
- Add a master series index.
- Add a PR-sized execution backlog.
- Seed the first deep-dive document for the data plane.

### Decision Points

None - execute directly.

### Verification

- The new folder exists and is linked by the series index.
- The active deep dive is clearly identified.
- A future agent can start from the docs without scanning prior chat history.

### Files to Read First

- `docs/strategy/context/work-plan-template.md`
- `docs/strategy/context/build-manifest.md`
- `docs/strategy/context/audit-rubric.md`

## Chunk 1: Data Plane System Map and Invariant Audit

**Priority:** P0
**Effort:** M
**Audit dimension(s):** Intelligence Engine Quality, Data Architecture and Compounding, Performance and Reliability, Testing and Code Quality
**Expected score impact:** Data Architecture and Compounding: establish the evidence needed for 6 to 8 quality work
**Depends on:** Chunk 0
**PR group:** A

### Context

The data plane is the highest-risk platform layer because scoring, matching, governance summaries, and workspace intelligence all depend on it. The app already declares a database-first read policy, but the implementation must be checked against real code paths, fallback behavior, freshness logic, sync jobs, and operational invariants.

### Scope

- Map the end-to-end flow from external sources to sync jobs to Supabase tables to read models to page and API consumers.
- Identify truth boundaries, freshness guarantees, fallback paths, and places where behavior changes under degraded conditions.
- Document validated findings in `deep-dive-01-data-plane.md`.
- Split confirmed issues into follow-up execution chunks in this backlog.

### Decision Points

None - execute directly unless the review uncovers an architectural fork with materially different tradeoffs.

### Verification

- `deep-dive-01-data-plane.md` contains a system map, validated findings, risk ranking, and next actions.
- At least the top fixable issues are converted into PR-sized backlog chunks.

### Files to Read First

- `lib/data.ts`
- `lib/supabase.ts`
- `lib/env.ts`
- `lib/sync/`
- `inngest/functions/`
- `app/api/`
- `docs/strategy/context/build-manifest.md`

## Chunk 2: Fix Public DRep API `active_only` Semantics

**Priority:** P0
**Effort:** S
**Audit dimension(s):** Data Architecture and Compounding, API and Integration Readiness, Testing and Code Quality
**Expected score impact:** API and Integration Readiness: prevent public contract drift
**Depends on:** Chunk 1
**PR group:** B

### Context

The public DRep API currently treats `active_only` as "well documented only" because it selects the `dreps` subset from `lib/data.ts`, and that subset is documentation-filtered rather than activity-filtered.

### Scope

- Correct `app/api/v1/dreps/route.ts` so `active_only` filters by actual active status.
- Separate documentation-quality filtering from activity filtering instead of overloading one flag.
- Add regression coverage for the API parameter semantics.
- Update any developer-facing docs if the response semantics change.

### Decision Points

None - execute directly.

### Verification

- Requests with `active_only=true` return only active DReps.
- Requests with `active_only=false` include inactive rows.
- Tests prove the filter is based on activity, not documentation completeness.

### Files to Read First

- `app/api/v1/dreps/route.ts`
- `lib/data.ts`
- `utils/documentation.ts`
- Existing API tests for `/api/v1/dreps` if present

## Chunk 3: Align DRep Freshness Policy With Sync Ownership

**Priority:** P0
**Effort:** M
**Audit dimension(s):** Data Architecture and Compounding, Performance and Reliability, Testing and Code Quality
**Expected score impact:** Data Architecture and Compounding: remove false-stale behavior and event churn
**Depends on:** Chunk 1
**PR group:** C
**Implementation status:** Completed in this worktree

### Context

The DRep read path treats data older than 15 minutes as stale even though the canonical DRep sync runs every 6 hours. This makes the read layer classify normal state as stale and emit extra sync events.

### Scope

- Define the authoritative freshness contract for DRep reads.
- Update `lib/data.ts` freshness and trigger behavior to match that contract.
- Preserve observability into stale data without letting normal state spam sync events.
- Add tests or assertions around freshness thresholds and trigger conditions.

### Decision Points

None - execute directly unless the review uncovers conflicting product expectations about how stale DRep data may be before users must be warned.

### Verification

- Normal post-sync data is not treated as stale during the expected sync window.
- Background sync events are emitted only when the configured stale threshold is truly exceeded.
- Logs and metrics still expose freshness clearly.

### Result

- Implemented via `lib/syncPolicy.ts` with a layered DRep policy:
  - cadence: 6h
  - retrigger threshold: 8h
  - degraded threshold: 12h
- Updated `lib/data.ts`, `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts`.
- Verified with `npm run test:unit -- __tests__/lib/data.test.ts __tests__/api/health.test.ts`.
- Verified with `npm run type-check`.

### Files to Read First

- `lib/data.ts`
- `inngest/functions/sync-dreps.ts`
- `lib/sync/dreps.ts`
- Any health or freshness guard jobs tied to DRep sync

## Chunk 4: Remove Upstream Fallbacks From Shared DRep Reads

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Data Architecture and Compounding, Performance and Reliability, API and Integration Readiness
**Expected score impact:** Data Architecture and Compounding: restore a single read contract
**Depends on:** Chunk 1
**PR group:** D
**Implementation status:** Completed in this worktree

### Context

`lib/data.ts` currently falls back to Koios from the shared DRep read path when Supabase is empty or unavailable. That changes semantics under failure and breaks the documented database-first architecture.

### Scope

- Remove or isolate direct upstream fallbacks from shared DRep reads.
- Replace them with explicit degraded behavior that preserves contract clarity.
- Surface freshness or degraded-state metadata rather than silently switching data sources.
- Add tests covering Supabase-unavailable behavior.

### Decision Points

None - execute directly. The documented repo policy already prefers database-first reads.

### Verification

- Shared DRep reads no longer call upstream live fetches in normal page or public API flows.
- Supabase failure mode is explicit and testable.
- User-facing behavior is consistent across healthy and degraded states.

### Progress So Far

- `getAllDReps()` no longer falls back to Koios on empty or unavailable Supabase cache.
- The legacy `/api/dreps` route now degrades explicitly to `{ dreps: [], allDReps: [], error: true, totalAvailable: 0 }` for existing frontend consumers.
- `lib/data.ts:getVotingPowerSummary()` now resolves thresholds through `lib/governanceThresholds.ts` instead of calling Koios directly.
- `lib/governanceThresholds.ts` is Supabase-first via `epoch_params`, with Koios retained only as an isolated fallback inside the resolver.
- Parameter-change threshold resolution now uses the proposal row `param_changes` payload and the maximum applicable protocol-parameter-group threshold.
- Verified with `npm run test:unit -- __tests__/lib/governanceThresholds.test.ts __tests__/lib/data.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/data.test.ts __tests__/api/dreps.test.ts`.
- Verified with `npm run type-check`.
- Follow-up work: decide whether non-shared proposal/workspace threshold consumers should adopt the same resolver and whether `epoch_params` should become a repo-managed typed contract.

### Files to Read First

- `lib/data.ts`
- `lib/governanceThresholds.ts`
- `lib/koios.ts`
- `utils/koios.ts`
- `app/api/v1/dreps/route.ts`
- `app/api/v1/dreps/[drepId]/route.ts`

## Chunk 5: Consolidate Ownership of DRep Snapshot Tables

**Priority:** P0
**Effort:** L
**Audit dimension(s):** Intelligence Engine Quality, Data Architecture and Compounding, Performance and Reliability
**Expected score impact:** Data Architecture and Compounding: reduce order-dependent partial state risk
**Depends on:** Chunk 1
**PR group:** E
**Implementation status:** Completed in this worktree

### Context

`sync-dreps`, `sync-drep-scores`, `sync-proposals`, and `generate-epoch-summary` currently overlap on snapshot responsibilities. The clearest examples so far are `delegation_snapshots`, `drep_score_history`, and `proposal_vote_snapshots`. That creates ambiguous ownership and makes final state depend on job order and follow-on job success.

### Scope

- Choose a single owner for `drep_score_history`.
- Choose a single owner for `delegation_snapshots`, or clearly split raw versus derived responsibilities into different tables.
- Choose a single owner for `proposal_vote_snapshots`.
- Remove duplicate writes and make downstream expectations explicit.
- Add operational checks so partial pipeline failures are visible.

### Decision Points

The executing agent should confirm the final ownership design before building if the solution requires a table split or a meaningful change to sync sequencing.

### Verification

- Each snapshot table has one clear owning sync stage.
- A failed follow-on sync cannot leave ambiguous mixed-semantic rows.
- The resulting pipeline is documented in `deep-dive-01-data-plane.md`.

### Progress So Far

- `proposal_vote_snapshots` is now owned by `generate-epoch-summary.ts`.
- `lib/sync/proposals.ts` no longer writes that table.
- `inngest/functions/check-snapshot-completeness.ts` now validates proposal vote snapshots against `prevEpoch`, which matches the epoch-transition write path.
- `sync-dreps` no longer writes current-epoch `drep_score_history`.
- `sync-dreps` no longer writes current-epoch `delegation_snapshots`.
- `sync-drep-scores` now uses `lib/scoring/delegationSnapshots.ts` to preserve or backfill delegation deltas on same-epoch reruns.
- `sync-drep-scores` now writes `delegation_snapshots.total_power_lovelace` from `votingPowerLovelace`, with unit coverage in `__tests__/scoring/delegationSnapshots.test.ts`.
- `generate-epoch-summary.ts` now finalizes previous-epoch `delegation_snapshots` with canonical `drep_power_snapshots` counts while recomputing delegation deltas against the prior epoch.
- Verified with `npm run test:unit -- __tests__/scoring/delegationSnapshots.test.ts`.
- Verified with `npm run type-check`.
- Follow-up work: audit downstream consumers against the explicit lifecycle split rather than ambiguous multi-writer ownership.

### Files to Read First

- `lib/sync/dreps.ts`
- `inngest/functions/sync-dreps.ts`
- `inngest/functions/sync-drep-scores.ts`
- `lib/sync/proposals.ts`
- `inngest/functions/generate-epoch-summary.ts`
- `types/database.ts`

## Chunk 6: Fail Closed for Internal Route Rate Limits Under Redis Failure

**Priority:** P0
**Effort:** M
**Audit dimension(s):** Performance and Reliability, Testing and Code Quality
**Expected score impact:** Security and operational resilience: reduce degraded-mode trust drift
**Depends on:** None
**PR group:** F

### Context

`lib/api/withRouteHandler.ts` silently falls back to process-local memory when Redis is unavailable. That materially weakens enforcement for internal routes during degraded conditions.

### Scope

- Replace the current silent in-memory downgrade with an explicit fail-closed or otherwise globally consistent strategy.
- Align behavior with the stricter posture already used in `lib/api/rateLimit.ts`.
- Add tests for Redis failure behavior.

### Decision Points

If the app intentionally needs a softer degraded-mode posture for some internal routes, the executing agent should identify those routes explicitly instead of leaving the fallback implicit.

### Verification

- Redis failure no longer weakens rate limiting into process-local state without visibility.
- Tests prove the chosen degraded-mode behavior.

### Files to Read First

- `lib/api/withRouteHandler.ts`
- `lib/api/rateLimit.ts`
- Internal routes using `withRouteHandler(..., { rateLimit: ... })`

## Chunk 7: Normalize Health and Freshness Threshold Policies

**Priority:** P1
**Effort:** L
**Audit dimension(s):** Performance and Reliability, Product Completeness vs. Vision
**Expected score impact:** Reliability and observability: clearer diagnosis and fewer conflicting signals
**Depends on:** None
**PR group:** G
**Implementation status:** Completed in this worktree

### Context

Operational diagnosis currently depends on multiple independent threshold tables across health endpoints, admin alerting, and freshness guard jobs. That makes incidents harder to reason about and can create duplicate or conflicting remediation.

### Scope

- Inventory the current health and freshness policy tables.
- Consolidate them into one canonical configuration source or a clearly layered model.
- Update consumers to reference that shared policy.
- Preserve route-specific presentation without duplicating core thresholds.

### Decision Points

The executing agent should confirm whether the desired end state is one central policy source or a small number of intentionally distinct policy classes.

### Verification

- The same sync condition is evaluated consistently across monitoring, alerting, and self-healing jobs.
- Threshold drift can be changed in one place.

### Progress So Far

- Added a layered canonical sync registry in `lib/syncPolicy.ts` instead of keeping four drifting threshold tables across health, alerting, and self-healing code paths.
- `app/api/health/route.ts` now derives sync labels and health levels from the shared policy and no longer invents its own stale thresholds per route.
- `app/api/health/sync/route.ts` now uses the shared core-sync registry plus explicit external-critical thresholds rather than its own local map.
- `app/api/admin/integrity/alert/route.ts` now reads labels, schedules, retrigger thresholds, and event names from the shared policy and only auto-heals syncs that actually define an event.
- `inngest/functions/sync-freshness-guard.ts` now uses the same canonical retrigger policy and never-ran sync inventory instead of its own `FRESHNESS_THRESHOLDS` table.
- `app/api/health/route.ts` now surfaces snapshot-diagnostic failure explicitly as `snapshots.status = unavailable` and degrades the top-level health result instead of silently swallowing the blind spot.
- `app/api/health/deep/route.ts` now documents the current Redis dependency posture accurately after the earlier rate-limit fail-closed change.
- Added regression coverage in `__tests__/lib/syncPolicy.test.ts`, `__tests__/api/health.test.ts`, and `__tests__/api/health-sync.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/syncPolicy.test.ts __tests__/api/health.test.ts __tests__/api/health-sync.test.ts`.
- Verified with `npm run agent:validate`.
- Verified with `npm run type-check`.
- Verified focused static hygiene with `npm run lint -- lib/syncPolicy.ts app/api/health/route.ts app/api/health/sync/route.ts app/api/admin/integrity/alert/route.ts inngest/functions/sync-freshness-guard.ts`.

### Files to Read First

- `app/api/health/route.ts`
- `app/api/health/sync/route.ts`
- `app/api/admin/integrity/alert/route.ts`
- `inngest/functions/sync-freshness-guard.ts`

## Chunk 8: Normalize Governance-Body Eligibility Across Proposal Consumers

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Data Architecture and Compounding, Intelligence Engine Quality, Testing and Code Quality
**Expected score impact:** Data Architecture and Compounding: eliminate another class of proposal-consumer semantic drift
**Depends on:** Chunk 1, Chunk 4
**PR group:** H
**Implementation status:** Completed in this worktree

### Context

Proposal queues, CC analysis, and proposal-detail UI were using incompatible type-based rules for which governance bodies can vote. That broke CIP-1694 semantics for treasury withdrawals, committee updates, constitution updates, info actions, and parameter changes that only become SPO-votable when they touch technical/security parameters.

### Scope

- Keep `lib/governance/votingBodies.ts` as the single eligibility source.
- Thread `param_changes` into proposal-detail and workspace-review consumers that already have, or cheaply can have, that data.
- Remove remaining duplicated body-eligibility type lists from proposal, workspace, and intelligence consumers.
- Add focused regression coverage for parameter-sensitive body presentation.

### Decision Points

None - execute directly unless a consumer needs a materially different product interpretation of Info-action or parameter-change presentation than the shared CIP-1694 eligibility model.

### Verification

- Security-relevant parameter changes show SPO participation only when technical/security parameters are affected.
- Treasury, committee, constitution, and info-action body participation is consistent across queueing, analysis, and UI surfaces.
- Workspace review receives the data it needs to use the same eligibility rules as proposal-detail pages.

### Progress So Far

- `lib/governance/votingBodies.ts` now centralizes the corrected eligibility matrix, including parameter-sensitive SPO participation for `ParameterChange`.
- `lib/governanceThresholds.ts` now exports protocol-parameter-group helpers plus an explicit SPO security-parameter allowlist that the shared eligibility layer consumes.
- `lib/actionQueue.ts` now filters SPO pending proposals through the shared eligibility rules.
- `lib/actionQueue.ts` now filters CC pending proposals through the shared eligibility rules instead of counting every open proposal.
- `inngest/functions/generate-cc-briefing.ts` now filters pending CC proposals through the shared eligibility rules.
- `app/api/workspace/proposals/monitor/route.ts` now uses shared governance-body eligibility and the shared DRep threshold resolver instead of treating its local threshold table as the body-inclusion matrix.
- The main proposal-detail route now threads `paramChanges` into `ProposalHeroV2`, `ProposalBridge`, `ProposalActionZone`, `ProposalVoterTabs`, `SourceMaterial`, and `LivingBrief`, removing type-only eligibility decisions from that UI path.
- `app/api/workspace/review-queue/route.ts` now exposes `paramChanges` through the review-queue contract.
- Reviewer-facing intelligence consumers now use shared governance-body eligibility with parameter context: `ReviewIntelBrief`, `StakeholderLandscape`, `ReviewBrief`, and `IntelPanel`.
- Passage-prediction background jobs now fetch `param_changes` and resolve thresholds through the shared governance rule layer before caching proposal predictions.
- `lib/scoring/historical.ts` now reads `delegation_snapshots` through the finalized `epoch` column instead of the stale `epoch_no` field.
- Added regression coverage in `__tests__/lib/votingBodies.test.ts` and `__tests__/lib/actionQueue.test.ts`.
- Added regression coverage in `__tests__/api/workspace-proposals-monitor.test.ts`.
- Added focused regression coverage in `__tests__/api/workspace-review-queue.test.ts`, `__tests__/components/StakeholderLandscape.test.tsx`, and `__tests__/lib/passagePrediction.test.ts`.
- Verified with `npm run test:unit -- __tests__/api/workspace-review-queue.test.ts __tests__/lib/passagePrediction.test.ts __tests__/api/workspace-proposals-monitor.test.ts`.
- Verified with `npm run test:component -- __tests__/components/StakeholderLandscape.test.tsx`.
- Verified with `npm run agent:validate`.
- Verified focused static hygiene with `npm run lint -- app/api/workspace/review-queue/route.ts components/intelligence/ReviewIntelBrief.tsx components/intelligence/sections/StakeholderLandscape.tsx components/studio/IntelPanel.tsx components/workspace/review/ReviewBrief.tsx components/workspace/review/ReviewWorkspace.tsx lib/workspace/types.ts lib/passagePrediction.ts inngest/functions/update-passage-predictions.ts inngest/functions/precompute-proposal-intelligence.ts lib/scoring/historical.ts` (warnings only in `components/workspace/review/ReviewWorkspace.tsx`, no errors).
- Verified with `npm run type-check`.

## Chunk 9: Normalize Authoring Threshold Copy

**Priority:** P2
**Effort:** S
**Audit dimension(s):** Data Architecture and Compounding, Product Completeness vs. Vision
**Expected score impact:** Minor consistency gain by removing threshold-copy drift from authoring UX
**Depends on:** Chunk 8
**PR group:** H

### Context

The authoring submission simulator still hardcodes governance threshold copy in `components/workspace/author/submission/FinancialSimulation.tsx`. That does not currently drive live data behavior, but it can drift from the shared governance rule layer and mislead proposal authors.

### Scope

- Replace the static authoring threshold copy table with shared threshold and eligibility helpers, or explicitly centralize the copy source if product wants curated explanatory text.
- Preserve user-friendly language while removing contradictory threshold claims.

### Verification

- Authoring threshold copy matches the shared governance rule layer for each supported proposal type.
- Parameter-change authoring copy does not imply SPO participation when only governance parameters are changed.

### Files to Read First

- `components/workspace/author/submission/FinancialSimulation.tsx`
- `lib/governance/votingBodies.ts`
- `lib/governanceThresholds.ts`

## Chunk 10: Enforce Ops-Critical Environment Contracts

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Performance and Reliability, Testing and Code Quality
**Expected score impact:** Reliability and observability: prevent silent operation without monitoring or alerting
**Depends on:** Chunk 7
**PR group:** I
**Implementation status:** Completed in this worktree

### Context

The runtime currently treats major observability and alerting integrations as optional. That allows a deploy to come up "healthy" even when Sentry, alert delivery, or heartbeat wiring is effectively disabled.

### Scope

- Separate environment variables into runtime-critical, ops-critical, and product-optional groups.
- Add an explicit verification path that fails when ops-critical monitoring and alerting env vars are absent in environments that expect them.
- Keep local-development ergonomics intact while removing silent production no-op behavior.

### Progress So Far

- `lib/env.ts` now defines and reports an explicit ops-critical env contract instead of treating all monitoring and alerting keys as generic optional vars.
- `app/api/health/route.ts` now returns `operations` status and degrades top-level health when ops-critical wiring is missing.
- `app/api/health/deep/route.ts` now returns `dependencies.operational_env` and degrades deep health when ops-critical wiring is missing.
- Added regression coverage in `__tests__/lib/env.test.ts`, `__tests__/api/health.test.ts`, and `__tests__/api/health-deep.test.ts`.
- Verified with `npm run test:unit -- __tests__/api/health-ready.test.ts __tests__/api/health.test.ts __tests__/api/health-deep.test.ts __tests__/lib/runtimeMetadata.test.ts __tests__/lib/env.test.ts __tests__/scripts/deployVerification.test.ts`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.
- Verified focused lint with `npm run lint -- lib/env.ts app/api/health/route.ts app/api/health/deep/route.ts`.

### Verification

- Production-targeted verification fails when Sentry or alert-delivery wiring is missing.
- Local development can still boot without forcing every ops integration.
- The effective env contract is documented in one place.

### Files to Read First

- `lib/env.ts`
- `instrumentation.ts`
- `lib/sync-utils.ts`
- `app/api/health/route.ts`
- `app/api/health/deep/route.ts`

## Chunk 11: Expand Tier-1 Cron Observability Coverage

**Priority:** P1
**Effort:** L
**Audit dimension(s):** Performance and Reliability, Product Completeness vs. Vision
**Expected score impact:** Reliability and observability: reduce blind spots in scheduled work
**Depends on:** Chunk 7
**PR group:** I
**Implementation status:** Completed in this worktree

### Context

The repo has far more cron-triggered jobs than cron instrumentation and heartbeat coverage. That leaves several freshness-critical or epoch-critical jobs without durable operator visibility.

### Scope

- Define cron coverage tiers so tier-1 jobs are explicitly identified.
- Add Sentry Cron instrumentation to every cron-triggered Inngest function, at minimum for the tier-1 set.
- Add external heartbeat coverage for the tier-1 jobs that gate freshness, alerts, or epoch transitions.
- Document the policy so new cron jobs cannot ship uninstrumented by accident.

### Verification

- Every tier-1 cron job has Sentry Cron coverage and an external heartbeat path.
- Missing or broken cron instrumentation is visible during review.
- The coverage policy is simple enough that future jobs can adopt it mechanically.

### Progress So Far

- Established the tier-1 cron set around freshness, epoch transition, and operator recovery jobs:
  - `sync-drep-scores`
  - `sync-alignment`
  - `sync-freshness-guard`
  - `generate-epoch-summary`
- Added runtime-configurable cron monitor options in `lib/sentry-cron.ts` so long-running jobs can declare accurate Sentry monitor budgets.
- Added regression coverage in `__tests__/lib/sentry-cron.test.ts`, including the runtime-override path.
- Added Sentry Cron coverage plus dedicated external heartbeat hooks for all four tier-1 jobs.
- Added optional heartbeat env keys for tier-1 jobs in `lib/env.ts` and `.env.example`:
  - `HEARTBEAT_URL_SCORING`
  - `HEARTBEAT_URL_ALIGNMENT`
  - `HEARTBEAT_URL_FRESHNESS_GUARD`
  - `HEARTBEAT_URL_EPOCH_SUMMARY`
- Fixed the `alert-integrity` Sentry monitor schedule drift so the monitor schedule matches the actual cron trigger.
- Updated `scripts/uptime-check.mjs` and `docs/observability-setup.md` so repo tooling and operator docs reflect the current heartbeat and monitor set instead of the stale 3-heartbeat/6-monitor assumptions.
- Verified with `npm run test:unit -- __tests__/lib/sentry-cron.test.ts __tests__/api/health-ready.test.ts __tests__/api/health.test.ts __tests__/api/health-deep.test.ts __tests__/lib/runtimeMetadata.test.ts __tests__/lib/env.test.ts __tests__/scripts/deployVerification.test.ts`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.
- Verified focused lint with `npm run lint -- lib/sentry-cron.ts lib/env.ts inngest/functions/sync-drep-scores.ts inngest/functions/sync-alignment.ts inngest/functions/sync-freshness-guard.ts inngest/functions/generate-epoch-summary.ts inngest/functions/alert-integrity.ts __tests__/lib/sentry-cron.test.ts` (warning only because the test file is eslint-ignored, no errors).

### Follow-up Work

- Decide whether the new tier-1 heartbeat env vars should graduate into the ops-critical env contract after the external monitors are provisioned.
- Extend instrumentation beyond the tier-1 set only where the job blast radius justifies it; do not treat every scheduled job as equally critical by default.

### Files to Read First

- `inngest/functions/`
- `lib/sentry-cron.ts`
- `lib/sync-utils.ts`
- `.github/workflows/post-deploy.yml`
- `scripts/inngest-status.ts`

## Chunk 12: Make Deploy and Preview Verification Release-Aware

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Performance and Reliability, API and Integration Readiness
**Expected score impact:** Reliability and observability: reduce false-positive deploy verification
**Depends on:** Chunk 10
**PR group:** I
**Implementation status:** Completed in this worktree

### Context

Post-deploy and preview verification currently depend too much on fixed waits and guessed environment URLs. That can validate the wrong release or fail for timing rather than correctness.

### Scope

- Make post-deploy verification resolve the actual deployed revision or build target before smoke tests run.
- Make preview verification derive the preview URL from deployment output rather than naming assumptions.
- Remove fixed smoke-test count text from workflow comments and replace it with actual result data.

### Progress So Far

- Added `lib/runtimeMetadata.ts` and exposed release metadata through `/api/health/ready`, `/api/health`, and `/api/health/deep`.
- Added `scripts/deploy-verify.ts` plus `scripts/lib/deployVerification.ts` as the canonical release-aware verification path.
- `scripts/smoke-test.ts` now uses semantic health validation, release-SHA checks, and distinct production versus preview profiles.
- `.github/workflows/post-deploy.yml` now verifies `github.event.workflow_run.head_sha` instead of sleeping for a fixed interval.
- `.github/workflows/preview.yml` now verifies the PR head SHA and no longer hardcodes success counts in the PR comment.
- Added wrapper and operator-doc alignment in `package.json`, `AGENTS.md`, and `README.md`.
- Verified with `npm run test:unit -- __tests__/api/health-ready.test.ts __tests__/api/health.test.ts __tests__/lib/runtimeMetadata.test.ts __tests__/scripts/deployVerification.test.ts`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.

### Verification

- Post-deploy checks prove they are testing the intended release.
- Preview checks target the deployed preview URL deterministically.
- Workflow comments reflect real smoke-test outcomes instead of hardcoded expectations.

### Files to Read First

- `.github/workflows/post-deploy.yml`
- `.github/workflows/preview.yml`
- `scripts/deploy-verify.ts`
- `scripts/lib/deployVerification.ts`
- `scripts/smoke-test.ts`

## Chunk 13: Thin Workspace Route Handlers Into Server Services

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Architecture and Code Health, API and Integration Readiness
**Expected score impact:** Runtime architecture: reduce HTTP-edge ownership drift
**Depends on:** Chunk 5
**PR group:** J
**Implementation status:** Completed in this worktree

### Context

The workspace review routes were doing too much work at the HTTP edge. They owned Supabase fan-out, governance thresholds, response shaping, and request parsing in the same file.

### Scope

- Move review queue assembly out of `app/api/workspace/review-queue/route.ts` into a bounded server service.
- Move proposal monitor assembly out of `app/api/workspace/proposals/monitor/route.ts` into a bounded server service.
- Keep route handlers responsible only for query validation and `NextResponse` serialization.

### Progress So Far

- Added `lib/workspace/reviewQueue.ts` for review queue assembly.
- Added `lib/workspace/proposalMonitor.ts` for proposal monitor assembly.
- Reduced both route handlers to thin request/response boundaries.
- Verified with `npm run test:unit -- __tests__/api/workspace-review-queue.test.ts __tests__/api/workspace-proposals-monitor.test.ts`.
- Verified with `npm run type-check`.

### Verification

- Workspace route handlers no longer own domain read-model assembly.
- Review queue and proposal monitor behavior remain unchanged at the route contract level.
- The extracted services are reusable by future server-component or background consumers.

### Files to Read First

- `app/api/workspace/review-queue/route.ts`
- `app/api/workspace/proposals/monitor/route.ts`
- `lib/workspace/reviewQueue.ts`
- `lib/workspace/proposalMonitor.ts`

## Chunk 14: Unify Proposal Governance Context Builders

**Priority:** P1
**Effort:** L
**Audit dimension(s):** Architecture and Code Health, Intelligence and Agent Readiness
**Expected score impact:** Runtime architecture: remove competing definitions of proposal context
**Depends on:** Chunk 13
**PR group:** J

### Context

`lib/intelligence/context.ts` and `lib/workspace/agent/context.ts` both assemble proposal/governance context, but with different caching, data sources, and output contracts.

### Scope

- Define the shared server-side proposal/governance context primitives.
- Move overlapping proposal, voting, treasury, precedent, and personal-context reads behind that shared service boundary.
- Keep page-intelligence formatting and workspace-agent prompt formatting separate, but make them consume the same underlying context model.

### Verification

- A proposal viewed in page intelligence and in the workspace agent resolves from the same server-side context service.
- The two consumers can still shape their final outputs differently without duplicating data assembly.
- Cache ownership is explicit instead of split between Redis and ad hoc in-memory maps.

### Files to Read First

- `lib/intelligence/context.ts`
- `lib/workspace/agent/context.ts`
- `lib/data.ts`
- `lib/ai/context.ts`

## Chunk 15: Split the Review Workspace Client Orchestrator

**Priority:** P1
**Effort:** XL
**Audit dimension(s):** Architecture and Code Health, Critical User Journeys
**Expected score impact:** Runtime architecture: reduce client-side coordination blast radius
**Depends on:** Chunk 13
**PR group:** J

### Context

`components/workspace/review/ReviewWorkspace.tsx` currently owns queue navigation, vote flow, rationale drafting, agent-panel wiring, keyboard shortcuts, analytics, and responsive layout orchestration in one large client file.

### Scope

- Split session/controller state from presentation.
- Extract vote-flow orchestration, queue navigation state, and studio-panel coordination into smaller focused modules.
- Keep the top-level review workspace focused on composition rather than owning every side effect directly.

### Verification

- Vote flow, queue navigation, and studio coordination each have narrower unit-test seams.
- The main review workspace component becomes materially smaller and easier to reason about.
- Mobile and desktop review flows continue to share the same core session logic without duplicating orchestration.

### Files to Read First

- `components/workspace/review/ReviewWorkspace.tsx`
- `hooks/useReviewQueue.ts`
- `hooks/useReviewSession.ts`
- `hooks/useVote.ts`
