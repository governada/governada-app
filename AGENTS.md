# Agent Guide

Provider-agnostic instructions for autonomous agents working in this repo. Treat this file as the portable workflow brief. Provider-specific adapters live under `.claude/`.

## Core Rules

- Feature work happens in a fresh worktree. The shared `governada-app` checkout stays on `main`. Hotfixes are the only exception. Read-only inspection on `main` is fine; the first mutating step must happen only after the agent has created a worktree.
- Search before creating. Extend existing components, hooks, routes, and utilities unless extension is genuinely infeasible.
- Prefer elegant, durable solutions over expedient shortcuts. Do not default to intentionally minimal stopgaps when a cleaner fix is clear and practical within scope. Optimize for long-term maintainability, performance, scalability, and reduced rework.
- Non-trivial bugs require root-cause analysis before fixing. Do not patch symptoms first.
- `.env.local` points at production services. Never perform write-heavy syncs, backfills, or destructive data operations without explicit approval.
- Risky user-facing work should be feature-flagged.

## Hard Constraints

- Route rendering follows `scripts/lib/routeRenderPolicy.mjs`. `app-dynamic` and `public-dynamic-exception` layouts/pages/routes that touch cached governance data, request headers/cookies, Supabase, Redis, or `process.env` must export `const dynamic = 'force-dynamic'`. `public-cache` routes may read DB-first cached governance data via `lib/data.ts` without `force-dynamic`, but may not read request-scoped APIs, direct Supabase/Redis clients, or raw `process.env` in the route file.
- Any new file in `inngest/functions/` must be imported and registered in `app/api/inngest/route.ts`.
- Client-side data fetching uses TanStack Query, not raw `fetch` with ad-hoc `useEffect` state.
- Pages and components read cached governance data via `lib/data.ts`, not direct Koios calls.
- Migrations go through Supabase MCP. After a migration, regenerate and commit `types/database.ts`.

These constraints are enforced by `npm run agent:validate`. Run it before shipping. CI also runs it.

## Workflow

1. If the task is feature work, create a fresh worktree first with `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>`. Do not start feature work in the shared checkout. `npm run worktree:new -- <name>` is a convenience wrapper, but on Windows Codex Desktop the direct PowerShell entrypoint is more reliable because it matches persistent approval prefixes cleanly.
2. Start from fresh `origin/main`. When resuming an existing worktree or when session diagnostics show drift/setup gaps, run `npm run worktree:sync`.
3. Read only the minimal context needed. Use the strategy registry and manifest before diving into the full vision docs.
4. Make the most elegant change that cleanly solves the actual problem within scope. Do not choose a shortcut or merely minimal patch when a more coherent fix is clear and practical.
5. Run `npm run agent:validate` and the relevant local verification for the scope.
6. Communicate impact explicitly in updates, handoffs, and reviews: what changed, why it matters, which surfaces or constraints it affects, and any real tradeoffs or risks.
7. For feature work, open a PR with `Summary`, `Existing Code Audit`, `Robustness`, and `Impact` sections.
8. Before merging, run `npm run pre-merge-check -- <PR#>`.
9. After merge, verify deploy health and smoke tests with `npm run deploy:verify`.

## Autonomy Boundary

Routine reads, edits, local verification, git hygiene, and PR preparation should not require approval. Pause for:

- Destructive production-data operations
- Scope expansion beyond the request
- Architectural forks with materially different tradeoffs
- Secrets, credential rotation, or external account changes

## Codex Desktop Sandbox

Keep Codex Desktop in `workspace-write`. The goal is not removing the sandbox; it is removing prompts for routine shipping.

- Preferred writable root: the shared repo root that also contains `.claude/worktrees/`, so worktree metadata stays inside the writable area.
- Open Codex on the shared repo root only. Do not open separate Codex projects rooted at `.claude/worktrees/<name>` or other external worktree directories for this repo.
- Prefer stable `npm run ...` wrappers for diagnostics, CI, deploy, and GitHub operations. For mutating Git/worktree setup on Windows Codex Desktop, prefer direct approved entrypoints such as `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>`, `git fetch origin main`, and `git worktree add`.
- For repo orientation, prefer `npm run session:doctor` over one-off `git branch`, `git worktree`, or `git stash` reads when it gives enough context.
- Persist approvals for safe recurring prefixes such as `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1`, `npm run worktree:new`, `npm run worktree:sync`, `npm run session:doctor`, `npm run gh:auth-status`, `npm run auth:repair`, `npm run ci:watch`, `npm run ci:failed`, `npm run pre-merge-check`, `npm run deploy:verify`, `npm run inngest:register`, `git add`, `git commit -m`, `git push`, `git fetch origin main`, `git worktree add`, and `gh api repos/governada/governada-app/pulls`.
- Do not persist approvals for broad shells or interpreters such as bare `powershell`, `cmd`, `node`, `python`, `git`, or `gh`.
- On Windows Codex Desktop, if a mutating Git/worktree command or an `npm` wrapper that shells out to Git fails in `workspace-write` with `EPERM`, access denied, or a likely sandbox error, rerun it immediately with `sandbox_permissions=require_escalated` using an already-approved prefix. Do not stop to ask first unless the prefix itself is missing.
- Repo-local GH context is provided by `npm run gh:auth-status` and the scripts in `scripts/lib/runtime.js`; do not rely on `gh` inferring the repo from a remote alias or unrelated global state.
- This repo may use its own `GH_CONFIG_DIR` profile. `npm run gh:auth-status` and `npm run auth:repair` should only affect the repo-scoped profile selected by repo scripts, not unrelated repos or other local projects.

## Credential And Tool Discovery

Always resolve credentials and tool wrappers from the repo before falling back to higher-level defaults.

- Search order: current checkout -> shared checkout fallback -> repo-scoped user paths named by repo files -> global/home-directory config.
- In worktrees, ignored local files may be absent even when they exist in the shared checkout. If `.mcp.json` or `.claude/settings.local.json` is missing in `.claude/worktrees/<name>`, check the shared checkout next before assuming the repo is unconfigured.
- Treat these files as authoritative when present: `.mcp.json`, `.claude/settings.local.json`, `.env.local`, `package.json`, `scripts/lib/runtime.js`, `scripts/set_gh_context.ps1`, `scripts/set-gh-context.js`, `scripts/gh-auth-status.ps1`, and `scripts/repair-gh-auth.ps1`.
- Repo-scoped user paths referenced by those files are part of the repo bootstrap, not global fallbacks. That includes `GH_CONFIG_DIR` and any wrapper commands referenced by `.mcp.json`.
- Before generic troubleshooting, run `npm run session:doctor`, then `npm run gh:auth-status`, then inspect `.mcp.json` and the referenced wrapper commands.

## Setup Files

- Local MCP credentials belong in `.mcp.json`, which stays ignored.
- Local Claude overrides belong in `.claude/settings.local.json`, which stays ignored.
- Use `.mcp.example.json` as the sanitized template for new machines.
- Use `npm run auth:repair` if GitHub auth or the remote URL needs repair.
