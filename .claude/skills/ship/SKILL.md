---
name: ship
description: Execute the full deploy pipeline from current changes to production verification
disable-model-invocation: true
---

Execute the full Civica deploy pipeline. Do NOT pause between steps.

1. `npm run preflight` -- fix ALL failures before proceeding
2. `gh auth switch --user drepscore`
3. `git branch --show-current` -- verify not on main (unless hotfix)
4. Audit new `app/` files for `force-dynamic` if they import Supabase/data
5. Stage relevant files with `git add`, commit with conventional commit message
6. `git push -u origin HEAD`
7. Create PR: `gh pr create --title "<type>: <description>" --body "<summary>"`
8. Poll CI: `gh pr checks <N> --watch` -- if fails, read logs, fix, push, re-check (max 3 attempts)
9. Merge: `gh api repos/drepscore/drepscore-app/pulls/<N>/merge -X PUT -f merge_method=squash`
10. Apply pending migrations via Supabase MCP `apply_migration`
11. If migrations applied: `npm run gen:types`, commit and push updated `types/database.ts`
12. Monitor Railway: poll `railway logs` until deploy completes (~3-7 min)
13. If Inngest functions changed: `curl -X PUT https://drepscore.io/api/inngest` then `npm run inngest:status`
14. Verify endpoints: `curl -s -o /dev/null -w "%{http_code}" https://drepscore.io/<path>` for each new/changed route
15. `npm run smoke-test`
16. If new analytics events: `npm run posthog:check <event>`
17. Clean up: if worktree, switch to main worktree to verify

Report final status only after ALL verification passes.
