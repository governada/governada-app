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

## Next Agent Starts Here

Start with `lib/data.ts`, `components/workspace/review/ReviewWorkspace.tsx`, `app/api/workspace/review-queue/route.ts`, `app/api/workspace/proposals/monitor/route.ts`, `lib/intelligence/context.ts`, and `lib/workspace/agent/context.ts`. The first goal is to validate ownership boundaries, not to refactor yet.
