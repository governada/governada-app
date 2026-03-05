# Civica (formerly DRepScore)

The civic hub for the Cardano Nation — makes governance visible, accountable, and participatory for every citizen. Ingests every governance action on-chain, layers opinionated scoring and analysis, and delivers personalized, actionable civic intelligence.

## Critical Rules

These override all other guidance when in conflict. Every rule has been violated and caused real damage.

1. **Feature branches for code changes.** `git branch --show-current` before any edit. If on `main` and it's not a single-commit hotfix the user explicitly requested, create a branch first.

2. **Ship It = the task. Autonomous end-to-end deployment is mandatory.** Implementation is NOT complete until deployed and validated in production. After code compiles clean, execute this sequence WITHOUT STOPPING OR ASKING:
   1. Push branch → create PR
   2. Wait for CI — fix failures if they're yours, verify pre-existing if they're not
   3. Merge PR (use `gh api .../merge` from worktrees)
   4. Apply pending migrations via Supabase MCP `apply_migration`
   5. Monitor Railway deployment (`railway logs` to watch build, poll until healthy)
   6. PUT `/api/inngest` if Inngest functions were added/modified → `npm run inngest:status` to verify
   7. Hit new/changed endpoints on `drepscore.io` to verify 200 responses
   8. `npm run posthog:check <event>` if new analytics events were added
   9. Clean up worktree
      Never say "PR created — merge when ready." Never present a deployment checklist. Just do it.

3. **Railway is the deploy target.** Use `BASE_URL` from `lib/constants.ts` for server-side URLs. No other hosting platform is part of the stack.

4. **`force-dynamic` on all runtime routes.** Any `app/**/page.tsx` or `route.ts` touching Supabase/env vars MUST export `const dynamic = 'force-dynamic'`. Railway Docker build has no env vars. NEVER use `export const revalidate` on these routes.

5. **Register every Inngest function in `serve()`.** Same commit as the function file. An unregistered function never runs.

6. **Feature-flag risky features.** Controversial/untested/costly → `getFeatureFlag()` (server) or `<FeatureGate>` (client). Add flag to `feature_flags` table via migration.

7. **Database-first reads.** Frontend reads → Supabase via `lib/data.ts`. No direct external API calls from pages/components. Koios/Tally/SubSquare only in sync functions.

8. **No `git add -A` without review.** Targeted `git add`. Run `git diff --cached --name-only` after staging. `-A` picks up `.cursor/`, `COMMIT_MSG.txt`, `PR_BODY.md`, workspace artifacts. Always delete temp files BEFORE staging.

9. **Verify deploy — don't assume.** After merge: poll CI until green, poll Railway until deployed, hit `drepscore.io` to smoke-test. Never report completion while CI is red or deploy is pending.

10. **`.env.local` is PRODUCTION.** Any local operation hitting Supabase/Koios/external services is a production operation. Never run sync, backfills, or write-path tests from localhost without explicit user approval.

11. **Supabase MCP for migrations — never the CLI.** `npx supabase db push` has no access token locally. Use MCP `apply_migration`. Apply migrations autonomously after pushing code.

12. **Echo-back on complex tasks.** Before creating the first todo list for any 3+ step task, state which of these rules apply.

13. **TanStack Query for client fetches.** All new client-side API calls must use `useQuery`/`useMutation` from `@tanstack/react-query`. Never raw `fetch` + `useState` + `useEffect`. Provider is in `components/Providers.tsx`.

14. **`gen:types` after every migration.** After applying a Supabase migration, run `npm run gen:types` and commit the updated `types/database.ts`.

## Tech Stack

- **Framework**: Next.js 16 App Router, TypeScript strict, server components for data fetching
- **UI**: shadcn/ui + Tailwind CSS v4 + Recharts/Tremor. Dark mode via next-themes
- **Client data fetching**: TanStack Query (`@tanstack/react-query`) — provider in `components/Providers.tsx`, config in `lib/queryClient.ts`
- **Wallet**: MeshJS (Eternl, Nami, Lace, Typhon+). Wallet connection is optional — show value first
- **Data**: Koios API (mainnet) → Supabase (cache) → Next.js (reads)
- **Caching/Rate Limiting**: Upstash Redis (`lib/redis.ts` + `@upstash/ratelimit`). Use `cached()` from `lib/redis.ts` for shared server-side caching
- **Hosting**: Railway (Docker, health checks, auto-deploy from `main`)
- **CDN/DNS**: Cloudflare
- **Background Jobs**: Inngest Cloud (see `docs/architecture-jobs.md`)
- **Error Tracking**: Sentry (Next.js SDK)
- **Analytics**: PostHog (JS + Node SDKs)
- **Testing**: Vitest (unit/integration in `__tests__/`), Playwright (E2E in `e2e/`), smoke tests (`scripts/smoke-test.ts`)
- **Code Quality**: Prettier + ESLint + lint-staged (pre-commit). `npm run format:check` in CI
- **Type Safety**: Supabase types via `npm run gen:types` (run after every migration)

## Data Flow

```
Koios API (source of truth)
    ↓  sync scripts + /api/sync routes
Supabase (cache layer, persistent storage)
    ↓  lib/data.ts reads
Next.js App (server components + API routes + client components)
```

All frontend reads go through Supabase via `lib/data.ts`. Direct Koios calls only in sync scripts and `utils/koios.ts`.

## Key Files

| Purpose                              | File(s)                                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL for server-side fetches     | `lib/constants.ts` (`BASE_URL`)                                                                                                                    |
| Supabase reads (primary data source) | `lib/data.ts`                                                                                                                                      |
| Koios API helpers (used by sync)     | `utils/koios.ts`                                                                                                                                   |
| Scoring V3 (pillar computation)      | `lib/scoring/`                                                                                                                                     |
| Supabase client                      | `lib/supabase.ts`                                                                                                                                  |
| Sync logic (durable, callable)       | `lib/sync/dreps.ts`, `lib/sync/votes.ts`, `lib/sync/secondary.ts`, `lib/sync/slow.ts`                                                              |
| Sync HTTP routes (thin wrappers)     | `app/api/sync/dreps/`, `app/api/sync/votes/`, `app/api/sync/proposals/`, `app/api/sync/secondary/`, `app/api/sync/slow/`, `app/api/sync/treasury/` |
| Proposals sync (inline in Inngest)   | `inngest/functions/sync-proposals.ts`                                                                                                              |
| DRep types                           | `types/drep.ts`, `types/koios.ts`                                                                                                                  |
| Alignment scoring (PCA)              | `lib/alignment/`                                                                                                                                   |
| Matching engine (quiz + confidence)  | `lib/matching/`                                                                                                                                    |
| GHI v2 (6 components + EDI)          | `lib/ghi/`                                                                                                                                         |
| Feature flags                        | `lib/featureFlags.ts`, `components/FeatureGate.tsx`                                                                                                |

## Scoring Models

### DRep Score V3

```
DRep Score (0-100, percentile-normalized) =
  Engagement Quality (35%) +
  Effective Participation (25%) +
  Reliability (25%) +
  Governance Identity (15%)
```

Each pillar: raw score → percentile-normalized → weighted sum. Implementation: `lib/scoring/`.

### SPO Governance Score

```
SPO Score (0-100, percentile-normalized) =
  Participation (45%) + Consistency (30%) + Reliability (25%)
```

### Score Tiers (Phase A — not yet shipped)

Emerging (0-39), Bronze (40-54), Silver (55-69), Gold (70-84), Diamond (85-94), Legendary (95-100).

## Server Component Constraints

- Any `app/**/page.tsx` or `route.ts` calling `createClient()`, `getSupabaseAdmin()`, or any runtime-only service must export `dynamic = 'force-dynamic'`. Railway's Docker build has no env vars at build time.
- **NEVER use `export const revalidate`** on routes touching Supabase — causes build-time prerendering, which crashes in Railway's Docker build.
- Next.js 16 enforces strict named exports from route files. Only HTTP handlers + config fields allowed. Helper functions must live in `lib/sync/<name>.ts`.

### `dreps` Table Schema Convention

The `dreps` table uses `id` as its primary key (the full `drep1...` bech32 string). Display metadata (`name`, `ticker`, `handle`, etc.) is inside the `info` JSONB column, not top-level columns. Use `lib/data.ts` `mapRow()` to unpack.

### File Extension Rule for JSX

Any API route using JSX (e.g., `ImageResponse`) must use `.tsx`, not `.ts`.

## Workflow

### Session Start

1. Read `.cursor/tasks/lessons.md` for patterns from prior sessions
2. `git branch --show-current` + `git status` — orient to current state
3. For multi-step tasks, echo-back which critical rules apply before starting

### Build Phase

- **Branch check (step 0)**: On `main` and not a hotfix → STOP and branch first
- **Preflight after each batch**: `npm run preflight` (format:check + lint + type-check + test)
- **Format before commit**: Run `npx prettier --write <files>` + `npx tsc --noEmit` before `git add`
- **Analytics inline**: Every new user interaction gets a PostHog event in the same diff
- **No orphaned components**: Every component created must be imported and rendered in the same commit
- **After migrations**: Run `npm run gen:types` and commit updated `types/database.ts`
- **E2E tests**: For UI-touching changes, add or update Playwright tests in `e2e/`

### Ship It (MANDATORY after every feature)

After code compiles clean, execute IMMEDIATELY without asking:

1. `npm run preflight` — fix ALL failures
2. `git add` relevant files → commit
3. `git push -u origin HEAD`
4. `gh pr create` → poll CI until green → merge
5. Apply pending migrations via Supabase MCP
6. Monitor Railway deployment until healthy
7. PUT `/api/inngest` if Inngest functions changed → verify with `npm run inngest:status`
8. Hit new/changed endpoints on `drepscore.io` to verify
9. `npm run posthog:check <event>` if new analytics events
10. Clean up worktree, update lessons

### Post-Execution Review (MANDATORY after plan completion)

After completing any plan or named batch: scan for opportunities, bugs, dead code, open questions, and vision alignment. Ask user which recommendations to execute before shipping.

## Git Worktree Workflow

```
C:\Users\dalto\drepscore\
  drepscore-app/           ← main (production, merges, hotfixes)
  drepscore-<feature>/     ← one per active feature branch
```

### Starting a Feature

1. Verify plan exists in `.cursor/plans/<feature>.plan.md`, committed to `main`
2. `git worktree add ../drepscore-<name> -b feature/<name>`
3. Copy `.env.local` to new worktree, run `npm install`

### Branch Safety

- **Never switch branches** in a worktree. If on wrong branch, stop and tell user.
- **Never merge to main from a worktree** — merges only via PR.
- From worktrees, use `gh api repos/drepscore/drepscore-app/pulls/<N>/merge -X PUT -f merge_method=squash` since `gh pr merge` fails (tries to checkout main which is locked).

### Worktree Decision

- **Direct on main**: Single-commit fixes, docs, config, plan file creation
- **Worktree required**: 2+ phase plans, new features, migrations + code, 10+ file refactors

## Background Jobs (Inngest Cloud)

All scheduled work runs via Inngest durable functions:

**Data syncs**: `sync-dreps` (6h), `sync-votes` (6h), `sync-secondary` (6h), `sync-slow` (daily 04:00), `sync-proposals` (30min), `sync-freshness-guard` (30min), `sync-treasury-snapshot` (daily 22:30), `sync-governance-benchmarks` (weekly), `sync-alignment` (event-driven), `sync-drep-scores` (event-driven, chained after dreps)

**Alerts**: `alert-integrity` (6h), `alert-inbox` (6h), `alert-api-health` (15min)

**Notifications & generation**: `check-notifications` (6h), `check-accountability-polls` (daily), `generate-epoch-summary` (daily), `snapshot-ghi` (daily), `generate-governance-brief` (weekly), `generate-state-of-governance` (weekly)

## Sync Pipeline

Execution model: Core syncs export `execute*Sync()` from `lib/sync/<name>.ts`. Inngest functions call these directly inside `step.run()`. Self-healing via `sync-freshness-guard` + `alert-integrity`.

All Koios responses validated via Zod schemas (`utils/koios-schemas.ts`). Invalid records skipped, not the entire batch.

### Adding a New Sync

1. Create Inngest function in `inngest/functions/sync-<name>.ts`
2. Register in `app/api/inngest/route.ts`
3. Add sync type to `SyncType` union in `lib/sync-utils.ts`
4. Add to `sync_log` CHECK constraint via migration
5. Add threshold to health route + freshness guard
6. Add heartbeat ping, create Zod schema if needed

## Analytics Protocol

Every feature must include analytics. Client: `posthog.capture()` via `lib/posthog.ts`. Server: `captureServerEvent()` via `lib/posthog-server.ts`. Event naming: `noun_verb`.

Full instrumentation map in `.cursor/rules/analytics-reference.md`.

## Environment & Deploy

- **Supabase project**: `pbfprhbaayvcrxokgicr`
- **Production URL**: `https://drepscore.io`
- **GitHub CLI**: Always `gh auth switch --user drepscore` before `gh` API calls
- **Railway CLI**: `railway logs`, `railway status`, `railway redeploy`
- **Inngest**: PUT `https://drepscore.io/api/inngest` after every deploy. Verify with `npm run inngest:status`
- **Post-deploy autonomous sequence**: Poll Railway → verify HTTP 200 → apply migrations → PUT Inngest → verify functions → smoke test endpoints

### Key Env Vars (in Railway dashboard)

`KOIOS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `SESSION_SECRET`, `ADMIN_WALLETS`, `ANTHROPIC_API_KEY`, `POSTHOG_PERSONAL_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `NEXT_PUBLIC_SITE_URL=https://drepscore.io`

### CI/CD

- CI skips for docs-only changes. Code changes: install → lint/format/type-check/test (parallel) → build
- E2E is post-merge only (not in PR critical path)
- Railway watchPaths ensures docs-only commits don't trigger deploys

### Release Gating

- **Direct to main (hotfix)**: Single-commit bug fixes, docs, config, dependency patches
- **PR required**: Migrations, API contract changes, auth/security, scoring model, new features, 10+ files, Inngest schedule changes

## Product Strategy

See `docs/strategy/ultimate-vision.md` for the full north star.

### Design Principles

1. Citizens first — every screen answers "what does a citizen need here?"
2. Action over information — command center is action feed, not data wall
3. Scores must have consequences (tiers, celebrations, competitive pressure)
4. Custom everything — if a chart library has it, we're not using it
5. Mobile is primary, adapt for desktop
6. Show value first (no forced wallet connect)
7. Loading skeletons, <3s target page loads

### Personas (citizen-first order)

1. Citizens (ADA holders), 2. DReps, 3. SPOs, 4. Constitutional Committee, 5. Treasury Proposal Teams, 6. Governance Researchers, 7. Cross-Chain Observers

## Known Gotchas

- `notification_log` uses `sent_at` not `created_at`
- `drep_votes` PK is `vote_tx_hash` (no `id` column), epoch column is `epoch_no`
- Supabase PostgREST default row limit is 1000 — add `.range(0, 99999)` for large tables
- Cloudflare has 100s timeout — split heavy Inngest steps to <60s each
- `dreps` table: `id` is the bech32 PK, metadata is in `info` JSONB, there is no `drep_id` column
- Worktree `.git` is a file, not a directory — write temp files to worktree root
- Next.js 16: `cookies()` returns a Promise — must `await cookies()`
- `useRef` requires initial value in strict TS — use `useRef<Type>(null)`
- Production domain is `drepscore.io`, NOT `drepscore.com`
- `npm uninstall` removes from ALL dependency sections — use `--save-dev` if only in devDeps
- Static `sitemap.ts` with Supabase queries crashes Railway — needs `force-dynamic`

## Scripts Reference

| Script                  | When to use                                      |
| ----------------------- | ------------------------------------------------ |
| `gen:types`             | After every Supabase migration                   |
| `inngest:status`        | After deploy — verify function registration      |
| `posthog:check [event]` | After deploying features with new events         |
| `smoke-test`            | After deploy — HTTP health checks                |
| `test`                  | Vitest unit/integration tests                    |
| `test:e2e`              | Playwright E2E tests                             |
| `format`                | Format all files with Prettier                   |
| `format:check`          | Check formatting (CI)                            |
| `preflight`             | Parallel format:check + lint + type-check + test |
| `analyze`               | Bundle analysis (set ANALYZE=true)               |
