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
**Implementation status:** In progress in this worktree

### Context

`lib/intelligence/context.ts` and `lib/workspace/agent/context.ts` both assemble proposal/governance context, but with different caching, data sources, and output contracts.

### Scope

- Define the shared server-side proposal/governance context primitives.
- Move overlapping proposal, voting, treasury, precedent, and personal-context reads behind that shared service boundary.
- Keep page-intelligence formatting and workspace-agent prompt formatting separate, but make them consume the same underlying context model.

### Progress So Far

- Added `lib/governance/proposalContext.ts` as the shared on-chain proposal facts module.
- Standardized proposal-key normalization plus normalized proposal snapshot and tri-body voting reads behind that shared boundary.
- Added a shared reduced proposal-classification summary for page-intelligence consumers.
- Updated `lib/intelligence/context.ts` to consume the shared proposal context seed instead of rebuilding those on-chain facts inline.
- Updated `lib/workspace/agent/context.ts` to consume the same shared proposal snapshot/voting primitives for on-chain proposal context and precedent lookup.
- Added `lib/governance/treasuryContext.ts` as a shared treasury read service for balance, runway, NCL, and recent ratified-withdrawal facts.
- Updated `lib/intelligence/context.ts` and `lib/workspace/agent/context.ts` to consume the shared treasury service instead of duplicating treasury assembly.
- Chose to keep cache ownership consumer-owned for now: page intelligence keeps Redis caching of rendered `ContextSynthesisResult`, while the workspace agent keeps its short-lived in-memory `GovernanceContextBundle` cache.
- Fixed the workspace-agent treasury unit drift by converting recent ratified withdrawals from lovelace to ADA at the shared-read boundary.
- Removed the duplicate `lib/governance/proposalSnapshot.ts` branch of the same responsibility.
- Fixed the proposal-panel route contract so the intelligence API call now preserves proposal index instead of silently defaulting to index `0`.
- Verified with `npm run test:unit -- __tests__/lib/proposalContext.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/treasuryContext.test.ts`.
- Verified with `npm run type-check`.

### Follow-up Work

- Keep cache ownership split unless two consumers genuinely need the same rendered output contract; do not merge Redis and in-memory caches just to remove duplication on paper.
- Continue moving only stable higher-level reads behind shared services, starting with personal-context or feedback/annotation assembly if one of those boundaries proves durable.

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
**Implementation status:** In progress in this worktree

### Context

`components/workspace/review/ReviewWorkspace.tsx` currently owns queue navigation, vote flow, rationale drafting, agent-panel wiring, keyboard shortcuts, analytics, and responsive layout orchestration in one large client file.

### Scope

- Split session/controller state from presentation.
- Extract vote-flow orchestration, queue navigation state, and studio-panel coordination into smaller focused modules.
- Keep the top-level review workspace focused on composition rather than owning every side effect directly.

### Progress So Far

- Added `hooks/useReviewWorkspaceController.ts` as the explicit review-workspace controller seam for queue/session/navigation state.
- Added `lib/workspace/reviewWorkspaceController.ts` as the pure helper layer for initial selection, progress, and queue traversal.
- Added `components/workspace/review/ReviewWorkspaceStudio.tsx` as the extracted interactive studio shell.
- Reduced `components/workspace/review/ReviewWorkspace.tsx` to route-level state selection, fallback states, and studio-shell composition.
- Added `hooks/useReviewDecisionFlow.ts` as the dedicated vote/rationale/mobile decision-flow seam for the review studio shell.
- Added `components/workspace/review/ReviewWorkspaceDecisionPanels.tsx` so desktop/mobile decision-panel composition now lives behind one presenter boundary instead of duplicated prop wiring in `ReviewWorkspaceStudio.tsx`.
- Removed the duplicate `hooks/useReviewWorkspaceSelection.ts` and `lib/workspace/reviewNavigation.ts` branch so the review flow has one queue/navigation ownership path.
- Removed dead `agentUserRole` and `editorRef` exposure from the top-level review-workspace boundary.
- Verified with `npm run test:unit -- __tests__/lib/reviewWorkspaceController.test.ts`.
- Verified with `npm run test:component -- __tests__/hooks/useReviewDecisionFlow.test.tsx`.
- Verified with `npm run test:component -- __tests__/components/ReviewWorkspaceDecisionPanels.test.tsx`.
- Verified with `npm run lint -- components/workspace/review/ReviewWorkspace.tsx components/workspace/review/ReviewWorkspaceStudio.tsx hooks/useReviewWorkspaceController.ts lib/workspace/reviewWorkspaceController.ts`.
- Verified with `npm run lint -- components/workspace/review/ReviewWorkspaceStudio.tsx hooks/useReviewDecisionFlow.ts hooks/useReviewWorkspaceController.ts components/workspace/review/ReviewWorkspace.tsx lib/workspace/reviewWorkspaceController.ts`.
- Verified with `npm run lint -- components/workspace/review/ReviewWorkspaceStudio.tsx components/workspace/review/ReviewWorkspaceDecisionPanels.tsx hooks/useReviewDecisionFlow.ts`.
- Verified with `npm run type-check`.

### Follow-up Work

- Continue only if DD06 exposes operator-journey regressions that the current controller, decision-flow, and decision-panel seams do not isolate cleanly.
- Shift the next DD03 effort toward deeper server-runtime ownership, especially `lib/data.ts` decomposition and background-job orchestration extraction.

### Verification

- Vote flow, queue navigation, and studio coordination each have narrower unit-test seams.
- The main review workspace component becomes materially smaller and easier to reason about.
- Mobile and desktop review flows continue to share the same core session logic without duplicating orchestration.

### Files to Read First

- `components/workspace/review/ReviewWorkspace.tsx`
- `components/workspace/review/ReviewWorkspaceStudio.tsx`
- `components/workspace/review/ReviewWorkspaceDecisionPanels.tsx`
- `hooks/useReviewDecisionFlow.ts`

## Chunk 16: Extract Proposal Enrichment Leaves From `lib/data.ts`

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Architecture and Code Health, API and Integration Readiness
**Expected score impact:** Runtime architecture: reduce cross-domain ownership inside the shared read plane
**Depends on:** Chunk 14
**PR group:** J
**Implementation status:** Completed in this worktree

### Context

`lib/data.ts` still mixes unrelated DRep cache, proposal, committee, and intelligence reads. The lowest-churn extraction target is the proposal-enrichment leaf cluster that many routes already depend on for proposal/rationale/vote enrichment.

### Scope

- Move `getProposalsByIds()`, `getRationalesByVoteTxHashes()`, and `getVotesByDRepId()` plus their shared types into a dedicated governance read module.
- Keep `lib/data.ts` as a compatibility re-export surface for now so callers do not all need to migrate in the same checkpoint.
- Add focused unit coverage for the new module seam.

### Progress So Far

- Added `lib/governance/proposalEnrichment.ts` as the dedicated proposal-enrichment leaf module.
- Moved `CachedProposal`, `RationaleRecord`, and `DRepVoteRow` into that module with their existing Supabase-backed read helpers.
- Reduced `lib/data.ts` by re-exporting those helpers and types instead of owning their implementation directly.
- Added focused regression coverage in `__tests__/lib/proposalEnrichment.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/proposalEnrichment.test.ts`.
- Verified with `npm run lint -- lib/data.ts lib/governance/proposalEnrichment.ts`.
- Verified with `npm run type-check`.

### Follow-up Work

- Decide whether `getVotingPowerSummary()` is the next low-churn proposal read to extract from `lib/data.ts`, or whether the heavier proposal-summary pipeline should move first.
- Migrate callers directly to `lib/governance/proposalEnrichment.ts` only when a later DD03 slice already needs to touch those imports.

### Verification

- The shared proposal-enrichment reads now live outside `lib/data.ts`.
- Existing callers still compile through the compatibility re-export.
- The extracted module has direct unit coverage instead of relying only on downstream route tests.

### Files to Read First

- `lib/data.ts`
- `lib/governance/proposalEnrichment.ts`
- `app/api/compare/route.ts`
- `app/api/v1/dreps/[drepId]/votes/route.ts`
- `app/drep/[drepId]/page.tsx`

## Chunk 17: Extract Proposal-Intelligence Cache Services From Inngest Jobs

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Architecture and Code Health, Intelligence and Agent Readiness
**Expected score impact:** Runtime architecture: make proposal-intelligence jobs thinner orchestrators
**Depends on:** Chunk 16
**PR group:** J
**Implementation status:** Completed in this worktree

### Context

`precompute-proposal-intelligence.ts` and `update-passage-predictions.ts` both owned open-proposal discovery, content hashing, passage-prediction cache assembly, and cache upserts inline. That duplicated runtime behavior and kept persistence details inside the job bodies.

### Scope

- Move proposal-intelligence target discovery and content hashing behind a shared helper.
- Move passage-prediction cache refresh and section upsert behavior behind that same helper.
- Reduce the two Inngest jobs to orchestration over the shared service boundary.
- Add focused unit coverage for the new helper.

### Progress So Far

- Added `lib/intelligence/proposalIntelligenceCache.ts` as the shared proposal-intelligence cache helper.
- `inngest/functions/precompute-proposal-intelligence.ts` now delegates proposal discovery, cache upserts, and passage-prediction refresh through that shared module.
- `inngest/functions/update-passage-predictions.ts` now delegates open-proposal discovery and passage-prediction cache refresh through the same shared module.
- Added focused regression coverage in `__tests__/lib/proposalIntelligenceCache.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/proposalIntelligenceCache.test.ts`.
- Verified with `npm run lint -- inngest/functions/precompute-proposal-intelligence.ts inngest/functions/update-passage-predictions.ts lib/intelligence/proposalIntelligenceCache.ts`.
- Verified with `npm run type-check`.

### Follow-up Work

- Extract the remaining AI-generation orchestration from `precompute-proposal-intelligence.ts` if DD03 continues on the proposal-intelligence pipeline.
- Evaluate `sync-spo-scores.ts` as the larger next job-orchestration seam once this proposal-intelligence path is fully stabilized.

### Verification

- Proposal-intelligence cache discovery and upsert behavior now live outside the Inngest job files.
- Both jobs consume the same cache-refresh implementation instead of duplicating passage-prediction logic.
- The shared helper has direct unit coverage.

### Files to Read First

- `lib/intelligence/proposalIntelligenceCache.ts`
- `inngest/functions/precompute-proposal-intelligence.ts`
- `inngest/functions/update-passage-predictions.ts`
- `__tests__/lib/proposalIntelligenceCache.test.ts`

## Chunk 18: Extract Proposal Voting-Power Reads From `lib/data.ts`

**Priority:** P1
**Effort:** S
**Audit dimension(s):** Architecture and Code Health, API and Integration Readiness
**Expected score impact:** Runtime architecture: reduce cross-domain ownership inside the shared read plane
**Depends on:** Chunk 16
**PR group:** J
**Implementation status:** Completed in this worktree

### Context

`getVotingPowerSummary()` is a proposal-domain helper with a narrow consumer surface, but it was still buried in `lib/data.ts` alongside unrelated DRep, committee, and intelligence reads.

### Scope

- Move `getVotingPowerSummary()` and its type into a dedicated governance read module.
- Keep `lib/data.ts` as a compatibility re-export surface for existing consumers.
- Add direct unit coverage for the extracted module and verify the old `lib/data.ts` import path still works.

### Progress So Far

- Added `lib/governance/votingPowerSummary.ts`.
- Reduced `lib/data.ts` by re-exporting `getVotingPowerSummary()` and `VotingPowerSummary` instead of owning the implementation directly.
- Added focused regression coverage in `__tests__/lib/votingPowerSummary.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/votingPowerSummary.test.ts __tests__/lib/data.test.ts`.
- Verified with `npm run lint -- lib/data.ts lib/governance/votingPowerSummary.ts`.
- Verified with `npm run type-check`.

### Follow-up Work

- Treat the heavier proposal-summary pipeline in `lib/data.ts` as the next proposal-domain extraction candidate now that the smaller voting-power seam is out.

### Verification

- Proposal voting-power reads now live outside `lib/data.ts`.
- Existing `lib/data.ts` consumers still compile and pass focused tests.
- The extracted module has direct unit coverage.

### Files to Read First

- `lib/data.ts`
- `lib/governance/votingPowerSummary.ts`
- `app/api/proposals/power/route.ts`
- `app/proposal/[txHash]/[index]/page.tsx`

## Chunk 19: Extract SPO Koios Pool-Info Helpers From `sync-spo-scores.ts`

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Architecture and Code Health, Performance and Reliability
**Expected score impact:** Runtime architecture: make the scoring job thinner around external metadata refresh
**Depends on:** None
**PR group:** J
**Implementation status:** Completed in this worktree

### Context

`sync-spo-scores.ts` was inlining repeated Koios pool-info batching, normalization, and stake-refresh logic inside the job body. That kept network orchestration and data mapping mixed directly into the scoring function.

### Scope

- Move Koios pool-info batching and normalization into a shared helper.
- Reuse that helper for SPO metadata refresh and delegator/stake refresh.
- Add focused unit coverage for the new helper.

### Progress So Far

- Added `lib/scoring/spoPoolInfo.ts` as the shared Koios pool-info helper.
- `inngest/functions/sync-spo-scores.ts` now delegates metadata refresh and stake/delegator refresh through that helper.
- Added focused regression coverage in `__tests__/lib/spoPoolInfo.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/spoPoolInfo.test.ts`.
- Verified with `npm run lint -- inngest/functions/sync-spo-scores.ts lib/scoring/spoPoolInfo.ts`.
- Verified with `npm run type-check`.

### Follow-up Work

- Continue on `sync-spo-scores.ts` with either the relay-geocoding path or the core score-computation/persistence bundle.

### Verification

- Koios pool-info batching and normalization now live outside the scoring job.
- The metadata and delegator-refresh steps share one helper instead of duplicating request logic.
- The helper has direct unit coverage.

### Files to Read First

- `inngest/functions/sync-spo-scores.ts`
- `lib/scoring/spoPoolInfo.ts`
- `__tests__/lib/spoPoolInfo.test.ts`

## Chunk 20: Extract Proposal Summary Contract From `lib/data.ts`

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Architecture and Code Health, API and Integration Readiness, Intelligence and Agent Readiness
**Expected score impact:** Runtime architecture: keep proposal status and tri-body semantics owned by one shared contract
**Depends on:** Chunk 18
**PR group:** J
**Implementation status:** Completed in this worktree

### Context

`lib/data.ts` still owned both list and detail proposal-summary shaping, while API and intelligence consumers were already drifting around that contract. The immediate runtime risk was not the SQL itself; it was the fact that status, tri-body vote grouping, and proposal indices were being re-derived differently across consumers.

### Scope

- Move tri-body grouping, DRep vote tallying, lifecycle-derived status, and row-to-summary mapping into a shared proposal-domain helper.
- Update `getAllProposalsWithVoteSummary()` and `getProposalByKey()` to consume that helper.
- Align the first downstream API and intelligence consumers to the shared contract instead of stale flattened vote aliases.
- Add focused tests for the new helper and the first repaired consumer.

### Progress So Far

- Added `lib/governance/proposalSummary.ts` as the shared proposal-summary contract.
- `lib/data.ts` now delegates both list and detail summary shaping through that module instead of keeping separate inline mappers.
- `app/api/v1/proposals/route.ts` now relies on the shared data-layer `status` field rather than re-deriving lifecycle status at the HTTP edge.
- `lib/intelligence/advisor-discovery-tools.ts` now computes controversy from `triBody`, uses the shared `status` field for active-proposal discovery, and preserves `proposalIndex` instead of silently falling back to `0`.
- `lib/intelligence/advisor-tools.ts` now preserves `proposalIndex` when building proposal pulse commands and list output.
- Added focused regression coverage in `__tests__/lib/proposalSummary.test.ts` and `__tests__/intelligence/advisor-discovery-tools.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/proposalSummary.test.ts __tests__/intelligence/advisor-discovery-tools.test.ts __tests__/lib/data.test.ts`.
- Verified with `npm run lint -- lib/governance/proposalSummary.ts lib/data.ts app/api/v1/proposals/route.ts lib/intelligence/advisor-discovery-tools.ts lib/intelligence/advisor-tools.ts inngest/functions/sync-spo-scores.ts`.
- Verified with `npm run type-check`.

### Follow-up Work

- Added `lib/governance/proposalVotingSummary.ts` as the shared proposal-voting-summary runtime reader for `lib/data.ts`, `lib/workspace/reviewQueue.ts`, `lib/workspace/proposalMonitor.ts`, `lib/governance/proposalContext.ts`, `app/api/proposals/route.ts`, and the workspace voting-summary route.
- Added focused regression coverage in `__tests__/lib/proposalVotingSummary.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/proposalVotingSummary.test.ts __tests__/api/workspace-proposals-monitor.test.ts __tests__/api/workspace-review-queue.test.ts __tests__/lib/proposalContext.test.ts __tests__/lib/data.test.ts`.
- Verified with `npm run lint -- lib/governance/proposalVotingSummary.ts lib/data.ts lib/governance/proposalContext.ts lib/workspace/proposalMonitor.ts lib/workspace/reviewQueue.ts app/api/proposals/route.ts app/api/workspace/proposals/[txHash]/[index]/voting-summary/route.ts`.
- Verified with `npm run type-check`.
- Audit the remaining proposal-list intelligence consumers for any other hidden `index`/`status` alias assumptions that are not yet covered by direct types.

### Verification

- Proposal list/detail reads now share one status and vote-summary mapper.
- The v1 proposals API no longer re-derives proposal status at the route edge.
- The repaired intelligence consumers use the current shared contract instead of stale legacy field names.

### Files to Read First

- `lib/governance/proposalSummary.ts`
- `lib/data.ts`
- `app/api/v1/proposals/route.ts`
- `lib/intelligence/advisor-discovery-tools.ts`
- `lib/intelligence/advisor-tools.ts`
- `__tests__/lib/proposalSummary.test.ts`
- `__tests__/intelligence/advisor-discovery-tools.test.ts`

## Chunk 21: Extract SPO Relay Geocoding Helpers From `sync-spo-scores.ts`

**Priority:** P1
**Effort:** S
**Audit dimension(s):** Architecture and Code Health, Performance and Reliability
**Expected score impact:** Runtime architecture: make the scoring job thinner around relay geolocation enrichment
**Depends on:** Chunk 19
**PR group:** J
**Implementation status:** Completed in this worktree

### Context

Even after the pool-info helper extraction, `sync-spo-scores.ts` still owned ip-api batching, relay geo lookup mapping, and centroid construction inline. That kept a second external-enrichment seam embedded directly in the job body.

### Scope

- Move ip-api relay geocoding into a shared helper.
- Move per-pool relay-location centroid assembly into that same helper.
- Reduce `sync-spo-scores.ts` so the geocode step orchestrates persistence instead of owning the data shaping details.
- Add focused unit coverage for the new helper.

### Progress So Far

- Added `lib/scoring/spoRelayLocations.ts` as the shared relay geocoding helper.
- `inngest/functions/sync-spo-scores.ts` now delegates ip-api relay lookups and pool centroid assembly through that module instead of owning the response mapping and grouping logic inline.
- Added focused regression coverage in `__tests__/lib/spoRelayLocations.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/spoRelayLocations.test.ts __tests__/lib/spoPoolInfo.test.ts`.
- Verified with `npm run lint -- lib/scoring/spoRelayLocations.ts inngest/functions/sync-spo-scores.ts`.
- Verified with `npm run type-check`.

### Follow-up Work

- Continue on `sync-spo-scores.ts` with the remaining Koios relay discovery loop if DD03 stays in the job boundary.
- Treat the larger score-computation, persistence, and tier-assignment cluster as the higher-value next scoring seam once the relay discovery boundary is reduced further.

### Verification

- Relay geocoding and centroid assembly now live outside the scoring job.
- The scoring job remains responsible only for pool discovery, persistence, and failure logging in that step.
- The new helper has direct unit coverage.

### Files to Read First

- `lib/scoring/spoRelayLocations.ts`
- `inngest/functions/sync-spo-scores.ts`
- `__tests__/lib/spoRelayLocations.test.ts`

## Chunk 22: Extract SPO Score Sync Artifacts From `sync-spo-scores.ts`

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Architecture and Code Health, Performance and Reliability, Testing and Code Quality
**Expected score impact:** Runtime architecture: move core scoring assembly out of the SPO sync job
**Depends on:** Chunk 21
**PR group:** J
**Implementation status:** Completed in this worktree

### Context

Even after the pool-info and relay-geocoding helper extractions, `sync-spo-scores.ts` still owned the highest-risk part of the scoring run: proposal weighting, vote-change detection, deliberation/confidence assembly, sybil penalty application, alignment mapping, and score snapshot row shaping.

### Scope

- Move the core score-computation and persistence-artifact assembly into a shared scoring helper.
- Reduce `sync-spo-scores.ts` so the compute step orchestrates Supabase reads, helper invocation, and persistence writes.
- Add focused unit coverage for the new scoring helper.

### Progress So Far

- Added `lib/scoring/spoScoreSync.ts` as the shared SPO scoring-run helper.
- `inngest/functions/sync-spo-scores.ts` now delegates the compute-scores step through that helper instead of owning the main scoring assembly inline.
- Added focused regression coverage in `__tests__/lib/spoScoreSync.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/proposalVotingSummary.test.ts __tests__/api/workspace-proposals-monitor.test.ts __tests__/api/workspace-review-queue.test.ts __tests__/lib/proposalContext.test.ts __tests__/lib/data.test.ts __tests__/lib/spoScoreSync.test.ts`.
- Verified with `npm run lint -- lib/governance/proposalVotingSummary.ts lib/scoring/spoScoreSync.ts lib/data.ts lib/governance/proposalContext.ts lib/workspace/proposalMonitor.ts lib/workspace/reviewQueue.ts app/api/proposals/route.ts app/api/workspace/proposals/[txHash]/[index]/voting-summary/route.ts inngest/functions/sync-spo-scores.ts`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.

### Follow-up Work

- DD03 is now closed. Remaining runtime-architecture work is explicitly deferred rather than unresolved.
- If a later deep dive re-enters the scoring pipeline, continue with the relay-discovery loop and the later power-snapshot / tier-assignment orchestration in `sync-spo-scores.ts`.
- If a later deep dive re-enters proposal intelligence, continue with the remaining AI-generation orchestration in `precompute-proposal-intelligence.ts`.

### Verification

- The compute-scores step now delegates core scoring assembly through one shared helper.
- The new helper has direct unit coverage.
- Shared proposal/workspace consumers and the thinner SPO scoring job both compile and pass focused verification together.

### Files to Read First

- `lib/scoring/spoScoreSync.ts`
- `inngest/functions/sync-spo-scores.ts`
- `__tests__/lib/spoScoreSync.test.ts`

## Chunk 23: Remove Dead Homepage SSR Pulse Reads

**Priority:** P0
**Effort:** S
**Audit dimension(s):** Performance and Reliability, Product Completeness vs. Vision
**Expected score impact:** Performance and Reliability: lower anonymous-route latency and wasted database work
**Depends on:** None
**PR group:** K
**Implementation status:** Completed in this worktree

### Context

The anonymous landing route was still doing live Supabase pulse queries even though the current homepage entrypoint no longer rendered or forwarded that pulse data anywhere.

### Scope

- Remove the unused `getGovernancePulse()` read path from `app/page.tsx`.
- Remove the dead `pulseData` prop from `components/hub/HubHomePage.tsx`.
- Keep current homepage behavior unchanged while reducing hot-path server work.

### Progress So Far

- Removed the unused `getGovernancePulse()` read path from `app/page.tsx`.
- Removed the dead `pulseData` prop contract from `components/hub/HubHomePage.tsx`.
- The homepage now renders the same globe shell without issuing unnecessary DRep/proposal queries first.

### Verification

- `app/page.tsx` no longer imports the Supabase client or computes pulse aggregates.
- `components/hub/HubHomePage.tsx` no longer accepts an unused pulse payload.
- Verified with focused type/lint checks in the DD05 checkpoint.

### Files to Read First

- `app/page.tsx`
- `components/hub/HubHomePage.tsx`
- `components/globe/GlobeLayout.tsx`

## Chunk 24: Bound Proposal Voter Scans To The Active Proposal Set

**Priority:** P0
**Effort:** S
**Audit dimension(s):** Performance and Reliability, Testing and Code Quality
**Expected score impact:** Performance and Reliability: reduce unnecessary full-table reads on proposal list surfaces
**Depends on:** None
**PR group:** K
**Implementation status:** Completed in this worktree

### Context

`getAllProposalsWithVoteSummary()` was reading the full `drep_votes` table just to build per-proposal voter sets for the current proposal list response.

### Scope

- Constrain the `drep_votes` lookup to the fetched proposal tx hashes.
- Keep the existing response contract unchanged.
- Add focused regression coverage so the query bound is explicit.

### Progress So Far

- `lib/data.ts:getAllProposalsWithVoteSummary()` now limits the `drep_votes` read to the fetched proposal tx hashes instead of scanning the entire table.
- Added focused regression coverage in `__tests__/lib/data.test.ts`.

### Verification

- `__tests__/lib/data.test.ts` proves the `drep_votes` lookup is called with `.in('proposal_tx_hash', [...txHashes])`.
- Verified with focused DD05 unit/type/lint checks.

### Files to Read First

- `lib/data.ts`
- `__tests__/lib/data.test.ts`
- `app/api/v1/proposals/route.ts`
- `app/api/proposals/route.ts`

## Chunk 25: Push Proposal List Filtering And Pagination Into The Read Layer

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Performance and Reliability, API and Integration Readiness
**Expected score impact:** Performance and Reliability: make proposal list cost scale closer to request size than table size
**Depends on:** Chunk 24
**PR group:** L
**Implementation status:** Completed in this worktree

### Context

Public proposal list surfaces still materialize broad proposal sets and shape them in memory. That keeps response cost tied to total proposal volume rather than the requested page, filter, or sort.

### Scope

- Reduce `app/api/v1/proposals/route.ts` dependence on `getAllProposalsWithVoteSummary()` as an all-proposals materialization step.
- Push status/type filtering, ordering, and pagination closer to the database/shared read layer.
- Revisit `/api/proposals` cache-key shape so misses do not always rebuild the same broad payload.
- Add focused verification around page-size and filter behavior.

### Progress So Far

- Added `lib/governance/proposalList.ts` as the paged/filter-aware proposal list read seam.
- `app/api/v1/proposals/route.ts` now uses that helper instead of materializing `getAllProposalsWithVoteSummary()` and then filtering/slicing in memory.
- `newest` requests now page in the database/read layer and only fetch voting summaries for the returned proposal page.
- `/api/proposals` now reads `governance_stats` once and scopes `proposal_outcomes` to the fetched proposal tx hashes instead of querying the full outcomes table on every cache miss.
- `lib/workspace/reviewQueue.ts` now narrows its proposal projection away from `select('*')`.
- Added focused regression coverage in `__tests__/lib/proposalList.test.ts`, `__tests__/api/proposals.test.ts`, `__tests__/api/workspace-review-queue.test.ts`, and `__tests__/lib/data.test.ts`.

### Follow-up Work

- If DD05 is reopened, profile whether `most_votes` and `most_contested` need a more explicit ranked-list contract instead of filtered in-memory sorting.
- If the legacy `/api/proposals` route becomes a hot external surface again, revisit its cache-key strategy rather than rebuilding a single list blob per `limit`.

### Verification

- Proposal list cost is materially closer to request size than total table size.
- Filters and sorts are still correct.
- Cache keys align with the response contract instead of a one-size-fits-all list blob.
- Verified with `npm run test:unit -- __tests__/lib/proposalList.test.ts __tests__/api/proposals.test.ts __tests__/api/workspace-review-queue.test.ts __tests__/lib/data.test.ts`.
- Verified with `npm run lint -- app/api/proposals/route.ts lib/workspace/reviewQueue.ts __tests__/api/proposals.test.ts __tests__/api/workspace-review-queue.test.ts app/api/v1/proposals/route.ts lib/governance/proposalList.ts components/globe/GlobeLayout.tsx`.
- Verified with `npm run type-check`.

### Files to Read First

- `app/api/v1/proposals/route.ts`
- `app/api/proposals/route.ts`
- `lib/data.ts`
- `lib/governance/proposalSummary.ts`
- `lib/governance/proposalVotingSummary.ts`

## Chunk 26: De-duplicate Vote Ingestion And Move Toward Incremental Sync

**Priority:** P0
**Effort:** L
**Audit dimension(s):** Performance and Reliability, Data Architecture and Compounding
**Expected score impact:** Performance and Reliability: stop background cost from growing linearly with total vote history
**Depends on:** None
**PR group:** M
**Implementation status:** Implemented on April 6, 2026 follow-up

### Context

Vote ingestion currently spans `sync-proposals`, `sync-votes`, and `sync-dreps`, with the 6-hour vote sync still importing and reprocessing full history in memory. That is one of the clearest scale risks surfaced in DD05.

### Scope

- Decide the primary owner for vote ingestion from Koios.
- Reduce or remove overlapping vote-fetch paths across proposal sync, votes sync, and DRep enrichment.
- Move the heavy votes sync away from whole-history import when possible, or introduce explicit checkpointing if true incremental sync is not yet practical.
- Review related slow-sync and metadata-archive paths for the same “full corpus every run” pattern.

### Current Review Outcome

- The follow-up resolved the contract choice in favor of a DB-first cached vote model: `drep_votes` remains normalized, gains `has_rationale`, and does not preserve raw `meta_json`.
- `sync-votes` is now the canonical `drep_votes` writer with a durable `sync_cursors` checkpoint and inclusive overlap on `block_time`.
- `sync-proposals` no longer writes `drep_votes`; it only refreshes proposals and can trigger the canonical vote sync when open proposals need freshness.
- `sync-dreps` now derives `rationale_rate` and alignment transparency from cached vote signals instead of live Koios vote payloads, while V3 scoring remains on stored `rationale_quality` and `meta_hash`.
- Inline rationale text is written immediately to `vote_rationales`, and the metadata-archive path now reads normalized rationale content from that store instead of a nonexistent `drep_votes.meta_json` column.
- `vote_rationales` now carries durable external-fetch state (`fetch_status`, retry/error metadata, and `next_fetch_at`), and `lib/sync/slow.ts` consumes that queue directly instead of rescanning the full vote table for uncached anchors.
- `lib/sync/data-moat.ts` now archives DRep, proposal, and rationale metadata from per-stream timestamp cursors in `sync_cursors` instead of reprocessing the full historical archive corpus on each run.

### Verification

- Vote-ingestion ownership is explicit.
- The main vote sync no longer gets slower forever with total historical vote count.
- Upstream rate-limit exposure is reduced relative to the current overlapping schedule.
- External rationale fetches now make forward progress from a bounded retry queue instead of bounded scans over unbounded source sets.
- Metadata archival work now scales with changed DRep, proposal, and rationale content instead of full-corpus rescans.
- Focused verification passed with `npm run test -- __tests__/sync/data-moat.test.ts __tests__/lib/drep-votes.test.ts __tests__/lib/vote-rationales.test.ts __tests__/sync/votes.test.ts __tests__/sync/slow.test.ts __tests__/lib/koios-cache.test.ts __tests__/scoring/engagementQuality.test.ts`, `npm run agent:validate`, and `npm run type-check`.

### Files to Read First

- `lib/sync/proposals.ts`
- `lib/sync/votes.ts`
- `lib/sync/dreps.ts`
- `lib/koios.ts`
- `types/database.ts`
- `lib/sync/data-moat.ts`
- `lib/sync/slow.ts`
- `utils/koios.ts`

## Chunk 27: Gate Homepage List-Overlay Queries Behind Visible State

**Priority:** P0
**Effort:** S
**Audit dimension(s):** Performance and Reliability, Testing and Code Quality
**Expected score impact:** Performance and Reliability: stop hidden-state homepage overfetch
**Depends on:** None
**PR group:** K
**Implementation status:** Completed in this worktree

### Context

The homepage globe list overlay stayed mounted while closed, and its entity hooks still fetched DReps, proposals, committee members, and pools before the closed-state guard returned `null`.

### Scope

- Add explicit query gating for the list overlay entity hooks.
- Keep the open-overlay behavior unchanged.
- Add focused component coverage so the closed-state query contract stays explicit.

### Progress So Far

- `hooks/queries.ts` now supports explicit `enabled` gating for `useCommitteeMembers()`, `useDReps()`, and `useProposals()`.
- `components/globe/ListOverlay.tsx` now disables DRep, proposal, committee, and pool queries while the overlay is closed.
- Added focused component coverage in `__tests__/components/ListOverlay.test.tsx`.

### Verification

- Passed `npm run test:component -- __tests__/components/ListOverlay.test.tsx`.
- Passed `npm run lint -- components/globe/ListOverlay.tsx hooks/queries.ts app/page.tsx components/hub/HubHomePage.tsx lib/data.ts`.
- Passed `npm run type-check`.

### Files to Read First

- `components/globe/ListOverlay.tsx`
- `hooks/queries.ts`
- `__tests__/components/ListOverlay.test.tsx`
- `components/globe/GlobeLayout.tsx`

## Chunk 28: Remove Homepage Route-Panel Bundle Tax

**Priority:** P1
**Effort:** S
**Audit dimension(s):** Performance and Reliability, Frontend UX Quality
**Expected score impact:** Performance and Reliability: reduce homepage bundle and parse work for an unused route-only overlay
**Depends on:** None
**PR group:** L
**Implementation status:** Completed in this worktree

### Context

The homepage globe shell was still importing `PanelOverlay` even though that panel only renders on `/g/*` route detail paths and is not used on the anonymous landing page.

### Scope

- Remove the homepage's eager dependency on `PanelOverlay`.
- Keep `/g/*` route behavior unchanged.
- Avoid reintroducing the route-panel path into the homepage bundle by accident.

### Progress So Far

- `components/globe/GlobeLayout.tsx` now lazy-loads `PanelOverlay` with `next/dynamic`.
- The route panel only mounts when `pathname.startsWith('/g/')`, so the anonymous homepage no longer pays for that overlay path.

### Verification

- Verified with `npm run lint -- components/globe/GlobeLayout.tsx`.
- Verified with `npm run type-check`.

### Files to Read First

- `components/globe/GlobeLayout.tsx`
- `components/globe/PanelOverlay.tsx`
- `components/hub/HubHomePage.tsx`

## Chunk 29: Preserve Protected-Route Intent and Wire the Shared Wallet-Connect Event

**Priority:** P0
**Effort:** M
**Audit dimension(s):** Frontend UX Quality, Performance and Reliability, Architecture and Code Health
**Expected score impact:** Critical user journeys: prevent anonymous-to-authenticated intent loss on protected routes
**Depends on:** None
**PR group:** N
**Implementation status:** Completed in this worktree

### Context

DD06 surfaced a major journey break: anonymous users who opened `/workspace` or `/you` were being dumped onto `/` with no preserved destination, and the repo-wide `openWalletConnect` event bus had no actual listener.

### Scope

- Preserve protected-route destination intent through the anonymous home fallback.
- Reopen the wallet modal automatically when the app redirected a user because auth was required.
- Make the global `openWalletConnect` event actually open the wallet modal.
- Resume the saved destination after successful auth when the modal flow completes.
- Add focused regression coverage around the route-level redirect contract and return-to sanitization.

### Progress So Far

- `proxy.ts` now redirects anonymous protected-route requests to `/?connect=1&returnTo=...`.
- `components/governada/GovernadaHeader.tsx` now listens for `openWalletConnect`, auto-opens the modal for auth-required redirects, and resumes the saved internal destination after auth when the modal is no longer open.
- Added `lib/navigation/returnTo.ts` as the shared safe internal-path validator.
- Added focused regression coverage in `__tests__/proxy.test.ts` and `__tests__/lib/returnTo.test.ts`.

### Verification

- Anonymous `/workspace` and `/you` requests preserve intent instead of silently dropping to `/`.
- Shared `openWalletConnect` dispatches now have a real listener.
- Only safe internal `returnTo` values are accepted.

### Files to Read First

- `proxy.ts`
- `components/governada/GovernadaHeader.tsx`
- `components/WalletConnectModal.tsx`
- `hooks/useQuickConnect.ts`
- `lib/navigation/returnTo.ts`
- `__tests__/proxy.test.ts`
- `__tests__/lib/returnTo.test.ts`

## Chunk 30: Turn `/workspace` Into A Stable Route-Owned Entry

**Priority:** P0
**Effort:** M
**Audit dimension(s):** Frontend UX Quality, Architecture and Code Health
**Expected score impact:** Critical user journeys: remove client-owned persona routing from the canonical workspace entry
**Depends on:** Chunk 29
**PR group:** O
**Implementation status:** Completed in this worktree

### Context

The workspace root is currently a client redirect shell whose behavior depends on `SegmentProvider` state settling after mount.

### Scope

- Decide what `/workspace` should mean as a route contract.
- Remove first-load misrouting risk from `WorkspacePage`.
- Prefer a route-owned entry or explicit server decision over a client-only redirect shell.
- Keep review and author subroutes as the real owned destinations if the root remains a chooser.

### Progress So Far

- `app/workspace/page.tsx` is now an async server route that reads the session cookie, validates it, and redirects before render.
- Added `lib/navigation/workspaceEntry.ts` as the shared workspace-entry decision helper for real sessions, preview sessions, and fallback behavior.
- Preview sessions now reuse the existing `preview_sessions.persona_snapshot` contract to choose the route-owned workspace destination.
- Removed the deleted `components/hub/WorkspacePage.tsx` client redirect shell.
- Added focused regression coverage in `__tests__/lib/workspaceEntry.test.ts`.

### Verification

- `/workspace` is a stable and explainable destination.
- Persona routing does not depend on an anonymous default race on first load.
- Verified with `npm run test:unit -- __tests__/proxy.test.ts __tests__/lib/returnTo.test.ts __tests__/lib/workspaceEntry.test.ts`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.

### Files to Read First

- `app/workspace/page.tsx`
- `lib/navigation/workspaceEntry.ts`
- `components/providers/SegmentProvider.tsx`
- `app/workspace/review/page.tsx`
- `app/workspace/author/page.tsx`

## Chunk 31: Make `/match` A Durable Journey Route

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Frontend UX Quality, Product Completeness vs. Vision
**Expected score impact:** Critical user journeys: improve sharing, attribution, and iteration on the match flow
**Depends on:** None
**PR group:** O
**Implementation status:** Completed in this worktree

### Context

`/match` currently redirects to `/?match=true`, but multiple journey surfaces still link to `/match` as though it were a stable standalone destination.

### Scope

- Decide whether match should become a real page-owned journey or whether all callers should target the homepage overlay explicitly.
- Remove the current split contract where the URL and the actual UI owner disagree.
- Preserve analytics and shareability if the route becomes durable.

### Progress So Far

- `app/match/page.tsx` now renders the homepage match shell directly instead of redirecting to `/?match=true`.
- Added `components/hub/HomePageShell.tsx` so `/` and `/match` share one server-owned shell.
- `components/governada/GovernadaShell.tsx`, `hooks/useSenecaThread.ts`, and `lib/nav/config.ts` now treat exact `/match` as a home-owned route for shell context, panel routing, and nav highlighting.
- Added focused regression coverage in `__tests__/components/HomePageShell.test.tsx` and `__tests__/lib/nav-config.test.ts`.

### Verification

- Match has one clear route contract.
- Deep links and return paths do not bounce through a redirect shim.
- Verified with `npm run test:component -- __tests__/components/HomePageShell.test.tsx`.
- Verified with `npm run test:unit -- __tests__/proxy.test.ts __tests__/lib/returnTo.test.ts __tests__/lib/workspaceEntry.test.ts __tests__/lib/nav-config.test.ts`.
- Verified with `npm run lint -- app/match/page.tsx app/page.tsx components/hub/HomePageShell.tsx components/governada/GovernadaShell.tsx hooks/useSenecaThread.ts lib/nav/config.ts`.
- Verified with `npm run agent:validate`.
- Verified with `npm run type-check`.

### Files to Read First

- `app/match/page.tsx`
- `app/page.tsx`
- `components/globe/GlobeLayout.tsx`
- `app/match/result/MatchResultClient.tsx`
- `components/governada/match/CuratedVoteFlow.tsx`

## Chunk 32: Normalize Proposal Action Ownership Across Flag And Device Paths

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Frontend UX Quality, Architecture and Code Health
**Expected score impact:** Critical user journeys: make proposal-detail actions predictable across surfaces
**Depends on:** None
**PR group:** P
**Implementation status:** Completed in this worktree

### Context

Proposal detail is the strongest durable public route, but the action path still changes across inline action, workspace bridge, and mobile external-routing branches.

### Scope

- Map the intended proposal-action contract across desktop, mobile, and feature-flag branches.
- Reduce contradictory routing between inline action, workspace routing, and external mobile flows.
- Make the chosen action model explicit in the route and components.

### Progress So Far

- `components/governada/proposals/ProposalActionZone.tsx` now uses the shared proposal bridge for governance actors instead of keeping a separate inline vote-flow contract on the public route.
- Added `lib/navigation/proposalAction.ts` so workspace review hrefs, governance-body eligibility, and the citizen engagement anchor are shared instead of being re-derived independently.
- `components/governada/proposals/MobileStickyAction.tsx` now routes governance actors into the internal review workflow instead of kicking them out to `gov.tools`, gives citizens a real shared engagement anchor to scroll to, and uses the shared wallet-connect event for anonymous users.
- Added focused regression coverage in `__tests__/components/MobileStickyAction.test.tsx`, `__tests__/components/ProposalActionZone.test.tsx`, and `__tests__/lib/proposalAction.test.ts`.

### Verification

- Proposal-detail action ownership is consistent across device and flag paths.
- The same user persona does not get materially different workflow contracts from the same route without an explicit product reason.
- Verified with `npm run test:unit -- __tests__/lib/proposalAction.test.ts`.
- Verified with `npm run test:component -- __tests__/components/MobileStickyAction.test.tsx __tests__/components/ProposalActionZone.test.tsx`.
- Verified with `npm run lint -- app/proposal/[txHash]/[index]/page.tsx components/governada/proposals/ProposalActionZone.tsx components/governada/proposals/ProposalBridge.tsx components/governada/proposals/MobileStickyAction.tsx lib/navigation/proposalAction.ts`.
- Verified with `npm run agent:validate`.
- `npm run type-check` is currently blocked by unrelated in-branch errors in `inngest/functions/sync-dreps.ts` and `lib/koios.ts`.

### Files to Read First

- `app/proposal/[txHash]/[index]/page.tsx`
- `components/governada/proposals/ProposalActionZone.tsx`
- `components/governada/proposals/ProposalBridge.tsx`
- `components/governada/proposals/MobileStickyAction.tsx`

## Chunk 33: Reconcile `/you` Protection, Anonymous UI State, And Share URL Contract

**Priority:** P1
**Effort:** S
**Audit dimension(s):** Frontend UX Quality, Architecture and Code Health
**Expected score impact:** Critical user journeys: remove identity-surface route drift
**Depends on:** Chunk 29
**PR group:** P
**Implementation status:** Completed in this worktree

### Context

The identity journey currently mixes a protected route shell, a component that implements an anonymous connect state, and a legacy share URL that redirects back to `/you`.

### Scope

- Decide whether `/you` should stay protected or expose an anonymous-ready preview/connect state.
- Align the page shell and component state to that decision.
- Normalize the share URL contract away from legacy redirect indirection if the canonical destination is `/you`.

### Progress So Far

- `app/you/page.tsx` is now route-owned and validates session state before render.
- Added `lib/navigation/session.ts` so `/workspace` and `/you` share the same validated cookie lookup instead of duplicating session logic.
- Added `lib/navigation/civicIdentity.ts` so the canonical identity path and share URL live in one place.
- Updated `app/my-gov/identity/page.tsx`, `components/governada/MyGovClient.tsx`, `components/governada/shared/CivicIdentityCard.tsx`, `components/governada/identity/CivicIdentityProfile.tsx`, `components/governada/identity/MilestoneStamps.tsx`, and `components/governada/identity/CitizenMilestoneCelebration.tsx` to target the canonical `/you` contract.
- The remaining anonymous identity CTA now routes through `/?connect=1&returnTo=/you`, matching the protected-route recovery flow.
- Added focused regression coverage in `__tests__/lib/civicIdentityRoute.test.ts`.

### Verification

- `/you` and its shared URLs follow one explicit contract.
- The component no longer exposes unreachable fallback UI, or the route is opened to match the component.
- Verified with `npm run test:unit -- __tests__/proxy.test.ts __tests__/lib/returnTo.test.ts __tests__/lib/workspaceEntry.test.ts __tests__/lib/nav-config.test.ts __tests__/lib/civicIdentityRoute.test.ts`.
- Verified with `npm run lint -- app/you/page.tsx app/my-gov/identity/page.tsx app/workspace/page.tsx components/governada/MyGovClient.tsx components/governada/identity/CivicIdentityProfile.tsx components/governada/identity/MilestoneStamps.tsx components/governada/identity/CitizenMilestoneCelebration.tsx components/governada/shared/CivicIdentityCard.tsx lib/navigation/civicIdentity.ts lib/navigation/session.ts`.
- Verified with `npm run agent:validate`.
- Verified with `npm run type-check`.

### Files to Read First

- `proxy.ts`
- `app/you/page.tsx`
- `components/governada/identity/CivicIdentityProfile.tsx`
- `app/my-gov/identity/page.tsx`

## Chunk 34: Run Mobile Playwright Coverage In The Main E2E Workflow

**Priority:** P1
**Effort:** S
**Audit dimension(s):** Testing and Code Quality, Frontend UX Quality
**Expected score impact:** Testing and release gates: make the existing mobile test project count in CI
**Depends on:** None
**PR group:** Q
**Implementation status:** Completed in this worktree

### Context

The repo already defines a `mobile` Playwright project, but `.github/workflows/e2e.yml` only runs `--project=chromium`.

### Scope

- Update the main E2E workflow so it executes both configured browser projects or an explicit equivalent mobile smoke scope.
- Keep the artifact/reporting behavior understandable when multiple Playwright projects run.
- Confirm the workflow still aligns with the standalone build artifact path.

### Verification

- The main E2E workflow no longer ignores the configured mobile project.
- Mobile route regressions can fail the same post-merge browser gate as desktop regressions.

### Progress So Far

- `.github/workflows/e2e.yml` now installs both `chromium` and `webkit`.
- The post-merge E2E workflow now runs `npm run test:e2e -- --project=chromium --project=mobile`.
- `e2e/navigation.spec.ts` and `e2e/quick-match.spec.ts` now reflect the durable `/match` route contract so the mobile project tests current behavior instead of the pre-DD06 redirect shim.

### Verification Notes

- Verified with `npm run lint -- e2e/critical-journeys.spec.ts e2e/navigation.spec.ts e2e/quick-match.spec.ts e2e/smoke.spec.ts playwright.config.ts`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.

### Files to Read First

- `.github/workflows/e2e.yml`
- `playwright.config.ts`
- `e2e/`

## Chunk 35: Add A Required PR-Time Browser Gate For Critical Journeys

**Priority:** P0
**Effort:** M
**Audit dimension(s):** Testing and Code Quality, Performance and Reliability
**Expected score impact:** Testing and release gates: stop route-level regressions before merge instead of only after deploy
**Depends on:** None
**PR group:** Q
**Implementation status:** Completed in this worktree

### Context

Playwright currently runs only after `CI` succeeds on `main`, so PRs can merge route-level regressions without any browser-level proof.

### Scope

- Decide the smallest reliable PR-time browser gate for the critical journeys hardened in DD06.
- Keep runtime cost bounded instead of trying to make the full E2E suite mandatory on every PR.
- Align the chosen gate with `pre-merge-check` expectations and branch protection strategy.

### Verification

- PRs get a required browser-level signal before merge for the highest-risk route contracts.
- The selected gate is small enough to stay reliable and fast.

### Progress So Far

- `.github/workflows/ci.yml` now uploads the standalone build artifact on pull requests as well as `main` pushes.
- Added a dedicated `browser-smoke` CI job that runs focused Playwright coverage before merge against the built artifact instead of trying to run the entire E2E suite on every PR.
- Added `e2e/critical-journeys.spec.ts` to cover anonymous `/workspace`, anonymous `/you`, durable `/match`, and proposal-detail reachability from discovery.
- `e2e/smoke.spec.ts` now uses more durable `domcontentloaded` entry timing and longer visibility waits on the homepage shell assertions.

### Verification Notes

- Verified with `npm run lint -- e2e/critical-journeys.spec.ts e2e/navigation.spec.ts e2e/quick-match.spec.ts e2e/smoke.spec.ts playwright.config.ts`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.
- Verified the build-artifact runtime path with `npm run build` under CI-style placeholder env vars.
- Local browser execution remains only partially reproducible from the in-repo worktree:
  - dev-server Playwright runs are distorted by CSP/eval behavior in development
  - the local machine does not currently have Playwright WebKit installed for the `mobile` project
  - worktree standalone output nests under `.next/standalone/.claude/worktrees/platform-architecture-review-series/server.js`, while CI checkouts at the repo root and use `.next/standalone/server.js`

### Files to Read First

- `.github/workflows/ci.yml`
- `.github/workflows/e2e.yml`
- `package.json`
- `e2e/smoke.spec.ts`
- `e2e/navigation.spec.ts`
- `e2e/quick-match.spec.ts`

## Chunk 36: Raise Coverage Gates To Match High-Blast-Radius Contracts

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Testing and Code Quality, Architecture and Code Health
**Expected score impact:** Testing and release gates: make coverage a meaningful release signal again
**Depends on:** Chunk 37
**PR group:** R
**Implementation status:** Completed in this worktree

### Context

Current coverage enforcement only checks a small set of library files, which is no longer a strong proxy for the app’s route and contract risk.

### Scope

- Re-evaluate the `coverage.include` set in `vitest.config.ts`.
- Add or tighten thresholds for the highest-churn shared contracts surfaced in DD01-DD06.
- Prefer a small number of meaningful gates over a large number of token thresholds.

### Verification

- Passing coverage means the repo has real protection on the highest-blast-radius shared seams.
- Thresholds are intentionally chosen and documented, not historical leftovers.

### Progress So Far

- Expanded `vitest.config.ts` coverage to include `lib/syncPolicy.ts` plus the DD06 route-contract helpers in `lib/navigation/`.
- `.github/workflows/ci.yml` now enforces line thresholds for ten direct-test-backed high-blast-radius seams instead of three historical leftovers.
- Missing threshold targets now fail CI instead of being silently skipped out of the coverage report.
- The tightened gate passed on a fresh `npm run test:coverage` run, confirming the threshold set is conservative enough to be stable and meaningful.

### Verification Notes

- Verified with `npm run test:coverage`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.

### Files to Read First

- `vitest.config.ts`
- `.github/workflows/ci.yml`
- `__tests__/`
- DD01-DD06 artifacts in this folder

## Chunk 37: Stabilize The Full-Coverage Baseline Before Tightening Thresholds

**Priority:** P0
**Effort:** M
**Audit dimension(s):** Testing and Code Quality, Architecture and Code Health
**Expected score impact:** Testing and release gates: make `npm run test:coverage` trustworthy enough to support stronger thresholds
**Depends on:** None
**PR group:** R
**Implementation status:** Completed in this worktree

### Context

DD07 can only raise meaningful coverage thresholds once the full coverage command itself is green enough to act as a reliable signal. The latest baseline run is red for a mix of test drift, changed limiter behavior, and one syntax-level transform error.

### Scope

- Fix the unexpected `429` behavior or the stale mocks in the auth, delegation, and polls route tests.
- Resolve the vote-schema drift in the sync schema tests.
- Repair the `lib/sync/data-moat.ts` transform error that currently breaks one suite before coverage can complete cleanly.
- Align the stale `__tests__/app/match-page.test.tsx` expectation with the current page-shell call contract.

### Verification

- `npm run test:coverage` runs to completion.
- The remaining failures, if any, are narrow enough to support threshold tuning instead of general suite repair.

### Progress So Far

- Added explicit limiter mocks in `__tests__/api/auth.test.ts`, `__tests__/api/delegation.test.ts`, and `__tests__/api/polls.test.ts` so fail-closed rate limiting no longer causes unexpected `429` drift under coverage.
- Updated vote fixtures in `__tests__/sync/integration.test.ts` and `__tests__/sync/koios-schemas.test.ts` to match the current Koios vote schema.
- Repaired the `lib/sync/data-moat.ts` coverage transform failure by removing the broken legacy block comment markers around unreachable archival code.
- Aligned `__tests__/app/match-page.test.tsx` with the current page-shell call contract.
- Confirmed the repaired baseline by running a fresh green `npm run test:coverage`.

### Verification Notes

- Verified with `npm run test:unit -- __tests__/api/auth.test.ts __tests__/api/delegation.test.ts __tests__/api/polls.test.ts __tests__/sync/koios-schemas.test.ts __tests__/sync/integration.test.ts __tests__/sync/data-moat.test.ts`.
- Verified with `npm run test:component -- __tests__/app/match-page.test.tsx`.
- Verified with `npm run test:unit -- __tests__/lib/proposalAction.test.ts`.
- Verified with `npm run test:coverage`.

### Files to Read First

- `__tests__/api/auth.test.ts`
- `__tests__/api/delegation.test.ts`
- `__tests__/api/polls.test.ts`
- `__tests__/sync/integration.test.ts`
- `__tests__/sync/koios-schemas.test.ts`
- `lib/sync/data-moat.ts`
- `__tests__/app/match-page.test.tsx`

## Chunk 38: Resolve Document Locale And Direction Before Hydration

**Priority:** P0
**Effort:** S
**Audit dimension(s):** Frontend UX Quality, Testing and Code Quality
**Expected score impact:** Global readiness: remove the English-first first-paint contract for non-English and RTL users
**Depends on:** None
**PR group:** S
**Implementation status:** Completed in this worktree

### Context

The app already defined supported locales and RTL languages, but the root document shell was still rendered as `lang="en"` until the client locale provider mounted.

### Scope

- Resolve locale from cookie and `Accept-Language` before render.
- Apply `lang` and `dir` at the document shell in both the main and embed layouts.
- Preserve the server-selected locale through hydration instead of resetting to the default client state.
- Add focused regression coverage for locale resolution behavior.

### Verification

- Initial server render no longer hardcodes English when a supported cookie or request locale is present.
- RTL languages can set `dir="rtl"` before hydration.

### Progress So Far

- Added `resolvePreferredLocale()` in `lib/i18n/config.ts`.
- Updated `app/layout.tsx` and `app/embed/layout.tsx` to resolve locale server-side and set `lang` / `dir` before render.
- Updated `components/providers/LocaleProvider.tsx` to accept `initialLocale`.
- Added focused regression coverage in `__tests__/lib/i18n-config.test.ts`.

### Verification Notes

- Verified with `npm run test:unit -- __tests__/lib/i18n-config.test.ts`.
- Verified with `npm run lint -- app/layout.tsx app/embed/layout.tsx components/providers/LocaleProvider.tsx lib/i18n/config.ts`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.

### Files to Read First

- `app/layout.tsx`
- `app/embed/layout.tsx`
- `components/providers/LocaleProvider.tsx`
- `lib/i18n/config.ts`

## Chunk 39: Centralize Locale-Aware Time And Number Formatting

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Frontend UX Quality, Architecture and Code Health
**Expected score impact:** Global readiness: make selected language and timezone policy visible in actual content, not just chrome
**Depends on:** Chunk 38
**PR group:** S
**Implementation status:** Completed in this worktree

### Context

The repo now resolves document locale correctly, but user-facing dates and numbers are still formatted through scattered `toLocaleString()` calls and hardcoded `en-US` helpers.

### Scope

- Define the shared formatting policy for dates, times, and compact number displays.
- Add formatter helpers that can consume selected locale and any chosen timezone policy.
- Replace the highest-traffic hardcoded formatting surfaces first.
- Add focused regression coverage for the new formatter contract.

### Verification

- The same value formats consistently across public, workspace, and notification surfaces.
- Hardcoded `en-US` user-facing date formatting is removed from the highest-traffic routes.

### Progress So Far

- Added `lib/i18n/format.ts` as the first shared locale-aware formatter seam for numbers, dates, and times.
- Migrated the first public/global surfaces onto that helper:
  - `components/ui/AsyncContent.tsx`
  - `components/globe/TemporalScrubber.tsx`
  - `components/hub/DelegationHealthSummary.tsx`
  - `components/notifications/InboxFeed.tsx`
  - `components/treasury/TreasuryPersonalImpact.tsx`
- Finished the remaining high-traffic rollout in:
  - `components/hub/CitizenHub.tsx`
  - `components/hub/WorkspaceRationalesPage.tsx`
  - `components/admin/IntegrityDashboard.tsx`
- Added focused regression coverage in `__tests__/lib/i18n-format.test.ts`.

### Verification Notes

- Verified with `npm run test:unit -- __tests__/lib/i18n-config.test.ts __tests__/lib/i18n-format.test.ts`.
- Verified with `npm run lint -- app/layout.tsx app/embed/layout.tsx components/providers/LocaleProvider.tsx lib/i18n/config.ts lib/i18n/format.ts components/ui/AsyncContent.tsx components/globe/TemporalScrubber.tsx components/hub/DelegationHealthSummary.tsx components/notifications/InboxFeed.tsx components/treasury/TreasuryPersonalImpact.tsx`.
- Verified with `npm run lint -- components/hub/CitizenHub.tsx components/hub/WorkspaceRationalesPage.tsx components/admin/IntegrityDashboard.tsx lib/i18n/format.ts components/providers/LocaleProvider.tsx`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.

### Files to Read First

- `components/ui/AsyncContent.tsx`
- `components/globe/TemporalScrubber.tsx`
- `components/hub/CitizenHub.tsx`
- `components/hub/DelegationHealthSummary.tsx`
- `components/notifications/InboxFeed.tsx`
- `components/treasury/TreasuryPersonalImpact.tsx`

## Chunk 40: Add An Explicit Privacy And Legal Baseline For Analytics-Touched Surfaces

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Product Completeness vs. Vision, Frontend UX Quality
**Expected score impact:** Global readiness: align analytics behavior with discoverable privacy and legal disclosure
**Depends on:** None
**PR group:** T
**Implementation status:** Completed in this worktree

### Context

Analytics can initialize on mount when `NEXT_PUBLIC_POSTHOG_KEY` is configured, but the current app scan did not find dedicated privacy or terms routes, nor a clear in-app consent/disclosure surface tied to that behavior.

### Scope

- Decide the minimum production baseline for privacy-policy, terms, and analytics disclosure surfaces.
- Add or link the required public routes/components.
- If consent is required for the chosen posture, make the analytics initialization path respect it explicitly.
- Add focused verification around route discoverability and analytics gating behavior.

### Verification

- Privacy/legal surfaces are discoverable from the app shell.
- Analytics behavior matches the documented disclosure or consent posture.

### Progress So Far

- Added public `app/privacy/page.tsx` and `app/terms/page.tsx` routes as the explicit product baseline for privacy and terms disclosure.
- Added `components/governada/LegalLinks.tsx` and surfaced those links from the shared shell footer in `components/governada/GovernadaShell.tsx`.
- Added a footer disclosure line that points users to the privacy page when analytics is enabled in production deployments.
- Updated `lib/posthog.ts` so analytics initialization respects browser Do Not Track instead of always booting when a PostHog key is present.
- Added focused verification in `__tests__/components/LegalLinks.test.tsx` and `__tests__/lib/posthog.test.ts`.

### Verification Notes

- Verified with `npm run test:unit -- __tests__/lib/i18n-config.test.ts __tests__/lib/i18n-format.test.ts __tests__/lib/posthog.test.ts`.
- Verified with `npm run test:component -- __tests__/components/LegalLinks.test.tsx`.
- Verified with `npm run lint -- components/governada/LegalLinks.tsx components/governada/GovernadaShell.tsx lib/posthog.ts app/privacy/page.tsx app/terms/page.tsx`.
- Verified with `npm run type-check`.
- Verified with `npm run agent:validate`.

### Files to Read First

- `components/Providers.tsx`
- `lib/posthog.ts`
- shared shell/footer/navigation surfaces that should expose policy links
