---
name: ship
description: Execute the governed Governada ship loop from committed changes to verified production
---

Execute the routine Governada ship loop autonomously until a real approval gate is reached. Do not use archived broker, Keychain, LaunchAgent, `github:*`, `pr:ready`, or `pr:merge` lanes.

## Canonical Sequence

1. Run `npm run session:guard`. Treat failure as a blocker.
2. Confirm the work is on a feature worktree/branch, not the shared `main` checkout. Hotfixes still use the PR path unless Tim explicitly approves a direct-main emergency bypass.
3. Run the relevant local verification for the change, including `npm run agent:validate`.
4. Apply the brain freshness rule from `AGENTS.md`. Feature or meaningful behavior work must update the relevant brain feature, initiative, roadmap, or decision note before closeout.
5. Stage only intended files, review the staged diff, and commit with a conventional commit message.
6. Run `npm run gh:auth-status` when git auth state is uncertain.
7. Publish the committed branch through SSH + 1Password:

   ```bash
   git push -u origin <current-branch>
   ```

8. Open or update the PR through the GitHub app connector or normal GitHub UI. Do not recreate the archived repo-level GitHub broker wrappers.
9. Watch CI in GitHub Actions. If it fails, inspect the failing job, fix, commit, push, and re-check. Escalate after 3 failed fix attempts.
10. Pause for Tim's exact chat approval:

```text
I approve merging governada/app PR #<PR#> if CI checks are green and the head SHA remains unchanged at <40-char-sha>.
```

11. Merge through the normal GitHub PR merge path only after approval.
12. Run `npm run health:verify` or `npm run smoke-test` when post-merge or deploy evidence is needed.
13. Run `npm run session:guard` before final closeout.

## PR Body Requirements

Feature PRs must include:

```markdown
## Summary

## Existing Code Audit

## Robustness

## Impact

## Brain Freshness

## Review Gate v0
```

The Review Gate v0 section must record the review tier, completed status, and findings/resolution. Run the review while the PR is still draft when practical. Do not ready a PR for merge with Review Gate wording that says the independent review is pending or still needs to run.

## Production Mutation Boundaries

- Supabase migrations, production data writes, secret changes, credential rotation, Railway deploy mutations, branch protection/admin changes, billing/admin changes, and GitHub App permission changes require explicit approval.
- Inngest registration is a deploy/runtime mutation. Use `npm run inngest:register -- <base-url>` only after explicit approval.
- Rollback preparation may create a revert PR, but immediate Railway rollback remains a human-present platform action in Phase 0B.

## Final Recap

Report the PR number, branch, head SHA, checks run, deploy verification result, and brain freshness status. Do not report a ship as complete until production verification has passed or a clearly named blocker remains.
