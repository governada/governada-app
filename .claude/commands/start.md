Initialize the session properly before writing any code.

## Steps

1. Run `npm run session:doctor` and read the snapshot before making changes. Inspect the `Repo bootstrap files` and `Repo-scoped auth and MCP` sections before reaching for GitHub or MCP tooling.
2. Resolve repo tooling in this order: current checkout first, shared checkout fallback second, repo-scoped user paths referenced by repo files third, global defaults last. In this repo that means `.mcp.json`, `.claude/settings.local.json`, `.env.local`, `package.json`, `scripts/lib/runtime.js`, and `scripts/set-gh-context.*` before generic home-directory config.
3. If the repo is on main and feature work is needed, create an in-repo worktree with `powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>` and continue there. Do NOT create branches in the main checkout. Hotfixes (`ALLOW_MAIN_EDIT=1`) are the only exception.
4. On Windows Codex Desktop, stay rooted at the shared repo root. Do not open a separate Codex project from an individual worktree folder for this repo.
5. If GitHub auth or MCP access is missing, use `npm run gh:auth-status`, `npm run auth:repair`, and the wrapper commands referenced by `.mcp.json` before falling back to generic `gh auth status` or global MCP settings.
6. If a mutating Git/worktree command fails with `EPERM`, access denied, or a likely sandbox error, rerun it immediately with `sandbox_permissions=require_escalated` using an already-approved prefix. Do not ask first unless the prefix is missing.
7. If `session:doctor` shows a dirty tree or stale stash/worktree state, fix that before planning.
8. Read `.cursor/tasks/lessons.md` and `.cursor/tasks/todo.md` only if they exist and are relevant to the task.
9. Before creating the first todo list, state which rules from CLAUDE.md apply to this task.
10. Create task list WITH deploy steps. Last items MUST be the deploy pipeline (commit -> PR -> CI -> merge -> deploy -> validate). A feature not in production is not done.
