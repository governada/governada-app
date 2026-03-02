# Lessons Learned

## 2026-03-01 — Session 8 Planning & Execution

### gh pr merge fails from feature worktrees
- **Context**: `gh pr merge` tries to checkout main after merging, which fails when main is locked by another worktree.
- **Fix**: Use `gh api repos/.../pulls/.../merge -X PUT -f merge_method=squash` instead.
- **Promoted to rule**: `git-branch-hygiene.mdc` — added merge-from-worktree section.

### Always verify build failures are not pre-existing
- **Context**: Turbopack build failed with `libsodium-sumo.mjs` not found. Spent zero time debugging because we stashed changes and confirmed the same error on the base branch.
- **Pattern**: `git stash → build → git stash pop`. If it fails on base, it's not your problem.
- **Promoted to rule**: `git-branch-hygiene.mdc` — added Build Failure Triage section.

### Shared type construction sites
- **Context**: Added `voteCoverage` to `PulseData.spotlightProposal` interface and the API route, but forgot `app/page.tsx` also constructs `PulseData` server-side. TypeScript caught it.
- **Pattern**: When modifying an interface, grep for all construction sites, not just the primary one.
- **Promoted to rule**: `git-branch-hygiene.mdc` — added Shared Type Construction section.

### Not all Inngest functions have HTTP routes
- **Context**: Added treasury to `SYNC_CONFIG` and `ACTIVE_SYNC_TYPES` in the integrity alert. Self-healing tried to call `/api/sync/treasury` — which doesn't exist. Treasury runs directly in Inngest, not via an HTTP route.
- **Pattern**: Before adding a sync type to any route-based config (self-healing, freshness guard), verify the HTTP route exists. Inngest-only syncs need separate handling.

### Zod `.passthrough()` breaks strict TypeScript types
- **Context**: Zod schemas with `.passthrough()` return `{ [x: string]: unknown; ...fields }`. This is incompatible with strict interfaces like `ProposalInfo[]` that `classifyProposals()` expects.
- **Fix**: Cast validated output: `validProposals as unknown as ProposalListResponse`. The Zod validation has already verified structural correctness.
- **Pattern**: When adding Zod validation to an existing typed pipeline, expect to need casts at consumption sites.

### PowerShell does not support heredoc syntax
- **Context**: `cat <<'EOF'` fails in PowerShell. Hit this when creating git commits and PRs with multi-line bodies.
- **Fix**: Write body to a temp file, use `--body-file`, then delete. Or use simple single-line messages.
- **Pattern**: Always use temp files for multi-line strings in PowerShell shell commands.

### DB CHECK constraints must match actual writes
- **Context**: `sync_log` had a CHECK constraint allowing only 3 sync types, but 7+ types were being written. SyncLogger silently caught the violation, leaving `v_sync_health` blind to most syncs.
- **Pattern**: When adding new enum-like values, always verify DB constraints allow them. Query: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'table_name'::regclass`.

### Railway deployments take 3-7 minutes
- **Context**: Polled `gh api .../status` every 60s. Took ~5 minutes for the build + deploy to complete.
- **Pattern**: After status shows `success`, also hit the actual new endpoint to confirm the new code is live. The status API can lag behind the actual deploy.

## 2026-03-01 — Session 9 Deploy Failures

### npm uninstall removes from all dependency sections
- **Context**: Installed `sharp` as devDep for icon generation, then ran `npm uninstall sharp`. This also removed `sharp` from production dependencies where it was already listed. Next.js needs sharp for image optimization — Railway deploy failed.
- **Pattern**: Never `npm uninstall` a package that exists in production deps. Use `npm uninstall --save-dev` if it's only in devDeps. Or better: use `npx` for one-time scripts to avoid touching dependencies at all.

### Static sitemap.ts with Supabase queries crashes Railway builds
- **Context**: `app/sitemap.ts` defaulted to static generation (`○`), meaning Next.js tries to prerender it at build time. Railway's build phase either lacks Supabase env vars or the query fails in the build container. Deploy failed silently.
- **Fix**: Add `export const dynamic = 'force-dynamic'` to sitemap.ts. Now it's `ƒ` (dynamic) — generated on request, not at build time.
- **Pattern**: Any `app/sitemap.ts` or `app/robots.ts` that queries a database MUST be force-dynamic. Static generation at build time will fail on CI/CD platforms that don't inject runtime env vars during the build phase.

### Always merge PR then deploy — don't skip steps
- **Context**: Completed all code, pushed, created PR, but didn't merge or deploy. The user had to ask.
- **Pattern**: The full workflow is: commit → push → create PR → merge PR → pull to main → push main → monitor deploy → verify live. Every step is mandatory. Don't stop at "PR created."

## 2026-03-02 — Session 12 (Constellation Hero)

### Next.js 16 cookies() returns a Promise
- **Context**: `cookies()` from `next/headers` is now async in Next.js 16. Must `await cookies()` before calling `.get()`.
- **Pattern**: Always `const cookieStore = await cookies()` in RSC.

### PowerShell mkdir doesn't accept -p flag
- **Context**: `mkdir -p dir1 dir2` fails in PowerShell. Use `New-Item -ItemType Directory -Force -Path dir1, dir2` instead.
- **Pattern**: Always use PowerShell-native commands. Don't assume bash flags work.

### useRef requires initial value in strict TS
- **Context**: `useRef<Type>()` without an argument causes TS error in strict mode. Pass `undefined` or `null`.
- **Pattern**: Always provide initial value: `useRef<Type>(null)` or `useRef<Type>(undefined)`.

## 2026-03-02 — Session 14 (Experience Architecture)

### Production domain is drepscore.io, NOT drepscore.com
- **Context**: `drepscore.com` DNS still points to Vercel (returns "deployment could not be found on Vercel"). The actual Railway production domain is `drepscore.io`.
- **Pattern**: Always use `drepscore.io` for production URLs. `drepscore.com` is stale/misconfigured.

### Never use VERCEL_URL — use BASE_URL from lib/constants.ts
- **Context**: Server-side fetch in `app/pulse/page.tsx` used `process.env.VERCEL_URL` as a fallback for constructing API URLs. This env var doesn't exist on Railway.
- **Pattern**: Always import `BASE_URL` from `@/lib/constants` (reads `NEXT_PUBLIC_SITE_URL`, falls back to localhost). Never reference Vercel-specific env vars.
- **Promoted to rule**: `architecture.md` — added "Platform Constraints (Railway, NOT Vercel)" section with explicit prohibitions and `BASE_URL` as canonical pattern.

### PowerShell heredoc (<<'EOF') doesn't work — use file-based commit messages
- **Context**: `git commit -m "$(cat <<'EOF' ... EOF)"` fails in PowerShell because heredocs are a bash feature.
- **Pattern**: Write commit message to `commit-msg.txt`, then `git commit -F commit-msg.txt`.

## 2026-03-02 — Session 15 (Hero Constellation Polish)

### Auto-deploy: don't stop at "code complete"
- **Context**: Implemented all 6 visual polish items, confirmed tsc passes, then stopped and summarized changes. User had to ask "why didn't you deploy?"
- **Pattern**: The Ship It Checklist exists in workflow.md. After the last code change compiles clean, run it immediately. No summary, no pause.
- **Promoted to rule**: Consolidated Deployment Protocol + Completion Protocol into a single numbered "Ship It Checklist" in workflow.md that's mechanical and impossible to skip.

### Branch check before writing code
- **Context**: Started coding directly on `main` instead of creating a feature branch. Had to create the branch retroactively before committing.
- **Pattern**: Always run `git branch --show-current` before the first edit. If on main, branch first.
- **Promoted to rule**: Added "Branch check (step 0)" as the first item in Build Phase in workflow.md.

### PowerShell: bash patterns tried first, then fixed — 5th occurrence
- **Context**: Tried heredoc for commit message, failed, then used file-based approach. Same pattern has now appeared 5 times across sessions.
- **Pattern**: Never attempt bash syntax. Use only the PowerShell patterns from the Shell Compatibility table in workflow.md.
- **Promoted to rule**: Rewrote Shell Compatibility section as a mandatory table of correct patterns with wrong patterns explicitly listed as "will fail."
