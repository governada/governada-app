---
description: Available MCPs, CLIs, and scripts for autonomous agent workflows
globs: ['**/*']
alwaysApply: true
---

# Tooling Reference
<!-- LINE BUDGET: 35 lines -->

Quick reference for all tools available to agents. Use these for full autonomous operation.

## MCPs (Cursor Settings > MCP)

| MCP | What it does | Key commands |
|-----|-------------|--------------|
| **Supabase** | Migrations, SQL queries, type gen | `apply_migration`, `execute_sql`, `list_tables` |
| **Sentry** | Error debugging, issue management | Query issues, view stack traces, resolve errors |
| **GitHub** | PR/issue management from Cursor | Create issues, manage PRs, review code |
| **Linear** | Issue tracking from Cursor | Create/update issues, manage projects |
| **Browser** | Frontend testing, UI verification | Navigate, click, snapshot, screenshot |

## CLIs (Terminal)

| CLI | What it does | Key commands |
|-----|-------------|--------------|
| **gh** | GitHub operations | `gh pr create`, `gh pr merge`, `gh pr checks --watch`, `gh auth switch --user drepscore` |
| **railway** | Deploy monitoring, logs | `railway logs`, `railway status`, `railway redeploy` |
| **inngest** | Local dev server | `npx inngest-cli@latest dev` |

## Scripts (npm run)

| Script | When to use |
|--------|-------------|
| `gen:types` | After every Supabase migration — regenerates `types/database.ts` |
| `inngest:status` | After deploy — verify function registration + sync health |
| `posthog:check [event]` | After deploying features with new events — verify instrumentation |
| `posthog:check --since 24h` | Check all events in a time window |
| `smoke-test` | After deploy — HTTP health checks against production |
| `test` | Run Vitest unit/integration tests |
| `test:e2e` | Run Playwright E2E tests (chromium + mobile) |
| `test:e2e:ui` | Playwright UI mode for debugging |
| `format` | Format all files with Prettier |
| `format:check` | Check formatting (runs in CI) |
| `analyze` | Bundle analysis (set ANALYZE=true) |
