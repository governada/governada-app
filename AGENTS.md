# Agent Guide

Provider-agnostic instructions for autonomous agents working in this repo. Treat this file as the portable workflow brief and the single canonical agent harness. Provider-specific adapters live under `.claude/`, but they must reference this file and call repo `npm run ...` scripts instead of duplicating workflow, auth, or worktree policy.

## Core Rules

- Feature work happens in a fresh worktree. The shared `governada-app` checkout stays on `main`. Hotfixes are the only exception. Read-only inspection on `main` is fine; the first mutating step must happen only after the agent has created a worktree.
- Search before creating. Extend existing components, hooks, routes, and utilities unless extension is genuinely infeasible.
- Prefer elegant, durable solutions over expedient shortcuts. Do not default to intentionally minimal stopgaps when a cleaner fix is clear and practical within scope. Optimize for long-term maintainability, performance, scalability, and reduced rework.
- Non-trivial bugs require root-cause analysis before fixing. Do not patch symptoms first.
- `.env.local` points at production services. Never perform write-heavy syncs, backfills, or destructive data operations without explicit approval.
- Risky user-facing work should be feature-flagged.
- Governada product feature work is not done until `/Users/tim/dev/governada/governada-brain` reflects what actually shipped. Search for an existing feature or initiative note before implementation and update or create durable feature memory before closeout.
- Do not duplicate these rules into provider-specific files. If a provider adapter needs repo policy, point it back here and keep executable behavior in `package.json` scripts or small adapter hooks.

## Hard Constraints

- Route rendering follows `scripts/lib/routeRenderPolicy.mjs`. `app-dynamic` and `public-dynamic-exception` layouts/pages/routes that touch cached governance data, request headers/cookies, Supabase, Redis, or `process.env` must export `const dynamic = 'force-dynamic'`. `public-cache` routes may read DB-first cached governance data via `lib/data.ts` without `force-dynamic`, but may not read request-scoped APIs, direct Supabase/Redis clients, or raw `process.env` in the route file.
- Any new file in `inngest/functions/` must be imported and registered in `app/api/inngest/route.ts`.
- Client-side data fetching uses TanStack Query, not raw `fetch` with ad-hoc `useEffect` state.
- Pages and components read cached governance data via `lib/data.ts`, not direct Koios calls.
- Migrations go through Supabase MCP. After a migration, regenerate and commit `types/database.ts`.

These constraints are enforced by `npm run agent:validate`. Run it before shipping. CI also runs it.

## Workflow

1. If the task is feature work, create a fresh worktree first with `npm run worktree:new -- <name>`. Do not start feature work in the shared checkout.
2. Start from fresh `origin/main`. When resuming an existing worktree or when session diagnostics show drift/setup gaps, run `npm run worktree:sync`.
3. Run `npm run session:guard` at the start and end of each local session. Treat a failing guard as a blocker, not a suggestion.
4. End each local session with exactly one outcome for every change set: committed, intentionally exported, or discarded. Do not leave anonymous stashes or dirty merged worktrees behind.
5. Read only the minimal context needed. Use the strategy registry and manifest before diving into the full vision docs.
6. Make the most elegant change that cleanly solves the actual problem within scope. Do not choose a shortcut or merely minimal patch when a more coherent fix is clear and practical.
7. Run `npm run agent:validate` and the relevant local verification for the scope.
8. Communicate impact explicitly in updates, handoffs, and reviews: what changed, why it matters, which surfaces or constraints it affects, and any real tradeoffs or risks.
9. For product feature work, update the relevant brain feature note under `/Users/tim/dev/governada/governada-brain/governada/features/` or initiative note under `/Users/tim/dev/governada/governada-brain/governada/initiatives/`. If no note exists and the feature is shaped enough to name, create one from the brain template. Tiny follow-up PRs should update the existing feature note rather than create duplicates.
10. Publish committed branch changes through `npm run github:ship` and create/update/ready PRs through `npm run github:pr-write` when the brokered lane supports the change class. Use direct `git push` or raw `gh` only as a documented fallback.
11. For feature work, open a PR with `Summary`, `Existing Code Audit`, `Robustness`, `Impact`, `Brain Freshness`, and `Review Gate v0` sections.
12. Before merging, run `npm run pre-merge-check -- <PR#>` and `npm run github:merge-doctor -- --pr <PR#> --expected-head <sha>`.
13. Merge only after Tim gives the exact chat approval for `github.merge` naming `governada/app`, the PR number, and the expected head SHA.
14. Execute merges through `npm run github:merge -- --pr <PR#> --expected-head <sha> --execute --confirm github.merge`. The wrapper performs synchronous post-merge deploy verification; run `npm run deploy:verify` separately only when extra verification is needed.

## Autonomy Boundary

Routine reads, edits, local verification, git hygiene, and PR preparation should not require approval. Pause for:

- Destructive production-data operations
- Scope expansion beyond the request
- Architectural forks with materially different tradeoffs
- Secrets, credential rotation, or external account changes

## Brain Freshness

Use the Obsidian brain for product context, feature lifecycle memory, durable decisions, and future-agent assumptions. Use the app repo for source code and code-shipping docs.

- Product feature work must search `/Users/tim/dev/governada/governada-brain/governada/features/` and `/Users/tim/dev/governada/governada-brain/governada/initiatives/` before planning or implementation.
- Every real product feature should have a feature note. The note should record product intent, strategic fit, surfaces, current behavior, intended behavior, acceptance criteria, implementation notes, verification, shipped history, and open follow-ups.
- New feature or meaningful behavior change: create or update the feature note before closeout.
- Small follow-up to an existing feature: update the existing feature note with shipped history, verification, or open gaps.
- Bug fix: update the feature note when the bug changes expected behavior, exposes a durable product/architecture lesson, or affects a critical journey.
- Refactor/test-only work: a feature note is optional only when behavior and future-agent assumptions are unchanged; say why at closeout.
- Update `/Users/tim/dev/governada/governada-brain/governada/roadmap.md` only when phase coverage, sequencing, or strategic status changes.
- Add or update a note under `/Users/tim/dev/governada/governada-brain/decisions/` when a durable product, architecture, monetization, identity, or sequencing choice is made.
- Final responses must include `Brain freshness: updated <files>` or `Brain freshness: not needed because <reason>`.

## Codex Desktop Sandbox

Keep Codex Desktop in `workspace-write`. The goal is not removing the sandbox; it is removing prompts for routine shipping.

- Preferred writable root: the shared repo root that also contains `.claude/worktrees/`, so worktree metadata stays inside the writable area.
- Open Codex on the shared repo root only. Do not open separate Codex projects rooted at `.claude/worktrees/<name>` or other external worktree directories for this repo.
- Prefer stable `npm run ...` wrappers for diagnostics, CI, deploy, GitHub operations, and worktree setup. The Mac-first agent path uses Node and shell entrypoints.
- When local hygiene is in question, use `npm run session:guard` as the blocking gate and `npm run session:doctor` for the human-readable breakdown.
- For repo orientation, prefer `npm run session:doctor` over one-off `git branch`, `git worktree`, or `git stash` reads when it gives enough context.
- Persist approvals for safe recurring prefixes such as `npm run worktree:new`, `npm run worktree:sync`, `npm run session:doctor`, `npm run session:guard`, `npm run gh:auth-status`, `npm run github:runtime-doctor`, `npm run github:read-doctor`, `npm run github:write-doctor`, `npm run github:ship-doctor`, `npm run github:merge-doctor`, `npm run github:pr-write`, `npm run github:pr-close`, `npm run github:merge`, `npm run auth:repair`, `npm run ci:watch`, `npm run ci:failed`, `npm run pre-merge-check`, `npm run deploy:verify`, `npm run inngest:register`, `git add`, `git commit -m`, `git push`, `git fetch origin main`, `git worktree add`, and `gh api repos/governada/app/pulls`.
- Live brokered GitHub wrappers may need those persisted repo-wrapper approvals to run outside the default Codex sandbox because the LaunchAgent, macOS Keychain, and broker socket are OS resources. Do not replace this with broad shell, `node`, `gh`, `bash`, or full-disk sandbox relaxation.
- Do not persist approvals for broad shells or interpreters such as bare `zsh`, `bash`, `node`, `python`, `git`, or `gh`.
- If a mutating Git/worktree command or an `npm` wrapper that shells out to Git fails in `workspace-write` with `EPERM`, access denied, or a likely sandbox error, rerun it immediately with `sandbox_permissions=require_escalated` using an already-approved prefix. Do not stop to ask first unless the prefix itself is missing.
- Repo-local GH context is provided by `npm run gh:auth-status` and the scripts in `scripts/lib/runtime.js`; do not rely on `gh` inferring the repo from a remote alias or unrelated global state.
- This repo may use its own `GH_CONFIG_DIR` profile. `npm run gh:auth-status` and `npm run auth:repair` should only affect the repo-scoped profile selected by repo scripts, not unrelated repos or other local projects.

## Credential And Tool Discovery

Always resolve credentials and tool wrappers from the repo before falling back to higher-level defaults.

- Canonical security/auth policy lives in `/Users/tim/dev/governada/governada-brain/agents/system/auth-and-identity.md`. This repo-local guide implements that policy for `governada/app`; it should not redefine cross-project auth rules independently.
- 1Password is the canonical source of truth for credentials and secret references across Governada, BlueCargo, and future projects. 1Password-backed SSH aliases remain the canonical Git transport for normal branch publishing; the Phase 0B GitHub App broker is a narrow sandbox-compatible API lane, not a replacement for 1Password SSH.
- Search order: current checkout -> shared checkout fallback -> repo-scoped user paths named by repo files -> global/home-directory config.
- In worktrees, ignored local files may be absent even when they exist in the shared checkout. If `.mcp.json` or `.claude/settings.local.json` is missing in `.claude/worktrees/<name>`, check the shared checkout next before assuming the repo is unconfigured.
- Treat these files as authoritative when present: `.mcp.json`, `.claude/settings.local.json`, `.env.local.refs`, `.env.local`, `docs/examples/env-local-refs.example.md`, `package.json`, `scripts/env-doctor.mjs`, `scripts/env-run.mjs`, `scripts/lib/runtime.js`, `scripts/set-gh-context.js`, `scripts/gh-auth-status.js`, and `scripts/repair-gh-auth.mjs`.
- Governada Git remotes should use the 1Password-backed SSH alias `git@github-governada:governada/app.git`. Do not replace it with HTTPS or bare `git@github.com`.
- GitHub CLI tokens should come from 1Password when possible: set `GH_TOKEN_OP_REF` or `GITHUB_TOKEN_OP_REF` to an `op://...` reference in local environment, never the raw token. Repo `gh` wrappers pin `OP_ACCOUNT=my.1password.com` and resolve that reference with the 1Password CLI without printing the secret.
- The Phase 0B autonomous `github.read` pilot is diagnosed by `npm run github:read-doctor`. It uses a GitHub App installation token materialized from 1Password service-account access when configured. It does not authorize PR writes, merge, deploy, production mutation, admin, billing, or secret changes.
- The Phase 0B `github.ship.pr` lane is diagnosed by `npm run github:ship-doctor`. `npm run github:ship -- publish --head <codex-or-feat-branch>` publishes committed local HEAD changes to a same-repo branch through the broker and GitHub Git Data APIs; it dry-runs by default, refuses dirty worktrees, refuses `main`, refuses cross-repo refs, never force pushes, and scans file contents for likely secret material before creating GitHub blobs. `npm run github:pr-write` is the bounded draft-PR wrapper for this lane. It dry-runs by default and requests only `contents=write`, `pull_requests=write`, `actions=read`, `checks=read`, plus GitHub's implicit `metadata=read`. Live PR mode requires `--execute --confirm github.write.pr` and either the local GitHub runtime broker or a human-present service-account runtime. It is limited to draft PR creation, title/body updates on draft PRs after a read-before-write draft check, completed Review Gate v0 body-only updates on ready PRs, or marking draft PRs ready for review. `npm run github:pr-close` is the bounded stale-draft close wrapper. It dry-runs by default, requires an expected head SHA, reads the target PR before close, and in live mode requires `--execute --confirm github.pr.close` plus exact approval text or approval file naming `governada/app`, the PR number, `github.pr.close`, and the expected head SHA. It only closes open draft PRs in `governada/app`; it does not authorize comments, labels, branch deletion, ready transitions, merge, deploy mutation, production sync, admin, billing, branch protection, or secret changes.
- The Phase 0B `github.merge` lane is diagnosed by `npm run github:merge-doctor` and executed only through `npm run github:merge -- --pr <number> --expected-head <sha> --execute --confirm github.merge`. Live merge requires a current prompt approval naming `governada/app`, the PR number, `github.merge` or merge, the exact expected head SHA, green/passing checks, and the head staying unchanged. The wrapper re-reads PR state, blocks draft/wrong-repo/changed-head/conflicting/behind/unreviewed/failing-check cases, requires completed Review Gate v0 in the PR body, and pins the merge request to the expected head SHA.
- The Phase 0B service-account runtime posture is diagnosed by `npm run github:runtime-doctor` and `npm run github:broker -- doctor`. `OP_SERVICE_ACCOUNT_TOKEN` must remain out of files, LaunchAgent plists, command arguments, logs, and agent-visible env. 1Password remains the source of truth; the approved macOS Keychain entry is only a local runtime cache for the Governada broker. Human-present setup/maintenance commands are `npm run github:broker -- install --confirm github.runtime.install`, `npm run github:broker -- cache-token --confirm github.runtime.cache-token`, `npm run github:broker -- clear-token-cache --confirm github.runtime.clear-token-cache`, and `npm run github:broker -- uninstall --confirm github.runtime.uninstall`. Durable installs run from the shared checkout after merge; worktree installs require `--temporary-worktree-proof` and are disposable live proofs only. The Keychain helper is built from tracked source and force-rebuilt from a trusted compiler path only on token-bearing cache writes and broker service starts. Doctor/status/delete paths inspect the Keychain item with macOS `security` without reading password bytes, and the helper exposes only write/run-broker modes with no token-dump read mode. The helper pins the expected helper and broker paths at compile time and passes only an allowlisted environment into the token-bearing broker child. After install and cache setup, agents should use `npm run github:broker -- ensure` or the repo-local GitHub wrappers, which auto-ensure the broker by reusing a healthy Governada broker and starting the LaunchAgent only when needed. Agents never receive the service-account token, private key, or raw installation token. When token-bearing GitHub App doctors and wrappers run, they require non-secret expiry/rotation metadata (`GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT` and `GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER`) so agents can warn before expiry and block unsafe near-expiry use.
- Local app/runtime secrets should use ignored `.env.local.refs` files with `op://...` references and `npm run env:run -- <command>` where possible. Use `npm run env:doctor` to inspect readiness without printing values. Do not place `GH_TOKEN_OP_REF` or `GITHUB_TOKEN_OP_REF` in `.env.local.refs`; keep them unresolved for repo GitHub wrappers.
- Worktree setup must not copy plaintext `.env.local` from the shared checkout. Existing `.env.local` files are temporary production-connected fallbacks only; never read, print, commit, or propagate them.
- Repo-scoped user paths referenced by those files are part of the repo bootstrap, not global fallbacks. That includes `GH_CONFIG_DIR` and any wrapper commands referenced by `.mcp.json`.
- Before generic troubleshooting, run `npm run session:doctor`, then `npm run gh:auth-status`, then inspect `.mcp.json` and the referenced wrapper commands. For the autonomous GitHub App lane, run `npm run github:runtime-doctor` first, then the operation-class doctor: `npm run github:read-doctor`, `npm run github:ship-doctor`, or `npm run github:merge-doctor`. These doctors may inspect `.env.local.refs` for GitHub App IDs, rotation metadata, and the private-key reference, but `OP_SERVICE_ACCOUNT_TOKEN` must come from an approved secure runtime environment or the broker process.

## Setup Files

- Local MCP credentials belong in `.mcp.json`, which stays ignored.
- Local Claude overrides belong in `.claude/settings.local.json`, which stays ignored.
- Local 1Password env references belong in `.env.local.refs`, which stays ignored. Use `docs/examples/env-local-refs.example.md` as the sanitized template.
- Use `.mcp.example.json` as the sanitized template for new machines.
- Use `npm run auth:repair` if GitHub auth or the remote URL needs repair.
