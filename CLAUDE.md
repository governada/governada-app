# Governada

Governance intelligence for the Cardano Nation.

## Autonomous Deployment Pipeline

Implementation is NOT complete until deployed and validated in production. Use `/ship` or execute manually:

1. `npm run preflight` -- fix all failures
2. Stage files, commit (conventional: `feat:`, `fix:`, `refactor:`, etc.)
3. `git push -u origin HEAD`
4. `gh pr create` -- use `gh pr checks <N> --watch` to wait for CI, fix failures
5. **Pre-merge check**: `bash scripts/pre-merge-check.sh <PR#>` -- blocks if CI running, branch behind, or Sentry error rate elevated
6. Merge: `gh api repos/governada/governada-app/pulls/<N>/merge -X PUT -f merge_method=squash`
7. Apply migrations via Supabase MCP (test on branch first per `.claude/rules/migration-safety.md`) -> `npm run gen:types` if needed
8. **Verify production**: wait ~3 min, then `bash scripts/check-deploy-health.sh` (includes response time assertions). Use `deploy-verifier` subagent in background if preferred.
9. PUT `https://governada.io/api/inngest` if Inngest functions changed (registers with self-hosted Inngest at `inngest-server.railway.internal:8288`)
10. `npm run smoke-test`, verify changed endpoints on `governada.io`
11. `bash scripts/uptime-check.sh deploy` -- ping BetterStack heartbeat
12. **Visual verification** (REQUIRED for UI changes): Open production in Claude Chrome, screenshot changed routes at desktop + mobile, verify against build spec. See `.claude/rules/post-deploy-verification.md` for full protocol.
13. Clean up worktree if applicable
14. **If deploy fails**: `bash scripts/rollback.sh` -- auto-reverts, verifies, creates GitHub issue

## Hard Constraints

Build failures or production bugs if violated:

- **Worktree isolation for feature work.** NEVER create feature branches in the main `governada-app` checkout. All feature work MUST happen in a worktree (`git worktree add ../governada-<name> -b feat/<name> origin/main` or `claude --worktree <name>`). The main checkout stays on `main` at all times. Enforced by `check-branch.sh` hook — edits on feature branches in the main checkout are blocked. Only hotfixes (with `ALLOW_MAIN_EDIT=1`) bypass this.

- **`force-dynamic`** on any `page.tsx`/`route.ts` touching Supabase/env vars. Railway build has no env vars.
- **Register Inngest functions** in `app/api/inngest/route.ts` -- same commit as the function file.
- **Database-first reads** via `lib/data.ts`. No direct Koios calls from pages/components.
- **TanStack Query** for client fetches. Never raw `fetch` + `useState` + `useEffect`.
- **`gen:types` after migrations.** Commit updated `types/database.ts`.
- **Supabase MCP for migrations**, never the CLI.
- **`.env.local` is PRODUCTION.** No sync/backfill/write ops without user approval.
- **Feature-flag risky features** via `getFeatureFlag()` / `<FeatureGate>`.
- **Feature flags for proposal workspace.** All proposal features gated behind `proposal_workspace` and sub-flags (`review_inline_annotations`, `review_treasury_impact`, etc.). See `lib/featureFlags.ts`.
- **Log deferred work.** When intentionally deferring work to post-launch (validation studies, data-dependent features, follow-up improvements), add it to `docs/strategy/context/post-launch-followups.md` with: source, priority, why deferred, what's needed, and success criteria. This is the single source of truth for unfinished work.

## Development Philosophy: Robust & Correct

The default posture is "understand deeply, then act minimally" — not "act quickly, fix later."

- **The burden of proof is on change.** Before modifying or creating code, prove why the change is necessary and why the existing approach is insufficient. "It could be better" is not sufficient justification.
- **Existing code is the starting point.** Before writing any new function, component, or utility, search for existing implementations that can be extended. Creating a new implementation when a suitable one exists is a defect. See `.claude/rules/build-on-existing.md`.
- **Root causes, not symptoms.** When fixing bugs, trace the full cause chain before writing a fix. A patch that addresses a symptom will create a new bug. If you can't explain WHY the bug exists, you haven't found the root cause yet. Use `/diagnose` for non-trivial bugs. **Infrastructure fixes > process fixes**: if your fix requires agents to "remember to do something," it's fragile. If it changes the system so the problem can't occur regardless of behavior, it's durable.
- **Done means done.** Work is not complete until: edge cases are handled, error/loading/empty states are designed, mobile is verified, the feature is gated if risky, and the implementation has been tested against the actual user journey — not just the happy path. Use `/harden` to verify robustness.
- **Less is more.** Shipping 3 robust features beats shipping 7 fragile ones. Push back on scope if quality would suffer. Recommend deferring work rather than shipping half-baked implementations.
- **Pushback is valuable.** If a plan feels underspecified, say so. If the scope feels too large for one session, say so. If the approach feels like it's optimizing for speed over correctness, say so. The founder prefers honest friction over compliant speed.
- **Improve, don't replace.** Unless explicitly using `/explore-feature` or the user requests net-new work, the default for every skill and command is to strengthen, extend, and improve what exists — not to build from scratch.

## Autonomous Operation

Agents have **full autonomous permission** to execute without asking. The `settings.json` allow list is the source of truth — if a tool is allowed, use it. Do NOT ask "should I update this file?" or "can I proceed?" before routine operations.

**Never ask permission for:**

- Editing or creating any file (code, docs, skills, rules, CLAUDE.md, configs)
- Running builds, tests, linters, or any npm script
- Git operations (commit, push, rebase, branch)
- Creating PRs, running CI checks, merging (per deploy pipeline)
- Reading files, searching code, exploring the codebase
- Running deploy scripts and verification

**DO ask / pause for:**

- Destructive operations on production data (Supabase writes, `.env.local` is production)
- Architectural decisions with multiple valid approaches (use plan mode)
- Scope expansion beyond what was requested
- Anything on the denylist in `settings.json`

"Pushback is valuable" means push back on **bad ideas and scope creep** — it does NOT mean ask permission before every edit. Act, don't ask.

## Tech Stack

- **Framework**: Next.js 16 App Router, TypeScript strict, React 19
- **UI**: shadcn/ui + Tailwind CSS v4 + Compass Design Language. Dark-only (forced). Three density modes via ModeProvider
- **Data**: Koios API -> Supabase (cache) -> `lib/data.ts` -> components
- **Client data**: TanStack Query (provider: `components/Providers.tsx`)
- **Wallet**: MeshJS. Connection optional -- show value first
- **Hosting**: Railway (Docker, auto-deploy from `main`). CDN: Cloudflare
- **Jobs**: Inngest self-hosted on Railway (22+ functions, `inngest-server` service). Caching: Upstash Redis
- **Monitoring**: Sentry (errors), PostHog (analytics, `noun_verb` events)
- **Testing**: Vitest + Playwright. Quality: Prettier + ESLint + lint-staged
- **AI**: Anthropic Claude (narratives, classification, rationale analysis)

## Key Files

| Purpose                   | Location                                                  |
| ------------------------- | --------------------------------------------------------- |
| Product strategy & vision | `docs/strategy/ultimate-vision.md`                        |
| Data reads                | `lib/data.ts`                                             |
| Supabase client           | `lib/supabase.ts`                                         |
| Koios helpers (sync only) | `utils/koios.ts`                                          |
| Scoring V3                | `lib/scoring/`                                            |
| Sync logic                | `lib/sync/`                                               |
| Alignment (PCA)           | `lib/alignment/`                                          |
| Matching engine           | `lib/matching/`                                           |
| GHI v2                    | `lib/ghi/`                                                |
| Feature flags             | `lib/featureFlags.ts`, `components/FeatureGate.tsx`       |
| Design language spec      | `docs/strategy/design-language.md`                        |
| Design tokens (CSS)       | `app/globals.css` (Compass palette, mode spacing)         |
| Density modes             | `components/providers/ModeProvider.tsx`                   |
| Governance Rings          | `components/ui/GovernanceRings.tsx`                       |
| Base URL                  | `lib/constants.ts` (`BASE_URL`)                           |
| Proposal authoring        | `components/workspace/author/`, `lib/workspace/`          |
| Proposal review           | `components/workspace/review/`, `hooks/useReviewQueue.ts` |
| AI skills engine          | `lib/ai/skills/`, `app/api/ai/skill/route.ts`             |
| Team collaboration        | `app/api/workspace/teams/`, `hooks/useTeam.ts`            |

## Worktrees

```
C:\Users\dalto\governada\
  governada-app/           <- main (production)
  governada-<feature>/     <- feature worktrees
```

- Hotfixes: direct on main. Features: `git worktree add ../governada-<name> -b feature/<name> origin/main`
- `gh auth switch --user drepscore` before gh commands
- From worktrees: `gh api .../merge` (not `gh pr merge`)
- **Parallel agent safety**: Multiple agents may be working simultaneously. Before merging:
  1. Run `bash scripts/pre-merge-check.sh <PR#>` -- hard requirement
  2. If another PR merged recently, rebase first: `git fetch origin && git rebase origin/main`
  3. Never merge while CI is running on main -- wait for it to finish

### Worktree Lifecycle Rules

**Session start**: `sync-worktree.sh` auto-runs and HARD BLOCKS if behind origin/main with a dirty tree. Fix: stash+rebase or commit+rebase before any work (including planning). Reading stale files produces plans that reference deleted/renamed code.

**During work**: Commit every 2-3 logical steps (even as `wip:`). A clean tree lets the hook auto-rebase when other PRs land.

**Before ending**: Commit or stash all changes. Leftover dirty state from one session blocks the NEXT session's auto-sync.

**Before pushing**: `check-behind-main.sh` blocks `git push` if behind origin/main. Fix: `git rebase origin/main`.

**CI trigger**: CI runs on `pull_request` to main, not on `git push` alone. Create the PR first.

## Environment

- **Production**: `https://governada.io` (NOT .com)
- **Supabase**: project `pbfprhbaayvcrxokgicr`
- **CI**: lint/format/type-check/test (parallel) -> build. E2E post-merge only
- **Release gating**: Hotfixes direct to main. Features/migrations/API changes via PR

## Scripts

| Script                       | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `preflight`                  | format:check + lint + type-check + test                     |
| `gen:types`                  | Supabase types after migrations                             |
| `inngest:status`             | Verify function registration                                |
| `posthog:check`              | Verify analytics events                                     |
| `smoke-test`                 | Production health checks + response time assertions         |
| `pre-merge-check.sh`         | Block merge if CI running, branch behind, or errors spiking |
| `cleanup.sh`                 | Worktree/dir cleanup (dry-run or --clean)                   |
| `generate-registry-index.sh` | Product registry staleness detection (--check for CI)       |
| `notify.sh`                  | Alert founder via Discord/Telegram at decision gates        |
| `rollback.sh`                | Automated Railway rollback with health verification         |
| `check-deploy-health.sh`     | Post-deploy health + response time validation               |
| `check-error-rate.sh`        | Sentry error rate gate (blocks merge if elevated)           |
| `uptime-check.sh`            | Ping BetterStack heartbeat URLs                             |
| `test-migration.sh`          | Supabase branch database migration testing guide            |

## Context Files (Agent-Optimized)

| Need                                      | File                                               | Lines |
| ----------------------------------------- | -------------------------------------------------- | ----- |
| Strategic state (CTO memory)              | `docs/strategy/context/strategic-state.md`         | ~80   |
| Feature registry (what exists & where)    | `docs/strategy/context/product-registry.md`        | ~200  |
| Feature domain detail (8 domains)         | `docs/strategy/context/registry/<domain>.md`       | ~100  |
| Build status / audit checklist            | `docs/strategy/context/build-manifest.md`          | ~250  |
| Navigation architecture spec              | `docs/strategy/context/navigation-architecture.md` | ~530  |
| UX constraints (per-page JTBD)            | `docs/strategy/context/ux-constraints.md`          | ~220  |
| Persona quick reference                   | `docs/strategy/context/persona-quick-ref.md`       | ~80   |
| Audit scoring rubric & benchmarks         | `docs/strategy/context/audit-rubric.md`            | ~180  |
| Work plan template (parallel agents)      | `docs/strategy/context/work-plan-template.md`      | ~80   |
| Competitive landscape (updated by audits) | `docs/strategy/context/competitive-landscape.md`   | ~150  |
| World-class patterns library              | `docs/strategy/context/world-class-patterns.md`    | ~100  |
| Post-launch follow-ups (deferred work)    | `docs/strategy/context/post-launch-followups.md`   | ~50   |
| Design language (Compass spec)            | `docs/strategy/design-language.md`                 | ~590  |
| Civic Identity Rings plan                 | `docs/strategy/plans/civic-identity-rings.md`      | ~280  |
| Full vision (strategic audits only)       | `docs/strategy/ultimate-vision.md`                 | ~730  |

## Audit Commands

| Command                                          | Purpose                                                                                                                     | Cadence                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `/audit [full\|step:N\|area]`                    | Product audit against vision (10 dimensions)                                                                                | Quarterly full, monthly focused                |
| `/verify-audit`                                  | Confirm previous audit gaps were closed                                                                                     | After each build cycle                         |
| `/audit-experience [persona-state]`              | End-to-end experience audit for one persona (UX + journeys + intelligence + craft)                                          | Monthly per persona, quarterly rotation        |
| `/audit-engine [full\|scoring\|data\|sync]`      | Backend engine: scoring models, data integrity, sync pipeline, calibration                                                  | Monthly focused, quarterly full                |
| `/audit-security [area]`                         | Auth, RLS, API security, data protection, infra hardening, anti-gaming                                                      | Pre-launch full, quarterly, after auth changes |
| `/audit-feature [feature]`                       | Deep-dive feature audit — necessity test, world-class benchmark, subtraction recs, data opportunities, ambitious redesigns  | Before/after page builds, monthly rotation     |
| `/explore-feature [feature]`                     | Generative exploration — 3 alternative concepts, data opportunity scan, inspiration research. Use when audit scores plateau | When scores plateau, before major redesigns    |
| `/audit-all [full\|experiences\|systems\|quick]` | Orchestrator: launches experience + engine + security audits as parallel subagents, synthesizes unified report              | Quarterly full, monthly quick                  |

## Strategy Commands

| Command                       | Purpose                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `/strategy`                   | Open strategic session: state of the world, what to think about, CTO/Head of Product mode |
| `/strategy review`            | Strategic review: velocity, direction, moat, priorities, what to start/stop               |
| `/strategy plan [topic]`      | Deep dive: options, trade-offs, recommendation for a specific strategic question          |
| `/strategy compete`           | Competitive intelligence: landscape changes, positioning, offensive/defensive moves       |
| `/strategy decide [question]` | Structured decision framework with options matrix and recommendation                      |
| `/strategy retro`             | Post-build strategic retro: did we build the right thing?                                 |
| `/strategy hygiene`           | Workspace health: stale branches, outdated docs, accumulated debt                         |

## Build Commands

| Command                                                        | Purpose                                                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/build-step N` (or `/build-phase N`)                          | End-to-end phase builder: vision research → architecture → decision gate → parallel execution → autonomous deploy → post-build audit |
| `/fix-audit [last\|area\|all]`                                 | Takes audit findings, plans fixes, executes in parallel, deploys, re-audits to verify scores improved                                |
| `/launch-readiness [full\|technical\|business\|blocker-check]` | Pre-launch go/no-go: security blockers, journey regression, performance, brand, legal, monetization, community, SEO                  |
| `/ship`                                                        | Full deploy pipeline for a single PR (preflight → CI → merge → deploy → verify)                                                      |
| `/hotfix`                                                      | Single-commit fix directly on main                                                                                                   |
| `/adversarial-review [scope]`                                  | Hostile post-build review: parallel code + UX adversaries via Preview, blocks ship on critical findings                              |

## Compaction Instructions

When compacting, preserve: the current task/goal, approved plan details, architectural decisions made this session, and any user feedback/corrections. The post-compact hook recovers git state and checkpoints automatically -- do not duplicate that. Focus on retaining the "why" behind decisions and any user preferences expressed during the session.

## Path-Scoped Rules

Detailed context loads automatically from `.claude/rules/` when working on:

- `strategy-session.md` -- CTO/Head of Product thinking discipline for `/strategy` sessions
- `product-strategy.md` -- principles, build sequence, context efficiency
- `product-vision.md` -- UX execution standards, persona experiences
- `hygiene.md` -- branch, commit, workspace cleanup rules
- `scoring.md` -- scoring models, tiers, GHI, alignment
- `sync-pipeline.md` -- Inngest, Koios, sync patterns
- `api-routes.md` -- force-dynamic, route constraints
- `analytics.md` -- PostHog event conventions
- `supabase.md` -- schema gotchas, migrations, RLS
