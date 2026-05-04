# Agent Guide

Canonical agent guide for `governada/app`. Provider adapters in `.claude/`, Cursor, and other tools point here instead of copying workflow or policy.

## Hard Constraints

- Route rendering follows `scripts/lib/routeRenderPolicy.mjs`; qualifying dynamic routes must export `const dynamic = 'force-dynamic'`.
- Any new file in `inngest/functions/` must be imported and registered in `app/api/inngest/route.ts`.
- Client-side data fetching uses TanStack Query, not raw `fetch` plus ad hoc `useEffect` state.
- Cached governance reads go through `lib/data.ts`, not direct Koios calls from pages/components.
- Migrations go through Supabase MCP; regenerate and commit `types/database.ts`.
- These are enforced by `npm run agent:validate`.

## Autonomy

- Routine read, edit, verify, commit, and PR work does not need approval.
- Feature mutations happen in a fresh worktree; the shared checkout stays read-only except hotfixes.
- Pause for destructive production-data operations, scope expansion, architectural forks, or secrets/credentials.
- `.env.local` points at production services; never run write-heavy syncs/backfills without explicit approval.
- Before merge, confirm CI is green and get Tim's exact approval; use the normal GitHub PR merge path.

## Defaults

- Challenge first, build second: for non-trivial work, write back the concrete request and list 3 unclear things before building.
- Plan first: before any 3+ file change, fill `docs/templates/feature-plan.md` into `brain/plans/<slug>.md`.
- Verify before done: run the pre-done hook with URL, screenshot, and grep-similar evidence. Name any residual steps required for the change to take effect (commit/push, deploy, restart, migration) — don't sign off on work that hasn't actually landed.
- Evidence-grounded recommendations: read the actual repo state before proposing solutions. Cite files read, commands run, and claims verified. Recommendations without an evidence trail are speculative — flag them as such.
- Edit > create for docs and code; search for the existing home before adding a new one.
- Flag credible out-of-scope issues via `spawn_task` with a self-contained prompt — real bugs, dead code, security smells, missing coverage. Skip vague hunches; don't fix inline.

## Production Quality Bar

- Ship error, loading, and empty states for user-facing work.
- Verify mobile at 375px and cover a11y basics: labels, focus, keyboard, contrast.
- No parallel implementations of the same behavior; extend the chosen path.
- Verify visually at the actual URL before declaring done.
- Add no new `any` types unless an ADR or explicit review approves it.

## Doc Placement Tree

- Constraint always-applies -> edit `AGENTS.md`.
- Subsystem pattern -> edit existing `docs/<subsystem>.md`.
- Architectural choice -> create `docs/adr/NNN-<slug>.md`.
- Feature plan -> create or update `brain/plans/<slug>.md`.
- Lesson -> append `brain/learnings/<tag>.md`.
- Otherwise ask first.

## Auth

- SSH + 1Password is the sole git lane.
- Remotes use `git@github-governada:...`.
- If broken, run `npm run gh:auth-status`, then `npm run auth:repair`.
- Do not print, copy, or store raw secrets.

## Where to Find More

- Architecture: `docs/architecture.md`
- Shipped/not-shipped status: `docs/manifest.md`
- Terms and code names: `docs/glossary.md`
- Brain entry: `/Users/tim/dev/governada/governada-brain/agents/governada-context.md`
- ADRs: `docs/adr/`
- Commands: `.claude/commands/`
- Hooks: `.claude/hooks/`

## Brain Freshness

- Final responses must end with `Brain freshness: updated <files>` or `Brain freshness: not needed because <reason>`.
