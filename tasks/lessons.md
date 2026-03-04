# Lessons Learned

<!-- LINE BUDGET: ~80 lines. Archive promoted/resolved entries to tasks/lessons-archive.md -->

Active patterns not yet encoded in cursor rules. Reviewed at session start.

---

## External API Discipline

**Pattern** (3 entries consolidated): Bulk endpoints over per-entity calls. Concurrent fetch (`Promise.all` in chunks of 5) over sequential `for...of await`. Per-request `AbortController` timeout (20s per call in a 60s function). Don't add expensive per-entity calls to sync functions already near their time budget — use a dedicated secondary sync.

## Supabase Write Safety

**Pattern**: ALWAYS destructure `{ error }` from every Supabase write. Supabase errors are plain objects (`{ message, details, hint }`), not `Error` instances — use `err?.message || JSON.stringify(err)`. Same applies to Koios errors: always `throw new Error(msg)`, never plain objects.

## Inngest Patterns

- **Step serialization boundary**: Step return values are JSON-serialized. Code outside `step.run()` re-executes on every step resumption. Capture timing/state in step 1's return. Reference memoized results, not ambient variables.
- **Consistent return shapes**: All code paths in `step.run()` must return the same object shape. Include all properties with empty defaults in early returns.
- **MCP transaction wrapping**: `apply_migration` wraps its own transaction. Strip `BEGIN`/`COMMIT` from SQL passed to it.

## Wallet Integration

- **Stake registration** required before vote delegation. Check via Koios `/account_info`. Chain `registerStakeCertificate` in same tx if needed. 2 ADA refundable deposit.
- **Nami standalone** has no CIP-1694 governance support. Detect via `supportedExtensions` for CIP-95. Direct users to Lace.
- **Phase tracking**: Split build/sign/submit with `onPhase` callbacks. Don't conflate tx building with wallet signing.

## RLS Policies

- Always use `(select auth.role())` not bare `auth.role()` — prevents per-row re-evaluation.
- Never use `FOR ALL` when the table also has a `FOR SELECT` policy. Split into per-operation policies.
- Tables with wallet-based RLS (`governance_events`) require `getSupabaseAdmin()` for server-side writes.

## Safety Rails

- **`.env.local` is production**: Never trigger syncs, backfills, or write-path tests from localhost without explicit approval.
- **`.cursor/mcp.json` is sacred**: Contains secrets + cached OAuth. NEVER overwrite, recreate, or modify without explicit user approval.
- **Redis required in production**: Infrastructure protecting against abuse must fail closed, never silently degrade.
- **Admin bypass**: Every gated feature must check `isAdmin` as a bypass. Admin gets a DRep selector dropdown.

## AI Features

**Pattern**: AI must narrate, never generate statistics. `assembleData()` → `generateNarrative(data)`. All numbers from Supabase queries; Claude only receives pre-computed facts. Use shared `lib/ai.ts` (`generateText`/`generateJSON`) — never duplicate SDK instantiation.

## Monitoring

**Pattern**: When refactoring a system, update ALL consumers: monitoring, alerting, self-healing, cleanup. Use a single config source of truth. Self-healing must use canonical production domain (`NEXT_PUBLIC_SITE_URL`).

## Sync Architecture

**Pattern**: Never use HTTP self-calls for durable background work. Inngest functions import `execute*Sync()` directly inside `step.run()`. HTTP routes exist only for manual/debug triggers. Write-path fetches must use `cache: 'no-store'`.

## Pre-existing Build Failures

**Pattern**: When a pre-existing build failure exists, fix or isolate it first so new failures are immediately visible. Don't dismiss build issues as "pre-existing" — they mask real problems.

---

### TanStack Query migration pattern

When migrating `fetch` + `useEffect` + `useState` to `useQuery`, create shared hooks in `hooks/queries.ts` with the `fetchJson<T>` helper. The `enabled` option prevents requests when dependencies are null/undefined. Components that previously passed `Authorization` headers via `getStoredSession()` need verification since the shared `fetchJson` helper uses plain `fetch` — cookie-based auth covers most cases.

### withRouteHandler changes error shapes

When routes are wrapped with `withRouteHandler`, unhandled exceptions now return `{ error: 'Internal server error' }` instead of custom error messages. Tests expecting specific error messages must be updated. This is by design — never leak internal error details to clients.

### Dynamic imports for bundle optimization

Use `next/dynamic` with `ssr: false` for components importing heavy libs (Three.js, d3, canvas-confetti, fuse.js). For page-level wrappers like `template.tsx`, use `React.lazy` + `Suspense` with a fallback that renders children directly to avoid blocking initial paint.

## Session Correction Log

| Session | Date       | Corrections | Notes                                                                                                                |
| ------- | ---------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| S18     | 2026-03-03 | 2           | CI cascade, hooks order                                                                                              |
| S19     | 2026-03-04 | 2           | test error shape after withRouteHandler wrap                                                                         |
| S20     | 2026-03-04 | 1           | Sentry Cron Monitors: use captureCheckIn (start/end) not withMonitor for Inngest step-based functions                |
| S21     | 2026-03-04 | 1           | React version mismatch (react vs react-dom) blocks jsdom render — keep versions pinned together                      |
| S22     | 2026-03-04 | 1           | @testing-library/react needs explicit cleanup() in vitest jsdom env when tests share test-ids                        |
| S23     | 2026-03-04 | 1           | Dashboard config (Sentry alerts, PostHog funnels) can't be automated via code — document reproducible setup in docs/ |

_Last updated: 2026-03-04_
_Review at session start. Archive promoted entries immediately._
