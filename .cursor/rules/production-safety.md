---
description: Production safety guardrails — prevent accidental writes to production from local dev or untested paths
globs: ['**']
alwaysApply: true
---

# Production Safety Guardrails

## Core Principle

`.env.local` contains **production** credentials. Any local operation that hits Supabase, Koios, push endpoints, or any external service is a **production operation**. Treat it accordingly.

## Before Running Any Command That Mutates State

1. **Identify the target environment.** If the command will write to a database, call an API, or trigger a side effect, determine whether it points at production or a test environment.
2. **If production: STOP.** Do not run sync operations, data backfills, migrations, or write-path tests against production from localhost. Validate these via Railway preview environments (PR-based) or Supabase branch databases instead.
3. **If ambiguous: ASK.** If you're unsure whether an operation could mutate production state, ask the user before proceeding. Never default to "probably safe."

## What "Test Locally" Means

- Compilation and type-checking (`npm run build`, `tsc --noEmit`)
- Function registration and API shape verification (e.g., Inngest dev server discovering functions, serve route returning correct metadata)
- Unit tests against mocked dependencies (`vitest`)
- **NOT** executing full sync workflows, triggering cron routes, or running scripts that write to Supabase

## Specific Prohibited Actions (Without Explicit User Approval)

- Running `curl` or `fetch` against `/api/sync/*` routes with production `CRON_SECRET`
- Triggering Inngest functions locally that call `getSupabaseAdmin()` with production credentials
- Running `npm run sync` or any script that writes to the production database
- Executing Supabase migrations against production without the user confirming the target

## Deploy Verification Protocol

After pushing code that will trigger a Railway deploy:

1. Wait for the deploy to complete — do not mark the task as done after `git push`
2. Check Railway dashboard Deployments tab for build status; confirm "Active"
3. Run `npm run smoke-test` to validate production endpoints
4. If deploy fails: check build/deploy logs in Railway dashboard, fix, re-push
5. Only then mark the deploy task as complete

## Pre-Commit Safety Check

When staging files for commit:

- Run `git status` on any new file's parent directory
- If the directory is untracked (`??`), verify all files the committed file imports from that directory are also staged
- A local build passing does NOT guarantee the deploy will pass — untracked sibling files exist locally but not in git
