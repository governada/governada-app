# DD05 Deferred Follow-Up Agent Prompt

Use this prompt for a separate agent focused on the deferred DD05 performance work:

```text
You are picking up the deferred DD05 performance follow-up in the Governada app.

Workspace:
- C:\Users\dalto\governada\governada-app
- Primary feature worktree: C:\Users\dalto\governada\governada-app\.claude\worktrees\platform-architecture-review-series
- Stay in workspace-write and follow AGENTS.md.

Read first:
- docs/strategy/context/architecture-review/deep-dive-05-performance-and-scale.md
- docs/strategy/context/architecture-review/execution-backlog.md
- docs/strategy/context/architecture-review/series-index.md

Primary target:
- Chunk 26 in execution-backlog.md: De-duplicate vote ingestion and move toward incremental sync.

Context you must preserve:
- DD05 is already closed for the review series.
- The remaining work was deferred intentionally because the cached `drep_votes` contract does not currently preserve raw `meta_json`, while the DRep scoring path still treats raw rationale content as part of vote-quality semantics.
- Do not ship a performance optimization that silently changes DRep score semantics.

Files to inspect first:
- lib/sync/proposals.ts
- lib/sync/votes.ts
- lib/sync/dreps.ts
- lib/koios.ts
- utils/koios.ts
- utils/scoring.ts
- lib/sync/data-moat.ts
- lib/sync/slow.ts
- types/database.ts

Your job:
1. Validate the current vote-ingestion ownership and identify the single best next architecture step.
2. Decide whether `drep_votes` should preserve raw rationale payloads or whether existing derived rationale-quality columns are now the authoritative scoring contract.
3. If the contract is clear and bounded, implement the next safe slice.
4. If the contract is not clear, produce a precise decision memo plus an implementation plan instead of forcing code.

Deliverables:
- A concise findings summary with exact file references.
- Either:
  - a safe implementation with focused tests and verification, or
  - a decision memo that names the blocking contract choice and the next PR-sized chunks.
- Updates to the DD05 docs/backlog only if your work materially changes the deferred follow-up state.

Verification expectations:
- Run focused unit tests for the touched sync/scoring paths.
- Run npm run agent:validate.
- Run npm run type-check if your changes touch shared types or cross-cutting sync helpers.

Constraints:
- Preserve the database-first read architecture.
- Do not revert unrelated work in the review branch.
- Prefer extracting or clarifying ownership seams over adding more overlapping sync paths.
```
