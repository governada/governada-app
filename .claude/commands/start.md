Initialize the session properly before writing any code.

## Steps

1. Run `npm run session:doctor` and read the snapshot before making changes.
2. If the repo is on main and feature work is needed, create an in-repo worktree with `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>` and continue there. Do NOT create branches in the main checkout. Hotfixes (`ALLOW_MAIN_EDIT=1`) are the only exception.
3. If `session:doctor` shows a dirty tree or stale stash/worktree state, fix that before planning.
4. Read `.cursor/tasks/lessons.md` and `.cursor/tasks/todo.md` only if they exist and are relevant to the task.
5. Before creating the first todo list, state which rules from CLAUDE.md apply to this task.
6. Create task list WITH deploy steps. Last items MUST be the deploy pipeline (commit → PR → CI → merge → deploy → validate). A feature not in production is not done.
