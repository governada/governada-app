# Civica (formerly DRepScore)

The civic hub for the Cardano Nation -- governance intelligence and civic engagement for Cardano.

## Autonomous Deployment Pipeline

Implementation is NOT complete until deployed and validated in production. Use `/ship` or execute manually:

1. `npm run preflight` -- fix all failures
2. Stage files, commit (conventional: `feat:`, `fix:`, `refactor:`, etc.)
3. `git push -u origin HEAD`
4. `gh pr create` -- poll CI until green, fix failures
5. Merge: `gh api repos/drepscore/drepscore-app/pulls/<N>/merge -X PUT -f merge_method=squash`
6. Apply migrations via Supabase MCP -> `npm run gen:types` if needed
7. Monitor Railway (`railway logs`, poll ~5 min)
8. PUT `https://drepscore.io/api/inngest` if Inngest functions changed
9. Verify endpoints on `drepscore.io`, run `npm run smoke-test`
10. Clean up worktree if applicable

## Hard Constraints

Build failures or production bugs if violated:

- **`force-dynamic`** on any `page.tsx`/`route.ts` touching Supabase/env vars. Railway build has no env vars.
- **Register Inngest functions** in `app/api/inngest/route.ts` -- same commit as the function file.
- **Database-first reads** via `lib/data.ts`. No direct Koios calls from pages/components.
- **TanStack Query** for client fetches. Never raw `fetch` + `useState` + `useEffect`.
- **`gen:types` after migrations.** Commit updated `types/database.ts`.
- **Supabase MCP for migrations**, never the CLI.
- **`.env.local` is PRODUCTION.** No sync/backfill/write ops without user approval.
- **Feature-flag risky features** via `getFeatureFlag()` / `<FeatureGate>`.

## Tech Stack

- **Framework**: Next.js 16 App Router, TypeScript strict, React 19
- **UI**: shadcn/ui + Tailwind CSS v4 + custom visualizations. Dark mode via next-themes
- **Data**: Koios API -> Supabase (cache) -> `lib/data.ts` -> components
- **Client data**: TanStack Query (provider: `components/Providers.tsx`)
- **Wallet**: MeshJS. Connection optional -- show value first
- **Hosting**: Railway (Docker, auto-deploy from `main`). CDN: Cloudflare
- **Jobs**: Inngest Cloud (22 functions). Caching: Upstash Redis
- **Monitoring**: Sentry (errors), PostHog (analytics, `noun_verb` events)
- **Testing**: Vitest + Playwright. Quality: Prettier + ESLint + lint-staged
- **AI**: Anthropic Claude (narratives, classification, rationale analysis)

## Key Files

| Purpose                   | Location                                            |
| ------------------------- | --------------------------------------------------- |
| Data reads                | `lib/data.ts`                                       |
| Supabase client           | `lib/supabase.ts`                                   |
| Koios helpers (sync only) | `utils/koios.ts`                                    |
| Scoring V3                | `lib/scoring/`                                      |
| Sync logic                | `lib/sync/`                                         |
| Alignment (PCA)           | `lib/alignment/`                                    |
| Matching engine           | `lib/matching/`                                     |
| GHI v2                    | `lib/ghi/`                                          |
| Feature flags             | `lib/featureFlags.ts`, `components/FeatureGate.tsx` |
| Base URL                  | `lib/constants.ts` (`BASE_URL`)                     |

## Worktrees

```
C:\Users\dalto\drepscore\
  drepscore-app/           <- main (production)
  drepscore-<feature>/     <- feature worktrees
```

- Hotfixes: direct on main. Features: `git worktree add ../drepscore-<name> -b feature/<name>`
- `gh auth switch --user drepscore` before gh commands
- From worktrees: `gh api .../merge` (not `gh pr merge`)

## Environment

- **Production**: `https://drepscore.io` (NOT .com)
- **Supabase**: project `pbfprhbaayvcrxokgicr`
- **CI**: lint/format/type-check/test (parallel) -> build. E2E post-merge only
- **Release gating**: Hotfixes direct to main. Features/migrations/API changes via PR

## Scripts

| Script           | Purpose                                 |
| ---------------- | --------------------------------------- |
| `preflight`      | format:check + lint + type-check + test |
| `gen:types`      | Supabase types after migrations         |
| `inngest:status` | Verify function registration            |
| `posthog:check`  | Verify analytics events                 |
| `smoke-test`     | Production health checks                |

## Path-Scoped Rules

Detailed context loads automatically from `.claude/rules/` when working on:

- `scoring.md` -- scoring models, tiers, GHI, alignment
- `sync-pipeline.md` -- Inngest, Koios, sync patterns
- `api-routes.md` -- force-dynamic, route constraints
- `analytics.md` -- PostHog event conventions
- `supabase.md` -- schema gotchas, migrations, RLS
