The user said "hotfix." Execute the full fix-to-production pipeline autonomously. Do NOT pause between steps.

Work directly on `main` (no branch/PR needed for single-commit hotfixes).

## Sequence

1. **Fix the bug** on main
2. **Stage ONLY bug fix files**: `git add <specific-fix-files>` → verify with `git diff --cached --name-only`
3. **Commit + push**: `git commit` with `fix:` prefix → `git push origin main`
4. **Monitor CI**: Poll `gh run list --branch main --limit 1` every 30s until green. If fails: read logs, fix, re-push
5. **Railway deploy**: Wait ~5 min, poll until status shows success
6. **Validate**: Health check (`/api/health`), smoke test, hit the fixed endpoint on `drepscore.io`
7. **Report**: Concise summary — what shipped, deploy time, validation results

**CRITICAL: Do NOT send a summary until post-deploy validation passes. Pushing to main is step 3 of 7.**

## When NOT to use hotfix path

If the change touches auth/security, scoring model, or database schema, push back and recommend the PR path.
