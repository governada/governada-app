Monitor the CI pipeline and Railway deployment until fully validated.

## Branch CI (before merge)

**IMPORTANT: Never stream `gh pr checks --watch` in the foreground.** It dumps the full table every 10 seconds and wastes thousands of context tokens.

Instead:

```bash
# Run in background (set run_in_background: true)
gh pr checks <pr-number> --watch
```

When the background task completes, take a single snapshot:

```bash
gh pr checks <pr-number>
```

If CI failed, read only the relevant logs:

```bash
gh run list --branch <branch> --limit 1 --json databaseId --jq '.[0].databaseId'
gh run view <run-id> --log-failed 2>&1 | tail -50
```

Branch protection requires ALL of: `type-check`, `lint`, `test`, `build`.
If CI fails: read the error, fix, commit, push. Max 3 retries before escalating.

## Post-Merge Verification

Railway auto-deploys on push to main independently of CI. Do NOT watch CI on main or poll `railway logs` — verify production directly:

**Always use the `deploy-verifier` subagent in the background after merge.** It handles all verification autonomously:

```
Agent(subagent_type="deploy-verifier", run_in_background=true, prompt="PR #N merged. Verify health + changed routes.")
```

If you must verify manually:

1. Wait ~3 min after merge for Railway Docker build
2. Health check: `curl -s https://governada.io/api/health` — expect `"status":"healthy"`
3. Inngest sync: `curl -X PUT https://governada.io/api/inngest` (if functions changed)
4. Smoke tests: `npm run smoke-test`

If ANY check fails: investigate, fix, push follow-up commit. Never report "done" until all checks pass.
