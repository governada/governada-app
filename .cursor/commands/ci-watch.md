# CI + Deploy Watch

Monitor the CI pipeline and Railway deployment until fully validated.

## CI Monitoring (branch or PR)

```powershell
# Watch PR checks until complete
gh pr checks <pr-number> --watch

# Or manual poll
Start-Sleep -Seconds 30 ; gh pr checks <pr-number>

# If failed — read logs
gh run list --branch <branch> --limit 1 --json databaseId --jq '.[0].databaseId'
gh run view <run-id> --log-failed
```

Branch protection requires ALL of: `type-check`, `lint`, `test`, `build`.

If CI fails: read the error, fix, commit, push. Max 3 retries before escalating to user.

## Railway Deploy Monitoring (after merge to main)

Railway auto-deploys on push to main. Docker build takes ~5 min total.

```powershell
# Poll CI on main
$run = (gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
Start-Sleep -Seconds 60 ; gh run view $run --json conclusion --jq '.conclusion'
# Repeat every 60s until 'success'
```

CI green does NOT mean deployed — Railway builds independently. Budget 5 min after CI passes.

## Post-Deploy Validation (ALL mandatory)

```powershell
# 1. Health check — expect 200
Invoke-WebRequest -Uri "https://governada.io/api/health" -UseBasicParsing | Select-Object StatusCode

# 2. Inngest function sync — expect 200
Invoke-WebRequest -Uri "https://governada.io/api/inngest" -Method PUT -UseBasicParsing

# 3. Smoke tests
npm run smoke-test

# 4. Feature-specific — hit the changed page or endpoint
Invoke-WebRequest -Uri "https://governada.io/<changed-route>" -UseBasicParsing
```

If ANY check fails: investigate, fix, push follow-up commit. Never report "done" until all 4 pass.

## Deploy failure triage

1. Check if failure is pre-existing: `git stash ; npx next build --webpack 2>&1 | Select-String "Build error" ; git stash pop`
2. If pre-existing: note it, proceed with workaround
3. If yours: fix, commit, push, re-monitor
4. Empty retrigger commit (last resort): `git commit --allow-empty -m "chore: retrigger deploy" ; git push`
