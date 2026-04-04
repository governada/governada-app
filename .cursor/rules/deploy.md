---
description: Deploy recipes and environment config — loaded when working on deploy-related files
globs:
  - app/api/**
  - supabase/migrations/**
  - inngest/**
alwaysApply: false
---

# Deploy Recipes

Procedural deploy steps live in commands: `/ship`, `/hotfix`, `/ci-watch`, `/pre-push`. This file is reference material loaded contextually.

## Supabase Migrations

Always use Supabase MCP `apply_migration` — never the CLI. The MCP authenticates through Cursor's integration.

1. Check pending files in `supabase/migrations/`
2. Read the SQL content
3. Apply via MCP `apply_migration` (name: snake_case, query: full SQL)
4. Verify with MCP `execute_sql`

Naming: sequential 3-digit prefix + descriptive snake_case: `020_feature_name.sql`

## Pre-Push Preflight (MANDATORY)

Run `npm run preflight` before every push. It checks format, lint, types, and tests in parallel (~90s). The `pre-push` git hook enforces this automatically.

If preflight fails, fix locally before pushing. CI is a safety net, not the primary feedback loop.

For agents: run preflight after each batch of changes during multi-batch plans, not just at the end. Catch issues incrementally.

## Release Gating

**Direct to main (hotfix):** Single-commit bug fixes, docs, config, dependency patches.

**PR required:** Migrations, API contract changes, auth/security, scoring model, new features, 10+ files, Inngest schedule changes.

## Incremental Build Pipeline

CI skips entirely for docs-only changes (`docs/**`, `tasks/**`, `.cursor/**`, `*.md`, `LICENSE`, `.github/workflows/**`). Code changes trigger the full pipeline.

`.next/cache` is persisted in CI via `actions/cache` — incremental Next.js builds are 30-50% faster on code-only changes. Railway relies on its default Docker layer caching (deps layer is cached when only source changes).

**E2E is post-merge only** (`e2e.yml`, triggered by `workflow_run` on CI success for `main`). It is NOT in the PR critical path. `ci.yml` covers only: install → lint/format/type-check/test (parallel) → build. PR target: ~5 min gate. Do not re-add E2E to `ci.yml`.

**Railway watchPaths** (`railway.toml`) ensures that CI/docs-only commits do NOT trigger Railway deploys. Only changes under `app/**`, `components/**`, `lib/**`, `hooks/**`, `utils/**`, `styles/**`, `public/**`, `Dockerfile`, `package*.json`, `next.config.*`, `tailwind.config.*`, `tsconfig.json` trigger a deploy.

## Railway Build Parity

Railway's Docker build has NO runtime env vars during `next build`. Local builds with `.env.local` are NOT equivalent. Always verify Railway deploy succeeds.

Any `app/` file importing `@/lib/supabase` (directly or via `@/lib/data`) that is NOT a `route.ts` MUST have `export const dynamic = 'force-dynamic'`.

## Environment

- **Supabase project**: `pbfprhbaayvcrxokgicr`
- **Production URL**: `https://governada.io`
- **GitHub CLI**: Use `npm run gh:auth-status` to confirm the repo-scoped governada profile before `gh` API calls.
- **MCP config** (`.cursor/mcp.json`): gitignored, contains secrets — NEVER overwrite
- **Railway CLI**: Installed globally (`railway`). Use `railway logs` for build/deploy logs, `railway status` for current state. Linked to the Governada project
- **Inngest**: PUT `https://governada.io/api/inngest` after every deploy to sync functions. 22 durable functions total (see `architecture.md`). Verify with `npm run inngest:status`
- **Post-deploy autonomous**: After any deploy, autonomously:
  1. Poll `railway deployment list` until latest shows `SUCCESS` — do not skip this step
  2. `Invoke-WebRequest -Uri "https://governada.io" -Method GET` — verify HTTP 200
  3. Apply pending migrations via Supabase MCP `apply_migration`
  4. PUT Inngest to sync functions
  5. `npm run inngest:status` — verify functions registered + recent runs healthy
  6. `npm run posthog:check <event>` — verify new instrumentation is firing (when deploying features with new events)
  7. Trigger new compute functions if they need initial data
  8. Hit new/changed endpoints on `governada.io` to verify 200 responses
     Do not ask the user for permission on these steps
- **INNGEST_SERVE_HOST**: `https://governada.io`

## Key Env Vars (managed in Railway dashboard)

`KOIOS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `SESSION_SECRET`, `ADMIN_WALLETS`, `ANTHROPIC_API_KEY`, `POSTHOG_PERSONAL_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `NEXT_PUBLIC_SITE_URL=https://governada.io`
