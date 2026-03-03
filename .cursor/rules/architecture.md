---
description: DRepScore architecture, data flow, scoring model, and key file map
globs: ['lib/**', 'utils/**', 'app/api/**', 'components/**', 'app/**']
alwaysApply: false
---

# DRepScore Architecture

## What This Is

Cardano governance tool for casual ADA holders to discover DReps aligned with their values via scorecards and easy delegation. Brand: `$drepscore`. Tone: neutral, educational.

## Tech Stack

- **Framework**: Next.js 16 App Router, TypeScript strict, server components for data fetching
- **UI**: shadcn/ui + Tailwind CSS v4 + Recharts/Tremor. Dark mode via next-themes
- **Wallet**: MeshJS (Eternl, Nami, Lace, Typhon+). Wallet connection is optional — show value first
- **Data**: Koios API (mainnet) → Supabase (cache) → Next.js (reads)
- **Hosting**: Railway (Docker, health checks, auto-deploy from `main`). **NOT Vercel** — see Platform Constraints below
- **CDN/DNS**: Cloudflare
- **Background Jobs**: Inngest Cloud (16 durable functions — syncs, integrity, notifications, treasury, cross-chain benchmarks, all feature-flagged)
- **Error Tracking**: Sentry (Next.js SDK)
- **Analytics**: PostHog (JS + Node SDKs)

## Platform Constraints (Railway, NOT Vercel)

This project is fully deployed on Railway. Vercel is not part of any workflow, integration, or deployment path. Agents have introduced Vercel references 3 times — this rule exists to stop it permanently.

**Prohibited:**

- `process.env.VERCEL_URL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, or any `VERCEL_*` env var
- `vercel.json`, `.vercel/` directories, `@vercel/*` packages (except transitive deps in lockfile)
- Any code path, fallback, or comment that references Vercel as a deployment target

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

| Purpose                              | File(s)                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Base URL for server-side fetches     | `lib/constants.ts` (`BASE_URL`)                                                                                         |
| Supabase reads (primary data source) | `lib/data.ts`                                                                                                           |
| Koios API helpers (used by sync)     | `utils/koios.ts`                                                                                                        |
| Scoring & enrichment logic           | `lib/koios.ts`, `utils/scoring.ts`                                                                                      |
| Supabase client                      | `lib/supabase.ts`                                                                                                       |
| **Sync logic (durable, callable)**   | `lib/sync/dreps.ts`, `lib/sync/votes.ts`, `lib/sync/secondary.ts`, `lib/sync/slow.ts`                                   |
| Sync HTTP routes (thin wrappers)     | `app/api/sync/dreps/`, `app/api/sync/votes/`, `app/api/sync/secondary/`, `app/api/sync/slow/`                           |
| Proposals sync (inline in Inngest)   | `inngest/functions/sync-proposals.ts`                                                                                   |
| DRep types                           | `types/drep.ts`, `types/koios.ts`                                                                                       |
| Alignment scoring                    | `lib/alignment.ts`, `utils/scoring.ts`                                                                                  |
| Admin integrity                      | `app/api/admin/integrity/route.ts`, `app/admin/integrity/page.tsx`                                                      |
| Feature flags                        | `lib/featureFlags.ts`, `components/FeatureGate.tsx`, `app/api/admin/feature-flags/route.ts`, `app/admin/flags/page.tsx` |
| Cross-chain governance               | `lib/crossChain.ts`, `inngest/functions/sync-governance-benchmarks.ts`                                                  |
| Developer platform                   | `app/developers/page.tsx`, `components/DeveloperPage.tsx`, `components/ApiExplorer.tsx`                                 |
| Embeddable widgets                   | `app/embed/layout.tsx`, `public/embed.js`, `components/Embed*.tsx`                                                      |

## Feature Flags

Supabase-backed `feature_flags` table (41 flags across 14 categories) with admin UI at `/admin/flags`. Flags have a `category` column for grouping in the admin UI. Cached in-memory for 60s, overridable via env vars (`FF_<KEY>=true|false`).

- **Server components**: `const enabled = await getFeatureFlag('flag_key')` from `lib/featureFlags.ts`
- **Client components**: `<FeatureGate flag="flag_key">{children}</FeatureGate>` from `components/FeatureGate.tsx`, or `useFeatureFlag('flag_key')` hook
- **Inngest functions**: Check flag inside a `step.run()` and early-return if disabled
- **API routes**: Check flag and return empty/404 if disabled
- **Admin API**: `GET /api/admin/feature-flags` (public read), `PATCH` (admin-only, requires `address` in body)

**Flag categories:** AI (4), Cross-Chain (3), Platform (3), Social (5), Intelligence (3), Narrative (2), Discovery (5), DRep Tools (3), Governance (5), Treasury (1), Visual (1), Dashboard (3), Sharing (1), Notifications (2)

**Key convention:** Flat namespace, underscores, descriptive: `category_feature`. All default to `enabled: true`. When adding a new feature that is controversial, untested, or costly — add a flag with an appropriate category.

## Admin Pages

All admin-only pages and tools follow a standard pattern:

- **Route prefix**: `app/admin/*` (e.g., `/admin/integrity`, `/admin/flags`)
- **Client-side auth**: Each page uses `useWallet()` → `POST /api/admin/check` to verify the connected wallet against `ADMIN_WALLETS` env var. Shows "Admin Access Required" if not authorized.
- **Server-side auth (write APIs)**: All admin `PATCH/POST/DELETE` endpoints validate the `address` field in the request body against `ADMIN_WALLETS`.
- **Navigation**: Admin pages are grouped under an "Admin" section in the Header wallet dropdown (desktop `DropdownMenu`) and MobileNav sheet. The section only renders when `isAdmin` is true.
- **Sitemap exclusion**: `robots.ts` already disallows `/admin/`
- **When adding a new admin page**: Add the route under `app/admin/`, implement the auth guard, and add a nav link to both `Header.tsx` (wallet dropdown Admin section) and `MobileNav.tsx` (Admin section).

## Scoring Model (V3, Feb 2026)

```
DRep Score (0-100) =
  Rationale Quality (35%) +
  Effective Participation (30%) +
  Reliability (20%) +
  Profile Completeness (15%)
```

- Influence/voting power intentionally excluded (conflicts with decentralization mission)
- Abstention penalty: <25% mild, 25-50% moderate, >50% severe
- Size tiers: Small (<10k), Medium (10k-1M, optimal), Large (1M-10M), Whale (>10M)

## Sync Architecture

- **Full sync** (`/api/sync`): Daily at 2am UTC. All DReps, votes, rationales, proposals, scores
- **Fast sync** (`/api/sync/fast`): Every 30 min. New proposals, active votes only
- **Bootstrap**: One-time scripts for initial data population (`scripts/bootstrap-sync.ts`)
- **Integrity alerts** (`/api/admin/integrity/alert`): Every 6 hours, Slack/Discord webhooks

## Database (Supabase)

28+ migrations. Key tables: `dreps`, `drep_votes`, `vote_rationales`, `proposals`, `drep_score_history`, `proposal_voting_summary`, `drep_power_snapshots`, `poll_responses`, `sync_log`, `integrity_snapshots`, `api_keys`, `api_usage_log`, `drep_milestones`, `position_statements`, `vote_explanations`, `governance_philosophy`, `governance_benchmarks`, `feature_flags` (with `category` column, 41 rows)

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

## Background Jobs (Inngest Cloud)

All scheduled work runs via Inngest durable functions (no platform-specific crons).
When adding or removing functions, update this list AND the count in the Tech Stack section above.

**Data syncs** — call `execute*Sync()` from `lib/sync/` directly inside `step.run()`:

- `sync-dreps` — every 6h + `drepscore/sync.dreps` event (all DReps, scores, alignment, history)
- `sync-votes` — every 6h + `drepscore/sync.votes` event (bulk vote upsert + reconciliation)
- `sync-secondary` — every 6h + `drepscore/sync.secondary` event (delegator counts, power snapshots, integrity)
- `sync-slow` — daily 04:00 UTC + `drepscore/sync.slow` event (rationales, AI summaries, hash verification, push notifications)
- `sync-proposals` — every 30 min + `drepscore/sync.proposals` event (new/updated proposals)
- `sync-freshness-guard` — every 30 min (detects stale sync_log entries, re-triggers via `inngest.send()`)
- `sync-treasury-snapshot` — daily 22:30 UTC (Koios /totals → treasury_snapshots)
- `sync-governance-benchmarks` — weekly Sunday 06:00 UTC (Tally/SubSquare → governance_benchmarks, feature-flagged via `cross_chain_sync`)

**Alerts & health:**

- `alert-integrity` — every 6h (data quality + Discord alerts)
- `alert-inbox` — daily 03:00, 09:00, 15:00, 21:00 UTC (new proposal inbox alerts)
- `alert-api-health` — every 15 min (API health checks)

**Notifications & generation:**

- `check-notifications` — every 6h at :15 (DRep-specific: score changes, delegation, rank, milestones, deadlines, treasury)
- `check-accountability-polls` — daily 23:00 UTC (open/close/schedule treasury accountability polls)
- `generate-epoch-summary` — daily 22:00 UTC (detects epoch transitions, writes governance_events)
- `snapshot-ghi` — daily 04:30 UTC (computes GHI + stores epoch snapshot)
- `generate-governance-brief` — weekly Monday 10:00 UTC (personalized governance briefs for active users)
- `generate-state-of-governance` — weekly Sunday 20:00 UTC (canonical State of Governance report)

### Inngest Step Return Type Rule

All code paths in a `step.run()` callback must return the same object shape. Inngest serializes step results to JSON; TypeScript infers a union from divergent return paths. Later steps accessing properties that only exist on one branch will fail type-check. Always include all properties in early returns with empty defaults.

## Server Component Constraints

- Any `app/**/page.tsx` or `app/**/route.ts` that calls `createClient()`, `getSupabaseAdmin()`, or any runtime-only service must export `dynamic = 'force-dynamic'`. Railway's Docker build has no env vars at build time — Next.js will attempt static prerendering and crash.
- **NEVER use `export const revalidate`** on routes that touch Supabase or any env-var-dependent service. `revalidate` triggers build-time prerendering, which crashes in Railway's Docker build. This has caused production deploy failures 3 times. Use `force-dynamic` instead — cache at the application layer if needed.
- Client components (`'use client'`) that fetch via `useEffect` are unaffected since they never run during build.
- When creating any new server page or API route that fetches data, default to `force-dynamic`. Only use static generation for truly static content (no DB, no env vars).

### Next.js 16 Route Export Rule

Next.js 16 enforces strict validation of named exports from route files. **Only these exports are permitted in `app/**/route.ts` files:\*\*

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
