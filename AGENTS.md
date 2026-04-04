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

1. If the task is feature work, create a fresh worktree first with `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>`. Do not start feature work in the shared checkout.
2. Start from fresh `origin/main`. When resuming an existing worktree or when session diagnostics show drift/setup gaps, run `npm run worktree:sync`.
3. Read only the minimal context needed. Use the strategy registry and manifest before diving into the full vision docs.
4. Make the smallest change that solves the actual problem.
5. Run `npm run agent:validate` and the relevant local verification for the scope.
6. For feature work, open a PR with `Summary`, `Existing Code Audit`, `Robustness`, and `Impact` sections.
7. Before merging, run `npm run pre-merge-check -- <PR#>`.
8. After merge, verify deploy health and smoke tests with `npm run deploy:verify`.

## Autonomy Boundary

Routine reads, edits, local verification, git hygiene, and PR preparation should not require approval. Pause for:

- Destructive production-data operations
- Scope expansion beyond the request
- Architectural forks with materially different tradeoffs
- Secrets, credential rotation, or external account changes

## Codex Desktop Sandbox

Keep Codex Desktop in `workspace-write`. The goal is not removing the sandbox; it is removing prompts for routine shipping.

- Preferred writable root: the repo parent, `C:\Users\dalto\governada\`, so worktree metadata and in-repo worktrees stay inside the writable area.
- Prefer stable `npm run ...` wrappers over ad hoc shell commands for CI, deploy, and GitHub operations. They produce narrower, reusable approval prefixes.
- Persist approvals for safe recurring prefixes such as `npm run gh:auth-status`, `npm run ci:watch`, `npm run ci:failed`, `npm run pre-merge-check`, `npm run deploy:verify`, `npm run inngest:register`, `git add`, `git commit -m`, `git push`, `git fetch origin main`, `git worktree add`, and `gh api repos/governada/governada-app/pulls`.
- Do not persist approvals for broad shells or interpreters such as bare `powershell`, `cmd`, `node`, `python`, `git`, or `gh`.
- Repo-local GH context is provided by `npm run gh:auth-status` and the scripts in `scripts/lib/runtime.js`; do not rely on `gh` inferring the repo from the SSH remote alias.

## Setup Files

- Local MCP credentials belong in `.mcp.json`, which stays ignored.
- Local Claude overrides belong in `.claude/settings.local.json`, which stays ignored.
- Use `.mcp.example.json` as the sanitized template for new machines.
- Use `npm run auth:repair` if GitHub auth or the remote URL needs repair.
