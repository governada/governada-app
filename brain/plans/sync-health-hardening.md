# Feature Plan

## Spec Link

Path or URL:

- Tim request in current Codex thread: sync alerts, health review, independent reviewer feedback, implementation approval.
- Supabase changelog reviewed for current REST/client behavior: `https://supabase.com/changelog`

## Files Read

- `AGENTS.md`
- `docs/templates/feature-plan.md`
- `lib/supabase.ts`
- `lib/env.ts`
- `app/api/health/route.ts`
- `app/api/health/sync/route.ts`
- `app/api/health/deep/route.ts`
- `app/api/admin/api-health/alert/route.ts`
- `app/api/admin/integrity/alert/route.ts`
- `app/api/admin/inbox-alert/route.ts`
- `app/api/og/vote-card/route.tsx`
- `inngest/helpers.ts`
- `inngest/functions/alert-api-health.ts`
- `inngest/functions/alert-integrity.ts`
- `inngest/functions/alert-inbox.ts`
- `lib/data.ts`
- `lib/sync-utils.ts`
- `lib/sync/secondary.ts`
- `lib/sync/dreps.ts`
- `lib/sync/slow.ts`
- `inngest/functions/generate-epoch-summary.ts`
- `inngest/functions/generate-state-of-governance.ts`
- `types/database.ts`
- `railway.toml`
- `app/api/health/ready/route.ts`
- `__tests__/api/health.test.ts`
- `__tests__/api/health-sync.test.ts`
- `__tests__/api/health-deep.test.ts`
- `__tests__/lib/env.test.ts`
- `__tests__/sync/sync-utils.test.ts`
- `__tests__/lib/supabase-read-client.test.ts`
- `__tests__/inngest/helpers.test.ts`

## Existing Implementations Found

- Read Supabase access is centralized in `lib/supabase.ts`; current production-base code prefers `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and accepts legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Operational env reporting exists in `lib/env.ts`, but it does not currently validate the Supabase read URL/key pair.
- Broad health lives at `/api/health`; core sync health lives at `/api/health/sync`; deep dependency health lives at `/api/health/deep`.
- Alert cron functions self-fetch API routes through `inngest/helpers.ts`.
- `lib/sync-utils.ts` already exports `fetchAll` for paginated Supabase reads.
- Several sync and summary paths read all DReps without `fetchAll`.

## Sites Affected

Implementation files:

- `lib/supabase.ts`
- `lib/env.ts`
- `app/api/health/route.ts`
- `app/api/health/sync/route.ts`
- `app/api/health/deep/route.ts`
- `app/api/admin/api-health/alert/route.ts`
- `app/api/admin/integrity/alert/route.ts`
- `app/api/admin/inbox-alert/route.ts`
- `inngest/helpers.ts`
- `lib/sync/secondary.ts`
- `lib/sync/dreps.ts`
- `lib/sync/slow.ts`
- `inngest/functions/generate-epoch-summary.ts`
- `inngest/functions/generate-state-of-governance.ts`

Test files referencing changed APIs:

- `__tests__/api/health.test.ts`
- `__tests__/api/health-sync.test.ts`
- `__tests__/api/health-deep.test.ts`
- `__tests__/lib/env.test.ts`
- `__tests__/sync/sync-utils.test.ts`
- New targeted tests as needed for alert helper and pagination behavior.

Type definitions/usages:

- No database type regeneration planned; no migrations in scope.
- Existing `types/database.ts` confirms `dreps.score`, not `dreps.drep_score`.

Documentation referencing changed names:

- This feature plan only, unless tests reveal existing docs must be corrected.

## ADRs That Apply

- No ADR required: this is operational hardening of existing sync/read-health paths, not a new architecture or credential expansion.

## Scope

In:

- Read-client viability probe that exercises Supabase with a safe head-only query.
- Structured health output for read-client failures.
- Supabase read-client env visibility in operational health.
- Alerter-path failure visibility and production-safe URL handling.
- Paginated DRep reads in sync paths where complete DRep coverage is expected.
- Score-distribution integrity query fix from `drep_score` to `score`.
- Tests for the changed contracts.

Out:

- Production env edits, secret printing, backfills, write-heavy syncs, migrations, or database mutations.
- Changing public product API contracts beyond health/alert diagnostics unless required by tests.
- Reworking Railway deploy healthcheck path in this slice.
- Reconciliation semantic policy change beyond surfacing clearer alerts if local code already supports it.

## Edge Cases

- Loading: no frontend loading states changed.
- Empty: health routes must distinguish empty sync/DRep data from read-client failure.
- Error: missing env, invalid key/query error, timeout, and route self-fetch failures should surface distinct non-secret reasons where practical.
- Mobile 375px: no UI changes.
- A11y: no UI changes.
- Auth: cron-protected alert routes remain protected by `CRON_SECRET`; no credential scope expansion.
- Data freshness: sync health should continue applying existing `SYNC_POLICY` thresholds.

## Verification Plan

- URL: safe production read-only probes may be re-run after implementation if needed; no production writes.
- Screenshot: not applicable; no UI changes.
- Grep-similar: verify changed DRep full-table sync reads use `fetchAll` and no unrelated dirty files are included.
- Tests/checks:
  - `npm run agent:validate`
  - Targeted API health tests
  - Targeted env/read-client tests
  - Targeted Inngest helper/alert tests
  - Targeted sync pagination tests

## Evidence Trail

Commands run:

- `git fetch origin main`
- `git worktree add .claude/worktrees/sync-health-hardening -b codex/sync-health-hardening origin/main`
- `rg` and `sed` over Supabase, health, alert, Inngest, and sync paths.
- `npm run gh -- pr checks 961`
- Supabase MCP `_list_branches` for project `pbfprhbaayvcrxokgicr`

Claims verified:

- Clean implementation worktree starts at `a4bb1450`, matching the production release observed during review.
- Production-base `lib/supabase.ts` prefers `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and falls back to legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `lib/env.ts` accepts either read key but does not include the Supabase read key pair in `OPS_CRITICAL_KEYS`.
- `inngest/helpers.ts` falls back to `http://localhost:3000` when `NEXT_PUBLIC_SITE_URL` is unset.
- Integrity score distribution currently queries `drep_score`, while generated DB types expose `dreps.score`.
- PR #961 GitHub Actions and Railway checks passed after publish; the external Supabase Preview check initially cancelled before a PR-specific Supabase branch appeared.
