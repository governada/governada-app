---
paths:
  - '**'
---

# Runtime Bootstrap

Before using GitHub, MCP, or other external tooling, resolve repo-scoped bootstrap files first.

## Lookup Order

1. Current checkout
   - `.mcp.json`
   - `.claude/settings.local.json`
   - `.env.local`
   - `package.json`
   - `scripts/lib/runtime.js`
   - `scripts/set_gh_context.ps1`
   - `scripts/set-gh-context.js`
   - `scripts/gh-auth-status.ps1`
   - `scripts/repair-gh-auth.ps1`
2. Shared checkout fallback
   - In this repo, worktrees live under `.claude/worktrees/<name>`.
   - Ignored local files can be missing there even when the shared checkout is configured.
   - If `.mcp.json` or `.claude/settings.local.json` is missing in the worktree, inspect the shared checkout next.
3. Repo-scoped user paths referenced by repo files
   - `GH_CONFIG_DIR`
   - Wrapper commands referenced by `.mcp.json`
4. Higher-level/global defaults
   - Global `gh` auth
   - Global MCP registries
   - Generic home-directory config not referenced by this repo

## Rules

- Repo bootstrap files are authoritative when present. Do not let a working global `gh` login or global MCP profile override repo-scoped settings.
- Run `npm run session:doctor` before guessing about missing auth or missing MCP tools.
- If GitHub auth is broken, use `npm run gh:auth-status` and `npm run auth:repair` before generic `gh auth login`.
- If MCP tools are missing, inspect `.mcp.json` and the wrapper commands it references before assuming the MCP server is not installed.
