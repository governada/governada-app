# Deep Dive 01 - Data Plane

**Status:** Completed
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

### 1. The shared DRep read path violated the documented database-first contract

**Severity:** Substantially reduced in this worktree

**Evidence**

- `lib/data.ts:7` imports `getEnrichedDReps` from the Koios integration layer.
- `lib/data.ts:229` and `lib/data.ts:291` fall back to `getEnrichedDReps(false)` when Supabase is empty or unavailable.
- `lib/data.ts:2020-2021` fetches governance thresholds directly from `@/utils/koios`.

**Why it matters**

The intended architecture is database-first reads through cached Supabase data. In degraded mode, the current implementation silently changes semantics by switching to upstream live fetches. That increases latency variance, couples user-facing availability to upstream health, and makes behavior under failure materially different from normal operation.

**Implementation status**

- Substantially improved in this worktree.
- `getAllDReps()` no longer falls back to Koios when the Supabase cache is empty or unavailable.
- The legacy `/api/dreps` route now returns an explicit degraded payload with empty arrays instead of silently switching sources or shape-breaking client callers.
- `lib/data.ts:getVotingPowerSummary()` no longer calls Koios directly. Threshold lookup now goes through `lib/governanceThresholds.ts`, which reads Supabase `epoch_params` first and uses Koios only as an isolated fallback inside that resolver.
- Parameter-change proposals now resolve the maximum applicable DRep threshold across all affected protocol-parameter groups using the stored `param_changes` payload.
- Follow-up cleanup still exists outside this finding: `epoch_params` is not yet a repo-managed typed table contract, and other non-shared proposal/workspace surfaces still maintain local threshold constants.

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

**Severity:** Fixed in this worktree

**Evidence**

- `app/api/v1/dreps/route.ts:22` defines the public parameter as `active_only`.
- `app/api/v1/dreps/route.ts:51` uses that flag to choose between `dreps` and `allDReps`.
- `lib/data.ts:264-275` shows that `dreps` is actually the `wellDocumentedDReps` subset, not the active subset.

**Why it matters**

External consumers asking for active-only DReps are currently receiving a documentation-quality filter instead of an activity-status filter. This is a contract bug in a public API, not just an internal naming issue.

**Implementation status**

- Fixed earlier in this worktree by aligning `/api/v1/dreps` `active_only` to actual DRep activity instead of documentation completeness.
- Added regression coverage in `__tests__/api/v1-dreps.test.ts`.

### 4. Snapshot ownership was split across two sync stages, creating order-dependent writes

**Severity:** Substantially reduced in this worktree

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

- Substantially improved in this worktree.
- `proposal_vote_snapshots` is now treated as a historical previous-epoch snapshot owned by `generate-epoch-summary.ts`.
- `lib/sync/proposals.ts` no longer writes that table, and `check-snapshot-completeness.ts` now validates the previous epoch instead of the current one.
- `sync-dreps` no longer writes current-epoch `delegation_snapshots` or `drep_score_history`; `sync-drep-scores` is now the sole live/current-epoch owner for both tables.
- `sync-drep-scores` now preserves or backfills `new_delegators` and `lost_delegators` on same-epoch reruns instead of nulling them out.
- `sync-drep-scores` now writes `total_power_lovelace` from the lovelace-scale source (`votingPowerLovelace`) instead of the ADA-scale `votingPower` field.
- `generate-epoch-summary.ts` now acts as an explicit previous-epoch finalizer for `delegation_snapshots`: it uses `drep_power_snapshots` for the canonical end-of-epoch counts and recomputes delta fields against the prior epoch instead of overwriting them with null values.
- The remaining follow-up is broader audit work, not ambiguous table ownership: verify that downstream proposal/workspace consumers consistently use the intended finalized-versus-live snapshot semantics.

### 5. Proposal consumers duplicated governance-body eligibility rules and lost parameter-sensitive semantics

**Severity:** Fixed in this worktree

**Evidence**

- `lib/governance/votingBodies.ts` previously marked `TreasuryWithdrawals` and `InfoAction` as DRep-only, allowed CC votes on committee updates, and allowed SPO votes on constitution updates.
- `lib/actionQueue.ts` maintained its own `SPO_VOTABLE_TYPES` list, which also treated constitution updates as SPO-votable and could not distinguish security-relevant from non-security parameter updates.
- `inngest/functions/generate-cc-briefing.ts` queried pending proposals through a separate type list instead of the shared governance-body rules.
- Proposal-detail consumers already have `proposal.paramChanges` available through `getProposalByKey`, while workspace review currently drops `param_changes` from the queue item shape instead of surfacing it to consumers.

**Why it matters**

For CIP-1694 proposal types, eligibility is not purely a string-to-body lookup. Parameter-change proposals require affected-parameter awareness, and multiple surfaces were encoding incompatible assumptions about which bodies can vote. That causes incorrect queues, incorrect CC analysis input, and user-facing UI drift.

**Implementation status**

- Fixed in this worktree.
- `lib/governance/votingBodies.ts` is now the shared eligibility source and correctly models:
  - `TreasuryWithdrawals` as DRep + CC
  - committee updates as DRep + SPO
  - constitution updates as DRep + CC
  - `InfoAction` as DRep + SPO + CC
  - `ParameterChange` as DRep + CC, plus SPO only for the current Cardano security allowlist of protocol parameters
- `lib/governanceThresholds.ts` now exports protocol-parameter-group helpers and an explicit SPO security-parameter allowlist, so the shared eligibility path can distinguish security-relevant parameter changes without assuming the whole technical group is SPO-votable.
- `lib/actionQueue.ts` now filters SPO pending proposals through the shared eligibility rules instead of a duplicated type list.
- `inngest/functions/generate-cc-briefing.ts` now filters pending CC proposals through the shared eligibility rules instead of a duplicated type list.
- `lib/actionQueue.ts` now filters CC pending proposals through the shared eligibility rules instead of head-counting all open proposals.
- `app/api/workspace/proposals/monitor/route.ts` now uses shared governance-body eligibility, the Supabase-first DRep threshold resolver, and a small shared governance constant for the fixed deposit value rather than using its local threshold table as both threshold source and body-inclusion matrix.
- `app/api/workspace/review-queue/route.ts` now exposes `paramChanges` through the review queue contract.
- `components/intelligence/ReviewIntelBrief.tsx`, `components/intelligence/sections/StakeholderLandscape.tsx`, `components/studio/IntelPanel.tsx`, and `components/workspace/review/ReviewBrief.tsx` now use the shared governance-body rules with parameter context in reviewer-facing UI.

### 6. Passage prediction and historical snapshot consumers still encoded stale threshold and schema assumptions

**Severity:** Fixed in this worktree

**Evidence**

- `lib/passagePrediction.ts` previously hardcoded a local CIP-1694 threshold map and could not see proposal `param_changes`.
- `inngest/functions/precompute-proposal-intelligence.ts` and `inngest/functions/update-passage-predictions.ts` selected proposal rows without `param_changes`, so cached predictions could not reflect parameter-sensitive SPO participation.
- `lib/scoring/historical.ts` queried `delegation_snapshots` with `epoch_no` even though the finalized snapshot lifecycle now uses `epoch`.

**Why it matters**

Cached reviewer intelligence and historical scoring should agree with the same governance rules and snapshot contracts used by the live monitor and shared data layer. If they drift, the app can show internally inconsistent outcomes across surfaces that all claim to describe the same proposal state.

**Implementation status**

- Fixed in this worktree.
- `lib/passagePrediction.ts` now accepts shared threshold context, resolves eligible bodies through `lib/governance/votingBodies.ts`, and exposes `resolvePassagePredictionThresholds()` for background jobs.
- `inngest/functions/precompute-proposal-intelligence.ts` and `inngest/functions/update-passage-predictions.ts` now fetch `param_changes` and resolve thresholds through the shared governance rule layer before caching predictions.
- `lib/scoring/historical.ts` now queries `delegation_snapshots.epoch` instead of `epoch_no`, aligning the historical consumer with the finalized snapshot contract.

## Residual Risks

1. Some non-decisioning authoring surfaces still hardcode governance-threshold copy outside the shared resolver path.
2. `epoch_params` is now operationally important to the shared threshold resolver but is not yet expressed as a repo-managed typed contract.
3. Other read helpers may still bypass canonical cached boundaries under degradation and should be revisited in later review passes.

## Open Questions

- Should `epoch_params` be promoted into a typed, repo-managed Supabase contract now that the shared threshold resolver depends on it?
- Which other read helpers besides the DRep path still need a database-first boundary audit in later deep dives?

## Next Actions

1. Carry residual authoring-threshold copy drift as a backlog item instead of leaving it implicit.
2. Use later deep dives to continue the broader audit for other database-first boundary violations outside the DRep/proposal flow.

## Handoff

**Current status:** Completed

**What changed this session**

- Fixed the DRep freshness-policy mismatch by introducing a shared DRep sync policy.
- Updated the DRep read path to retrigger only when data is actually overdue.
- Aligned the main health, sync health, admin integrity alert, and freshness-guard surfaces to the shared DRep policy.
- Removed direct governance-threshold Koios reads from `lib/data.ts` by introducing a Supabase-first shared resolver in `lib/governanceThresholds.ts`.
- Clarified `delegation_snapshots` ownership as a lifecycle split: scoring owns the live epoch, and epoch summary finalizes the previous epoch with recomputed delegation deltas.
- Fixed the live current-epoch `delegation_snapshots.total_power_lovelace` unit mismatch in `sync-drep-scores`.
- Added focused regression coverage for the threshold resolver and `getVotingPowerSummary()` integration.
- Corrected shared governance-body eligibility rules, including parameter-sensitive SPO participation for security-relevant parameter updates.
- Updated SPO queue, CC queue, CC briefing, and workspace monitor consumers to use the shared eligibility rules instead of local type lists or head-count shortcuts.
- Moved the fixed governance-action deposit into `lib/governance/constants.ts` so server routes can reuse it without importing wallet-builder code.
- Threaded `paramChanges` through the main proposal-detail consumer path (`ProposalHeroV2`, `ProposalBridge`, `ProposalActionZone`, `ProposalVoterTabs`, `SourceMaterial`, and `LivingBrief`) so those UI surfaces no longer infer voter eligibility from `proposalType` alone when the page already has the parameter payload.
- Threaded `paramChanges` through the review-queue contract and reviewer-facing intelligence consumers (`ReviewIntelBrief`, `StakeholderLandscape`, `ReviewBrief`, and `IntelPanel`) so workspace-review now follows the same governance-body rules as proposal detail pages.
- Replaced the hardcoded passage-prediction threshold matrix with shared threshold resolution plus parameter-sensitive eligibility, and aligned the background cache jobs to fetch `param_changes`.
- Fixed the historical scoring consumer to query `delegation_snapshots.epoch` instead of the old `epoch_no` column.

**Verification**

- Passed `npm run test:unit -- __tests__/api/workspace-review-queue.test.ts __tests__/lib/passagePrediction.test.ts __tests__/api/workspace-proposals-monitor.test.ts`.
- Passed `npm run test:component -- __tests__/components/StakeholderLandscape.test.tsx`.
- Passed `npm run agent:validate`.
- Focused lint for the final Deep Dive 01 files completed with warnings only in `components/workspace/review/ReviewWorkspace.tsx` and no errors.
- Passed `npm run type-check`.

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
- `lib/governanceThresholds.ts`
- `lib/governance/votingBodies.ts`
- `lib/governance/constants.ts`
- `lib/actionQueue.ts`
- `inngest/functions/generate-cc-briefing.ts`
- `inngest/functions/precompute-proposal-intelligence.ts`
- `inngest/functions/update-passage-predictions.ts`
- `app/api/workspace/proposals/monitor/route.ts`
- `app/api/workspace/review-queue/route.ts`
- `app/proposal/[txHash]/[index]/page.tsx`
- `components/intelligence/ReviewIntelBrief.tsx`
- `components/intelligence/sections/StakeholderLandscape.tsx`
- `components/workspace/review/ReviewBrief.tsx`
- `components/governada/proposals/ProposalHeroV2.tsx`
- `components/governada/proposals/ProposalBridge.tsx`
- `components/governada/proposals/ProposalActionZone.tsx`
- `components/governada/proposals/ProposalVerdict.tsx`
- `components/TriBodyVotePanel.tsx`
- `components/ProposalVoterTabs.tsx`
- `components/governada/proposals/SourceMaterial.tsx`
- `components/governada/proposals/LivingBrief.tsx`
- `lib/passagePrediction.ts`
- `lib/scoring/historical.ts`
- `lib/scoring/delegationSnapshots.ts`
- `inngest/functions/generate-epoch-summary.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `__tests__/lib/data.test.ts`
- `__tests__/lib/governanceThresholds.test.ts`
- `__tests__/lib/votingBodies.test.ts`
- `__tests__/lib/actionQueue.test.ts`
- `__tests__/lib/passagePrediction.test.ts`
- `__tests__/api/workspace-proposals-monitor.test.ts`
- `__tests__/api/workspace-review-queue.test.ts`
- `__tests__/components/StakeholderLandscape.test.tsx`
- `__tests__/api/health.test.ts`
- `__tests__/scoring/delegationSnapshots.test.ts`

**Validated findings**

- The main shared DRep list read no longer falls back to Koios, and governance-threshold lookup is now isolated behind a Supabase-first resolver instead of a direct `lib/data.ts` upstream call.
- DRep freshness is now governed by an explicit layered policy instead of a false-stale 15-minute read threshold.
- The public `active_only` DRep API flag currently maps to documentation completeness rather than active status. Fixed earlier in this worktree.
- `proposal_vote_snapshots` is now owned by the epoch-summary path, current-epoch `delegation_snapshots` plus `drep_score_history` are scoring-owned, and previous-epoch `delegation_snapshots` are now explicitly finalized by `generate-epoch-summary.ts`.
- Governance-body eligibility is now centralized in `lib/governance/votingBodies.ts` with an explicit SPO security-parameter allowlist aligned to current Cardano governance documentation, and queue / briefing / monitor / proposal-detail / workspace-review / cached-prediction consumers now use that shared rule layer.
- Historical scoring now reads `delegation_snapshots` through the finalized `epoch` contract instead of the stale `epoch_no` column.

**Open questions**

- See the `Open Questions` section above. None are blocking for Deep Dive 01 closure.

**Next actions**

- Start the next deep dive with Deep Dive 02 or Deep Dive 04.
- Use the backlog for residual low-priority threshold-copy cleanup outside the active data plane.

**Next agent starts here**

Deep Dive 01 is complete. The next agent should continue with the next prioritized review area from the series index.
