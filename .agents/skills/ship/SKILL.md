---
name: ship
description: Execute the governed Governada ship loop from committed changes to verified production
---

Execute the routine Governada ship loop autonomously until a real approval gate is reached. Do not use legacy direct GitHub CLI PR creation, `pr:ready`, `pr:merge`, direct main pushes, or background deploy-verifier flows as the normal path.

## Canonical Sequence

1. Run `npm run session:guard`. Treat failure as a blocker.
2. Confirm the work is on a feature worktree/branch, not the shared `main` checkout. Hotfixes still use the PR path unless Tim explicitly approves a direct-main emergency bypass.
3. Run the relevant local verification for the change, including `npm run agent:validate`.
4. Apply the brain freshness rule from `AGENTS.md`. Feature or meaningful behavior work must update the relevant brain feature, initiative, roadmap, or decision note before closeout.
5. Stage only intended files, review the staged diff, and commit with a conventional commit message.
6. Run `npm run github:runtime-doctor` when auth/runtime state is uncertain.
7. Run `npm run github:ship-doctor`.
8. Publish the committed branch through the brokered lane:

   ```bash
   npm run github:ship -- publish --head <current-branch> --execute --confirm github.ship.pr
   ```

   Use direct `git push` only as a documented fallback when the brokered lane cannot support the change class, such as workflow-file permission gaps.

9. Create, update, or ready the PR through the bounded PR-write lane:

   ```bash
   npm run github:pr-write -- create --head <branch> --title "<title>" --body-file <file> --execute --confirm github.write.pr
   npm run github:pr-write -- update --pr <PR#> --body-file <file> --execute --confirm github.write.pr
   npm run github:pr-write -- ready --pr <PR#> --execute --confirm github.write.pr
   ```

10. Watch CI with `npm run ci:watch`. If it fails, inspect with `npm run ci:failed`, fix, commit, republish, and re-check. Escalate after 3 failed fix attempts.
11. Run `npm run pre-merge-check -- <PR#>`.
12. Run `npm run github:merge-doctor -- --pr <PR#> --expected-head <40-char-sha>`.
13. Pause for Tim's exact chat approval:

    ```text
    I approve github.merge for governada/app PR #<PR#> if CI checks are green and the head SHA remains unchanged at <40-char-sha>.
    ```

14. Merge only through the brokered merge lane:

    ```bash
    npm run github:merge -- --pr <PR#> --expected-head <40-char-sha> --execute --confirm github.merge --approval-file <approval-file>
    ```

15. Let `github:merge` run synchronous post-merge deploy verification. Run `npm run deploy:verify` or `npm run smoke-test` separately only when extra evidence is needed.
16. Run `npm run session:guard` before final closeout.

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

The Review Gate v0 section must record the review tier, completed status, and findings/resolution. Run the review while the PR is still draft when practical. Do not ready a PR for merge with Review Gate wording that says the independent review is pending or still needs to run. If review completes after the PR is already ready, `github:pr-write update` allows only a body-only completed Review Gate v0 update.

## Production Mutation Boundaries

- Supabase migrations, production data writes, secret changes, credential rotation, Railway deploy mutations, branch protection/admin changes, billing/admin changes, and GitHub App permission changes require explicit approval.
- Inngest registration is a deploy/runtime mutation. Use `npm run inngest:register -- <base-url>` only after explicit approval.
- Rollback preparation may create a revert PR, but immediate Railway rollback remains a human-present platform action in Phase 0B.

## Final Recap

Report the PR number, branch, head SHA, checks run, deploy verification result, and brain freshness status. Do not report a ship as complete until production verification has passed or a clearly named blocker remains.
