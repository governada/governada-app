---
name: ship
description: Execute the full deploy pipeline from current changes to production verification
---

Execute the full Governada deploy pipeline. Do NOT pause between steps.

1. `npm run preflight` -- fix ALL failures before proceeding
2. `gh auth switch --user drepscore`
3. `git branch --show-current` -- verify not on main (unless hotfix)
4. Audit new `app/` files for `force-dynamic` if they import Supabase/data
5. Stage relevant files with `git add`, commit with conventional commit message
6. `git push -u origin HEAD`
7. Create PR: `gh pr create --title "<type>: <description>" --body "<summary>"`
8. Poll CI: `gh pr checks <N> --watch` -- if fails, read logs, fix, push, re-check (max 3 attempts)
9. Pre-merge check: `bash scripts/pre-merge-check.sh <PR#>`
10. Merge: `gh api repos/governada/governada-app/pulls/<N>/merge -X PUT -f merge_method=squash`
11. Apply pending migrations via Supabase MCP `apply_migration`
12. If migrations applied: `npm run gen:types`, commit and push updated `types/database.ts`
13. **Verify production directly** — Railway auto-deploys from merge, do NOT watch CI on main or poll `railway logs`. Wait ~3 min, then `curl -s https://governada.io/api/health`. Use `deploy-verifier` subagent in background if preferred.
14. If Inngest functions changed: `curl -X PUT https://governada.io/api/inngest` then `npm run inngest:status`
15. Verify endpoints: `curl -s -o /dev/null -w "%{http_code}" https://governada.io/<path>` for each new/changed route
16. `npm run smoke-test`
17. If new analytics events: `npm run posthog:check <event>`
18. Clean up: if worktree, switch to main worktree to verify

Report final status only after ALL verification passes.
