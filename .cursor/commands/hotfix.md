# Hotfix

The user said "hotfix." Execute the full fix-to-production pipeline autonomously. Do NOT pause between steps.

## Step 0: Create todos (MANDATORY)

Before writing any code, create todos for EVERY phase. The hotfix is NOT complete until every todo is done.

```
TodoWrite (use exact IDs):
- hotfix-fix      → Fix the bug on main
- hotfix-commit   → Stage bug fix files only, commit, push to main
- hotfix-ci       → Monitor CI until green
- hotfix-deploy   → Wait for Railway deploy (~5 min), confirm success
- hotfix-validate → Post-deploy: health + smoke tests + feature verify
- hotfix-report   → Report results to user
```

## Step 1: Fix the bug

Work directly on `main` (hotfixes are direct-to-main, no branch/PR). Mark `hotfix-fix` complete.

## Step 2: Commit + push

Stage ONLY bug fix files — never docs, cursor rules, or unrelated changes.

```powershell
git add <specific-fix-files>
git diff --cached --name-only
```

Write commit message to `.git/COMMIT_MSG` (prefix with `fix:`), then:

```powershell
git commit -F .git/COMMIT_MSG
git push origin main
```

Mark `hotfix-commit` complete.

## Step 3: Monitor CI

```powershell
gh run list --branch main --limit 1 --json databaseId,conclusion --jq '.[0]'
# Poll every 30s until conclusion is 'success' or 'failure'
```

If failure: `gh run view <id> --log-failed` → fix → re-push. Mark `hotfix-ci` complete.

## Step 4: Railway deploy

Wait ~5 min after push.

```powershell
Start-Sleep -Seconds 120
$sha = (git rev-parse HEAD)
gh api repos/governada/governada-app/commits/$sha/status --jq '.statuses[] | {state, description}'
# Repeat every 60s until state is 'success'
```

If failure: push empty retrigger commit. Mark `hotfix-deploy` complete.

## Step 5: Validate

```powershell
Invoke-WebRequest -Uri "https://governada.io/api/health" -UseBasicParsing | Select-Object StatusCode
npm run smoke-test
```

Hit the fixed page/endpoint on `governada.io`. Mark `hotfix-validate` complete.

## Step 6: Report

Concise summary: what shipped, deploy time, validation results. Mark `hotfix-report` complete.

---

**CRITICAL: Do NOT send a summary until hotfix-validate is complete. Pushing to main is step 2 of 6 — it is not "done."**

## When NOT to use hotfix path

If the change touches auth/security, scoring model, or database schema, push back and recommend the PR path even if the user says "hotfix."
