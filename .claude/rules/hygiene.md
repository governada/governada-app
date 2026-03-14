---
paths:
  - '**'
---

# Agent Hygiene Rules

## Branch Hygiene

- **Always start from fresh main.** Before any development: `git checkout main && git pull origin main && git checkout -b feat/<name>`. Never develop on a stale or leftover branch.
- **Clean up after yourself.** When a worktree session is complete and the PR is merged, remove the worktree. Don't leave stale branches around.
- **Delete local branches after merge.** `gh pr merge --squash --delete-branch` only deletes the remote branch. Always follow up with `git branch -d <branch>` locally. The squash commit SHA differs from the branch commits, so use `-D` if `-d` complains about unmerged work you know was squash-merged.
- **Prune remotes at session start.** Run `git fetch --prune` to remove stale remote tracking refs. The cleanup script does this automatically.
- **Drop stashes after merge.** If you stashed work-in-progress for a branch that's now merged, drop those stashes. Don't let stashes accumulate.
- **Verify branch freshness.** If resuming work in an existing worktree, check `git log --oneline origin/main..HEAD` -- if >10 commits behind, rebase first.

## Context Efficiency

- **Prefer context slices over monolith docs.** When you need product context:
  - Build status/audit: read `docs/strategy/context/build-manifest.md` (~180 lines)
  - Persona requirements: read `docs/strategy/context/persona-quick-ref.md` (~60 lines)
  - Audit scoring: read `docs/strategy/context/audit-rubric.md` (~180 lines)
  - Work plan structure: read `docs/strategy/context/work-plan-template.md` (~80 lines)
  - Competitive intelligence: read `docs/strategy/context/competitive-landscape.md` (~150 lines)
  - UX standards & design principles: read `.claude/rules/product-vision.md` (~54 lines)
  - Full persona UX specs: read `docs/strategy/personas/[persona].md`
  - Only read `docs/strategy/ultimate-vision.md` (952 lines) when updating the vision itself or doing a deep strategic audit
- **Rules files are self-sufficient.** The `.claude/rules/product-strategy.md` contains all principles needed for most feature decisions. Don't read the full vision doc "just in case."

## PR Impact Summary

Every PR must include an impact summary -- both in the GitHub description and in the Claude Code conversation.

### In the PR description (`gh pr create --body`)

Include an **## Impact** section after the standard summary:

```
## Impact
- **What changed**: 1-2 sentences on the functional change
- **User-facing**: Yes/No + brief description of what users will see differently
- **Risk**: Low/Medium/High + rationale (e.g., "Low -- styling only, no data changes")
- **Scope**: Files/modules touched, migrations, env vars, Inngest functions added/changed
```

### In Claude Code (conversation output)

After creating the PR, print a boxed recap:

```
--- PR Impact Recap ---
PR: #<number> <title>
What changed: <1-2 sentences>
User-facing: <Yes/No + detail>
Risk: <Low/Medium/High + rationale>
Scope: <files/modules touched>
URL: <PR URL>
-----------------------
```

This lets the founder quickly assess whether to review now or later, and creates a searchable record in PR history.

## Commit Hygiene

- **Don't leave uncommitted changes.** Before ending a session, either commit work-in-progress or explicitly note what's uncommitted and why.
- **Update tracking docs.** When shipping a step/WP/QP, update status in the relevant tracking doc (work-packages.md, world-class-packages.md, build-manifest.md) in the same PR.

## Documentation Formatting

- **Sequential numbering.** Ordered lists must use correct sequential numbers (1, 2, 3...). Never duplicate a number. After inserting or appending items, verify the full sequence.
- **Use Edit tool for markdown files, never sed.** `sed` on markdown causes numbering errors, encoding issues, and orphaned formatting. Always use the Edit tool or Write tool for documentation changes.
- **Validate tables.** Markdown tables must have matching column counts across header, separator, and all rows. Verify pipe alignment after edits.
- **Preserve heading hierarchy.** Don't skip heading levels (e.g., `##` to `####`). Maintain consistent nesting.
- **No trailing whitespace or orphaned markers.** After editing a list or section, verify there are no empty list items, dangling bullets, or stray formatting characters.

## Workspace Cleanup

- **Run `bash scripts/cleanup.sh` at the start of major sessions** to detect stale worktrees, orphaned directories, stale branches, and uncommitted changes.
- **Don't accumulate worktrees.** If a PR is merged, the worktree should be removed promptly. The cleanup script detects these.
- **Run `bash scripts/cleanup.sh --clean` periodically** to auto-delete branches whose remote is gone and remove merged/stale worktrees.
