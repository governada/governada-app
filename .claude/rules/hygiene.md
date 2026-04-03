---
paths:
  - '**'
---

# Agent Hygiene Rules

## Branch Hygiene

- **Always start from fresh origin/main.** For worktrees, prefer `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>` so feature branches land in `.claude/worktrees/<name>` inside the repo sandbox. Raw git is `git worktree add .claude/worktrees/<name> -b feat/<name> origin/main`. Never develop on a stale or leftover branch. The sync-worktree hook auto-fast-forwards local main, but always specify `origin/main` as the start point.
- **Clean up after yourself.** When a worktree session is complete and the PR is merged, remove the worktree.
- **Delete local branches after merge.** `gh pr merge --squash --delete-branch` only deletes the remote branch. Follow up with `git branch -d <branch>` locally. Use `-D` if squash-merged.
- **Prune remotes at session start.** Run `git fetch --prune` to remove stale remote tracking refs.
- **Drop stashes after merge.** Don't let stashes accumulate from merged branches.
- **Verify branch freshness.** If resuming work, check `git log --oneline origin/main..HEAD` -- if >10 commits behind, rebase first.

## Commit Hygiene

- **Don't leave uncommitted changes.** Before ending a session, either commit work-in-progress or explicitly note what's uncommitted and why.
- **Update tracking docs.** When shipping a step/WP/QP, update status in the relevant tracking doc (build-manifest.md) in the same PR.

## PR Impact Summary

Every PR must include an **## Impact** section (what changed, user-facing Y/N, risk level, scope). See `/ship` skill for the full template. After creating the PR, print a boxed recap in conversation: PR number, title, what changed, user-facing detail, risk, scope, URL.

## Documentation Formatting

- **Sequential numbering.** Ordered lists must use correct sequential numbers (1, 2, 3...). Never duplicate a number. Verify the full sequence after inserting items.
- **Use Edit tool for markdown files, never sed.** `sed` on markdown causes numbering errors and orphaned formatting.
- **Validate tables.** Markdown tables must have matching column counts across header, separator, and all rows.
- **Preserve heading hierarchy.** Don't skip heading levels (e.g., `##` to `####`).
- **No trailing whitespace or orphaned markers.**

## Workspace Cleanup

- **Run `npm run session:doctor` at the start of major sessions** to inspect branch status, worktrees, stashes, and session files before planning.
- **Run `npm run cleanup` at the start of major sessions** when you need to detect stale worktrees, orphaned directories, stale branches, and uncommitted changes.
- **Run `npm run docs:doctor` during hygiene passes** to detect stale manifest state, CLAUDE count drift, and registry mismatch.
- **Don't accumulate worktrees.** Remove promptly after PR merge.
- **Run `npm run cleanup:clean` periodically** to auto-delete branches whose remote is gone.

## CI Watching

**NEVER** stream `gh pr checks --watch` in the foreground — it polls every 10 seconds and dumps the full status table each time, consuming thousands of tokens with no new information.

Set `run_in_background: true` on the Bash call. When the notification arrives, take a single snapshot:

```bash
gh pr checks <N>  # single snapshot of final status
```

If CI fails: `npm run ci:failed`

## Deploy Verification

**ALWAYS** run the `deploy-verifier` subagent in the background after merge. Do NOT wait for its result before continuing other work or responding to the user.

```
Agent(subagent_type="deploy-verifier", run_in_background=true, ...)
```

Report the result in 1-2 sentences when the notification arrives. Do not dump the full output.

## Research & File Reading

- Read files directly with the Read tool when checkpoint/plan files list specific files to modify. Do NOT spawn Explore agents to re-discover known paths.
- Only use Explore for genuinely unknown territory.
- When you need type signatures or component props from files you've already read, note them in the checkpoint — don't re-read.

## Checkpoint Enrichment

When writing checkpoint files for handoff, include: key type signatures and hook return shapes, component prop interfaces, and any non-obvious patterns discovered. This saves the next agent from re-reading 10+ files to rediscover the same information.
