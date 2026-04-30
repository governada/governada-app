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

**Severity:** Partially addressed follow-up

**Evidence**

- A route scan across `app/**/page.tsx` and `app/**/page.ts` showed `59` of `92` page routes exporting `dynamic = 'force-dynamic'`.
- High-traffic pages like `app/page.tsx` and `app/proposal/[txHash]/[index]/page.tsx` are included in that set.

**Why it matters**

Not every page should be static, but a large fully dynamic footprint narrows caching and future partial-prerendering options. That raises the floor on server cost and makes it harder to separate truly personalized pages from historically uncached ones.

**Implementation status**

- The route-dynamism ranking now exists in `dd05-force-dynamic-audit.md`.
- The cache-policy decision now exists in `dd05-cache-policy-decision.md`, and `npm run agent:validate` now recognizes explicit `public-cache`, `public-dynamic-exception`, and `app-dynamic` route classes.
- The homepage, DRep, and proposal surfaces now emit shared microdata through `components/shared/StructuredDataMicrodata.tsx`, removing the last nonce-aware public JSON-LD script from that SEO seam.
- The main root shell no longer uses `next-themes` at runtime; `app/layout.tsx` now owns dark mode directly and no longer reads `x-nonce` for a forced-dark theme bootstrap.
- The shared `GovernadaShell` no longer carries app-only workflow providers; `ModeProvider`, `ShortcutProvider`, and `ShortcutOverlay` now live behind `components/governada/AppShellProviders.tsx`, with private/app layouts opting in explicitly.
- This follow-up removed `22` redundant page-level `force-dynamic` exports from redirect-only or root-shell pages that did not themselves own request-scoped data work.
- After that cleanup, the explicit dynamic set is easier to reason about: `55` page routes remain dynamic, split between private/request-scoped surfaces and public live-read detail surfaces. The root document shell no longer belongs to that set.
- The root-shell locale/CSP blocker is resolved in this worktree; the remaining dynamic pages are page-local runtime assemblies, not shell-owned cache ceilings.

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

- Fixed in this worktree, with one more runtime slice added on April 7.
- `hooks/queries.ts` now supports explicit `enabled` gating for `useDReps()`, `useProposals()`, and `useCommitteeMembers()`.
- `components/globe/ListOverlay.tsx` now disables those entity queries, plus the pools query, while the overlay is closed.
- `components/globe/GlobeLayout.tsx` now lazy-loads `PanelOverlay` and only mounts it on `/g/*` routes, removing that route-panel code path from the anonymous homepage.
- `components/globe/GlobeLayout.tsx` now also defers the closed `ListOverlay`, inactive `DiscoveryOverlay`, unopened `EntityDetailSheet`, and hover-only `GlobeTooltip` until they are actually needed on the homepage.
- `app/api/governance/constellation/route.ts` now emits cached `proposalNodes`, so the homepage globe no longer makes a second `/api/proposals` request just to render open proposal markers.
- `app/api/governance/constellation/route.ts` now also emits precomputed main-scene nodes, and `components/GlobeConstellation.tsx` now picks the right quality-tier slice from that payload instead of recomputing the full 3D layout on mount.
- Added focused component coverage in `__tests__/components/ListOverlay.test.tsx` and `__tests__/components/GlobeLayout.test.tsx`.

## Risk Ranking

1. The homepage still pays for the core 3D/client globe itself, even after the query, route-panel, deferred-overlay, single-payload, and precomputed-layout reductions.
2. The remaining public live-read detail surfaces are still page-local dynamic routes, so they still have their own cache and freshness costs even after the root-shell contract was cleaned up.

## Deferred Follow-Ups

1. Completed on April 6, 2026: the vote-ingestion and archive sync follow-up is now DB-first and incremental, with `sync-votes` owning `drep_votes`, `slow.ts` advancing a durable rationale queue in `vote_rationales`, and `data-moat.ts` archiving changed metadata via per-stream cursors instead of corpus rescans.
2. Completed on April 7, 2026: the `force-dynamic` route set is now ranked in `dd05-force-dynamic-audit.md`, and redundant redirect-shell exports were removed from the page surface.
3. Completed on April 8, 2026: the remaining cache-policy choice is now explicit in `dd05-cache-policy-decision.md`, and the validator contract now permits cache-first public routes to read `lib/data.ts` without forcing page-level dynamism.
4. Completed on April 8, 2026: homepage, DRep, and proposal SEO markup now runs through shared microdata primitives instead of nonce-aware JSON-LD scripts.
5. Completed on April 8, 2026: the main root shell dropped its `next-themes` bootstrap and now hard-owns dark mode without a request-scoped nonce read.
6. Completed on April 9, 2026: the shared shell no longer carries app-only workflow providers; `AppShellProviders.tsx` plus nested app layouts now own density and shortcut behavior for private/workflow routes.
7. Completed on April 9, 2026: the locale ownership shift and public CSP split are closed; the root document shell is static for the public contract and nonce CSP is confined to app/private prefixes.
8. Completed on 2026-04-10: the homepage globe shell now starts on the 2D-safe path until the browser probe resolves and reuses the shared GPU tier for the 3D scene, so the speculative first-load WebGL boot is removed.
9. Completed on 2026-04-10: the visible public shell stays server-rendered instead of waiting behind a client-only spotlight wrapper, so the browser sees `#main-content` and the header on the first response.

## Handoff

**Current status:** Completed; DD05 is closed, and the last homepage globe runtime slice landed by removing speculative 3D boot, sharing GPU-tier detection between the homepage shell and 3D scene, and keeping the visible public shell server-rendered.

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
- Ranked the remaining `force-dynamic` footprint in `dd05-force-dynamic-audit.md` and removed redundant page-level exports from redirect-only and root-shell page files.
- Added `dd05-cache-policy-decision.md` plus the machine-readable `scripts/lib/routeRenderPolicy.mjs` contract so public cache policy is explicit in docs and validator rules.
- Added `components/shared/StructuredDataMicrodata.tsx` and moved homepage, DRep, and proposal SEO markup onto shared microdata primitives instead of relying on nonce-aware JSON-LD scripts.
- Removed the root `ThemeProvider` / `next-themes` bootstrap from `app/layout.tsx`, keeping the main shell dark-first while shrinking the remaining request-scoped shell surface to app/private-only concerns.
- Moved `ModeProvider`, `ShortcutProvider`, and `ShortcutOverlay` out of `components/governada/GovernadaShell.tsx` and into `components/governada/AppShellProviders.tsx`, with app/private layouts opting into those workflow providers explicitly.
- Deferred closed homepage overlay chunks until they are actually opened or activated.
- Folded homepage proposal-node shaping into `app/api/governance/constellation/route.ts`, removing the extra `/api/proposals` request from the globe shell while keeping the proposal list API separate for other consumers.
- Moved main constellation-node positioning into the cached constellation payload so `components/GlobeConstellation.tsx` no longer computes the full 3D layout during homepage boot.
- Kept the visible public shell outside the non-SSR spotlight wrapper, so the browser-visible header and `#main-content` remain present in the first HTML response.
- Verified the DD05 code changes with focused unit coverage, lint, and `npm run type-check`.

**Validated findings**

- The homepage had unnecessary live Supabase work on every request. Fixed in this worktree.
- The homepage list overlay and route-panel path were overfetching and overloading the homepage shell. Fixed in this worktree.
- Public and workspace proposal list surfaces were scaling with broad reads and in-memory shaping. Fixed for the primary hot paths in this worktree, with narrower sort and caching follow-up deferred.
- The vote and metadata-archive sync paths now advance from explicit cached state instead of full-corpus rescans.
- The remaining `force-dynamic` set is now ranked, and the public locale/CSP split is complete after the provider-level public/app shell split landed.

**Next agent starts here**

DD05 is closed. If performance work is reopened later, start with deeper 3D scene quality tuning or route-specific rendering measurement; the deferred sync-ownership, archive-scaling, public structured-data, root-theme-bootstrap, provider-level public/app shell, locale/CSP, and homepage globe runtime seams are already resolved in the current worktree.
