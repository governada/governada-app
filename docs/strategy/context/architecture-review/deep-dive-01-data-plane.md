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

**Implementation status**

- Partially improved in this worktree.
- `getAllDReps()` no longer falls back to Koios when the Supabase cache is empty or unavailable.
- The legacy `/api/dreps` route now returns an explicit degraded payload with empty arrays instead of silently switching sources or shape-breaking client callers.
- Remaining direct Koios usage in the shared data layer still exists for governance-threshold lookup in `getVotingPowerSummary()`, so this finding remains open.

### 2. DRep freshness logic was misaligned with the actual sync cadence

**Severity:** Fixed in this worktree

**Evidence**

- `lib/data.ts` previously used a 15-minute freshness threshold for DRep reads even though the canonical sync runs every 6 hours.
- `inngest/functions/sync-dreps.ts:83` schedules the canonical DRep sync every 6 hours.
- `lib/syncPolicy.ts` now defines the shared DRep freshness contract for cadence, retrigger threshold, and degraded threshold.
- `lib/data.ts` now retriggers background sync only after the shared overdue threshold is exceeded.
- `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts` now consume the shared DRep policy instead of hand-maintaining the read-path value.

**Why it matters**

By policy, normal DRep data can be 6 hours old between scheduled syncs. The old implementation treated data older than 15 minutes as stale, so expected state looked overdue for most of the sync window and could repeatedly trigger extra background sync events in production.

**Implementation status**

- Fixed in this worktree with a layered policy:
  - scheduled cadence: 6 hours
  - read-plane retrigger threshold: 8 hours
  - operator-facing degraded threshold: 12 hours
- Added regression coverage in `__tests__/lib/data.test.ts`.
- Verified with `npm run test:unit -- __tests__/lib/data.test.ts __tests__/api/health.test.ts`.
- Verified cross-file typing with `npm run type-check`.

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

**Implementation status**

- Partially improved in this worktree.
- `proposal_vote_snapshots` is now treated as a historical previous-epoch snapshot owned by `generate-epoch-summary.ts`.
- `lib/sync/proposals.ts` no longer writes that table, and `check-snapshot-completeness.ts` now validates the previous epoch instead of the current one.
- `sync-dreps` no longer writes current-epoch `delegation_snapshots` or `drep_score_history`; `sync-drep-scores` is now the sole current-epoch owner for both tables.
- `sync-drep-scores` now preserves or backfills `new_delegators` and `lost_delegators` on same-epoch reruns instead of nulling them out.
- Previous-epoch `delegation_snapshots` ownership still overlaps with `generate-epoch-summary.ts`, so this finding remains open.

## Risk Ranking

1. Public API contract bug: `active_only` does not mean active.
2. Remaining snapshot ownership overlap in previous-epoch `delegation_snapshots`.
3. Remaining database-first boundary violations still exist in shared data helpers.
4. Broader health-policy duplication still exists outside the DRep freshness slice.

## Open Questions

- Which other read helpers besides the DRep path bypass the database-first boundary under degradation?
- Should other sync domains adopt the same layered freshness model now used for DReps, or is a broader health-policy refactor still needed first?
- Should `generate-epoch-summary.ts` remain the previous-epoch finalizer for `delegation_snapshots`, or should that responsibility move fully into the scoring/data pipeline?

## Next Actions

1. Continue tracing proposal, engagement, and workspace data paths to see whether the same boundary problems repeat outside the DRep flow.
2. Decide the target ownership model for previous-epoch `delegation_snapshots`.
3. Remove the remaining direct Koios usage from shared data helpers, starting with governance-threshold lookup.

## Handoff

**Current status:** In progress

**What changed this session**

- Fixed the DRep freshness-policy mismatch by introducing a shared DRep sync policy.
- Updated the DRep read path to retrigger only when data is actually overdue.
- Aligned the main health, sync health, admin integrity alert, and freshness-guard surfaces to the shared DRep policy.
- Added focused regression coverage for the DRep freshness behavior and revalidated the health endpoint behavior.

**Evidence collected**

- `CLAUDE.md`
- `docs/strategy/context/build-manifest.md`
- `docs/strategy/context/audit-rubric.md`
- `lib/data.ts`
- `middleware.ts`
- `instrumentation.ts`
- `lib/env.ts`
- `lib/api/handler.ts`
- `lib/syncPolicy.ts`
- `lib/scoring/delegationSnapshots.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `__tests__/lib/data.test.ts`
- `__tests__/api/health.test.ts`
- `__tests__/scoring/delegationSnapshots.test.ts`

**Validated findings**

- The main shared DRep list read no longer falls back to Koios, but shared data helpers still contain direct upstream reads for governance thresholds.
- DRep freshness is now governed by an explicit layered policy instead of a false-stale 15-minute read threshold.
- The public `active_only` DRep API flag currently maps to documentation completeness rather than active status. Fixed earlier in this worktree.
- `proposal_vote_snapshots` is now owned by the epoch-summary path, and current-epoch `delegation_snapshots` plus `drep_score_history` are now scoring-owned. Previous-epoch `delegation_snapshots` ownership still needs a final decision.

**Open questions**

- See the `Open Questions` section above.

**Next actions**

- Continue the deep dive into proposals and engagement paths to determine whether the same anti-patterns repeat.
- Remove the remaining shared-data direct Koios reads, starting with governance-threshold lookup.
- Choose a final owner model for previous-epoch `delegation_snapshots` before closing the data-plane review.

**Next agent starts here**

Start with the remaining direct Koios lookup in `lib/data.ts:getVotingPowerSummary()`, then decide whether that data belongs in Supabase or in a clearly isolated upstream-only helper. After that, finish the previous-epoch `delegation_snapshots` ownership decision.
