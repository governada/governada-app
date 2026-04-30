# Deep Dive 02 - Security and Trust

**Status:** Completed
**Started:** 2026-04-03
**Owner branch:** `feature/platform-architecture-review-series`
**Review goal:** verify auth, session handling, middleware gates, admin/API privilege boundaries, rate limiting, API key handling, and other trust-boundary risks.

## Scope

This deep dive covers:

- Session creation, validation, and revocation
- Middleware gating for protected routes
- Admin route privilege checks
- Public API key validation and tier enforcement
- Rate limiting behavior under normal and degraded conditions
- Observability paths that depend on trusted user/session data

## Review Questions

1. Which boundary is authoritative for each class of request: middleware, route handler, or downstream data access?
2. Do auth and API key checks actually enforce the stated policy, or only a subset of it?
3. What happens when Redis, Supabase, or other trust infrastructure is degraded?
4. Are admin and public API privileges enforced consistently across the route surface?
5. Are there any places where the app trusts unsigned or unverified identity data for security-sensitive behavior?

## Files Read First

- `middleware.ts`
- `lib/api/handler.ts`
- `lib/api/withRouteHandler.ts`
- `lib/api/keys.ts`
- `lib/api/rateLimit.ts`
- `lib/supabaseAuth.ts`
- `lib/adminAuth.ts`
- `instrumentation.ts`
- `app/api/admin/`
- `app/api/v1/`

## Evidence Collected So Far

- `lib/supabaseAuth.ts` is the canonical server-side session verifier. It validates the JWT, checks expiration, and fails closed if revocation state cannot be checked.
- `proxy.ts` is the current route gate for `/workspace`, `/you`, and `/api/v1` CORS behavior.
- `proxy.ts` uses cookie presence as a coarse gate for `/workspace` and `/you`, but does not itself verify JWT validity.
- Admin routes mostly enforce `requireAuth()` plus `isAdminWallet()` at the handler level.
- `lib/api/handler.ts` is the public v1 API wrapper and owns API key validation and tier gating.
- `lib/api/withRouteHandler.ts` is the internal route wrapper and owns auth plus rate limiting for non-v1 routes.
- `lib/api/rateLimit.ts` implements a separate, fail-closed rate limit helper, which is materially different from the fallback behavior in `withRouteHandler.ts`.

## Initial System Boundary Snapshot

The intended trust chain is:

`client session / API key -> auth helper -> route wrapper -> data access -> downstream side effects`

That shape is reasonable. The current review risk is not missing a trust layer. The risk is inconsistent enforcement and failure-mode drift between similar helpers.

## Findings

### 1. `requiredTier: 'pro'` is not actually enforced for public API key holders

**Severity:** Fixed in this worktree

**Evidence**

- `lib/api/handler.ts:48-61` validates API keys and sets `tier = result.key.tier`, but only rejects requests when `options.requiredTier && tier === 'anon'`.
- `app/api/v1/dreps/[drepId]/history/route.ts:49` marks the endpoint as `requiredTier: 'pro'`.
- `app/api/v1/dreps/[drepId]/votes/route.ts:80` marks the endpoint as `requiredTier: 'pro'`.
- `lib/api/keys.ts` defines multiple authenticated tiers: `public`, `pro`, `business`, and `enterprise`.

**Why it matters**

The route wrapper claimed to enforce a minimum API tier, but the implementation only blocked anonymous callers. Any authenticated `public` key could pass a `requiredTier: 'pro'` route, so premium endpoints were not actually tier-gated.

**Implementation status**

- Fixed in `lib/api/handler.ts` by introducing explicit tier ranking comparison.
- Verified with `__tests__/api/v1-drep-history.test.ts`.

### 2. Internal route rate limiting silently weakens to per-process memory under Redis failure

**Severity:** Fixed in this worktree

**Evidence**

- `lib/api/withRouteHandler.ts:61-89` attempts Upstash-backed rate limiting, then falls back to an in-memory `Map` when Redis access throws.
- `lib/api/withRouteHandler.ts:124-129` applies that limiter to any route using `rateLimit`.
- `lib/api/rateLimit.ts` uses a different policy and explicitly fails closed on Redis errors.

**Why it matters**

For protected internal routes, a Redis outage did not preserve the intended global control. Enforcement became process-local instead of shared across instances, which materially weakened the protection boundary exactly when the system was already degraded.

**Implementation status**

- Fixed in `lib/api/withRouteHandler.ts` by removing the silent in-memory downgrade and failing closed on shared rate-limit initialization/runtime errors.
- Verified with `__tests__/api/withRouteHandler.test.ts`.

### 3. Public API wrapper previously dropped dynamic route params on v1 endpoints

**Severity:** Fixed in this worktree

**Evidence**

- `lib/api/handler.ts` previously invoked wrapped handlers with `(request, ctx)` only.
- `app/api/v1/dreps/[drepId]/route.ts`, `app/api/v1/dreps/[drepId]/history/route.ts`, `app/api/v1/dreps/[drepId]/votes/route.ts`, and `app/api/v1/embed/[drepId]/route.ts` all declare a third `params` argument.

**Why it matters**

Tier-gated route tests exposed that the wrapper contract did not actually match the route handler signatures. That meant dynamic v1 routes were depending on a wrapper that did not forward the route params they expected.

**Implementation status**

- Fixed in `lib/api/handler.ts` by forwarding Next.js route `params`.
- Verified with `__tests__/api/v1-drep-history.test.ts`.

### 4. Public v1 CORS preflight did not allow the documented `Authorization` transport

**Severity:** Fixed in this worktree

**Evidence**

- `proxy.ts` handled `/api/v1/*` CORS preflight centrally.
- That CORS header previously allowed `Content-Type, X-API-Key` but not `Authorization`.
- `lib/api/handler.ts` supports both `Authorization: Bearer` and `X-API-Key` for API key transport.

**Why it matters**

Browser-based cross-origin consumers using the documented bearer transport would fail preflight even though the handler accepted the header at runtime. That is a real trust-boundary mismatch between edge policy and handler policy.

**Implementation status**

- Fixed in `proxy.ts` by adding `Authorization` to `Access-Control-Allow-Headers`.
- Verified with `__tests__/proxy.test.ts`.

### 5. Error instrumentation trusted unsigned session cookie payloads for user tagging

**Severity:** Fixed in this worktree

**Evidence**

- `instrumentation.ts` previously decoded the `drepscore_session` cookie payload directly and used `walletAddress` from the unsigned payload to derive the Sentry user tag.
- That path did not verify the JWT signature before attaching hashed identity context to error reports.

**Why it matters**

This did not grant application privileges, but it did let a forged cookie influence security-adjacent telemetry. During incident response, spoofed user attribution increases diagnostic noise and weakens trust in the observability boundary.

**Implementation status**

- Fixed in `instrumentation.ts` by verifying the session JWT signature before extracting `walletAddress` for Sentry tagging.
- Invalid or unsigned cookies now produce no user tag.
- Verified with `__tests__/instrumentation.test.ts`.

## Residual Risks

1. `proxy.ts` still uses cookie presence as a coarse route gate before server-side auth verification, which can admit invalid-session users to protected page shells even though downstream data routes re-verify.
2. The `/admin` preview-user deny rule in `proxy.ts` still inspects cookie payload data without signature verification, but only for an early deny path rather than a privilege grant.

## Open Questions

- Should the coarse `/workspace` and `/you` page-shell gate move from cookie presence to lightweight JWT verification in `proxy.ts`, or is the current downstream re-verification sufficient for launch?

## Next Actions

1. Carry the page-shell auth-gate question as a product/security tradeoff instead of leaving it implicit.
2. Move to the next active deep dive in the series.

## Handoff

**Current status:** Completed

**What changed this session**

- Mapped the session, proxy, admin, API key, and rate-limit trust boundaries.
- Fixed the initial public API tier and wrapper issues, then closed the remaining concrete trust-boundary defects around browser bearer transport and unsigned observability identity tagging.
- Scanned the `/workspace`, `/you`, and admin route surface to distinguish confirmed bugs from residual coarse-gate risks.

**Evidence collected**

- `proxy.ts`
- `lib/api/handler.ts`
- `lib/api/withRouteHandler.ts`
- `lib/api/keys.ts`
- `lib/api/rateLimit.ts`
- `lib/supabaseAuth.ts`
- `lib/adminAuth.ts`
- `instrumentation.ts`
- `app/workspace/layout.tsx`
- `app/workspace/page.tsx`
- `app/you/layout.tsx`
- `app/you/page.tsx`
- `app/api/admin/api-health/alert/route.ts`
- `app/api/admin/check/route.ts`
- `app/api/admin/overview/route.ts`
- `app/api/admin/feature-flags/route.ts`
- `app/api/admin/inbox-alert/route.ts`
- `app/api/admin/integrity/route.ts`
- `app/api/admin/integrity/alert/route.ts`
- `app/api/admin/systems/automation/route.ts`
- `app/api/v1/dreps/[drepId]/route.ts`
- `app/api/v1/dreps/[drepId]/history/route.ts`
- `app/api/v1/dreps/[drepId]/votes/route.ts`
- `app/api/v1/embed/[drepId]/route.ts`
- `__tests__/proxy.test.ts`
- `__tests__/instrumentation.test.ts`
- `__tests__/api/v1-drep-history.test.ts`
- `__tests__/api/withRouteHandler.test.ts`
- `__tests__/api/v1-dreps.test.ts`
- `__tests__/api/v1-governance-health.test.ts`

**Validated findings**

- `requiredTier: 'pro'` did not block `public` API key holders. Fixed in this worktree.
- Internal route rate limiting fell back to in-memory state when Redis was unavailable. Fixed in this worktree.
- The public v1 API wrapper did not forward dynamic route params. Fixed in this worktree.
- The public v1 API wrapper now accepts both `Authorization: Bearer` and `X-API-Key`, matching the advertised transport contract.
- `/api/v1/*` CORS preflight now allows `Authorization`, matching the documented bearer transport. Fixed in this worktree.
- `instrumentation.ts` now verifies the session JWT before deriving Sentry user tags from cookie state. Fixed in this worktree.
- The scanned `/workspace`, `/you`, and admin route surfaces did not reveal another confirmed auth-bypass path; the remaining concern is the coarse page-shell gate in `proxy.ts`, not downstream privilege enforcement.

**Open questions**

- See the `Open Questions` section above.

**Next actions**

- Deep Dive 02 is complete.
- Carry the coarse page-shell auth-gate question into a later architecture or launch-hardening decision if needed.

**Next agent starts here**

Deep Dive 02 is complete. The next agent should move to the next prioritized review area from the series index.
