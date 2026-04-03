All code changes compile clean. Execute the full deploy pipeline autonomously. Do NOT pause between steps.

## Sequence

1. **Preflight**: `npm run preflight:quick *>&1 | Select-Object -Last 5` — fix ALL failures. Uses `test:changed` for speed; CI runs full suite.
2. **Auth check**: `npm run gh:auth-status` — must show governada and `Repo context: governada/governada-app`
3. **Branch check**: `git branch --show-current` — must NOT be main for features
4. **Force-dynamic audit**: Any new `app/` file importing `@/lib/supabase` or `@/lib/data` needs `export const dynamic = 'force-dynamic'`
5. **Stage + commit**: `git add <specific-files>` → review with `git diff --cached --name-only` → commit
6. **Push**: `git push -u origin HEAD`
7. **PR**: `gh pr create -R governada/governada-app --title "feat: description" --body-file PR_BODY.md --base main` → delete PR_BODY.md. PR body MUST include these sections (per CLAUDE.md hygiene rules + build-on-existing):

   ```markdown
   ## Summary

   [1-3 bullet points]

   ## Existing Code Audit

   - **Searched for**: [concepts/patterns you looked for]
   - **Found**: [existing implementations, or "nothing similar"]
   - **Decision**: [extended existing / created new because ...]

   ## Robustness

   - [ ] Error states handled
   - [ ] Loading states meaningful
   - [ ] Empty states guide users
   - [ ] Edge cases considered
   - [ ] Mobile verified (if UI)

   ## Impact

   - **What changed**: [1-2 sentences]
   - **User-facing**: Yes/No + detail
   - **Risk**: Low/Medium/High + rationale
   - **Scope**: Files/modules touched
   ```

8. **CI**: Wait for CI with minimal context consumption: `npm run ci:watch`
   If fails, see [CI Failure Recovery](#ci-failure-recovery) below (max 3 retries)
9. **Pre-merge check**: `npm run pre-merge-check -- <PR#>` — includes Sentry error rate gate
10. **Merge**: `gh api repos/governada/governada-app/pulls/<N>/merge -X PUT -f merge_method=squash`
11. **Migrations**: If migrations needed, test on Supabase branch first (see `.claude/rules/migration-safety.md`), then apply via Supabase MCP `apply_migration` → `npm run gen:types`
12. **Post-merge verification** (background — do NOT block):
    ```
    Agent(subagent_type="deploy-verifier", run_in_background=true,
      prompt="PR #N merged. Run: npm run deploy:verify. If Inngest functions changed, run: npm run deploy:verify -- --register-inngest")
    ```
    Continue immediately to step 13 without waiting.
13. **Update tracking docs**: If this PR adds features, fixes scoring, changes counts:
    - Update `docs/strategy/context/build-manifest.md` — check off items, add new `[x]` entries with PR #
    - Update `CLAUDE.md` if counts changed
    - Commit doc updates as follow-up on main
14. **Cleanup**: Switch to main, pull, delete local branch (`git branch -d <branch>`), drop stashes
15. **Report**: Print PR Impact Recap. Note that deploy verification is running in background.

**IMPORTANT: For high-risk changes (scoring, matching, delegation, data migrations), use `/ship-careful` instead.**

**When the deploy-verifier subagent completes, check its result. If it failed, run `npm run rollback` immediately.**

## Rollback

If smoke test or health check fails after merge:

1. Run `npm run rollback` — auto-detects, reverts, verifies, creates issue
2. With git revert: `npm run rollback -- --revert-commit`
3. Notify: script auto-sends Discord/Telegram alert

## CI Failure Recovery

When CI fails:

`npm run ci:failed`

| Failure        | Fix                                                                |
| -------------- | ------------------------------------------------------------------ |
| **format**     | `npx prettier --write <file>`, commit, push                        |
| **lint**       | Read error, fix code, commit, push                                 |
| **type-check** | Read error, fix types, commit, push                                |
| **test**       | `npx vitest run <test-file>` locally, fix, commit, push            |
| **build**      | Usually missing `force-dynamic`. Check error, add it, commit, push |

After fixing, run these as separate commands:
`git add <files>`
`git commit -m "fix: resolve CI failure"`
`git push`
CI re-runs automatically. Re-watch with `npm run ci:watch`.

If stuck after 3 attempts, escalate to the user with the exact error message.
