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

### Files to Read First

- `lib/data.ts`
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

### Files to Read First

- `app/api/health/route.ts`
- `app/api/health/sync/route.ts`
- `app/api/admin/integrity/alert/route.ts`
- `inngest/functions/sync-freshness-guard.ts`

## Chunk 8: Revisit Cache Policy for Tier-Gated Public API GETs

**Priority:** P1
**Effort:** M
**Audit dimension(s):** Performance and Reliability, API and Integration Readiness
**Expected score impact:** Reliability and trust: safer caching behavior on gated endpoints
**Depends on:** None
**PR group:** H

### Context

The shared public API wrapper currently applies public CDN caching to every successful GET, including tier-gated endpoints.

### Scope

- Decide whether tier-gated GET responses should remain publicly cacheable.
- If not, change the wrapper or route-level overrides so gated endpoints use a safer cache policy.
- Add tests proving the wrapper behavior for anonymous versus gated GETs.

### Decision Points

The executing agent should confirm whether the product intentionally wants public caching for entitlement-gated but non-user-specific data. If not, tighten it.

### Verification

- Cache headers differ appropriately between anonymous public routes and tier-gated routes.
- Tests cover both cases.

### Files to Read First

- `lib/api/handler.ts`
- `app/api/v1/dreps/[drepId]/history/route.ts`
- `app/api/v1/dreps/[drepId]/votes/route.ts`
