# Agent Guide

Provider-agnostic instructions for autonomous agents working in this repo. Treat this file as the portable workflow brief. Provider-specific adapters live under `.claude/`.

## Core Rules

- Feature work happens in a fresh worktree. The shared `governada-app` checkout stays on `main`. Hotfixes are the only exception. Read-only inspection on `main` is fine; the first mutating step must happen only after the agent has created a worktree.
- Search before creating. Extend existing components, hooks, routes, and utilities unless extension is genuinely infeasible.
- Non-trivial bugs require root-cause analysis before fixing. Do not patch symptoms first.
- `.env.local` points at production services. Never perform write-heavy syncs, backfills, or destructive data operations without explicit approval.
- Risky user-facing work should be feature-flagged.

## Hard Constraints

- Any `app/**/page.tsx` or `app/**/route.ts` touching Supabase, Redis, or `process.env` must export `const dynamic = 'force-dynamic'`.
- Any new file in `inngest/functions/` must be imported and registered in `app/api/inngest/route.ts`.
- Client-side data fetching uses TanStack Query, not raw `fetch` with ad-hoc `useEffect` state.
- Pages and components read cached governance data via `lib/data.ts`, not direct Koios calls.
- Migrations go through Supabase MCP. After a migration, regenerate and commit `types/database.ts`.

These constraints are enforced by `npm run agent:validate`. Run it before shipping. CI also runs it.

## Workflow

1. If the task is feature work, create a fresh worktree first with `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>`. Do not start feature work in the shared checkout. `npm run worktree:new -- <name>` is a convenience wrapper, but on Windows Codex Desktop the direct PowerShell entrypoint is more reliable because it matches persistent approval prefixes cleanly.
2. Start from fresh `origin/main`. When resuming an existing worktree or when session diagnostics show drift/setup gaps, run `npm run worktree:sync`.
3. Read only the minimal context needed. Use the strategy registry and manifest before diving into the full vision docs.
4. Make the smallest change that solves the actual problem.
5. Run `npm run agent:validate` and the relevant local verification for the scope.
6. For feature work, open a PR with `Summary`, `Existing Code Audit`, `Robustness`, and `Impact` sections.
7. Use `npm run git:stage -- ...`, `npm run git:commit -- --message "..."`, and `npm run git:push` instead of raw `git add`, `git commit`, or `git push`.
8. If a draft PR is ready to ship, promote it with `npm run pr:ready -- <PR#>`.
9. Before merging, run `npm run pre-merge-check -- <PR#>`.
10. Merge with `npm run pr:merge -- <PR#>`.
11. After merge, verify deploy health and smoke tests with `npm run deploy:verify`, `npm run health:ready`, and `npm run health:status`.

## Autonomy Boundary

Routine reads, edits, local verification, git hygiene, and PR preparation should not require approval. Pause for:

- Destructive production-data operations
- Scope expansion beyond the request
- Architectural forks with materially different tradeoffs
- Secrets, credential rotation, or external account changes

## Codex Desktop Sandbox

Keep Codex Desktop in `workspace-write`. The goal is not removing the sandbox; it is removing prompts for routine shipping.

- Preferred writable root: the repo root, `C:\Users\dalto\governada\governada-app\`, so `.claude/worktrees/` and git worktree metadata stay inside the writable area.
- Open Codex on the shared repo root only. Do not open separate Codex projects rooted at `.claude/worktrees/<name>` or `C:\Users\dalto\.codex\worktrees\...` for this repo.
- Prefer stable `npm run ...` wrappers for diagnostics, CI, deploy, GitHub operations, mutating local git actions, and production health reads. For mutating Git/worktree setup on Windows Codex Desktop, prefer approved wrapper entrypoints such as `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>`, `npm run git:stage`, `npm run git:commit`, `npm run git:push`, `npm run health:ready`, `npm run health:status`, and `npm run health:reconciliation`.
- For repo orientation, prefer `npm run session:doctor` over one-off `git branch`, `git worktree`, or `git stash` reads when it gives enough context.
- Use `npm run pr:ready -- <PR#>` and `npm run pr:merge -- <PR#>` instead of raw `gh pr ready` or inline `gh api .../merge` commands.
- Use `npm run git:stage -- ...`, `npm run git:commit -- --message "..."`, and `npm run git:push` instead of raw `git add`, `git commit`, and `git push`.
- Use `npm run health:ready`, `npm run health:status`, `npm run health:api`, and `npm run health:reconciliation` instead of ad hoc `Invoke-RestMethod` or `Invoke-WebRequest`.
- After pulling wrapper changes on a new machine or after repo hardening updates, run `npm run codex:sync-windows-rules` once to seed the exact persistent Codex approvals for these wrapper commands.
- Persist approvals for safe recurring prefixes such as `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1`, `npm run worktree:new`, `npm run worktree:sync`, `npm run session:doctor`, `npm run gh:auth-status`, `npm run auth:repair`, `npm run git:stage`, `npm run git:commit`, `npm run git:push`, `npm run pr:ready`, `npm run pr:merge`, `npm run ci:watch`, `npm run ci:failed`, `npm run pre-merge-check`, `npm run deploy:verify`, `npm run health:ready`, `npm run health:status`, `npm run health:api`, `npm run health:reconciliation`, `npm run inngest:register`, `git fetch origin main`, `git worktree add`, and `gh api repos/governada/governada-app/pulls`.
- Do not persist approvals for broad shells or interpreters such as bare `powershell`, `cmd`, `node`, `python`, `git`, or `gh`.
- On Windows Codex Desktop, if a mutating Git/worktree command or an `npm` wrapper that shells out to Git fails in `workspace-write` with `EPERM`, access denied, or a likely sandbox error, rerun it immediately with `sandbox_permissions=require_escalated` using an already-approved wrapper prefix. Do not stop to ask first unless the wrapper prefix itself is missing.
- Repo-local GH context is provided by `npm run gh:auth-status` and the scripts in `scripts/lib/runtime.js`; do not rely on `gh` inferring the repo from the SSH remote alias.
- The governada repo uses its own `GH_CONFIG_DIR` profile. `npm run gh:auth-status` and `npm run auth:repair` only affect that repo-scoped profile; they do not switch `gh` for unrelated repos or Claude Code projects.

## Setup Files

- Local MCP credentials belong in `.mcp.json`, which stays ignored.
- Local Claude overrides belong in `.claude/settings.local.json`, which stays ignored.
- Use `.mcp.example.json` as the sanitized template for new machines.
- Use `npm run auth:repair` if GitHub auth or the remote URL needs repair.
