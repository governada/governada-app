# Deep Dive 04 - Reliability and Observability

**Status:** In progress
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

## Evidence Collected

- `lib/env.ts` defines required and optional environment variables and raises on missing required vars.
- `instrumentation.ts` calls `validateEnv()` only in the `nodejs` runtime and initializes Sentry in both `nodejs` and `edge`.
- `app/api/health/route.ts`, `app/api/health/deep/route.ts`, `app/api/health/sync/route.ts`, and `app/api/health/ready/route.ts` provide multiple operational health surfaces with different scopes.
- `lib/sync-utils.ts` contains the shared sync logging, alerting, heartbeat, and anomaly-detection utilities.
- `inngest/functions/sync-freshness-guard.ts` implements a self-healing cron that retriggers stale syncs and heals missing epoch snapshots.
- `app/api/admin/integrity/route.ts` and `app/api/admin/integrity/alert/route.ts` provide admin/cron diagnosis and alerting flows.
- `lib/api/handler.ts` applies request logging, rate limiting, and cache headers for public API routes.
- `app/api/v1/dreps/[drepId]/history/route.ts` and `app/api/v1/dreps/[drepId]/votes/route.ts` are tier-gated public API routes that still inherit shared caching behavior.

## Findings

### 1. Operational diagnosis is fragmented across several health models

**Severity:** High

**Evidence**

- `app/api/health/route.ts` defines a broad per-sync threshold table and reports a composite `healthy/degraded/critical` status.
- `app/api/health/sync/route.ts` limits diagnosis to `proposals`, `dreps`, `scoring`, and `alignment` with a different threshold model.
- `app/api/admin/integrity/alert/route.ts` defines its own `SYNC_CONFIG` and retry/alert thresholds.
- `inngest/functions/sync-freshness-guard.ts` defines yet another freshness table and retrigger policy.

**Why it matters**

The same outage can be labeled differently depending on which monitor or alert path sees it first. That makes incident triage noisier, increases duplicate retriggers, and makes it harder to answer the first operational question: "Is the system actually degraded, or are we looking at a policy mismatch?"

### 2. Tier-gated API routes still inherit public CDN cache headers

**Severity:** High

**Evidence**

- `lib/api/handler.ts` applies shared `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` headers to successful GETs.
- `app/api/v1/dreps/[drepId]/history/route.ts` is a pro-tier route returning cached history.
- `app/api/v1/dreps/[drepId]/votes/route.ts` is a pro-tier route returning cached vote history.

**Why it matters**

Authenticated or tier-gated responses should not silently share the same CDN caching policy as anonymous public reads. Even if the payload is identical for all pro users, this is a brittle default because revocation, entitlement changes, and incident debugging become harder once authorization-sensitive responses are publicly cacheable by default.

### 3. Snapshot health failures are swallowed by the main health endpoint

**Severity:** Medium

**Evidence**

- `app/api/health/route.ts` computes snapshot health across many tables.
- That same route explicitly swallows snapshot-health exceptions as "best effort."

**Why it matters**

The main health endpoint is supposed to explain compounding and freshness problems. If the snapshot check itself fails, the endpoint still returns a response without surfacing that the snapshot diagnostic layer is blind. That creates false confidence during the exact kind of failure this endpoint should help diagnose.

## Risk Ranking

1. Fragmented operational diagnosis across multiple threshold models.
2. Public caching applied to tier-gated API responses.
3. Snapshot health failures hidden behind best-effort error swallowing.

## Open Questions

- Should the health/freshness thresholds be centralized into a single policy source that both alerting and monitoring consume?
- Should tier-gated API responses use `private` caching or a separate cache policy entirely?
- Should snapshot-health failures escalate into an explicit degraded status instead of being swallowed?

## Next Actions

1. Pull the next scan toward the sync/alert policy layer and decide whether the threshold tables should be unified or merely normalized.
2. Trace the remaining admin alert and API health paths for duplicated logic and missing correlation data.
3. Decide whether the pro-tier API cache behavior is intentional enough to keep or should be tightened before further release work.

## Handoff

**Current status:** In progress

**What changed this session**

- Investigated env validation, health endpoints, logging, Sentry, cron/heartbeat coverage, and failure diagnosis paths.
- Validated three concrete reliability/observability issues with file-level evidence.
- Identified the main operational risk as inconsistent diagnosis rather than missing monitoring surface area.

**Evidence collected**

- `lib/env.ts`
- `instrumentation.ts`
- `middleware.ts`
- `lib/api/handler.ts`
- `lib/sync-utils.ts`
- `lib/sentry-cron.ts`
- `app/api/health/route.ts`
- `app/api/health/deep/route.ts`
- `app/api/health/sync/route.ts`
- `app/api/health/ready/route.ts`
- `app/api/admin/integrity/route.ts`
- `app/api/admin/integrity/alert/route.ts`
- `inngest/functions/sync-freshness-guard.ts`
- `app/api/v1/dreps/[drepId]/history/route.ts`
- `app/api/v1/dreps/[drepId]/votes/route.ts`

**Validated findings**

- Operational diagnosis is fragmented across several health models.
- Tier-gated API routes still inherit public CDN cache headers.
- Snapshot health failures are swallowed by the main health endpoint.

**Open questions**

- See the `Open Questions` section above.

**Next actions**

- Continue the observability pass on remaining alerting and recovery paths.
- Decide whether the health policy should be centralized before implementation work begins.
- If the cache policy is deemed acceptable, document why; otherwise, treat it as a fix candidate.

**Next agent starts here**

Start with the threshold policy layer: `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts`. The goal is to determine whether one canonical freshness policy can replace the current overlap.
