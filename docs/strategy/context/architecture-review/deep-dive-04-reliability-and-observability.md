# Deep Dive 04 - Reliability and Observability

**Status:** Completed
**Started:** 2026-04-03
**Owner branch:** `feature/platform-architecture-review-series`
**Review goal:** verify env validation, health checks, deploy/runtime safeguards, logging, Sentry/instrumentation, cron/heartbeat coverage, and operational failure diagnosis.

## Scope

This pass covers the operational surfaces that determine whether the app can fail loudly, fail consistently, and be diagnosed quickly:

- Environment validation and startup safeguards
- Health endpoints and readiness/liveness behavior
- Logging, Sentry, and request-error capture
- Cron and heartbeat coverage for sync jobs
- Failure diagnosis paths for syncs, alerts, and admin integrity checks
- Deploy and preview verification confidence

## Evidence Collected

- `lib/env.ts`
- `instrumentation.ts`
- `middleware.ts`
- `proxy.ts`
- `lib/api/handler.ts`
- `lib/syncPolicy.ts`
- `lib/sync-utils.ts`
- `lib/runtimeMetadata.ts`
- `lib/sentry-cron.ts`
- `app/api/health/route.ts`
- `app/api/health/deep/route.ts`
- `app/api/health/sync/route.ts`
- `app/api/health/ready/route.ts`
- `app/api/admin/integrity/route.ts`
- `app/api/admin/integrity/alert/route.ts`
- `inngest/functions/sync-freshness-guard.ts`
- `.github/workflows/post-deploy.yml`
- `.github/workflows/preview.yml`
- `scripts/deploy-verify.ts`
- `scripts/lib/deployVerification.ts`
- `scripts/smoke-test.ts`
- `scripts/check-deploy-health.mjs`
- `package.json`
- `AGENTS.md`
- `README.md`
- `__tests__/api/health-ready.test.ts`
- `__tests__/api/health.test.ts`
- `__tests__/api/health-sync.test.ts`
- `__tests__/api/v1-dreps.test.ts`
- `__tests__/api/v1-drep-history.test.ts`
- `__tests__/instrumentation.test.ts`
- `__tests__/proxy.test.ts`
- `__tests__/lib/syncPolicy.test.ts`
- `__tests__/lib/runtimeMetadata.test.ts`
- `__tests__/scripts/deployVerification.test.ts`

## Findings

### 1. Operational diagnosis was fragmented across several health models

**Severity:** Fixed in this worktree

**Evidence**

- `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts` previously maintained their own stale-threshold tables.
- The threshold drift was concrete, not cosmetic:
  - `proposals` used `90` minutes in broad health and self-healing, but `120` in simple liveness.
  - `secondary`, `scoring`, `alignment`, `treasury`, and `ghi` all diverged across the four surfaces.
- Missing-row handling also drifted, especially around "never ran" sync types.

**Why it matters**

The same outage could be labeled differently depending on which operator surface saw it first. That creates noisy triage, duplicate retriggers, and unclear incident ownership.

**Implementation status**

- Fixed in this worktree.
- `lib/syncPolicy.ts` now defines a layered canonical sync registry instead of one local threshold map per surface.
- The shared policy models intentionally different meanings:
  - `retriggerAfterMinutes` for self-healing and alerting
  - `degradedAfterMinutes` / `criticalAfterMinutes` for broad health
  - `externalCriticalAfterMinutes` for simple external liveness
- `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts` now consume that shared policy.
- Auto-healing is now gated on sync types that actually define an event instead of assuming every monitored type is triggerable.

### 2. Tier-gated API routes still inherited public CDN cache headers

**Severity:** Fixed in this worktree

**Evidence**

- `lib/api/handler.ts` previously applied shared public GET caching to successful tier-gated responses.
- `app/api/v1/dreps/[drepId]/history/route.ts` and `app/api/v1/dreps/[drepId]/votes/route.ts` are pro-tier routes that inherited that default.

**Why it matters**

Authenticated or entitlement-sensitive responses should not silently share public CDN cache semantics. Even when the payload is user-agnostic, the cache policy is the wrong default for trust and incident handling.

**Implementation status**

- Fixed earlier in this worktree by switching tier-gated successful GETs to `Cache-Control: private, no-store`.
- Verified with `__tests__/api/v1-drep-history.test.ts` and `__tests__/api/v1-dreps.test.ts`.

### 3. Snapshot health failures were swallowed by the main health endpoint

**Severity:** Fixed in this worktree

**Evidence**

- `app/api/health/route.ts` computed snapshot health across many tables.
- That same route swallowed snapshot-diagnostic exceptions as "best effort", which meant the endpoint could stay apparently healthy while its own diagnostic layer was blind.

**Why it matters**

If the snapshot diagnostic layer fails, operators need to know that the health endpoint has lost part of its visibility. Silent failure creates false confidence during incident response.

**Implementation status**

- Fixed in this worktree.
- `app/api/health/route.ts` now returns explicit snapshot status metadata instead of swallowing diagnostic failure.
- Snapshot diagnostic failure now degrades the top-level health result instead of leaving the route silently optimistic.
- Snapshot check results are now rolled into a top-level snapshot status instead of being returned as an unranked sidecar payload.

### 4. Operational monitoring failed open when observability and alerting env wiring was missing

**Severity:** Fixed in this worktree

**Evidence**

- `lib/env.ts` previously validated only runtime-critical variables and treated Sentry, Discord, email, heartbeat, and related ops integrations as optional.
- `instrumentation.ts` will disable Sentry when `NEXT_PUBLIC_SENTRY_DSN` is absent.
- `lib/sync-utils.ts` will silently no-op for alert delivery, heartbeat pings, and analytics deploy hooks when related env vars are absent unless another surface reports that contract loss explicitly.

**Why it matters**

A production deploy can come up "healthy" while error monitoring, operator alerting, or external cron visibility is effectively disabled. That is an operability failure, not a convenience.

**Implementation status**

- Fixed in this worktree.
- `lib/env.ts` now defines and reports an explicit ops-critical env contract instead of treating all monitoring and alerting keys as generic optional vars.
- `app/api/health/route.ts` now returns `operations` status and degrades top-level health when ops-critical wiring is missing.
- `app/api/health/deep/route.ts` now returns `dependencies.operational_env` and degrades deep health when ops-critical wiring is missing.
- This keeps local boot ergonomics intact while making production-targeted verification fail visibly instead of silently accepting missing operator visibility wiring.

### 5. Cron observability coverage was too thin relative to the number of scheduled jobs

**Severity:** Fixed in this worktree

**Evidence**

- The repo has many cron-triggered Inngest jobs, but only a subset currently have durable Sentry Cron or heartbeat coverage.
- Freshness-critical jobs like `sync-drep-scores`, `generate-epoch-summary`, and `sync-freshness-guard` are especially important to cover consistently.

**Why it matters**

World-class observability requires durable visibility into the jobs that gate freshness, epoch transitions, and operator alerts. Missing cron instrumentation means silent missed runs remain possible.

**Implementation status**

- Fixed in this worktree for the tier-1 set.
- The repo now uses an explicit tier-1 scheduled-job set instead of treating cron instrumentation as opportunistic:
  - `sync-drep-scores`
  - `sync-alignment`
  - `sync-freshness-guard`
  - `generate-epoch-summary`
- `lib/sentry-cron.ts` now supports monitor runtime overrides so long-running jobs can declare accurate Sentry Cron budgets.
- All four tier-1 jobs now have Sentry Cron coverage and dedicated external heartbeat hooks.
- `alert-integrity` no longer has Sentry monitor schedule drift; its monitor schedule now matches the actual cron trigger.
- `.env.example`, `lib/env.ts`, `scripts/uptime-check.mjs`, and `docs/observability-setup.md` now reflect the current tier-1 heartbeat set instead of the stale 3-heartbeat/6-monitor posture.

### 6. Deploy and preview verification were time-based and not release-aware

**Severity:** Fixed in this worktree

**Evidence**

- `.github/workflows/post-deploy.yml` previously waited a fixed interval before smoke tests rather than proving it was checking the intended release.
- `.github/workflows/preview.yml` previously treated readiness as enough and hardcoded success messaging.
- `scripts/smoke-test.ts` previously accepted any `200` from the health routes and did not verify release identity.

**Why it matters**

Verification that can target the wrong release or the wrong URL creates false positives. That weakens the entire reliability story even when smoke tests technically pass.

**Implementation status**

- Fixed in this worktree.
- `lib/runtimeMetadata.ts` now exposes runtime release identity, and the health/readiness routes return it.
- `scripts/deploy-verify.ts` now polls readiness until the expected commit SHA is live before running the endpoint suite.
- `scripts/lib/deployVerification.ts` now treats health routes semantically instead of accepting any `200`, and it distinguishes production from preview verification.
- `.github/workflows/post-deploy.yml` now verifies `github.event.workflow_run.head_sha` instead of sleeping for a fixed interval and checking whatever is live.
- `.github/workflows/preview.yml` now verifies the PR head SHA and no longer hardcodes smoke-test counts in the PR comment.
- `package.json`, `AGENTS.md`, and `README.md` now point operators at the canonical `npm run deploy:verify` wrapper.

## Risk Ranking

1. Lower-tier scheduled jobs still rely on explicit product judgment about whether they deserve durable cron instrumentation.
2. Snapshot policy itself is still broader than the freshness-policy layer and may need its own canonical registry in a later pass.

## Open Questions

- Should the new tier-1 heartbeat URLs become part of the ops-critical env contract once production monitors are provisioned?
- Is the preview URL template sufficient long-term, or should preview verification eventually resolve provider-native preview URLs directly from deployment metadata?

## Next Actions

1. Decide whether preview URL resolution should move from a configured template to provider-native deployment metadata.
2. Decide whether the new tier-1 heartbeat URLs should graduate into the ops-critical env contract after infrastructure provisioning.
3. Treat any broader scheduled-job instrumentation as a separate prioritization exercise, not an automatic follow-on from this deep dive.

## Handoff

**Current status:** Completed

**What changed this session**

- Replaced the drifting per-route freshness tables with a layered canonical sync policy in `lib/syncPolicy.ts`.
- Updated `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts` to consume that shared policy.
- Fixed the main health endpoint so snapshot-diagnostic failures surface explicitly and degrade the top-level health result instead of being swallowed.
- Updated `app/api/health/deep/route.ts` to document the current Redis dependency posture accurately after the earlier rate-limit hardening work.
- Added runtime release metadata in `lib/runtimeMetadata.ts` and exposed it through `app/api/health/ready/route.ts`, `app/api/health/route.ts`, and `app/api/health/deep/route.ts`.
- Added `scripts/deploy-verify.ts` and `scripts/lib/deployVerification.ts` so deploy verification waits for the expected release SHA and treats health routes semantically instead of accepting any `200`.
- Updated `.github/workflows/post-deploy.yml` and `.github/workflows/preview.yml` to use the canonical `npm run deploy:verify` wrapper.
- Aligned operator docs and wrappers in `package.json`, `AGENTS.md`, and `README.md`.
- Added an explicit ops-critical env contract in `lib/env.ts` and surfaced it through `app/api/health/route.ts` and `app/api/health/deep/route.ts` so missing Sentry, site URL, heartbeat, or alert-webhook wiring degrades health instead of failing open.
- Added monitor runtime overrides in `lib/sentry-cron.ts` and regression coverage in `__tests__/lib/sentry-cron.test.ts`.
- Added dedicated heartbeat env hooks plus Sentry Cron coverage for the tier-1 jobs `sync-drep-scores`, `sync-alignment`, `sync-freshness-guard`, and `generate-epoch-summary`.
- Fixed `alert-integrity` monitor schedule drift and updated `scripts/uptime-check.mjs`, `.env.example`, and `docs/observability-setup.md` so tooling and docs match the current cron coverage posture.
- Pulled in parallel scout findings for runtime-boundary mapping, ops env contracts, cron coverage, and deploy verification gaps.

**Validated findings**

- Operational diagnosis no longer depends on four drifting stale-threshold tables. Fixed in this worktree.
- Tier-gated API routes no longer inherit public CDN cache headers. Fixed earlier in this worktree.
- Snapshot diagnostic failure now surfaces instead of being silently swallowed. Fixed in this worktree.
- Deploy and preview verification now prove release identity and fail on semantic health drift instead of sleeping and accepting any `200`.
- Ops-critical env wiring no longer fails open; health surfaces now expose and degrade on missing operator visibility wiring.
- Tier-1 cron coverage now has explicit Sentry Cron and external heartbeat coverage instead of depending on opportunistic instrumentation.

**Verification**

- Passed `npm run test:unit -- __tests__/lib/syncPolicy.test.ts __tests__/api/health.test.ts __tests__/api/health-sync.test.ts`.
- Passed `npm run test:unit -- __tests__/api/health-ready.test.ts __tests__/api/health.test.ts __tests__/lib/runtimeMetadata.test.ts __tests__/scripts/deployVerification.test.ts`.
- Passed `npm run test:unit -- __tests__/api/health-ready.test.ts __tests__/api/health.test.ts __tests__/api/health-deep.test.ts __tests__/lib/runtimeMetadata.test.ts __tests__/lib/env.test.ts __tests__/scripts/deployVerification.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/sentry-cron.test.ts __tests__/api/health-ready.test.ts __tests__/api/health.test.ts __tests__/api/health-deep.test.ts __tests__/lib/runtimeMetadata.test.ts __tests__/lib/env.test.ts __tests__/scripts/deployVerification.test.ts`.
- Passed `npm run agent:validate`.
- Passed `npm run type-check`.
- Passed focused lint for `lib/syncPolicy.ts`, `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts`.
- Passed focused lint for `app/api/health/ready/route.ts`, `app/api/health/route.ts`, `app/api/health/deep/route.ts`, and `lib/runtimeMetadata.ts`.
- Passed focused lint for `lib/env.ts`, `app/api/health/route.ts`, and `app/api/health/deep/route.ts`.
- Passed focused lint for `lib/sentry-cron.ts`, `lib/env.ts`, `inngest/functions/sync-drep-scores.ts`, `inngest/functions/sync-alignment.ts`, `inngest/functions/sync-freshness-guard.ts`, `inngest/functions/generate-epoch-summary.ts`, and `inngest/functions/alert-integrity.ts` (test-file ignore warning only, no errors).

**Open questions**

- See the `Open Questions` section above.

**Next actions**

- Treat provider-native preview URL discovery as a follow-up enhancement, not a blocker to the DD04 closeout.
- Revisit the ops-critical env contract only after the new tier-1 heartbeat monitors exist in production.

**Next agent starts here**

Deep Dive 04 is closed for the review series. Start with Deep Dive 03 in `docs/strategy/context/architecture-review/deep-dive-03-runtime-architecture.md`, and only reopen DD04 if deployment metadata or heartbeat provisioning exposes a concrete gap.
