---
description: Autonomous deployment pipeline — the full deploy-validate-rollback cycle
globs: []
alwaysApply: true
---

# Deployment Pipeline

When the user says "deploy" or you determine a deploy is needed, execute this entire sequence autonomously. Do NOT ask for confirmation at each step — run end-to-end and report results.

## Pre-flight Checks (~30s)

Run all three in sequence. If ANY fails, fix the code and re-run. Do not proceed until all green.

```
npm run lint
npm run type-check
npm test
```

If lint/type-check errors are in YOUR changes, fix them. If they're pre-existing, proceed.

## Supabase Migrations (if needed)

1. Check for pending migration files in `supabase/migrations/`
2. Apply via Supabase MCP `apply_migration`
3. Verify with `execute_sql` — confirm the schema change took effect
4. Only proceed after migration is confirmed

### Migration Naming Convention

- Sequential 3-digit prefix: `001_`, `002_`, etc.
- Descriptive snake_case suffix: `020_feature_name.sql`

## Release Gating

Before committing, classify the change to determine the release path.

**Direct to main (autonomous, no PR) — see also "Hotfix Protocol" in `workflow.md`:**

- Single-commit bug fixes with all tests passing (user says "hotfix" → full autonomous deploy pipeline)
- Cursor rule / documentation updates
- Copy/content/config changes
- Dependency patches

**PR + Railway preview required (human reviews before merge):**

- Database migrations (irreversible DDL)
- Changes to public API contract (`/api/v1/*`)
- Auth or security changes (RLS, session, crypto)
- Scoring model changes
- New user-facing features or major UI changes
- Any change touching 10+ files
- Inngest function schedule changes

## Commit + Push

1. `git add` relevant changes (never stage `.env*`, `credentials`, or secrets)
2. Commit with descriptive message following repo style
3. **If direct-to-main**: `git push origin main`
4. **If PR required**: create branch, push, then `gh auth switch --user drepscore` and open PR via `gh pr create`, report preview URL

## Monitor CI (~2-3 min)

1. `gh run list --limit 1` — get the run ID
2. `gh run watch <run-id>` — wait for completion
3. If CI fails:
   - `gh run view <run-id> --log-failed` — read the error
   - Fix the issue, commit, push again
   - Re-monitor CI
   - Max 3 retry attempts before escalating to user

## Monitor Railway Deployment (~5 min)

- Railway auto-deploys on push to main
- Docker build takes ~5 min: `npm ci` (~90s, cached when deps unchanged) → `next build` (~2-3 min) → image push + container swap (~30-60s)
- CI green does NOT mean deployed — Railway builds independently. Budget 5 min after push before validating production.
- Check Railway dashboard Deployments tab for build status
- Wait for deployment to show "Active"
- If deploy fails: check build logs and deploy logs in Railway dashboard, fix, push again

### Build Environment Parity — ENFORCED CHECK

Railway's Docker build separates build-time and runtime env vars. During `next build` inside Docker, **no runtime env vars are available** (no `NEXT_PUBLIC_SUPABASE_URL`, no `SUPABASE_SECRET_KEY`, etc.). This means:

- Local `next build` (which has `.env.local`) is **NOT equivalent** to Railway's Docker build
- CI builds may also pass if they have env vars configured as secrets
- Always verify Railway deploy succeeds — don't assume local build = production build

**Before every push, run this check on any new or modified files in `app/`:**

Any file in `app/` that imports from `@/lib/supabase` (directly or transitively via `@/lib/data`) **and** is NOT an API route (`route.ts`) MUST have `export const dynamic = 'force-dynamic'` at the top level. Without it, Next.js will attempt static prerendering during the Docker build and crash because Supabase env vars are not available.

Known affected patterns: `app/sitemap.ts`, `app/page.tsx`, `app/discover/page.tsx`, `app/drep/[drepId]/page.tsx`, any new server component that fetches data.

If the `next build` output shows the route as `○ (Static)` and it queries Supabase, it **will** fail on Railway. Check the build output and convert to `ƒ (Dynamic)` with `force-dynamic`.

## Post-deploy Validation (MANDATORY — do NOT skip)

**This section is not optional.** Every deploy to production MUST complete all three checks below before reporting success to the user. A deploy without validation is an incomplete deploy.

### 1. Health Check

```
Invoke-WebRequest -Uri "https://drepscore.io/api/health" -UseBasicParsing | Select-Object StatusCode
```

Expect 200, status != "error".

### 2. Inngest Sync

```
Invoke-WebRequest -Uri "https://drepscore.io/api/inngest" -Method PUT -UseBasicParsing
```

Registers all Inngest functions with Inngest Cloud. Expect 200.

### 3. Smoke Tests

```
npm run smoke-test
```

Checks `/api/health`, `/api/dreps`, `/api/v1/dreps`, `/api/v1/governance/health`, `/api/auth/nonce`.

### 4. Feature-specific verification

Verify at least one new endpoint or changed behavior is live. Examples:

- New route: `Invoke-WebRequest -Uri "https://drepscore.io/<new-route>" -UseBasicParsing`
- New header: check response headers
- Changed behavior: confirm the change is observable

**If ANY check fails:** Roll back in Railway dashboard, investigate, fix, re-deploy.

## Report (MANDATORY — do NOT skip)

After successful deploy, provide a concise summary:

- What changed (1-2 sentences)
- Deploy time
- Validation results (health, Inngest sync, smoke tests, feature verification)
- Update `.cursor/tasks/lessons.md` if anything unexpected occurred

**The full sequence is: code → commit → push → PR → merge → pull main → push main → monitor Railway → post-deploy validation → report. Every step is mandatory. Never stop at "PR created" — finish the pipeline.**

---

## Environment

- **Supabase project**: `pbfprhbaayvcrxokgicr`
- **Production URL**: `https://drepscore.io`
- **Cron secret**: stored in `.env.local` as `CRON_SECRET`

### GitHub CLI

Two accounts are configured. **Always switch to `drepscore` before any `gh` API calls** (PR creation, run monitoring, etc.):

```
gh auth switch --user drepscore
```

The `tim-dd` account does not have collaborator access to the repo.

### MCP Configuration — DO NOT MODIFY

`.cursor/mcp.json` is gitignored and contains secrets. **NEVER overwrite, recreate, or edit this file.**

### Inngest

- All 12 background jobs run via Inngest Cloud (see `architecture.md` for full list)
- After every deploy: `PUT https://drepscore.io/api/inngest` to sync functions
- `INNGEST_SERVE_HOST=https://drepscore.io` ensures SDK advertises production URL

### Environment Variables

Key vars (managed in hosting dashboard):

- `KOIOS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`
- `CRON_SECRET`, `SESSION_SECRET`, `ADMIN_WALLETS`
- `ANTHROPIC_API_KEY`, `POSTHOG_PERSONAL_API_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SERVE_HOST`
- `NEXT_PUBLIC_SITE_URL=https://drepscore.io`
