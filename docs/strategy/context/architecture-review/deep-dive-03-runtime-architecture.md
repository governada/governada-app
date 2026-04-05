# Deep Dive 03 - Runtime Architecture

**Status:** In progress
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

**Severity:** Open

**Evidence**

- `lib/data.ts` is about 2,000 lines and exports DRep reads, proposal reads, committee health reads, ranking helpers, delegation intelligence, and citizen-sentiment helpers from one server module.
- The same file currently owns functions such as `getAllDReps()`, `getAllProposalsWithVoteSummary()`, `getCCHealthSummary()`, `getDelegatorIntelligence()`, and `getVotingPowerSummary()`.

**Why it matters**

This keeps proposal, representative, committee, and intelligence read paths coupled at the module boundary. It raises blast radius for changes, makes ownership unclear, and forces unrelated consumers to depend on one giant server surface.

### 2. `ReviewWorkspace.tsx` was an oversized client orchestrator

**Severity:** Partially reduced in this worktree

**Evidence**

- `components/workspace/review/ReviewWorkspace.tsx` previously sat at about 1,100 lines and mixed queue selection, keyboard registration, rationale drafting, vote submission, layout composition, and fallback states in one client file.
- The review path had started to split into competing ownership models: a live `useReviewWorkspaceController.ts` path, an unreferenced `useReviewWorkspaceSelection.ts` path, and a duplicate `reviewNavigation.ts` helper layer.
- The old file also carried dead `StudioPanelWrapper` and agent-role plumbing that was no longer part of the rendered review flow.

**Why it matters**

The review flow is one of the most important operator surfaces in the product. Keeping state orchestration, command handling, and presentation in one client file makes regressions harder to isolate and reduces the chance of safe iteration on voting and review UX.

**Implementation status**

- Partially reduced in this worktree.
- `hooks/useReviewWorkspaceController.ts` now owns queue/session/navigation state as the explicit client controller boundary.
- `lib/workspace/reviewWorkspaceController.ts` now owns the pure selection/progress helpers used by that controller.
- `components/workspace/review/ReviewWorkspaceStudio.tsx` now owns the interactive studio shell instead of leaving that view tree embedded inside `ReviewWorkspace.tsx`.
- `components/workspace/review/ReviewWorkspace.tsx` is now a thin route-level entrypoint for loading/error/empty/complete states plus studio-shell composition.
- Removed the duplicate `useReviewWorkspaceSelection.ts` and `lib/workspace/reviewNavigation.ts` branch so the review flow no longer has two competing queue/navigation abstractions.
- Remaining gap: vote/rationale orchestration still lives inside `ReviewWorkspaceStudio.tsx`, so the studio shell is smaller and better bounded but not yet fully decomposed.

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

**Why it matters**

This creates semantic drift. The workspace agent, page intelligence, and any future server-side assistant can present different “ground truth” for the same proposal because they are built from parallel context systems instead of one owned service boundary.

**Implementation status**

- Partially reduced in this worktree.
- Added `lib/governance/proposalContext.ts` as the shared on-chain proposal facts seam for proposal key normalization, normalized proposal snapshots, tri-body voting snapshots, and reduced classification summaries.
- `lib/intelligence/context.ts` now consumes the shared proposal context seed instead of assembling proposal and voting facts independently.
- `lib/workspace/agent/context.ts` now consumes the same shared proposal snapshot/voting primitives for on-chain proposal context and precedent lookup.
- `components/governada/panel/ProposalPanel.tsx` now resolves the current `/proposal/[txHash]/[index]` route into an explicit proposal ref before calling `/api/intelligence/context`, which closes the prior index-loss bug in the panel/intelligence path.
- Remaining gap: cache ownership and higher-level context composition are still split between Redis-backed page intelligence and the workspace agent's in-memory bundle cache.

### 5. Background jobs still mix orchestration, domain logic, and persistence

**Severity:** Open

**Evidence**

- `inngest/functions/precompute-proposal-intelligence.ts` mixes proposal discovery, staleness hashing, AI calls, deterministic prediction assembly, and persistence writes in one job.
- `inngest/functions/sync-spo-scores.ts` is nearly 1,000 lines and still carries network calls, scoring logic, persistence, and sync bookkeeping inside one function boundary.

**Why it matters**

Long-lived jobs should be thin orchestrators over explicit services. When the job itself owns the domain logic, it becomes difficult to reuse calculations elsewhere, unit test critical paths narrowly, or reason about retry/idempotency boundaries.

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

1. Proposal/governance context duplication between `lib/intelligence/context.ts` and `lib/workspace/agent/context.ts`
2. `ReviewWorkspace.tsx` as a single large client orchestrator
3. `lib/data.ts` as the shared cross-domain read plane
4. Background jobs that still own orchestration plus domain logic
5. Route-handler assembly drift, now reduced for the workspace review path

## Open Questions

- Should proposal/governance context for workspace agents and page intelligence collapse into one shared server service, or should they intentionally diverge behind an explicit “full context” versus “page context” contract?
- Does the remaining vote/rationale path in `ReviewWorkspaceStudio.tsx` justify its own hook now, or is the current controller-shell split sufficient until deeper user-journey work starts?
- Is `lib/data.ts` best decomposed by domain (`dreps`, `proposals`, `committee`, `analytics`) or by consumer surface (`public API`, `workspace`, `intelligence`)?

## Next Actions

1. Finish the proposal/governance context boundary by deciding how cache ownership and higher-level context composition should be shared across page intelligence and the workspace agent.
2. Decide whether the remaining vote/rationale/mobile-sheet logic in `ReviewWorkspaceStudio.tsx` should become its own hook, or stay colocated until the critical-user-journeys pass exercises it end to end.
3. Continue extracting domain read services out of `lib/data.ts`, starting with proposal/governance reads that already feed multiple consumers.
4. Extract pure domain services from `precompute-proposal-intelligence.ts` and `sync-spo-scores.ts` so the Inngest jobs become orchestration wrappers.

## Handoff

**Current status:** In progress

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

**Verification**

- Passed `npm run test:unit -- __tests__/api/workspace-review-queue.test.ts __tests__/api/workspace-proposals-monitor.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/proposalContext.test.ts`.
- Passed `npm run test:unit -- __tests__/lib/reviewWorkspaceController.test.ts`.
- Passed `npm run lint -- components/workspace/review/ReviewWorkspace.tsx components/workspace/review/ReviewWorkspaceStudio.tsx hooks/useReviewWorkspaceController.ts lib/workspace/reviewWorkspaceController.ts`.
- Passed `npm run type-check`.

## Next Agent Starts Here

Start with `components/workspace/review/ReviewWorkspaceStudio.tsx`, `lib/intelligence/context.ts`, `lib/workspace/agent/context.ts`, and `lib/data.ts`. The review workspace now has one controller/helper path plus a separate studio shell; the next DD03 choice is whether to keep the remaining vote/rationale flow inside `ReviewWorkspaceStudio.tsx` for now or extract it, then decide whether Redis plus in-memory context caching should remain intentionally split or move behind one explicit server-side contract.
