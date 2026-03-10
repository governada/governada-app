# Governada

Governance intelligence for the Cardano Nation.

## Autonomous Deployment Pipeline

Implementation is NOT complete until deployed and validated in production. Use `/ship` or execute manually:

1. `npm run preflight` -- fix all failures
2. Stage files, commit (conventional: `feat:`, `fix:`, `refactor:`, etc.)
3. `git push -u origin HEAD`
4. `gh pr create` -- poll CI until green, fix failures
5. **Pre-merge check**: `bash scripts/pre-merge-check.sh <PR#>` -- blocks if CI is running on main or branch is behind
6. Merge: `gh api repos/governada/governada-app/pulls/<N>/merge -X PUT -f merge_method=squash`
7. Apply migrations via Supabase MCP -> `npm run gen:types` if needed
8. Monitor Railway (`railway logs`, poll ~5 min)
9. PUT `https://governada.io/api/inngest` if Inngest functions changed
10. Verify endpoints on `governada.io`, run `npm run smoke-test`
11. Clean up worktree if applicable

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
| Product strategy & vision | `docs/strategy/ultimate-vision.md`                  |
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
C:\Users\dalto\governada\
  governada-app/           <- main (production)
  governada-<feature>/     <- feature worktrees
```

- Hotfixes: direct on main. Features: `git worktree add ../governada-<name> -b feature/<name>`
- `gh auth switch --user drepscore` before gh commands
- From worktrees: `gh api .../merge` (not `gh pr merge`)
- **Parallel agent safety**: Multiple agents may be working simultaneously. Before merging:
  1. Run `bash scripts/pre-merge-check.sh <PR#>` -- hard requirement
  2. If another PR merged recently, rebase first: `git fetch origin && git rebase origin/main`
  3. Never merge while CI is running on main -- wait for it to finish

## Environment

- **Production**: `https://governada.io` (NOT .com)
- **Supabase**: project `pbfprhbaayvcrxokgicr`
- **CI**: lint/format/type-check/test (parallel) -> build. E2E post-merge only
- **Release gating**: Hotfixes direct to main. Features/migrations/API changes via PR

## Scripts

| Script               | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `preflight`          | format:check + lint + type-check + test              |
| `gen:types`          | Supabase types after migrations                      |
| `inngest:status`     | Verify function registration                         |
| `posthog:check`      | Verify analytics events                              |
| `smoke-test`         | Production health checks                             |
| `pre-merge-check.sh` | Block merge if CI running or branch behind           |
| `cleanup.sh`         | Worktree/dir cleanup (dry-run or --clean)            |
| `notify.sh`          | Alert founder via Discord/Telegram at decision gates |

## Context Files (Agent-Optimized)

| Need                                      | File                                               | Lines |
| ----------------------------------------- | -------------------------------------------------- | ----- |
| Build status / audit checklist            | `docs/strategy/context/build-manifest.md`          | ~250  |
| Navigation architecture spec              | `docs/strategy/context/navigation-architecture.md` | ~530  |
| UX constraints (per-page JTBD)            | `docs/strategy/context/ux-constraints.md`          | ~220  |
| Persona quick reference                   | `docs/strategy/context/persona-quick-ref.md`       | ~80   |
| Audit scoring rubric & benchmarks         | `docs/strategy/context/audit-rubric.md`            | ~180  |
| Work plan template (parallel agents)      | `docs/strategy/context/work-plan-template.md`      | ~80   |
| Competitive landscape (updated by audits) | `docs/strategy/context/competitive-landscape.md`   | ~150  |
| Full vision (strategic audits only)       | `docs/strategy/ultimate-vision.md`                 | ~730  |

## Audit Commands

| Command                                          | Purpose                                                                                                        | Cadence                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `/audit [full\|step:N\|area]`                    | Product audit against vision (10 dimensions)                                                                   | Quarterly full, monthly focused                |
| `/verify-audit`                                  | Confirm previous audit gaps were closed                                                                        | After each build cycle                         |
| `/audit-experience [persona-state]`              | End-to-end experience audit for one persona (UX + journeys + intelligence + craft)                             | Monthly per persona, quarterly rotation        |
| `/audit-engine [full\|scoring\|data\|sync]`      | Backend engine: scoring models, data integrity, sync pipeline, calibration                                     | Monthly focused, quarterly full                |
| `/audit-security [area]`                         | Auth, RLS, API security, data protection, infra hardening, anti-gaming                                         | Pre-launch full, quarterly, after auth changes |
| `/audit-all [full\|experiences\|systems\|quick]` | Orchestrator: launches experience + engine + security audits as parallel subagents, synthesizes unified report | Quarterly full, monthly quick                  |

## Build Commands

| Command                                                        | Purpose                                                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/build-step N` (or `/build-phase N`)                          | End-to-end phase builder: vision research → architecture → decision gate → parallel execution → autonomous deploy → post-build audit |
| `/fix-audit [last\|area\|all]`                                 | Takes audit findings, plans fixes, executes in parallel, deploys, re-audits to verify scores improved                                |
| `/launch-readiness [full\|technical\|business\|blocker-check]` | Pre-launch go/no-go: security blockers, journey regression, performance, brand, legal, monetization, community, SEO                  |
| `/ship`                                                        | Full deploy pipeline for a single PR (preflight → CI → merge → deploy → verify)                                                      |
| `/hotfix`                                                      | Single-commit fix directly on main                                                                                                   |

## Path-Scoped Rules

Detailed context loads automatically from `.claude/rules/` when working on:

- `product-strategy.md` -- principles, build sequence, context efficiency
- `product-vision.md` -- UX execution standards, persona experiences
- `hygiene.md` -- branch, commit, workspace cleanup rules
- `scoring.md` -- scoring models, tiers, GHI, alignment
- `sync-pipeline.md` -- Inngest, Koios, sync patterns
- `api-routes.md` -- force-dynamic, route constraints
- `analytics.md` -- PostHog event conventions
- `supabase.md` -- schema gotchas, migrations, RLS
