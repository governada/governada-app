---
name: ship
description: Execute the full deploy pipeline from current changes to production verification
---

Execute the full Governada deploy pipeline. Do NOT pause between steps.

1. `npm run preflight` -- fix ALL failures before proceeding
2. `npm run gh:auth-status`
3. `git branch --show-current` -- verify not on main (unless hotfix)
4. Audit new `app/` files for `force-dynamic` if they import Supabase/data
5. Stage relevant files with `git add`, commit with conventional commit message
6. `git push -u origin HEAD`
7. Create PR: `gh pr create -R governada/governada-app --title "<type>: <description>" --body "<summary>"`
8. Poll CI with `npm run ci:watch`. If it fails, inspect with `npm run ci:failed`, fix, push, re-check (max 3 attempts)
9. Pre-merge check: `npm run pre-merge-check -- <PR#>`
10. Merge: `gh api repos/governada/governada-app/pulls/<N>/merge -X PUT -f merge_method=squash`
11. Apply pending migrations via Supabase MCP `apply_migration`
12. If migrations applied: `npm run gen:types`, commit and push updated `types/database.ts`
13. **Verify production** — Railway auto-deploys from merge. **Always** launch `deploy-verifier` subagent in background (run_in_background: true). Do NOT wait for it — continue with cleanup or respond to the user. Report result when the notification arrives.
14. If Inngest functions changed: `curl -X PUT https://governada.io/api/inngest` then `npm run inngest:status`
15. Verify endpoints: `curl -s -o /dev/null -w "%{http_code}" https://governada.io/<path>` for each new/changed route
16. `npm run smoke-test`
17. If new analytics events: `npm run posthog:check <event>`
18. Clean up: if worktree, switch to main worktree to verify

Report final status only after ALL verification passes.

## PR Impact Template

Every PR description must include:

```
## Impact
- **What changed**: 1-2 sentences on the functional change
- **User-facing**: Yes/No + brief description of what users will see differently
- **Risk**: Low/Medium/High + rationale (e.g., "Low — styling only, no data changes")
- **Scope**: Files/modules touched, migrations, env vars, Inngest functions added/changed
```

After creating the PR, print this in the conversation:

```
--- PR Impact Recap ---
PR: #<number> <title>
What changed: <1-2 sentences>
User-facing: <Yes/No + detail>
Risk: <Low/Medium/High + rationale>
Scope: <files/modules touched>
URL: <PR URL>
-----------------------
```
