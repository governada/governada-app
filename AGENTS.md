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
4. `session:guard` proves repo/session hygiene only. It does not prove phase closeout, brain freshness, operator queue freshness, retrieval freshness, or Phase 1 readiness.
5. End each local session with exactly one outcome for every change set: committed, intentionally exported, or discarded. Do not leave anonymous stashes or dirty merged worktrees behind.
6. Read only the minimal context needed. Use the strategy registry and manifest before diving into the full vision docs.
7. Make the most elegant change that cleanly solves the actual problem within scope. Do not choose a shortcut or merely minimal patch when a more coherent fix is clear and practical.
8. Run `npm run agent:validate` and the relevant local verification for the scope.
9. Communicate impact explicitly in updates, handoffs, and reviews: what changed, why it matters, which surfaces or constraints it affects, and any real tradeoffs or risks.
10. After PR cleanup, merge, deploy, auth, workflow, control-plane, or multi-step work, final answers must say whether brain/control-plane closeout is still pending and must separate `Safe To Pause Session` from `Safe For Handoff / Phase Closeout`.
11. Do not imply Phase 0.6 closeout, Phase 1 readiness, or next-agent handoff safety from local repo cleanliness alone.
12. For product feature work, update the relevant brain feature note under `/Users/tim/dev/governada/governada-brain/governada/features/` or initiative note under `/Users/tim/dev/governada/governada-brain/governada/initiatives/`. If no note exists and the feature is shaped enough to name, create one from the brain template. Tiny follow-up PRs should update the existing feature note rather than create duplicates.
13. Publish committed branch changes through `npm run github:ship` and create/update/ready PRs through `npm run github:pr-write` when the brokered lane supports the change class. Use direct `git push` or raw `gh` only as a documented fallback.
14. For feature work, open a PR with `Summary`, `Existing Code Audit`, `Robustness`, `Impact`, `Brain Freshness`, and `Review Gate v0` sections.
15. Before requesting merge approval, run `npm run github:merge-ready -- --pr <PR#>`. If the default stable-host doctor fails closed in a human-present Codex process without `OP_SERVICE_ACCOUNT_TOKEN`, run `npm run github:merge-ready:legacy -- --pr <PR#>` as the documented compatibility path. The readiness wrapper runs `pre-merge-check`, withholds the approval prompt until the merge doctor passes, then prints the exact approval text.
16. Merge only after Tim gives the exact chat approval for `github.merge` naming `governada/app`, the PR number, and the expected head SHA printed by the readiness wrapper.
17. Execute merges through `npm run github:merge -- --pr <PR#> --expected-head <sha> --execute --confirm github.merge`. The wrapper performs synchronous post-merge deploy verification; run `npm run deploy:verify` separately when extra verification is needed or when the wrapper reports `MERGED_VERIFY_TIMEOUT`.
18. When shipping/auth state is ambiguous, run `npm run ship:doctor` before diagnosing. It separates local Git refs, direct Git SSH, direct Git remote transport, repo GitHub API auth, the existing app-local broker path, and the stable agent-runtime host path; do not infer one lane's health from another. Use `npm run ship:doctor -- --probe-ssh --probe-git-remote` when investigating 1Password SSH signing or fetch hangs because the direct Git probe is time-bounded and read-only.

## Repo Vs Vault

- The sibling Obsidian vault at `/Users/tim/dev/governada/governada-brain` is the default home for durable Governada operating knowledge that should persist across sessions but does not need to version with app code: incident notes, runbooks, decisions, product context, and institutional memory.
- The app repo is for code, tests, migrations, executable scripts, and docs that must ship or review with the codebase.
- For Governada project, product, strategy, architecture, launch, or operating context, start with the vault entrypoint at `/Users/tim/dev/governada/governada-brain/agents/governada-context.md` before broad repo search. Use repo search after that for implementation details, current code paths, and verification against the live codebase.
- When work produces durable Governada knowledge, proactively write back to the vault even if the user did not explicitly say "log this." Mention which note you created or updated and why it is the durable home for that knowledge.
- Treat `inbox/daily/` as intake, not the final resting place for important knowledge. Promote durable decisions, runbooks, incidents, system notes, and product context into stable notes under `decisions/`, `notes/`, or `governada/`, then leave the daily note as the breadcrumb trail.
- If the user asks to "log" something, "capture" a note, "write this up," or "add a runbook" without naming a destination, prefer the Obsidian vault over adding an ad hoc markdown file to this repo. Say which vault note you created or updated.
- If the requested documentation changes code behavior, deployment mechanics, validation rules, or contributor workflow for this repo, update the repo docs in version control instead of only writing to the vault.
- Treat `governada-brain` as an Obsidian vault, not generic markdown storage. When editing there, preserve wiki links, prefer Obsidian-style note structure, and avoid breaking link targets through casual renames or ad hoc file moves.
- Prefer folder-qualified wikilinks such as `[[governada/roadmap]]` when note names could collide, and use the vault templates/frontmatter conventions instead of ad hoc note shapes.
- Never store raw secrets, tokens, private keys, or copied `.env` values in the vault. Record variable names, system names, rotation state, and procedures instead.
- Cross-link repo work and vault context when the connection will help future agents: add the relevant vault note to PR descriptions or repo docs when a code change depends on durable context, and add repo paths, PR numbers, or commit SHAs to the vault note when they materially anchor the note. Do not force cross-links for trivial refactors or low-signal chores.
- After editing the sibling vault locally, run `npm run vault:check` from this repo when available to verify link hygiene and template/frontmatter expectations.

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
- Use `npm run vault:check` for local Obsidian vault hygiene when work touches `/Users/tim/dev/governada/governada-brain`.
- When local hygiene is in question, use `npm run session:guard` as the blocking gate and `npm run session:doctor` for the human-readable breakdown.
- For repo orientation, prefer `npm run session:doctor` over one-off `git branch`, `git worktree`, or `git stash` reads when it gives enough context.
- Persist approvals for safe recurring prefixes such as `npm run worktree:new`, `npm run worktree:sync`, `npm run session:doctor`, `npm run session:guard`, `npm run vault:check`, `npm run gh:auth-status`, `npm run gh:token-cache`, `npm run github:runtime-doctor`, `npm run github:read-doctor`, `npm run github:write-doctor`, `npm run github:ship-doctor`, `npm run github:merge-ready`, `npm run github:merge-doctor`, `npm run github:pr-write`, `npm run github:pr-close`, `npm run github:merge`, `npm run auth:repair`, `npm run ci:watch`, `npm run ci:failed`, `npm run pre-merge-check`, `npm run deploy:verify`, `npm run inngest:register`, `git add`, `git commit -m`, `git push`, `git fetch origin main`, `git worktree add`, and `gh api repos/governada/app/pulls`.
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
- GitHub CLI tokens should come from 1Password when possible: set `GH_TOKEN_OP_REF` or `GITHUB_TOKEN_OP_REF` to an `op://...` reference in local environment, never the raw token. Human-present setup may run `npm run gh:token-cache -- cache-token --confirm gh.runtime.cache-token` to write a repo-local macOS Keychain runtime cache. Repo `gh` wrappers pin `OP_ACCOUNT=my.1password.com`, prefer the Keychain helper cache when present, and fall back to resolving the 1Password reference without printing the secret.
- The Phase 0.7 stable-host `github.read` lane is diagnosed by `npm run github:read-doctor`, which routes to `/Users/tim/dev/agent-runtime/bin/agent-runtime github doctor --domain governada --operation github.read`. The pre-Slice-5a app-local doctor remains available only as the explicit compatibility fallback `npm run github:read-doctor:legacy` or `npm run github:read-doctor -- --legacy`. This lane uses a short-lived GitHub App installation token materialized inside the approved stable-host/service-account runtime and does not authorize PR writes, merge, deploy, production mutation, admin, billing, or secret changes.
- The Phase 0B `github.ship.pr` lane is diagnosed by `npm run github:ship-doctor`. `npm run github:ship -- publish --head <codex-or-feat-branch>` publishes committed local HEAD changes to a same-repo branch through the broker and GitHub Git Data APIs; it dry-runs by default, refuses dirty worktrees, refuses `main`, refuses cross-repo refs, never force pushes, and scans file contents for likely secret material before creating GitHub blobs. `npm run github:pr-write` is the bounded draft-PR wrapper for this lane. It dry-runs by default and requests only `contents=write`, `pull_requests=write`, `actions=read`, `checks=read`, plus GitHub's implicit `metadata=read`. Live PR mode requires `--execute --confirm github.write.pr` and either the local GitHub runtime broker or a human-present service-account runtime. It is limited to draft PR creation, title/body updates on draft PRs after a read-before-write draft check, completed Review Gate v0 body-only updates on ready PRs, or marking draft PRs ready for review. `npm run github:pr-close-doctor` routes `github.pr.close` proof to the stable host by default, with `npm run github:pr-close-doctor:legacy` / `--legacy` as the non-mutating app-local compatibility proof. `npm run github:pr-close` remains the bounded stale-draft close wrapper on the existing broker path until stable-host close support lands. It dry-runs by default, requires an expected head SHA, reads the target PR before close, and in live mode requires `--execute --confirm github.pr.close` plus exact approval text or approval file naming `governada/app`, the PR number, `github.pr.close`, and the expected head SHA. It only closes open draft PRs in `governada/app`; it does not authorize comments, labels, branch deletion, ready transitions, merge, deploy mutation, production sync, admin, billing, branch protection, or secret changes.
- The Phase 0B `github.merge` lane is prepared by `npm run github:merge-ready -- --pr <number>`, diagnosed by `npm run github:merge-doctor`, and executed only through `npm run github:merge -- --pr <number> --expected-head <sha> --execute --confirm github.merge`. `github:merge-ready` runs the required pre-merge check and merge doctor before printing the exact approval prompt; `npm run github:merge-ready:legacy -- --pr <number>` is the compatibility path when the default stable-host doctor fails closed in a human-present Codex process without `OP_SERVICE_ACCOUNT_TOKEN`. Live merge requires a current prompt approval naming `governada/app`, the PR number, `github.merge` or merge, the exact expected head SHA, green/passing checks, and the head staying unchanged. The wrapper re-reads PR state, blocks draft/wrong-repo/changed-head/conflicting/behind/unreviewed/failing-check cases, requires completed Review Gate v0 in the PR body, and pins the merge request to the expected head SHA.
- The Phase 0B service-account runtime posture is diagnosed by `npm run github:runtime-doctor` and `npm run github:broker -- doctor`. `OP_SERVICE_ACCOUNT_TOKEN` must remain out of files, LaunchAgent plists, command arguments, logs, and agent-visible env. 1Password remains the source of truth; the approved macOS Keychain entry is only a local runtime cache for the Governada broker. Human-present setup/maintenance commands are `npm run github:broker -- install --confirm github.runtime.install`, `npm run github:broker -- cache-token --confirm github.runtime.cache-token`, `npm run github:broker -- clear-token-cache --confirm github.runtime.clear-token-cache`, and `npm run github:broker -- uninstall --confirm github.runtime.uninstall`. Durable installs run from the shared checkout after merge; worktree installs require `--temporary-worktree-proof` and are disposable live proofs only. The Keychain helper is built from tracked source and force-rebuilt from a trusted compiler path only on token-bearing cache writes and broker service starts. Doctor/status/delete paths inspect the Keychain item with macOS `security` without reading password bytes, and the helper exposes only write/run-broker/run-gh modes with no token-dump read mode. The helper pins the expected helper and broker paths at compile time and passes only an allowlisted environment into token-bearing children. After install and cache setup, agents should use `npm run github:broker -- ensure` or the repo-local GitHub wrappers, which auto-ensure the broker by reusing a healthy Governada broker and starting the LaunchAgent only when needed. Agents never receive the service-account token, private key, or raw installation token. When token-bearing GitHub App doctors and wrappers run, they require non-secret expiry/rotation metadata (`GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT` and `GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER`) so agents can warn before expiry and block unsafe near-expiry use.
- Local app/runtime secrets should use ignored `.env.local.refs` files with `op://...` references and `npm run env:run -- <command>` where possible. Use `npm run env:doctor` to inspect readiness without printing values. Do not place `GH_TOKEN_OP_REF` or `GITHUB_TOKEN_OP_REF` in `.env.local.refs`; keep them unresolved for repo GitHub wrappers.
- Worktree setup must not copy plaintext `.env.local` from the shared checkout. Existing `.env.local` files are temporary production-connected fallbacks only; never read, print, commit, or propagate them.
- Repo-scoped user paths referenced by those files are part of the repo bootstrap, not global fallbacks. That includes `GH_CONFIG_DIR` and any wrapper commands referenced by `.mcp.json`.
- Before generic troubleshooting, run `npm run session:doctor`, then `npm run gh:auth-status`, then inspect `.mcp.json` and the referenced wrapper commands. For ambiguous shipping/auth failures, run `npm run ship:doctor`; add `--probe-ssh --probe-git-remote` when the question is direct 1Password SSH/Git transport health. For the autonomous GitHub App lane, run `npm run github:runtime-doctor` first, then the operation-class doctor: `npm run github:read-doctor`, `npm run github:ship-doctor`, `npm run github:pr-close-doctor`, or `npm run github:merge-doctor`. `github:read-doctor`, `github:ship-doctor`, and `github:pr-close-doctor` now delegate to the stable host by default; `github:pr-close` live execution remains app/broker-scoped until a later stable-host support slice changes it. These doctors may inspect `.env.local.refs` for GitHub App IDs, rotation metadata, and private-key references, but `OP_SERVICE_ACCOUNT_TOKEN` must come from an approved secure runtime environment, the stable host, or the broker process for the specific operation class.

## Setup Files

- Local MCP credentials belong in `.mcp.json`, which stays ignored.
- Local Claude overrides belong in `.claude/settings.local.json`, which stays ignored.
- Local 1Password env references belong in `.env.local.refs`, which stays ignored. Use `docs/examples/env-local-refs.example.md` as the sanitized template.
- Use `.mcp.example.json` as the sanitized template for new machines.
- Use `npm run auth:repair` if GitHub auth or the remote URL needs repair.
