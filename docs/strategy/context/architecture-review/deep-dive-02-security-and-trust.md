# Deep Dive 02 - Security and Trust

**Status:** In progress
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
- `middleware.ts` uses cookie presence as a coarse gate for `/workspace` and `/you`, but does not itself verify JWT validity.
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

**Severity:** High

**Evidence**

- `lib/api/handler.ts:48-61` validates API keys and sets `tier = result.key.tier`, but only rejects requests when `options.requiredTier && tier === 'anon'`.
- `app/api/v1/dreps/[drepId]/history/route.ts:49` marks the endpoint as `requiredTier: 'pro'`.
- `app/api/v1/dreps/[drepId]/votes/route.ts:80` marks the endpoint as `requiredTier: 'pro'`.
- `lib/api/keys.ts` defines multiple authenticated tiers: `public`, `pro`, `business`, and `enterprise`.

**Why it matters**

The route wrapper claims to enforce a minimum API tier, but the implementation only blocks anonymous callers. Any authenticated `public` key can pass a `requiredTier: 'pro'` route, so premium endpoints are not actually tier-gated.

### 2. Internal route rate limiting silently weakens to per-process memory under Redis failure

**Severity:** High

**Evidence**

- `lib/api/withRouteHandler.ts:61-89` attempts Upstash-backed rate limiting, then falls back to an in-memory `Map` when Redis access throws.
- `lib/api/withRouteHandler.ts:124-129` applies that limiter to any route using `rateLimit`.
- `lib/api/rateLimit.ts` uses a different policy and explicitly fails closed on Redis errors.

**Why it matters**

For protected internal routes, a Redis outage does not preserve the intended global control. Enforcement becomes process-local instead of shared across instances, which materially weakens the protection boundary exactly when the system is already degraded.

## Risk Ranking

1. Public API tier enforcement bug on paywalled routes.
2. Route rate limiting degrades from global to process-local when Redis is unavailable.

## Open Questions

- Are any other v1 routes using `requiredTier` with the same broken comparison, or is the blast radius limited to the two DRep endpoints?
- Should the internal route wrapper fail closed like `lib/api/rateLimit.ts` instead of falling back to in-memory?
- Do any protected page flows rely on `middleware.ts` cookie presence as the only gate, or do they always re-verify server-side?
- Is `Authorization: Bearer` the only supported API key transport, or should `X-API-Key` be accepted as well? The current CORS policy advertises `X-API-Key`, but `withApiHandler` does not read it.
- Should observability continue trusting decoded session payloads for user tagging in `instrumentation.ts`, or should that be derived only from verified session state?

## Next Actions

1. Fix the public API tier comparison so `requiredTier` enforces an actual minimum tier level, not just "authenticated vs anonymous."
2. Rework internal route rate limiting so Redis failure does not silently downgrade to process-local protection.
3. Continue scanning the remaining auth-sensitive routes for any missing `requireAuth()` / `isAdminWallet()` combinations.
4. Decide whether API key transport should be normalized to `Authorization` only or dual-supported with `X-API-Key`.

## Handoff

**Current status:** In progress

**What changed this session**

- Mapped the session, middleware, admin, API key, and rate-limit trust boundaries.
- Validated two concrete security findings with file-level evidence.
- Left the remaining trust questions explicit instead of guessing.

**Evidence collected**

- `middleware.ts`
- `lib/api/handler.ts`
- `lib/api/withRouteHandler.ts`
- `lib/api/keys.ts`
- `lib/api/rateLimit.ts`
- `lib/supabaseAuth.ts`
- `lib/adminAuth.ts`
- `instrumentation.ts`
- `app/api/admin/check/route.ts`
- `app/api/admin/overview/route.ts`
- `app/api/admin/feature-flags/route.ts`
- `app/api/admin/integrity/route.ts`
- `app/api/v1/dreps/[drepId]/history/route.ts`
- `app/api/v1/dreps/[drepId]/votes/route.ts`

**Validated findings**

- `requiredTier: 'pro'` does not block `public` API key holders.
- Internal route rate limiting falls back to in-memory state when Redis is unavailable.

**Open questions**

- See the `Open Questions` section above.

**Next actions**

- Patch the API tier comparison.
- Patch the internal rate-limit fallback behavior.
- Continue auditing the remaining privileged routes and session-dependent page flows.

**Next agent starts here**

Start by fixing the two validated issues above, then re-check the route surface for any other auth or trust assumptions that still depend on path presence, unsigned payload data, or degraded-mode fallbacks.
