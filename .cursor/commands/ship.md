# Ship It

All code changes compile clean. Execute the full deploy pipeline autonomously. Do NOT pause between steps.

## Step 1: Create deploy todos

Before anything else, create these todos. The task is NOT complete until every todo is marked done:

```
TodoWrite (use exact IDs):
- ship-preflight → Verify gh auth (governada) + branch + force-dynamic audit
- ship-stage    → Stage files (targeted git add), review diff
- ship-commit   → Write msg to .git/COMMIT_MSG, git commit -F
- ship-push     → git push -u origin HEAD
- ship-pr       → Create PR (write body to .git/PR_BODY.md, --body-file)
- ship-ci       → Poll CI until green (gh pr checks --watch)
- ship-merge    → gh pr merge --squash --delete-branch --admin
- ship-deploy   → Monitor Railway deploy (~5 min after merge)
- ship-validate → Post-deploy: health + Inngest sync + smoke tests + feature verify
- ship-cleanup  → Delete local branch, check lessons, summary
```

## Step 2: Pre-flight

```powershell
gh auth status
# Must show governada. If not: npm run gh:auth-status
git branch --show-current
# Must NOT be main for features
```

Audit new `app/` files: any importing `@/lib/supabase` or `@/lib/data` needs `export const dynamic = 'force-dynamic'` (unless it's a `route.ts`).

## Step 3: Stage + commit

```powershell
git add <specific-files>
git diff --cached --stat
git diff --cached --name-only
# Verify: no .cursor/, commit-msg.txt, .env* staged
```

Write commit message to `.git/COMMIT_MSG` using Write tool, then:

```powershell
git commit -F .git/COMMIT_MSG
```

## Step 4: Push + PR

```powershell
git push -u origin HEAD
```

Write PR body to `.git/PR_BODY.md` using Write tool, then:

```powershell
gh pr create --title "feat: description" --body-file .git/PR_BODY.md --base main
```

## Step 5: CI monitoring

```powershell
gh pr checks <number> --watch
# Or manual poll:
Start-Sleep -Seconds 30 ; gh pr checks <number>
```

If CI fails: `gh run view <id> --log-failed` → fix → commit → push → re-monitor. Max 3 retries before escalating.

Branch protection requires: `type-check`, `lint`, `test`, `build` — ALL must pass.

## Step 6: Merge

```powershell
gh pr merge <number> --squash --delete-branch --admin
```

If rebase needed: `git fetch origin main ; git rebase origin/main ; git push --force-with-lease`. This re-triggers CI.

## Step 7: Deploy validation

Wait ~5 min after merge for Railway to build + deploy.

```powershell
# Poll CI on main
$run = (gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
Start-Sleep -Seconds 60 ; gh run view $run --json conclusion --jq '.conclusion'
# Repeat every 60s until 'success'
```

```powershell
# Health check
Invoke-WebRequest -Uri "https://governada.io/api/health" -UseBasicParsing | Select-Object StatusCode

# Inngest sync
Invoke-WebRequest -Uri "https://governada.io/api/inngest" -Method PUT -UseBasicParsing

# Smoke tests
npm run smoke-test
```

Hit at least one changed endpoint/page on `governada.io` to verify the new code is live.

## Step 8: Cleanup

```powershell
git checkout main ; git pull ; git branch -D <branch-name>
git stash list
# Drop any stashes from this session
```

Update `tasks/lessons.md` if anything was learned. Concise summary to user.

---

**CRITICAL: Do NOT send a completion summary until ship-validate is done. Pushing code is step 4 of 10 — it is not "done."**
