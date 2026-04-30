# DD05 Force-Dynamic Audit

**Date:** 2026-04-09  
**Status:** Completed DD05 follow-up artifact

## Summary

- The hard blocker was the root document shell in `app/layout.tsx`, but that contract is now resolved in this worktree: the root layout is static/default-locale, and public CSP no longer depends on request-scoped nonce ownership.
- This follow-up removed `22` redundant page-level `force-dynamic` exports from redirect-only or root-shell pages that do not themselves touch Supabase, Redis, or env state.
- After that cleanup, the app still has `55` page routes exporting `force-dynamic`.
- The remaining explicit dynamic page set now splits cleanly into:
  - `28` private/request-scoped routes under admin, workspace, `you`, `my-gov`, preview, and claim flows
  - `27` public routes that still render live server-side detail or embed surfaces

## Ranked Buckets

### 1. Resolved Root Shell Blocker

**Why it no longer blocks caching**

- [app/layout.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/layout.tsx) now sets the main shell dark mode directly and uses the static public document locale.
- The proxy now scopes nonce CSP to app/private prefixes, so the root document shell no longer imposes a dynamic ceiling on public routes.

**Implication**

- Broad caching or static-route work should now start with the remaining page-local public live-read surfaces; the provider-level public/app shell split is already complete.
- The public structured-data seam is now shared microdata, the root shell no longer carries a `next-themes` bootstrap, and app-only workflow providers no longer ride on every public route. The remaining dynamic behavior is page-local runtime data, not locale/CSP plumbing.

### 2. Private Or Truly Request-Scoped Routes

**Why they stay dynamic**

- The remaining private routes are concentrated under server-authenticated or role-specific surfaces such as:
  - [app/admin/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/admin/page.tsx)
  - [app/workspace/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/workspace/page.tsx)
  - [app/you/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/you/page.tsx)
  - [app/claim/[drepId]/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/claim/[drepId]/page.tsx)

**Rank**

- Treat these as lower-priority DD05 cache candidates. They are not the main accidental debt bucket.

### 3. Public Live-Read Detail Surfaces

**Why they stay dynamic today**

- The remaining public pages still route through live server-side data assembly or request-scoped behavior, for example:
  - [app/proposal/[txHash]/[index]/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/proposal/[txHash]/[index]/page.tsx)
  - [app/drep/[drepId]/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/drep/[drepId]/page.tsx)
  - [app/pool/[poolId]/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/pool/[poolId]/page.tsx)
  - [app/pulse/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/pulse/page.tsx)
  - [app/compare/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/compare/page.tsx)

**Rank**

- These are the next DD05 cache-policy candidates after the root-shell decision, because they are public and traffic-facing.
- The homepage, DRep, and proposal structured-data seam on this bucket is now shared microdata in [StructuredDataMicrodata.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/components/shared/StructuredDataMicrodata.tsx), so these public pages no longer need a nonce-aware JSON-LD script at all.

### 4. Historical-Debt Bucket Reduced In This Worktree

The following pages no longer declare their own `force-dynamic` export because they were only redirect shells or route-owned homepage wrappers:

- [app/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/page.tsx)
- [app/match/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/match/page.tsx)
- [app/delegation/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/delegation/page.tsx)
- [app/discover/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/discover/page.tsx)
- [app/governance/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/governance/page.tsx)
- [app/governance/committee/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/governance/committee/page.tsx)
- [app/governance/health/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/governance/health/page.tsx)
- [app/governance/leaderboard/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/governance/leaderboard/page.tsx)
- [app/governance/pools/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/governance/pools/page.tsx)
- [app/governance/proposals/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/governance/proposals/page.tsx)
- [app/governance/representatives/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/governance/representatives/page.tsx)
- [app/governance/treasury/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/governance/treasury/page.tsx)
- [app/my-gov/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/my-gov/page.tsx)
- [app/my-gov/profile/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/my-gov/profile/page.tsx)
- [app/my-gov/identity/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/my-gov/identity/page.tsx)
- [app/workspace/delegators/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/workspace/delegators/page.tsx)
- [app/workspace/performance/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/workspace/performance/page.tsx)
- [app/workspace/pool-profile/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/workspace/pool-profile/page.tsx)
- [app/workspace/position/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/workspace/position/page.tsx)
- [app/workspace/votes/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/workspace/votes/page.tsx)
- [app/you/drep/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/you/drep/page.tsx)
- [app/you/spo/page.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/app/you/spo/page.tsx)

## Next DD05 Step

- The cache-policy decision is now explicit in `dd05-cache-policy-decision.md`.
- The provider-level public/app shell split is now complete through [AppShellProviders.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/components/governada/AppShellProviders.tsx) plus nested app layouts under `app/admin`, `app/workspace`, `app/you`, `app/my-gov`, `app/claim`, `app/preview`, and `app/dev`.
- The locale ownership shift plus public CSP split are complete. The homepage, DRep, and proposal structured-data seam is already migrated onto [StructuredDataMicrodata.tsx](/C:/Users/dalto/governada/governada-app/.claude/worktrees/platform-architecture-review-series/components/shared/StructuredDataMicrodata.tsx), and the main root shell no longer depends on `next-themes` or request-scoped CSP ownership.
