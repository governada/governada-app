All code changes compile clean. Execute the full deploy pipeline autonomously. Do NOT pause between steps.

## Sequence

1. **Preflight**: `npm run preflight` — fix ALL failures
2. **Auth check**: `gh auth status` — must show drepscore. If not: `gh auth switch --user drepscore`
3. **Branch check**: `git branch --show-current` — must NOT be main for features
4. **Force-dynamic audit**: Any new `app/` file importing `@/lib/supabase` or `@/lib/data` needs `export const dynamic = 'force-dynamic'`
5. **Stage + commit**: `git add <specific-files>` → review with `git diff --cached --name-only` → commit
6. **Push**: `git push -u origin HEAD`
7. **PR**: `gh pr create --title "feat: description" --body-file PR_BODY.md --base main` → delete PR_BODY.md
8. **CI**: `gh pr checks <N> --watch` — if fails, read logs, fix, push, re-monitor (max 3 retries)
9. **Merge**: `gh pr merge <N> --squash --delete-branch` (or `gh api .../merge` from worktrees)
10. **Migrations**: Apply pending via Supabase MCP `apply_migration` → `npm run gen:types`
11. **Deploy monitor**: Wait ~5 min, poll Railway until deployed, verify health endpoint returns 200
12. **Inngest sync**: PUT `https://governada.io/api/inngest` if functions changed → `npm run inngest:status`
13. **Smoke test**: Hit new/changed endpoints on `governada.io`, run `npm run smoke-test`
14. **Analytics**: `npm run posthog:check <event>` if new events
15. **Update tracking docs**: If this PR adds features, fixes scoring, changes counts (routes, components, functions), or ships a QP/step:
    - Update `docs/strategy/context/build-manifest.md` — check off items, add new `[x]` entries with PR #, update counts
    - Update `CLAUDE.md` if counts changed (Inngest functions, key files, etc.)
    - Commit doc updates in the same PR or as a follow-up commit on main
16. **Cleanup**: Switch to main, pull, delete local branch (`git branch -d <branch>`), drop any stashes from the branch (`git stash list` → `git stash drop`)

**CRITICAL: Do NOT send a completion summary until deploy validation passes. Pushing code is step 6 of 16 — it is not "done."**
