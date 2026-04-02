Monitor CI and verify deployment. Optimized for minimal context consumption.

## Branch CI (before merge)

Use `gh run watch` — prints only status changes, not full table every 10s:

```bash
RUN_ID=$(gh run list --branch $(git branch --show-current) --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch $RUN_ID --exit-status
```

If CI failed, read only the tail of failed logs:

```bash
gh run view $RUN_ID --log-failed 2>&1 | tail -20
```

Branch protection requires: `build` (which depends on `checks` + `test`).
Max 3 retries before escalating.

## Post-Merge Verification

**Always use the deploy-verifier subagent in background.** Do NOT block on this:

```
Agent(subagent_type="deploy-verifier", run_in_background=true,
  prompt="PR #N merged. Wait 180s, then: npm run smoke-test -- --quiet && node scripts/uptime-check.mjs deploy")
```

The unified `smoke-test --quiet` subsumes health checks, response time assertions, and data integrity validation. Only failures are printed.

The `post-deploy.yml` GitHub Action also runs automatically as a second safety net.

If deploy-verifier reports failure: run `node scripts/rollback.mjs --revert-commit`, then use the Railway dashboard rollback if production needs immediate recovery.
