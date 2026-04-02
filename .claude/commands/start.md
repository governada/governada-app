Initialize the session properly before writing any code.

## Steps

1. **Worktree check**: Run `git rev-parse --show-toplevel` and check if `.git` is a directory (main checkout) or file (worktree). If you're in the main checkout and the task requires feature work, STOP and create a fresh worktree with `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>`, or tell the user to relaunch with `claude --worktree <name>`. Do NOT create branches in the main checkout. Hotfixes (with `ALLOW_MAIN_EDIT=1`) are the only exception.
2. **Sync with main**: `git fetch origin main && git rebase origin/main`. This ensures the worktree starts from the latest deployed code so new skills, fixes, and context files are available immediately. If rebase conflicts, stash first (`git stash && git rebase origin/main && git stash pop`).
3. **Orient**: `git branch --show-current && git status && git log --oneline -5`
4. **Read lessons**: Read `.cursor/tasks/lessons.md`. If a pattern appeared 2+ times without promotion, propose promoting it now
5. **Check for in-progress work**: Read `.cursor/tasks/todo.md` if it exists
6. **Git hygiene**: `git stash list && git worktree list` — flag stale stashes and orphaned worktrees
7. **Echo-back critical rules**: Before creating the first todo list, state which rules from CLAUDE.md apply to this task
8. **Create task list WITH deploy steps**: Last items MUST be the deploy pipeline (commit → PR → CI → merge → deploy → validate). A feature not in production is not done.
