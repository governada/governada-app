# Governada

Governance intelligence for the Cardano Nation.

## Autonomous Deployment Pipeline

Implementation is NOT complete until deployed and validated in production. Use `/ship` for the full pipeline (authoritative). Manual steps: preflight -> commit -> push -> PR -> CI (background) -> pre-merge-check -> merge -> deploy-verifier (background) -> smoke-test -> visual verification (UI changes). If Inngest functions changed: `npm run inngest:register`. If deploy fails: `npm run rollback`.

## Hard Constraints

Build failures or production bugs if violated:

- **Worktree isolation for feature work.** NEVER create feature branches in the main `governada-app` checkout. All feature work MUST happen in a worktree (`powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>` or `git worktree add .claude/worktrees/<name> -b feat/<name> origin/main`). The main checkout stays on `main` at all times. Enforced by `check-branch.ps1` hook — edits on feature branches in the main checkout are blocked. Only hotfixes (with `ALLOW_MAIN_EDIT=1`) bypass this.

- Sandbox-safe default: `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>` creates `.claude/worktrees/<name>` inside the repo instead of a sibling directory.

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

- **The burden of proof is on change.** Prove why the change is necessary. "It could be better" is not sufficient.
- **Existing code is the starting point.** Search before creating. See `.claude/rules/build-on-existing.md`.
- **Elegant beats expedient.** Prefer the cleanest durable solution that fits the scope. Do not default to shortcut fixes or intentionally minimal patches when a more coherent design is clear. Optimize for maintainability, performance, scalability, and reduced rework.
- **Root causes, not symptoms.** Trace the full cause chain. Use `/diagnose` for non-trivial bugs. Infrastructure fixes > process fixes.
- **Done means done.** Edge cases handled, error/loading/empty states designed, mobile verified, feature gated if risky, tested against real user journeys.
- **Less is more.** 3 robust features beats 7 fragile ones. Defer rather than ship half-baked.
- **Always explain impact.** In updates, reviews, and PRs, state what changed, why it matters, what behavior or system boundaries it affects, and any real tradeoffs or risks.
- **Pushback is valuable.** Honest friction over compliant speed.
- **Improve, don't replace.** Extend what exists; build from scratch only when explicitly requested.

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

## Codex Desktop Sandbox

Keep Codex Desktop in `workspace-write`. The target is smooth autonomous shipping with narrow persistent approvals, not unrestricted machine access.

- Best writable root: the shared repo root that also contains `.claude/worktrees/`, so worktree metadata stays inside the writable area.
- Open Codex on the shared repo root only. Do **not** open separate Codex projects rooted at `.claude/worktrees/<name>` or other external worktree directories for this repo.
- Prefer the repo's `npm run ...` entrypoints for diagnostics, GitHub auth, CI watching, failed-log tails, deploy verification, and Inngest registration. For mutating Git/worktree setup on Windows Codex Desktop, prefer direct approved entrypoints such as `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>`, `git fetch origin main`, and `git worktree add`.
- Recommended persistent approvals: `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1`, `npm run worktree:new`, `npm run worktree:sync`, `npm run session:doctor`, `npm run gh:auth-status`, `npm run auth:repair`, `npm run ci:watch`, `npm run ci:failed`, `npm run pre-merge-check`, `npm run deploy:verify`, `npm run inngest:register`, `git add`, `git add -A`, `git commit -m`, `git push`, `git fetch origin main`, `git worktree add`, and `gh api repos/governada/governada-app/pulls`.
- Do **not** persist approvals for broad shells or interpreters like bare `powershell`, `cmd`, `node`, `python`, `git`, or `gh`.
- On Windows Codex Desktop, if a mutating Git/worktree command or an `npm` wrapper that shells out to Git fails in `workspace-write` with `EPERM`, access denied, or a likely sandbox error, rerun it immediately with `sandbox_permissions=require_escalated` using an already-approved prefix. Do not stop to ask first unless the prefix itself is missing.
- Desktop GH context should go through `npm run gh:auth-status` and the helpers in `scripts/lib/runtime.js`; do not rely on `gh` inferring the repo from a remote alias or unrelated global state.
- This repo may use its own `GH_CONFIG_DIR` profile. `npm run gh:auth-status` and `npm run auth:repair` should repair only the repo-scoped profile selected by repo scripts, not unrelated repos or other local projects.

## Credential And Tool Discovery

Agents must treat repo-scoped bootstrap files as the first source of truth for credentials, MCP servers, and CLI context.

- Search order: current checkout -> shared checkout fallback -> repo-scoped user paths named by repo files -> global/home-directory defaults.
- In `.claude/worktrees/<name>`, ignored local files may be missing even though the shared checkout is configured. If `.mcp.json` or `.claude/settings.local.json` is absent in the worktree, check the shared checkout before concluding that auth or MCP is unavailable.
- Authoritative repo bootstrap files: `.mcp.json`, `.claude/settings.local.json`, `.env.local`, `package.json`, `scripts/lib/runtime.js`, `scripts/set_gh_context.ps1`, `scripts/set-gh-context.js`, `scripts/gh-auth-status.ps1`, and `scripts/repair-gh-auth.ps1`.
- Treat repo-scoped user paths referenced by those files as part of the same bootstrap chain. That includes `GH_CONFIG_DIR` and any wrapper commands referenced by `.mcp.json`.
- Default recovery path: `npm run session:doctor` -> `npm run gh:auth-status` -> inspect `.mcp.json` and the referenced wrapper commands -> `npm run auth:repair` if GitHub auth is still broken. Only then fall back to generic `gh` or global MCP troubleshooting.

## Tech Stack

- **Framework**: Next.js 16 App Router, TypeScript strict, React 19
- **UI**: shadcn/ui + Tailwind CSS v4 + Compass Design Language. Dark-only (forced). Three density modes via ModeProvider
- **Data**: Koios API -> Supabase (cache) -> `lib/data.ts` -> components
- **Client data**: TanStack Query (provider: `components/Providers.tsx`)
- **Wallet**: MeshJS. Connection optional -- show value first
- **Hosting**: Railway (Docker, auto-deploy from `main`). CDN: Cloudflare
- **Jobs**: Inngest self-hosted on Railway (57+ functions, `inngest-server` service). Caching: Upstash Redis
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
<shared-repo-root>/
  .claude/worktrees/<feature>/  <- feature worktrees
```

- Hotfixes: direct on main. Features: `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>` (`npm run worktree:new -- <name>` is optional outside Windows Codex Desktop)
- Raw git equivalent: `git worktree add .claude/worktrees/<name> -b feature/<name> origin/main`
- Repo scripts should scope `gh` to the repo-specific context for the current checkout. Do not depend on unrelated global `gh` state.
- Windows-native hooks and ship commands are PowerShell-first. Use `scripts/set_gh_context.ps1` for desktop-agent auth context.
- From worktrees: `gh api .../merge` (not `gh pr merge`)
- **Parallel agent safety**: Multiple agents may be working simultaneously. Before merging:
  1. Run `npm run pre-merge-check -- <PR#>` -- hard requirement
  2. If another PR merged recently, rebase first: `git fetch origin && git rebase origin/main`
  3. Never merge while CI is running on main -- wait for it to finish

### Worktree Lifecycle Rules

**Session start**: `sync-worktree.ps1` auto-runs and HARD BLOCKS if behind origin/main with a dirty tree. Fix: stash+rebase or commit+rebase before any work (including planning). Reading stale files produces plans that reference deleted/renamed code.

**During work**: Commit every 2-3 logical steps (even as `wip:`). A clean tree lets the hook auto-rebase when other PRs land.

**Before ending**: Commit or stash all changes. Leftover dirty state from one session blocks the NEXT session's auto-sync.

**Before pushing**: `check-behind-main.ps1` blocks `git push` if behind origin/main. Fix: `git rebase origin/main`.

**CI trigger**: CI runs on `pull_request` to main, not on `git push` alone. Create the PR first.

## Environment

- **Production**: `https://governada.io` (NOT .com)
- **Supabase**: project `pbfprhbaayvcrxokgicr`
- **CI**: lint/format/type-check/test (parallel) -> build. E2E post-merge only
- **Release gating**: Hotfixes direct to main. Features/migrations/API changes via PR

## Scripts

| Script                      | Purpose                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| `preflight`                 | format:check + lint + type-check + test                                  |
| `gen:types`                 | Supabase types after migrations                                          |
| `inngest:status`            | Verify function registration                                             |
| `posthog:check`             | Verify analytics events                                                  |
| `smoke-test`                | Unified production verification (health, response times, data integrity) |
| `pre-merge-check`           | Block merge if CI running, branch behind, or errors spiking              |
| `cleanup` / `cleanup:clean` | Worktree/dir cleanup (dry-run or cleanup modes)                          |
| `registry:index`            | Product registry structural index generation                             |
| `registry:index:check`      | Product registry staleness detection for CI/preflight                    |
| `docs:doctor`               | Check documentation drift, stale manifest, and count mismatches          |
| `notify`                    | Alert founder via Discord/Telegram at decision gates                     |
| `rollback`                  | Automated Railway rollback with health verification                      |
| `check:error-rate`          | Sentry error rate gate (blocks merge if elevated)                        |
| `uptime-check`              | Ping BetterStack heartbeat URLs                                          |
| `migration:test`            | Supabase branch database migration testing guide                         |
| `inngest:register`          | Re-register Inngest functions after deploy or server restart             |
| `deploy:verify`             | Wait, smoke-test, heartbeat ping, optional Inngest registration          |

Legacy `scripts/*.sh` files are compatibility shims. Canonical desktop-agent automation should use the PowerShell hooks and `npm run ...` entrypoints above.

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

When compacting, preserve: the current task/goal, approved plan details, architectural decisions made this session, and any user feedback/corrections. Drop: full file contents already committed, CI output already acted on, tool call results already summarized. The post-compact hook recovers git state and checkpoints automatically -- do not duplicate that. Focus on retaining the "why" behind decisions and any user preferences expressed during the session.

## Path-Scoped Rules

Detailed context loads automatically from `.claude/rules/` when working on:

- `product-strategy.md` -- principles, build sequence, context efficiency, strategy session discipline
- `product-vision.md` -- UX execution standards, persona experiences
- `hygiene.md` -- branch, commit, workspace cleanup rules
- `scoring.md` -- scoring models, tiers, GHI, alignment
- `sync-pipeline.md` -- Inngest, Koios, sync patterns
- `api-routes.md` -- force-dynamic, route constraints
- `analytics.md` -- PostHog event conventions
- `supabase.md` -- schema gotchas, migrations, RLS
