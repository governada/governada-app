---
description: DRepScore architecture, data flow, scoring model, and key file map
globs: ['lib/**', 'utils/**', 'app/api/**', 'components/**', 'app/**']
alwaysApply: false
---
<!-- LINE BUDGET: 120 lines. Inngest/sync details → architecture-jobs.md. DB tables → query via Supabase MCP. -->

# DRepScore Architecture

## What This Is

The governance intelligence layer for Cardano -- ingests every governance action on-chain, layers opinionated analysis, and delivers personalized, actionable insight to every ecosystem participant. Brand: `$drepscore`. Tone: neutral, educational.

**Product vision and build sequence:** See `docs/strategy/ultimate-vision.md` for the definitive north star -- build order, monetization phases, data flywheel, and how every system connects.

## Tech Stack

- **Framework**: Next.js 16 App Router, TypeScript strict, server components for data fetching
- **UI**: shadcn/ui + Tailwind CSS v4 + Recharts/Tremor. Dark mode via next-themes
- **Client data fetching**: TanStack Query (`@tanstack/react-query`) — use for ALL client-side data fetching. Never raw `fetch` + `useState` + `useEffect` for API calls. Provider in `components/Providers.tsx`, client config in `lib/queryClient.ts`
- **Wallet**: MeshJS (Eternl, Nami, Lace, Typhon+). Wallet connection is optional — show value first
- **Data**: Koios API (mainnet) → Supabase (cache) → Next.js (reads)
- **Caching/Rate Limiting**: Upstash Redis (primary, via `lib/redis.ts` + `@upstash/ratelimit`). Falls back to Supabase `api_usage_log` when Redis env vars are unset. Use `cached()` from `lib/redis.ts` for shared server-side caching
- **Hosting**: Railway (Docker, health checks, auto-deploy from `main`)
- **CDN/DNS**: Cloudflare
- **Background Jobs**: Inngest Cloud (see `architecture-jobs.md` for full function list)
- **Error Tracking**: Sentry (Next.js SDK)
- **Analytics**: PostHog (JS + Node SDKs)
- **Testing**: Vitest (unit/integration in `__tests__/`), Playwright (E2E in `e2e/`), smoke tests (`scripts/smoke-test.ts`)
- **Code Quality**: Prettier + ESLint + lint-staged (pre-commit). `npm run format:check` in CI
- **Type Safety**: Supabase types generated via `npm run gen:types` (run after every migration)

## Platform Constraints (Railway)

This project is fully deployed on Railway (Docker). Railway auto-deploys on merge to `main`.

**Required for server-side URL construction:**

```ts
import { BASE_URL } from '@/lib/constants';
// Uses NEXT_PUBLIC_SITE_URL (set to https://drepscore.io in Railway), falls back to localhost
```

Never construct base URLs from env vars directly. `BASE_URL` is the single source of truth.

## Data Flow (Canonical)

```
Koios API (source of truth)
    ↓  sync scripts + /api/sync routes
Supabase (cache layer, persistent storage)
    ↓  lib/data.ts reads
Next.js App (server components + API routes + client components)
```

**Critical rule**: All frontend reads go through Supabase via `lib/data.ts`. Direct Koios calls only happen inside sync scripts and `utils/koios.ts` (used by sync). Never add new direct-API paths to the frontend.

## Key Files

| Purpose                               | File(s)                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL for server-side fetches      | `lib/constants.ts` (`BASE_URL`)                                                                                                                    |
| Supabase reads (primary data source)  | `lib/data.ts`                                                                                                                                      |
| Koios API helpers (used by sync)      | `utils/koios.ts`                                                                                                                                   |
| Scoring V3 (pillar computation)       | `lib/scoring/` (engagementQuality, effectiveParticipation, reliability, governanceIdentity, drepScore, percentile, types)                          |
| Scoring & enrichment (legacy helpers) | `lib/koios.ts`, `utils/scoring.ts`                                                                                                                 |
| Supabase client                       | `lib/supabase.ts`                                                                                                                                  |
| **Sync logic (durable, callable)**    | `lib/sync/dreps.ts`, `lib/sync/votes.ts`, `lib/sync/secondary.ts`, `lib/sync/slow.ts`                                                              |
| Sync HTTP routes (thin wrappers)      | `app/api/sync/dreps/`, `app/api/sync/votes/`, `app/api/sync/proposals/`, `app/api/sync/secondary/`, `app/api/sync/slow/`, `app/api/sync/treasury/` |
| Proposals sync (inline in Inngest)    | `inngest/functions/sync-proposals.ts`                                                                                                              |
| DRep types                            | `types/drep.ts`, `types/koios.ts`                                                                                                                  |
| Alignment scoring (PCA)               | `lib/alignment/` (pca, voteMatrix, classifyProposals, normalize, dimensions, rationaleQuality, validate), `lib/alignment.ts`                       |
| Matching engine (quiz + confidence)   | `lib/matching/confidence.ts`, `lib/matching/dimensionAgreement.ts`, `lib/matching/userProfile.ts`, `lib/representationMatch.ts`                    |
| GHI v2 (6 components + EDI)           | `lib/ghi/` (index, components, ediMetrics, calibration, types), `lib/ghi.ts` (re-export shim)                                                      |
| Decentralization dashboard            | `app/decentralization/`, `app/api/governance/decentralization/route.ts`                                                                            |
| Admin integrity                       | `app/api/admin/integrity/route.ts`, `app/admin/integrity/page.tsx`                                                                                 |
| Feature flags                         | `lib/featureFlags.ts`, `components/FeatureGate.tsx`, `app/api/admin/feature-flags/route.ts`, `app/admin/flags/page.tsx`                            |
| Cross-chain governance                | `lib/crossChain.ts`, `inngest/functions/sync-governance-benchmarks.ts`                                                                             |
| Developer platform                    | `app/developers/page.tsx`, `components/DeveloperPage.tsx`, `components/ApiExplorer.tsx`                                                            |
| Embeddable widgets                    | `app/embed/layout.tsx`, `public/embed.js`, `components/Embed*.tsx`                                                                                 |

## Feature Flags

Supabase-backed `feature_flags` table (41 flags across 14 categories) with admin UI at `/admin/flags`. Flags have a `category` column for grouping in the admin UI. Cached in-memory for 60s, overridable via env vars (`FF_<KEY>=true|false`).

- **Server components**: `const enabled = await getFeatureFlag('flag_key')` from `lib/featureFlags.ts`
- **Client components**: `<FeatureGate flag="flag_key">{children}</FeatureGate>` from `components/FeatureGate.tsx`, or `useFeatureFlag('flag_key')` hook
- **Inngest functions**: Check flag inside a `step.run()` and early-return if disabled
- **API routes**: Check flag and return empty/404 if disabled
- **Admin API**: `GET /api/admin/feature-flags` (public read), `PATCH` (admin-only, requires `address` in body)

**Key convention:** Flat namespace, underscores, descriptive: `category_feature`. All default to `enabled: true`. When adding a new feature that is controversial, untested, or costly — add a flag with an appropriate category.

**Admin pages**: All under `app/admin/`, client auth via `POST /api/admin/check`, write endpoints validate `address` against `ADMIN_WALLETS`. Add nav links to Header dropdown + MobileNav Admin section.

## Scoring Model (V3, Mar 2026)

```
DRep Score (0-100, percentile-normalized) =
  Engagement Quality (35%) +
  Effective Participation (25%) +
  Reliability (25%) +
  Governance Identity (15%)
```

Each pillar is computed as a raw score, then percentile-normalized across the full DRep population. The composite is a weighted sum of percentile scores. Implementation: `lib/scoring/`.

- **Engagement Quality**: provision rate (decay-weighted), AI rationale quality, deliberation signal
- **Effective Participation**: importance-weighted participation with treasury scaling and close-margin bonus
- **Reliability**: consistency, abstention penalty, responsiveness (median days to vote)
- **Governance Identity**: quality-tiered profile completeness + delegator count percentile
- **Momentum**: linear regression slope over score history (stored as `score_momentum`)
- Influence/voting power intentionally excluded (conflicts with decentralization mission)
- Temporal decay: exponential with 180-day half-life on vote-related metrics

## Server Component Constraints

- Any `app/**/page.tsx` or `app/**/route.ts` that calls `createClient()`, `getSupabaseAdmin()`, or any runtime-only service must export `dynamic = 'force-dynamic'`. Railway's Docker build has no env vars at build time — Next.js will attempt static prerendering and crash.
- **NEVER use `export const revalidate`** on routes that touch Supabase or any env-var-dependent service. `revalidate` triggers build-time prerendering, which crashes in Railway's Docker build. This has caused production deploy failures 3 times. Use `force-dynamic` instead — cache at the application layer if needed.
- Client components (`'use client'`) that fetch via `useEffect` are unaffected since they never run during build.
- When creating any new server page or API route that fetches data, default to `force-dynamic`. Only use static generation for truly static content (no DB, no env vars).

### Next.js 16 Route Export Rule

Next.js 16 enforces strict validation of named exports from route files. **Only these exports are permitted in `app/**/route.ts` files:**

- HTTP method handlers: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Config fields: `dynamic`, `revalidate`, `fetchCache`, `runtime`, `preferredRegion`, `maxDuration`, `generateStaticParams`

**Any other named export causes a build failure**: `"X" is not a valid Route export field.`

This means: helper functions, business logic, type re-exports, and utility functions **must not be exported from route files**. For sync logic that needs to be callable from both a route and an Inngest function:

```
lib/sync/<name>.ts   ← export function execute*Sync()  (durable logic lives here)
app/api/sync/<name>/route.ts  ← import from lib/sync/, thin auth wrapper only
inngest/functions/sync-<name>.ts  ← import from lib/sync/, call inside step.run()
```

This pattern also improves testability — lib functions can be tested without HTTP request mocking.

### `dreps` Table Schema Convention

The `dreps` table uses `id` as its primary key (the full `drep1...` bech32 string). All other tables use `drep_id` as their foreign key column. **Do not query `dreps.drep_id` — it does not exist.**

Display metadata (`name`, `ticker`, `handle`, `description`, `isActive`, `votingPower`, etc.) is stored inside the `info` JSONB column, not as top-level columns. To get a DRep's display name from a raw Supabase row:

```
const info = row.info || {};
const name = info.name || info.ticker || info.handle || shortenDRepId(row.id);
```

The `lib/data.ts` `mapRow()` function unpacks `info` into flat `EnrichedDRep` properties. When writing new API routes that query `dreps` directly via Supabase, select `id, score, info, ...` — never `name`, `ticker`, or `handle` as columns.

### File Extension Rule for JSX

Any API route that uses JSX (e.g., `ImageResponse` from `next/og`) **must** use the `.tsx` extension, not `.ts`. TypeScript will not parse JSX syntax in `.ts` files. This applies to all OG image routes under `app/api/og/` and the badge route under `app/api/badge/`.

## UX Principles

- Show value first (no forced wallet connect)
- Educational tooltips on every metric
- Well-documented DRep filter by default (has name + ticker or description)
- Summary view default, depth on demand (hover tooltips, expandable sections)
- Loading skeletons, <3s target page loads
- Encourage delegation to smaller, quality DReps (size tier badges, decentralization scoring)
- **Ambitious by default**: Every user-facing visual must be unmistakably DRepScore — not generic shadcn. Custom visualizations over chart libraries, physics-based animations over CSS transitions, identity-colored accents on every surface. See "Ambitious by Default" in `workflow.md` for the full decision framework.

## Production URL

https://drepscore.io
