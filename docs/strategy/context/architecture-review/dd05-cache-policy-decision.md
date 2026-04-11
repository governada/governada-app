# DD05 Cache-Policy Decision

**Date:** 2026-04-08  
**Status:** Accepted DD05 follow-up contract

## Decision

- Public discovery and detail routes move toward a cache-first contract.
- Private, authenticated, admin, and API surfaces remain request-scoped by design.
- Public locale becomes route-owned over time; request headers and cookies stop deciding the public HTML contract.
- Strict nonce-based CSP remains on request-scoped app surfaces.
- Public SEO markup moves away from nonce-dependent inline JSON-LD toward shared structured-data primitives that do not require `headers()` reads in the route file.
- The public shell becomes dark-first without a root runtime theme bootstrap. Embed-specific theme negotiation can stay isolated from the main public shell.

## Why This Is The Chosen Path

- The remaining DD05 blocker was architectural rather than a small code smell: `app/layout.tsx` forced the tree dynamic for locale negotiation, and the public shell sat under the current nonce-based CSP boundary even after the homepage, DRep, and proposal SEO markup moved to shared microdata. That contract is now resolved in this worktree.
- Next.js treats nonce-based CSP as a dynamic-rendering contract. As long as the public shell keeps that model, broad caching and future partial prerendering stay capped.
- The repo already chose a database-first read path for governance data. Public pages should be able to read those cached DB-backed projections without inheriting a blanket dynamic requirement.

## Route Classes

The validator source of truth is `scripts/lib/routeRenderPolicy.mjs`.

### `public-cache`

- Public route intended to be cache-first.
- Current example includes the root shell at `app/layout.tsx`.
- May read cached governance data through `lib/data.ts` or equivalent DB-first read helpers.
- May not read request headers, cookies, direct Supabase clients, direct Redis clients, or raw `process.env` in the route file.

### `public-dynamic-exception`

- Public route that is still request-scoped because of an explicit product or infrastructure contract.
- Current examples include DRep/proposal detail, embed surfaces, and several public report/share flows.
- Must export `const dynamic = 'force-dynamic'` when it touches cached governance data or request-scoped runtime APIs.

### `app-dynamic`

- Authenticated, admin, operator, or API surface that is intentionally request-scoped.
- Must export `const dynamic = 'force-dynamic'` when it touches cached governance data or request-scoped runtime APIs.

## Migration Sequence

1. Shared structured-data emitter
   Completed in this worktree. The homepage, DRep, and proposal surfaces now emit shared microdata through `components/shared/StructuredDataMicrodata.tsx`, so their public SEO contract no longer depends on nonce-aware JSON-LD scripts.
2. Root shell dark-mode simplification
   Completed in this worktree. The main app shell no longer uses `next-themes` at runtime; `app/layout.tsx` now owns dark mode directly and no longer reads `x-nonce` for theme bootstrap.
3. Public/app shell split
   Completed in this worktree. App-only workflow providers now live in `components/governada/AppShellProviders.tsx`, and nested admin/workspace/you/my-gov/claim/preview/dev layouts opt into them instead of forcing `ModeProvider`, `ShortcutProvider`, and `ShortcutOverlay` onto every public route through `GovernadaShell`.
4. Locale ownership shift
   Completed in this worktree. The root document shell now owns the canonical public document locale directly, and the cookie remains a preference helper rather than the public HTML authority.
5. Public CSP split
   Completed in this worktree. Public cacheable routes now use static headers plus App Router SRI, while nonce-based CSP stays confined to request-scoped app surfaces.
6. Public cache rollout
   Remove the remaining page-level dynamic exceptions route by route without reintroducing shell, locale, or structured-data coupling.

## Validator Implications

- `npm run agent:validate` now recognizes `public-cache`, `public-dynamic-exception`, and `app-dynamic` explicitly.
- The validator no longer assumes every `lib/data.ts` read must force the route dynamic.
- The validator still blocks cache-first routes from reading request-scoped APIs, direct Supabase/Redis clients, or raw env access.

## Current Status

The provider-level public/app shell split is complete, and the locale/CSP contract is now implemented in the worktree. Any remaining DD05 follow-up is page-local public cache rollout or homepage profiling rather than root-shell locale/CSP ownership.
