# Deep Dive 01 - Data Plane

**Status:** In progress
**Started:** 2026-04-02
**Owner branch:** `feature/platform-architecture-review-series`
**Review goal:** verify truth boundaries, freshness guarantees, fallback behavior, and read-model correctness from source ingestion through page and API consumption.

## Scope

This deep dive covers:

- External source ingestion boundaries
- Background sync and scheduling
- Supabase storage and snapshot discipline
- Shared read layer behavior
- Data-serving API routes and page consumers
- Failure modes when cache, sync, or upstream dependencies degrade

## Review Questions

1. Where is the canonical source of truth for each major data domain?
2. What guarantees exist for freshness, and where are they only best-effort?
3. Do degraded-mode fallbacks preserve product correctness or silently change semantics?
4. Which invariants are enforced in code versus documented as policy?
5. Which areas need structural changes before incremental fixes are safe?

## Files to Read First

- `lib/data.ts`
- `lib/supabase.ts`
- `lib/env.ts`
- `lib/constants.ts`
- `lib/sync/`
- `inngest/functions/`
- `app/api/`
- `docs/strategy/context/build-manifest.md`

## Evidence Collected So Far

- Repo guidance explicitly requires database-first reads via `lib/data.ts`, with no direct Koios calls from pages or components.
- `lib/data.ts` is currently a high-centrality shared module at about 2,013 lines.
- The repo exposes a very broad surface area: 91 page routes and about 306 route handlers.
- `middleware.ts` and `lib/api/handler.ts` already centralize part of the operational boundary, which reduces some platform drift outside the data layer.
- `vitest.config.ts` prioritizes algorithmic coverage, while current E2E coverage is small relative to route count.

## Initial System Boundary Snapshot

From current documentation and code inspection, the intended flow is:

`Koios and other upstream sources -> Inngest sync functions -> Supabase cached tables and snapshots -> lib/data.ts and adjacent read helpers -> Next.js pages and API routes`

This is the right overall shape. The main review risk is not missing architecture. The main risk is that the implementation may have accumulated mixed responsibilities and degraded-mode exceptions inside the shared read layer.

## Initial Risk Hypotheses

1. `lib/data.ts` likely mixes too many concerns: query orchestration, transformation, caching, freshness checks, fallback behavior, and domain-specific aggregation.
2. Cache fallback paths that jump back to upstream sources may preserve uptime while violating the intended database-first semantic boundary.
3. Freshness signaling appears partially process-local, which may be insufficient in a multi-instance deployment.
4. The route surface area suggests there may be multiple consumer-specific data access patterns rather than a clean set of stable read models.

## Findings

### 1. The shared DRep read path violates the documented database-first contract

**Severity:** High

**Evidence**

- `lib/data.ts:7` imports `getEnrichedDReps` from the Koios integration layer.
- `lib/data.ts:229` and `lib/data.ts:291` fall back to `getEnrichedDReps(false)` when Supabase is empty or unavailable.
- `lib/data.ts:2020-2021` fetches governance thresholds directly from `@/utils/koios`.

**Why it matters**

The intended architecture is database-first reads through cached Supabase data. In degraded mode, the current implementation silently changes semantics by switching to upstream live fetches. That increases latency variance, couples user-facing availability to upstream health, and makes behavior under failure materially different from normal operation.

### 2. DRep freshness logic is misaligned with the actual sync cadence

**Severity:** High

**Evidence**

- `lib/data.ts:13` sets `CACHE_FRESHNESS_MINUTES = 15`.
- `lib/data.ts:135-136` documents that DRep data changes every 6 hours.
- `lib/data.ts:154` emits `drepscore/sync.dreps` when the cache is considered stale.
- `lib/data.ts:133` debounces that trigger for only 10 minutes.
- `inngest/functions/sync-dreps.ts:83` schedules the canonical DRep sync every 6 hours.

**Why it matters**

By policy, normal DRep data can be 6 hours old between scheduled syncs. By implementation, data older than 15 minutes is treated as stale. That means the app will classify expected state as stale for most of the sync window and can repeatedly trigger extra background sync events in production.

### 3. The public DRep API exposes incorrect semantics for `active_only`

**Severity:** High

**Evidence**

- `app/api/v1/dreps/route.ts:22` defines the public parameter as `active_only`.
- `app/api/v1/dreps/route.ts:51` uses that flag to choose between `dreps` and `allDReps`.
- `lib/data.ts:264-275` shows that `dreps` is actually the `wellDocumentedDReps` subset, not the active subset.

**Why it matters**

External consumers asking for active-only DReps are currently receiving a documentation-quality filter instead of an activity-status filter. This is a contract bug in a public API, not just an internal naming issue.

### 4. Snapshot ownership is split across two sync stages, creating order-dependent writes

**Severity:** High

**Evidence**

- `lib/sync/dreps.ts:558-617` writes `delegation_snapshots` and `drep_score_history` during the DRep sync post-processing phase.
- `inngest/functions/sync-drep-scores.ts:540-618` writes `drep_score_history` and `delegation_snapshots` again during the score computation phase.
- `inngest/functions/sync-dreps.ts:181-187` explicitly triggers the scoring sync after the DRep sync.
- `inngest/functions/generate-epoch-summary.ts:709` writes `proposal_vote_snapshots`.
- `inngest/functions/generate-epoch-summary.ts:819` writes `delegation_snapshots`.
- `lib/sync/proposals.ts:341-369` also writes `proposal_vote_snapshots`.

**Why it matters**

Multiple jobs currently own the same snapshot tables. Final state therefore depends on job order, epoch timing, and follow-on job success. A partial failure can leave partially refreshed rows with different semantics than the fully completed pipeline.

## Risk Ranking

1. Public API contract bug: `active_only` does not mean active.
2. Freshness policy mismatch causing unnecessary background sync churn.
3. Database-first boundary violation in degraded reads.
4. Split ownership of snapshot tables across sync stages and epoch-summary jobs.

## Open Questions

- Which other read helpers besides the DRep path bypass the database-first boundary under degradation?
- Should freshness be defined per domain by sync SLA, or should the read layer expose explicit freshness metadata without self-triggering syncs?
- Which sync stage should be the sole owner of `delegation_snapshots`, `drep_score_history`, and `proposal_vote_snapshots`?

## Next Actions

1. Split the validated findings above into execution chunks and rank them by blast radius.
2. Continue tracing proposal, engagement, and workspace data paths to see whether the same boundary problems repeat outside the DRep flow.
3. Decide the target ownership model for DRep snapshots before implementation starts.

## Handoff

**Current status:** In progress

**What changed this session**

- Created the architecture review series scaffold.
- Established the review order and the first active deep dive.
- Validated four concrete data-plane findings with file-level evidence.
- Converted the data-plane review from hypothesis gathering into an execution-ready state.

**Evidence collected**

- `CLAUDE.md`
- `docs/strategy/context/build-manifest.md`
- `docs/strategy/context/audit-rubric.md`
- `lib/data.ts`
- `middleware.ts`
- `instrumentation.ts`
- `lib/env.ts`
- `lib/api/handler.ts`
- `vitest.config.ts`
- `playwright.config.ts`

**Validated findings**

- The shared DRep read path falls back to Koios and therefore violates the database-first contract.
- DRep freshness logic is inconsistent with the 6-hour sync cadence and can trigger unnecessary background syncs.
- The public `active_only` DRep API flag currently maps to documentation completeness rather than active status.
- `delegation_snapshots`, `drep_score_history`, and `proposal_vote_snapshots` have split ownership across multiple sync and epoch-summary jobs.

**Open questions**

- See the `Open Questions` section above.

**Next actions**

- Promote the validated findings into PR-sized execution chunks.
- Continue the deep dive into proposals and engagement paths to determine whether the same anti-patterns repeat.
- Choose a single-owner model for the affected snapshot tables before implementation.

**Next agent starts here**

Start with the new backlog chunks for the DRep path findings, then inspect proposal and engagement read paths for the same two issues: degraded-mode upstream fallbacks and semantic drift between API names and actual filters.
