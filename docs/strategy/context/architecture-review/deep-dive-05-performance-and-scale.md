# Deep Dive 05 - Performance and Scale

**Status:** Completed
**Started:** 2026-04-05
**Owner branch:** `feature/platform-architecture-review-series`
**Review goal:** verify cache strategy, query fan-out, bundle shape, route dynamism, and load readiness so high-traffic public surfaces and long-running sync paths do not degrade as usage grows.

## Scope

This pass focuses on the parts of the app where traffic growth or data growth will turn current design choices into real latency, cost, or reliability problems:

- anonymous landing and public API hot paths
- proposal list/detail query fan-out and cache shape
- workspace/reviewer shared-state fan-out
- background sync jobs whose cost grows with historical corpus size
- route dynamism and client/runtime pressure on the page surface
- load-test and bundle-analysis readiness

## Evidence Collected

- `package.json`
- `next.config.ts`
- `scripts/bundle-report.ts`
- `tests/load/scenarios/api-v1.js`
- `app/page.tsx`
- `components/hub/HubHomePage.tsx`
- `components/globe/GlobeLayout.tsx`
- `components/globe/ListOverlay.tsx`
- `app/api/proposals/route.ts`
- `app/api/governance/pulse/route.ts`
- `app/api/v1/proposals/route.ts`
- `app/proposal/[txHash]/[index]/page.tsx`
- `lib/data.ts`
- `lib/governance/proposalList.ts`
- `lib/governance/proposalVotingSummary.ts`
- `lib/koios.ts`
- `lib/redis.ts`
- `hooks/queries.ts`
- `lib/workspace/reviewQueue.ts`
- `lib/workspace/proposalMonitor.ts`
- `lib/sync/proposals.ts`
- `lib/sync/votes.ts`
- `lib/sync/dreps.ts`
- `lib/sync/data-moat.ts`
- `lib/sync/slow.ts`
- `types/database.ts`
- `utils/koios.ts`
- `supabase/migrations/018_data_integrity.sql`
- `__tests__/lib/data.test.ts`
- `__tests__/lib/proposalList.test.ts`
- `__tests__/api/proposals.test.ts`
- `__tests__/api/workspace-review-queue.test.ts`
- `__tests__/components/ListOverlay.test.tsx`

## Findings

### 1. The anonymous homepage was doing dead server-side database work on every request

**Severity:** Fixed in this worktree

**Evidence**

- `app/page.tsx` was querying Supabase for active DReps, total DReps, open proposals, and delegator counts through `getGovernancePulse()`.
- `components/hub/HubHomePage.tsx` accepted `pulseData` but did not consume it or pass it into `GlobeLayout`.
- That meant the hottest anonymous route stayed expensive even though the result never affected rendered output.

**Why it matters**

The landing page is the highest-probability public entry path. Paying for live DRep/proposal queries there without using the result is pure latency and database cost with no user benefit.

**Implementation status**

- Fixed in this worktree.
- Removed the unused `getGovernancePulse()` read path from `app/page.tsx`.
- Removed the dead `pulseData` prop from `components/hub/HubHomePage.tsx`.
- This keeps current behavior identical while removing unnecessary Supabase work from the landing route.

### 2. Proposal list surfaces were scaling with broad reads and in-memory shaping

**Severity:** Fixed in this worktree for the current hot paths, with narrower follow-up work deferred

**Evidence**

- `app/api/v1/proposals/route.ts` originally loaded `getAllProposalsWithVoteSummary()`, then filtered, sorted, and sliced in memory instead of pushing those constraints toward the read layer.
- `lib/data.ts:getAllProposalsWithVoteSummary()` originally loaded the full proposals set for that consumer surface and scanned `drep_votes` more broadly than necessary.
- `app/api/proposals/route.ts` was caching for 60 seconds, but each cache miss still read all matching proposals, two separate `governance_stats` rows, all `proposal_outcomes`, and the shared voting-summary path.
- `lib/workspace/reviewQueue.ts` was loading `select('*')` for all open proposals before shaping the personalized queue.

**Why it matters**

These routes get slower as proposal count and vote volume rise, even if the request only needs a small page or a single personalized workspace view. That is manageable at current scale but becomes expensive under bursty public traffic.

**Implementation status**

- Fixed for the primary public and workspace hot paths in this worktree.
- `lib/data.ts:getAllProposalsWithVoteSummary()` no longer performs an unbounded `drep_votes` scan; it now limits voter lookups to the fetched proposal tx hashes.
- Added `lib/governance/proposalList.ts` so the `v1` proposals API can push status/type filtering plus `newest` pagination into the read layer instead of materializing the full list first.
- `app/api/v1/proposals/route.ts` now uses that helper, and `newest` requests fetch only the requested proposal page plus the matching voting summaries.
- `app/api/proposals/route.ts` now reads `governance_stats` once and scopes `proposal_outcomes` to the fetched proposal tx hashes instead of rebuilding against the whole outcomes table on every cache miss.
- `lib/workspace/reviewQueue.ts` now narrows the proposal projection to the fields the queue actually uses instead of `select('*')`.
- Added focused regression coverage in `__tests__/lib/proposalList.test.ts`, `__tests__/api/proposals.test.ts`, `__tests__/api/workspace-review-queue.test.ts`, and `__tests__/lib/data.test.ts`.
- Deferred follow-up: `most_votes` and `most_contested` in the `v1` route still sort a filtered in-memory set, but they no longer route through the older all-proposals materialization path.

### 3. Background vote ingestion and slow-sync jobs still scale with total history instead of new change volume

**Severity:** Closed in DD05, with the deferred vote-ingestion follow-up implemented on April 6, 2026

**Evidence**

- `lib/sync/proposals.ts`, `lib/sync/votes.ts`, and `lib/sync/dreps.ts` all touch Koios vote ingestion paths with overlapping scopes.
- `utils/koios.ts:fetchAllVotesBulk()` plus `lib/sync/votes.ts` still import and process full vote history in memory on the 6-hour sync path.
- `lib/koios.ts:getEnrichedDReps()` already exposes a `prefetchedVotes` seam, but `lib/sync/dreps.ts:phaseFetchDReps()` still falls back to per-DRep live vote fetching.
- The cached `drep_votes` contract currently preserves `meta_url`, `meta_hash`, and rationale-scoring columns, but not the raw `meta_json` that the DRep scorer still treats as part of rationale quality, so the cached-votes switch is not a drop-in change.
- Before the follow-up, `lib/sync/data-moat.ts` reprocessed the full metadata-archive corpus daily instead of only newly changed content.
- `lib/sync/slow.ts` applies bounded cache lookups against unbounded source sets, which risks churn instead of forward progress as the corpus grows.

**Why it matters**

These jobs get slower forever as history accumulates. Even if traffic stays flat, sync latency, memory pressure, and upstream rate-limit exposure all grow with data size.

**Implementation status**

- DD05 still closed on schedule; the follow-up landed later without reopening the review.
- The repo chose the DB-first contract: `drep_votes` stays normalized, gains `has_rationale`, and does not preserve raw `meta_json`.
- `sync-votes` is now the canonical incremental owner with `sync_cursors`, `sync-proposals` no longer writes `drep_votes`, and `sync-dreps` now derives legacy rationale/transparency fields from cached vote signals while V3 scoring remains on stored `rationale_quality` and `meta_hash`.
- `vote_rationales` now carries durable external-fetch state, so `lib/sync/slow.ts` advances a retryable rationale queue instead of doing bounded lookups against the full vote corpus.
- `lib/sync/data-moat.ts` now archives DRep, proposal, and rationale metadata from per-stream timestamp cursors in `sync_cursors`, removing the last DD05-era full-corpus archive pass from the sync path.

### 4. The page surface is still heavily dynamic

**Severity:** Deferred follow-up

**Evidence**

- A route scan across `app/**/page.tsx` and `app/**/page.ts` showed `59` of `92` page routes exporting `dynamic = 'force-dynamic'`.
- High-traffic pages like `app/page.tsx` and `app/proposal/[txHash]/[index]/page.tsx` are included in that set.

**Why it matters**

Not every page should be static, but a large fully dynamic footprint narrows caching and future partial-prerendering options. That raises the floor on server cost and makes it harder to separate truly personalized pages from historically uncached ones.

**Implementation status**

- Deferred with a ranked follow-up instead of blocking DD05 closeout.
- The public-route and sync-cost fixes above were higher-leverage than a broad route-cache audit, but the `force-dynamic` footprint remains a clear DD05-era finding that later work should treat as a cache-policy backlog rather than accidental debt.

### 5. The homepage globe shell had hidden-state entity overfetch and unnecessary route-panel bundle cost

**Severity:** Fixed in this worktree

**Evidence**

- `components/globe/ListOverlay.tsx` mounted `useDReps()`, `useProposals(200)`, `useCommitteeMembers()`, and the local pools `useQuery()` before the `if (!isOpen) return null` guard.
- `components/globe/GlobeLayout.tsx` keeps `ListOverlay` in the homepage tree at all times and only toggles its open state.
- That meant the closed homepage list panel still kicked off all four entity queries even when the user never opened it.
- `components/globe/GlobeLayout.tsx` also statically imported `PanelOverlay` even though the homepage never uses the `/g/*` route panel path.

**Why it matters**

This is classic hidden-state overfetch and bundle tax: the homepage pays network, client, and parse cost for UI paths the user may never touch. It is especially wasteful on the anonymous landing route where first-load budget matters most.

**Implementation status**

- Fixed in this worktree.
- `hooks/queries.ts` now supports explicit `enabled` gating for `useDReps()`, `useProposals()`, and `useCommitteeMembers()`.
- `components/globe/ListOverlay.tsx` now disables those entity queries, plus the pools query, while the overlay is closed.
- `components/globe/GlobeLayout.tsx` now lazy-loads `PanelOverlay` and only mounts it on `/g/*` routes, removing that route-panel code path from the anonymous homepage.
- Added focused component coverage in `__tests__/components/ListOverlay.test.tsx`.

## Risk Ranking

1. Dynamic rendering is still widely used across the page surface without a clearly ranked cache strategy.
2. The homepage still mounts a heavy immediate client globe shell, even after the dead SSR, hidden-state query, and route-panel reductions.

## Deferred Follow-Ups

1. Completed on April 6, 2026: the vote-ingestion and archive sync follow-up is now DB-first and incremental, with `sync-votes` owning `drep_votes`, `slow.ts` advancing a durable rationale queue in `vote_rationales`, and `data-moat.ts` archiving changed metadata via per-stream cursors instead of corpus rescans.
2. Rank the `force-dynamic` pages into truly personalized versus historical-debt buckets before broad caching work starts.
3. Profile the homepage globe shell itself, since the first-load 3D/client runtime cost still dominates after the query and panel-path cuts.

## Handoff

**Current status:** Completed; the remaining DD05 follow-up is non-sync page/runtime work

**What changed this session**

- Started DD05 and mapped the initial hot-path surfaces for public pages, proposal routes, and background sync growth.
- Removed dead SSR pulse queries from `app/page.tsx`.
- Removed the unused `pulseData` contract from `components/hub/HubHomePage.tsx`.
- Bounded `getAllProposalsWithVoteSummary()` so it only reads `drep_votes` rows for the fetched proposal tx hashes instead of scanning the entire table.
- Added focused regression coverage in `__tests__/lib/data.test.ts`.
- Gated `ListOverlay` entity queries behind visible state and added focused component coverage in `__tests__/components/ListOverlay.test.tsx`.
- Added `lib/governance/proposalList.ts` and routed `app/api/v1/proposals/route.ts` through it so proposal-list filtering and pagination sit closer to the read layer.
- Reduced `/api/proposals` cache-miss work by merging `governance_stats` reads and scoping `proposal_outcomes` to the fetched proposal tx hashes.
- Narrowed the workspace review queue proposal projection away from `select('*')`.
- Removed `PanelOverlay` from the anonymous homepage path by lazy-loading it only for `/g/*` routes.
- Verified the DD05 code changes with focused unit coverage, lint, and `npm run type-check`.

**Validated findings**

- The homepage had unnecessary live Supabase work on every request. Fixed in this worktree.
- The homepage list overlay and route-panel path were overfetching and overloading the homepage shell. Fixed in this worktree.
- Public and workspace proposal list surfaces were scaling with broad reads and in-memory shaping. Fixed for the primary hot paths in this worktree, with narrower sort and caching follow-up deferred.
- The vote and metadata-archive sync paths now advance from explicit cached state instead of full-corpus rescans.
- `force-dynamic` usage is widespread across the page surface. Deferred follow-up.

**Next agent starts here**

DD05 is closed. If performance work is reopened later, start with the `force-dynamic` route audit and homepage globe runtime profiling; the deferred sync-ownership and archive-scaling seams are already resolved in the current worktree.
