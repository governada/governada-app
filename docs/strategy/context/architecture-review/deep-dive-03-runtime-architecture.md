# Deep Dive 03 - Runtime Architecture

**Status:** Completed
**Started:** 2026-04-04
**Owner branch:** `feature/platform-architecture-review-series`
**Review goal:** verify ownership boundaries across server components, client components, route handlers, background jobs, and shared libraries.

## Scope

This pass will map where runtime responsibilities live and where they currently leak across boundaries:

- Shared server read plane
- Route-handler assembly boundaries
- Server component versus client component ownership
- Background-job orchestration versus domain logic
- Intelligence and agent context ownership

## Initial Evidence Collected

- `lib/data.ts`
- `lib/intelligence/context.ts`
- `lib/workspace/agent/context.ts`
- `app/api/workspace/review-queue/route.ts`
- `app/api/workspace/proposals/monitor/route.ts`
- `components/workspace/review/ReviewWorkspace.tsx`
- `inngest/functions/precompute-proposal-intelligence.ts`
- `inngest/functions/sync-spo-scores.ts`

## Initial Scout Findings

### 1. The shared read layer is a god-module

`lib/data.ts` is the clearest ownership hotspot. It mixes DRep reads, proposal reads, intelligence inputs, analytics summaries, and unrelated read helpers into one large server module.

### 2. The review workspace is effectively a client-side application inside one file

`components/workspace/review/ReviewWorkspace.tsx` owns queue selection, agent wiring, rationale drafting, vote flow, analytics, keyboard commands, and studio layout in one client component.

### 3. Route handlers still assemble domain read models directly

Workspace route handlers like `app/api/workspace/review-queue/route.ts` and `app/api/workspace/proposals/monitor/route.ts` still combine SQL access, business rules, and response shaping at the HTTP edge.

### 4. Background jobs mix orchestration, domain logic, and persistence

Representative jobs like `sync-spo-scores.ts` and `precompute-proposal-intelligence.ts` remain large multi-responsibility functions instead of thin orchestrators over bounded services.

### 5. Intelligence context and workspace-agent context are parallel read systems

`lib/intelligence/context.ts` and `lib/workspace/agent/context.ts` both assemble overlapping proposal/governance context with direct DB access and shared-helper calls, which creates competing ownership of "what context means."

## Validated Findings

### 1. `lib/data.ts` is still a cross-domain server read plane

**Severity:** Partially reduced in this worktree

**Evidence**

- `lib/data.ts` is about 2,000 lines and exports DRep reads, proposal reads, committee health reads, ranking helpers, delegation intelligence, and citizen-sentiment helpers from one server module.
- The same file currently owns functions such as `getAllDReps()`, `getAllProposalsWithVoteSummary()`, `getCCHealthSummary()`, `getDelegatorIntelligence()`, and `getVotingPowerSummary()`.

**Why it matters**

This keeps proposal, representative, committee, and intelligence read paths coupled at the module boundary. It raises blast radius for changes, makes ownership unclear, and forces unrelated consumers to depend on one giant server surface.

**Implementation status**

- Partially reduced in this worktree.
- Extracted the shared proposal-enrichment leaf into `lib/governance/proposalEnrichment.ts`, moving `getProposalsByIds()`, `getRationalesByVoteTxHashes()`, and `getVotesByDRepId()` plus their shared types behind a dedicated governance read module.
- Extracted `getVotingPowerSummary()` into `lib/governance/votingPowerSummary.ts` as a second proposal-domain read leaf with direct unit coverage.
- Added `lib/governance/proposalSummary.ts` as the shared proposal-summary contract for tri-body vote grouping, DRep vote tallying, lifecycle-derived status, and row-to-summary translation.
- `getAllProposalsWithVoteSummary()` and `getProposalByKey()` now delegate that summary shaping through the shared module instead of maintaining separate list/detail mapping logic inside `lib/data.ts`.
- `app/api/v1/proposals/route.ts` now consumes the shared `status` field from the data-layer contract instead of re-deriving lifecycle state at the HTTP edge.
- Intelligence discovery and proposal-list tools now consume `triBody`, `status`, and `proposalIndex` from the shared contract instead of relying on stale flattened vote fields or implicit `index` aliases.
- Kept `lib/data.ts` as a compatibility boundary by re-exporting those extracted read leaves instead of forcing broad caller churn in the same checkpoints.
- Added focused unit coverage for the extracted modules, including compound-key proposal filtering, rationale mapping, DRep-vote ordering, threshold-aware voting-power resolution, proposal-summary shaping, and controversy/active-proposal intelligence consumers.
- Added `lib/governance/proposalVotingSummary.ts` as the shared runtime reader for `proposal_voting_summary`, and moved `lib/data.ts`, `lib/workspace/reviewQueue.ts`, `lib/workspace/proposalMonitor.ts`, `lib/governance/proposalContext.ts`, `app/api/proposals/route.ts`, and the workspace voting-summary route onto that helper instead of letting each consumer assemble summary reads independently.
- Added focused unit coverage in `__tests__/lib/proposalVotingSummary.test.ts` and compatibility verification through the repaired proposal/workspace consumer tests.
- Remaining gap: `lib/data.ts` is still broad overall across representative, proposal, committee, and intelligence domains. Further decomposition is now an explicit follow-up instead of an unresolved proposal-summary ownership leak.

### 2. `ReviewWorkspace.tsx` was an oversized client orchestrator

**Severity:** Fixed in this worktree

**Evidence**

- `components/workspace/review/ReviewWorkspace.tsx` previously sat at about 1,100 lines and mixed queue selection, keyboard registration, rationale drafting, vote submission, layout composition, and fallback states in one client file.
- The review path had started to split into competing ownership models: a live `useReviewWorkspaceController.ts` path, an unreferenced `useReviewWorkspaceSelection.ts` path, and a duplicate `reviewNavigation.ts` helper layer.
- The old file also carried dead `StudioPanelWrapper` and agent-role plumbing that was no longer part of the rendered review flow.

**Why it matters**

The review flow is one of the most important operator surfaces in the product. Keeping state orchestration, command handling, and presentation in one client file makes regressions harder to isolate and reduces the chance of safe iteration on voting and review UX.

**Implementation status**

- Fixed in this worktree.
- `hooks/useReviewWorkspaceController.ts` now owns queue/session/navigation state as the explicit client controller boundary.
- `lib/workspace/reviewWorkspaceController.ts` now owns the pure selection/progress helpers used by that controller.
- `components/workspace/review/ReviewWorkspaceStudio.tsx` now owns the interactive studio shell instead of leaving that view tree embedded inside `ReviewWorkspace.tsx`.
- `components/workspace/review/ReviewWorkspace.tsx` is now a thin route-level entrypoint for loading/error/empty/complete states plus studio-shell composition.
- `hooks/useReviewDecisionFlow.ts` now owns vote/rationale/mobile-sheet orchestration instead of leaving that state and side-effect cluster inside `ReviewWorkspaceStudio.tsx`.
- `components/workspace/review/ReviewWorkspaceDecisionPanels.tsx` now owns shared desktop/mobile decision-panel composition so the studio shell no longer duplicates DecisionPanel prop wiring and sheet framing.
- Removed the duplicate `useReviewWorkspaceSelection.ts` and `lib/workspace/reviewNavigation.ts` branch so the review flow no longer has two competing queue/navigation abstractions.
- Added focused component-project coverage for the decision-flow hook, including success propagation, rationale submission, and mobile vote selection.
- Added focused component-project coverage for the shared decision-panel wrappers, including desktop intel passthrough, hidden voted state, mobile vote forwarding, and mobile-sheet reuse.
- Remaining gap: none that block DD03 closeout. Any further changes to the review workspace now belong to later user-journey work unless DD06 uncovers a concrete regression.

### 3. Workspace route handlers were assembling read models at the HTTP edge

**Severity:** Fixed in this worktree

**Evidence**

- `app/api/workspace/review-queue/route.ts` and `app/api/workspace/proposals/monitor/route.ts` previously mixed request parsing, Supabase fan-out, governance rules, and response shaping directly in the route file.
- Those routes now delegate domain assembly into `lib/workspace/reviewQueue.ts` and `lib/workspace/proposalMonitor.ts`, leaving the HTTP edge responsible only for parameter validation and response mapping.

**Why it matters**

The HTTP edge should not be the place where workspace domain rules live. Pulling the assembly into bounded server services reduces route complexity and creates a cleaner seam for unit testing, reuse, and future server-component consumers.

**Implementation status**

- Fixed in this worktree.
- Added `lib/workspace/reviewQueue.ts` as the server-side queue assembly boundary for open proposal review data.
- Added `lib/workspace/proposalMonitor.ts` as the server-side monitor assembly boundary for proposal lifecycle and threshold evaluation.
- Reduced both workspace route handlers to thin request parsing plus `NextResponse` serialization.

### 4. Intelligence context is split across two competing builders

**Severity:** Partially reduced in this worktree

**Evidence**

- `lib/intelligence/context.ts` is about 1,300 lines and performs route detection plus route-specific Supabase reads, treasury reads, personal-context stitching, and Redis caching.
- `lib/workspace/agent/context.ts` is about 670 lines and separately assembles proposal, voting, treasury, precedent, and personal context with its own in-memory cache and its own proposal-fetch helpers.
- Both modules were separately reading on-chain proposal facts such as proposal identity, CIP-108 motivation/rationale, vote summary, and epochs remaining.
- They also had overlapping treasury reads while their cache layers served different output contracts and TTLs.

**Why it matters**

This creates semantic drift. The workspace agent, page intelligence, and any future server-side assistant can present different “ground truth” for the same proposal because they are built from parallel context systems instead of one owned service boundary.

**Implementation status**

- Partially reduced in this worktree.
- Added `lib/governance/proposalContext.ts` as the shared on-chain proposal facts seam for proposal key normalization, normalized proposal snapshots, tri-body voting snapshots, and reduced classification summaries.
- `lib/intelligence/context.ts` now consumes the shared proposal context seed instead of assembling proposal and voting facts independently.
- `lib/workspace/agent/context.ts` now consumes the same shared proposal snapshot/voting primitives for on-chain proposal context and precedent lookup.
- Added `lib/governance/treasuryContext.ts` as the shared treasury read seam for balance, runway, NCL, and recent ratified-withdrawal facts.
- `lib/intelligence/context.ts` and `lib/workspace/agent/context.ts` now both consume that shared treasury service instead of assembling treasury state independently.
- The workspace-agent treasury bundle now reports recent ratified withdrawals in ADA rather than forwarding the raw lovelace sum as if it were already ADA.
- `components/governada/panel/ProposalPanel.tsx` now resolves the current `/proposal/[txHash]/[index]` route into an explicit proposal ref before calling `/api/intelligence/context`, which closes the prior index-loss bug in the panel/intelligence path.
- Cache ownership is now an explicit decision instead of an unresolved drift point:
  - page intelligence keeps Redis caching of rendered `ContextSynthesisResult`
  - workspace agent keeps its short-lived in-memory `GovernanceContextBundle` cache
- Remaining gap: higher-level personal-context and feedback/annotation composition still diverge across the two consumers, and those boundaries need a narrower shared-read decision than a cache merge.

### 5. Background jobs still mix orchestration, domain logic, and persistence

**Severity:** Partially reduced in this worktree

**Evidence**

- `inngest/functions/precompute-proposal-intelligence.ts` mixes proposal discovery, staleness hashing, AI calls, deterministic prediction assembly, and persistence writes in one job.
- `inngest/functions/sync-spo-scores.ts` is nearly 1,000 lines and still carries network calls, scoring logic, persistence, and sync bookkeeping inside one function boundary.

**Why it matters**

Long-lived jobs should be thin orchestrators over explicit services. When the job itself owns the domain logic, it becomes difficult to reuse calculations elsewhere, unit test critical paths narrowly, or reason about retry/idempotency boundaries.

**Implementation status**

- Partially reduced in this worktree.
- Added `lib/intelligence/proposalIntelligenceCache.ts` as the shared cache/discovery boundary for open proposal intelligence targets, content hashing, section upserts, and passage-prediction cache refresh.
- `inngest/functions/precompute-proposal-intelligence.ts` now delegates proposal discovery, section upserts, and passage-prediction cache refresh through that shared helper instead of owning those persistence details inline.
- `inngest/functions/update-passage-predictions.ts` now delegates open-proposal discovery and cache refresh through the same shared helper instead of rebuilding that logic inside the job.
- Added `lib/scoring/spoPoolInfo.ts` as the shared Koios pool-info boundary for SPO metadata/stake refresh helpers, batched Koios fetches, and relay-IP extraction.
- `inngest/functions/sync-spo-scores.ts` now delegates pool metadata and delegator/stake refresh through that shared helper instead of inlining repeated Koios request/normalization logic inside the job.
- Added `lib/scoring/spoRelayLocations.ts` as the shared relay geocoding boundary for ip-api lookups and per-pool centroid assembly.
- `inngest/functions/sync-spo-scores.ts` now delegates relay-IP geocoding and relay-location centroid construction through that helper instead of owning the ip-api response mapping and pool-location grouping inline.
- Added `lib/scoring/spoScoreSync.ts` as the shared score-computation and persistence-artifact boundary for SPO scoring runs.
- `inngest/functions/sync-spo-scores.ts` now delegates the core compute-scores step through that helper instead of owning proposal weighting, deliberation/confidence assembly, sybil penalty application, alignment mapping, and score snapshot row shaping inline.
- Added focused unit coverage for proposal-intelligence cache discovery and batch upsert behavior.
- Added focused unit coverage for SPO pool-info batching, normalization, relay-IP filtering, and relay geocoding/centroid assembly.
- Added focused unit coverage in `__tests__/lib/spoScoreSync.test.ts`.
- Remaining gap: AI-generation orchestration still lives inside `precompute-proposal-intelligence.ts`, and `sync-spo-scores.ts` still owns relay discovery, later enrichment steps, power snapshots, tier assignment, and top-level job orchestration. Those are explicit follow-ups rather than DD03 blockers.

## Review Outline

1. Map the runtime topology for three concrete paths:
   - proposal detail
   - workspace review
   - cached intelligence / background recompute
2. Validate the five ownership risks above with code-level evidence.
3. Decide what belongs in:
   - shared server services
   - route handlers
   - server components
   - client orchestrators
   - background jobs
4. Convert the highest-value runtime-boundary problems into PR-sized backlog chunks.

## Risk Ranking

1. Background jobs that still own orchestration plus domain logic
2. Higher-level context composition drift between `lib/intelligence/context.ts` and `lib/workspace/agent/context.ts`
3. `lib/data.ts` as the shared cross-domain read plane
4. Route-handler assembly drift, now reduced for the workspace review path
5. Review-workspace client composition, now fixed for the current runtime-architecture scope

## Open Questions

- Which higher-level shared read is stable enough to extract next after treasury: personal context, feedback/annotation aggregation, or neither yet?
- Is `lib/data.ts` best decomposed by domain (`dreps`, `proposals`, `committee`, `analytics`) or by consumer surface (`public API`, `workspace`, `intelligence`)?

## Deferred Follow-Ups

1. Continue extracting broader domain seams out of `lib/data.ts`, especially outside the proposal read path that DD03 already reduced.
2. Evaluate whether personal-context or feedback/annotation assembly between `lib/intelligence/context.ts` and `lib/workspace/agent/context.ts` is stable enough to share without forcing a cache merge.
3. Continue thinning background jobs by extracting the remaining AI-generation work from `precompute-proposal-intelligence.ts` and the relay-discovery / later-enrichment / tier-assignment steps from `sync-spo-scores.ts`.
4. Revisit the review workspace only if DD06 exposes operator-journey regressions that the current controller, decision-flow, and decision-panel seams do not isolate cleanly.

## Handoff

**Current status:** Completed

**What changed this session**

- Validated the runtime-boundary scout with concrete ownership evidence across `lib/data.ts`, `ReviewWorkspace.tsx`, the workspace routes, and the two context builders.
- Fixed one concrete DD03 slice by extracting workspace review queue and proposal monitor assembly into `lib/workspace/reviewQueue.ts` and `lib/workspace/proposalMonitor.ts`.
- Reduced `app/api/workspace/review-queue/route.ts` and `app/api/workspace/proposals/monitor/route.ts` to thin HTTP boundaries.
- Added `lib/governance/proposalContext.ts` as the shared on-chain proposal facts boundary for page intelligence and workspace-agent proposal consumers.
- Removed the duplicate `lib/governance/proposalSnapshot.ts` branch of the same responsibility.
- Fixed proposal-panel route drift so the intelligence panel now passes the canonical proposal ref, including index, when reading proposal context.
- Split the review workspace first by runtime boundary: `ReviewWorkspace.tsx` is now a thin route-level entrypoint, `useReviewWorkspaceController.ts` is the controller seam, and `ReviewWorkspaceStudio.tsx` is the interactive studio shell.
- Removed the duplicate `useReviewWorkspaceSelection.ts` and `lib/workspace/reviewNavigation.ts` branch so queue navigation has one owning helper layer.
- Removed dead `agentUserRole` and `editorRef` exposure from the public review-workspace boundary.
- Added `hooks/useReviewDecisionFlow.ts` so vote/rationale/mobile decision orchestration has its own client hook boundary instead of living inside the studio shell component.
- Added `lib/governance/treasuryContext.ts` so page intelligence and workspace-agent context share one treasury read seam while keeping their different cache/output contracts.
- Added `components/workspace/review/ReviewWorkspaceDecisionPanels.tsx` so shared desktop/mobile decision-panel composition has one presenter boundary instead of duplicated prop wiring in the studio shell.
- Added `lib/governance/proposalEnrichment.ts` so the shared proposal/rationale/DRep-vote enrichment helpers no longer live inside the `lib/data.ts` god-module.
- Added `lib/governance/votingPowerSummary.ts` so proposal voting-power/threshold reads no longer live inside `lib/data.ts`.
- Added `lib/governance/proposalSummary.ts` so proposal lifecycle status, tri-body vote grouping, and list/detail summary shaping now live behind one shared governance contract instead of separate inline mappers.
- Added `lib/intelligence/proposalIntelligenceCache.ts` so proposal intelligence target discovery, content hashing, passage-prediction refresh, and cache upserts are shared outside the Inngest job bodies.
- Added `lib/scoring/spoPoolInfo.ts` so SPO metadata/stake refresh logic shares one Koios batching and normalization boundary outside the scoring job.
- Added `lib/scoring/spoRelayLocations.ts` so relay geocoding and per-pool location centroid assembly now live outside `sync-spo-scores.ts`.
- Added `lib/governance/proposalVotingSummary.ts` so proposal/workspace consumers share one runtime `proposal_voting_summary` reader instead of each assembling those reads independently.
- Added `lib/scoring/spoScoreSync.ts` so the core SPO scoring run now has a shared computation and persistence-artifact seam outside `sync-spo-scores.ts`.
- Fixed intelligence proposal-consumer drift by aligning controversy and active-proposal tools to the shared `triBody`, `status`, and `proposalIndex` contract instead of stale legacy vote-field aliases.
- Fixed intelligence-comment drift by aligning the top-level `lib/intelligence/context.ts` description with its actual route-local personalization behavior.
- Closed DD03 after converting the remaining high-risk runtime-boundary gaps into either shipped seams or explicit deferred follow-ups.

**Verification**

- Passed `npm run test:unit -- __tests__/api/workspace-review-queue.test.ts __tests__/api/workspace-proposals-monitor.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/proposalContext.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/reviewWorkspaceController.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/treasuryContext.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/proposalEnrichment.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/votingPowerSummary.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/proposalSummary.test.ts __tests__/intelligence/advisor-discovery-tools.test.ts __tests__/lib/data.test.ts`.
- Passed `npm run test:unit -- __tests__/intelligence/tool-executors.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/proposalIntelligenceCache.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/spoPoolInfo.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/spoRelayLocations.test.ts __tests__/lib/spoPoolInfo.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/proposalVotingSummary.test.ts __tests__/api/workspace-proposals-monitor.test.ts __tests__/api/workspace-review-queue.test.ts __tests__/lib/proposalContext.test.ts __tests__/lib/data.test.ts __tests__/lib/spoScoreSync.test.ts`.
- Passed `npm run test:component -- __tests__/hooks/useReviewDecisionFlow.test.tsx`.
- Passed `npm run test:component -- __tests__/components/ReviewWorkspaceDecisionPanels.test.tsx`.
- Passed `npm run lint -- components/workspace/review/ReviewWorkspace.tsx components/workspace/review/ReviewWorkspaceStudio.tsx hooks/useReviewWorkspaceController.ts lib/workspace/reviewWorkspaceController.ts`.
- Passed `npm run lint -- components/workspace/review/ReviewWorkspaceStudio.tsx hooks/useReviewDecisionFlow.ts hooks/useReviewWorkspaceController.ts components/workspace/review/ReviewWorkspace.tsx lib/workspace/reviewWorkspaceController.ts lib/governance/treasuryContext.ts lib/intelligence/context.ts lib/workspace/agent/context.ts`.
- Passed `npm run lint -- components/workspace/review/ReviewWorkspaceStudio.tsx components/workspace/review/ReviewWorkspaceDecisionPanels.tsx hooks/useReviewDecisionFlow.ts`.
- Passed `npm run lint -- lib/data.ts lib/governance/proposalEnrichment.ts`.
- Passed `npm run lint -- lib/data.ts lib/governance/votingPowerSummary.ts inngest/functions/sync-spo-scores.ts lib/scoring/spoPoolInfo.ts`.
- Passed `npm run lint -- lib/governance/proposalSummary.ts lib/data.ts app/api/v1/proposals/route.ts lib/intelligence/advisor-discovery-tools.ts lib/intelligence/advisor-tools.ts inngest/functions/sync-spo-scores.ts`.
- Passed `npm run lint -- inngest/functions/precompute-proposal-intelligence.ts inngest/functions/update-passage-predictions.ts lib/intelligence/proposalIntelligenceCache.ts`.
- Passed `npm run lint -- lib/scoring/spoRelayLocations.ts inngest/functions/sync-spo-scores.ts`.
- Passed `npm run lint -- lib/governance/proposalVotingSummary.ts lib/scoring/spoScoreSync.ts lib/data.ts lib/governance/proposalContext.ts lib/workspace/proposalMonitor.ts lib/workspace/reviewQueue.ts app/api/proposals/route.ts app/api/workspace/proposals/[txHash]/[index]/voting-summary/route.ts inngest/functions/sync-spo-scores.ts`.
- Passed `npm run type-check`.
- Passed `npm run agent:validate`.

## Next Agent Starts Here

Start with `docs/strategy/context/architecture-review/deep-dive-05-performance-and-scale.md` when the next review begins. If a later deep dive needs DD03 follow-up context, read `lib/data.ts`, `lib/governance/proposalVotingSummary.ts`, `lib/scoring/spoScoreSync.ts`, `lib/intelligence/context.ts`, `lib/workspace/agent/context.ts`, `inngest/functions/precompute-proposal-intelligence.ts`, and `inngest/functions/sync-spo-scores.ts` first.
