---
paths:
  - "**"
---

# Agent Hygiene Rules

## Branch Hygiene

- **Always start from fresh main.** Before any development: `git checkout main && git pull origin main && git checkout -b feat/<name>`. Never develop on a stale or leftover branch.
- **Clean up after yourself.** When a worktree session is complete and the PR is merged, remove the worktree. Don't leave stale branches around.
- **Verify branch freshness.** If resuming work in an existing worktree, check `git log --oneline origin/main..HEAD` -- if >10 commits behind, rebase first.

## Context Efficiency

- **Prefer context slices over monolith docs.** When you need product context:
  - Build status/audit: read `docs/strategy/context/build-manifest.md` (~180 lines)
  - Persona requirements: read `docs/strategy/context/persona-quick-ref.md` (~60 lines)
  - Audit scoring: read `docs/strategy/context/audit-rubric.md` (~180 lines)
  - Work plan structure: read `docs/strategy/context/work-plan-template.md` (~80 lines)
  - Competitive intelligence: read `docs/strategy/context/competitive-landscape.md` (~150 lines)
  - Only read `docs/strategy/ultimate-vision.md` (952 lines) when updating the vision itself or doing a deep strategic audit
- **Rules files are self-sufficient.** The `.claude/rules/product-strategy.md` contains all principles needed for most feature decisions. Don't read the full vision doc "just in case."

## Commit Hygiene

- **Don't leave uncommitted changes.** Before ending a session, either commit work-in-progress or explicitly note what's uncommitted and why.
- **Update tracking docs.** When shipping a step/WP/QP, update status in the relevant tracking doc (work-packages.md, world-class-packages.md, build-manifest.md) in the same PR.

## Workspace Cleanup

- **Run `bash scripts/cleanup.sh` at the start of major sessions** to detect stale worktrees, orphaned directories, and uncommitted changes.
- **Don't accumulate worktrees.** If a PR is merged, the worktree should be removed promptly. The cleanup script detects these.
