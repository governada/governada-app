# Ship

Use `AGENTS.md` and `.agents/skills/ship/SKILL.md` as the canonical workflow. This command is a Claude adapter, not a second source of truth.

Execute routine reads, edits, checks, commits, branch publication, PR preparation, and CI monitoring autonomously. Pause only for explicit approval gates such as merge, production mutations, secret/admin changes, or scope expansion.

## Sequence

1. `npm run session:guard`
2. Run relevant local verification, including `npm run agent:validate`
3. Apply the brain freshness rule from `AGENTS.md`
4. Stage only intended files, review the staged diff, and commit
5. `npm run github:runtime-doctor` when runtime state is uncertain
6. `npm run github:ship-doctor`
7. Publish through the brokered lane:

   ```bash
   npm run github:ship -- publish --head <branch> --execute --confirm github.ship.pr
   ```

   Use direct `git push` only as a documented fallback when the brokered lane cannot support the change class.

8. Create, update, or ready the PR through `npm run github:pr-write`, not direct GitHub CLI PR creation or `pr:ready`
9. `npm run ci:watch`
10. `npm run pre-merge-check -- <PR#>`
11. `npm run github:merge-doctor -- --pr <PR#> --expected-head <40-char-sha>`
12. Pause for Tim's exact chat approval:

    ```text
    I approve github.merge for governada/app PR #<PR#> if CI checks are green and the head SHA remains unchanged at <40-char-sha>.
    ```

13. Merge only through:

    ```bash
    npm run github:merge -- --pr <PR#> --expected-head <40-char-sha> --execute --confirm github.merge --approval-file <approval-file>
    ```

14. Let `github:merge` complete synchronous deploy verification. Run extra `deploy:verify`, `smoke-test`, or route checks only when the change warrants extra evidence.
15. `npm run session:guard`
16. Report final status only after verification passes or a named blocker remains.

## PR Body

PR body MUST include these sections:

```markdown
## Summary

## Existing Code Audit

## Robustness

## Impact

## Brain Freshness

## Review Gate v0
```

The Review Gate v0 section must record the review tier, completed status, and findings/resolution. Run the review while the PR is still draft when practical. Do not ready a PR for merge with Review Gate wording that says the independent review is pending or still needs to run. If review completes after the PR is already ready, `github:pr-write update` allows only a body-only completed Review Gate v0 update.

**IMPORTANT:** For high-risk changes, use `/ship-careful` to plan the rollout and approval gates, then return to this canonical ship path.

## Rollback

If smoke test or health check fails after merge:

1. Treat it as a human-present incident.
2. Run `npm run rollback -- --dry-run` for diagnosis.
3. Use `npm run rollback -- --revert-commit` only to prepare a revert PR.
4. Immediate Railway rollback is a platform mutation and requires Tim's explicit approval/action.

## CI Failure Recovery

When CI fails:

`npm run ci:failed`

| Failure        | Fix                                                                     |
| -------------- | ----------------------------------------------------------------------- |
| **format**     | `npx prettier --write <file>`, commit, republish                        |
| **lint**       | Read error, fix code, commit, republish                                 |
| **type-check** | Read error, fix types, commit, republish                                |
| **test**       | `npx vitest run <test-file>` locally, fix, commit, republish            |
| **build**      | Usually missing `force-dynamic`. Check error, add it, commit, republish |

After fixing, run these as separate commands:

```bash
git add <files>
git commit -m "fix: resolve CI failure"
npm run github:ship -- publish --head <branch> --execute --confirm github.ship.pr
npm run ci:watch
```

If stuck after 3 attempts, escalate to the user with the exact error message.
