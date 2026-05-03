# Feature Plan

## Spec Link

Path or URL:

- `/Users/tim/dev/governada/governada-brain/plans/homepage-mvp.md`
- `/Users/tim/dev/governada/governada-brain/plans/homepage-mvp-implementation-plan.md` (Phase 0.5)
- `/Users/tim/dev/governada/governada-brain/governada/initiatives/homepage-redesign.md`
- `/Users/tim/dev/governada/governada-brain/learnings/homepage-redesign/phase-0-blocker.md`
- `/Users/tim/dev/governada/governada-brain/agents/homepage-orchestrator.md`

## Files Read

- `AGENTS.md`
- `.env.preview.example`
- `.github/workflows/preview.yml`
- `app/api/delegation/route.ts`
- `app/dev/delegation-test/page.tsx`
- `app/dev/delegation-test/DelegationTestClient.tsx`
- `docs/architecture.md`
- `docs/templates/feature-plan.md`
- `hooks/useDelegation.ts`
- `lib/delegation.ts`
- `lib/env.ts`
- `lib/supabase.ts`
- `scripts/gen-types.ts`
- `scripts/health-verify.ts`
- `scripts/lib/deployVerification.ts`
- `scripts/preview-ready.js`
- `scripts/smoke-test.ts`
- `supabase/config.toml`
- `types/database.ts`

## Existing Implementations Found

- Delegation preflight and mainnet submission live in `lib/delegation.ts`.
- Delegation success telemetry lives in `hooks/useDelegation.ts`.
- The dev delegation harness uses the same hook path at `app/dev/delegation-test/`.
- Preview verification already exists as `.github/workflows/preview.yml`, but it is gated by repo vars and URL-template assumptions.
- Release-aware health verification helpers live in `scripts/lib/deployVerification.ts`.
- Supabase runtime env access is centralized in `lib/supabase.ts`, with validation in `lib/env.ts`.

## Sites Affected

Implementation files:

- `.env.preview.example`
- `.github/workflows/preview.yml`
- `app/api/delegation/mode/route.ts`
- `app/api/delegation/sandbox/route.ts`
- `docs/architecture.md`
- `hooks/useDelegation.ts`
- `lib/delegation.ts`
- `lib/delegation/mode.ts`
- `lib/env.ts`
- `lib/supabase.ts`
- `package.json`
- `scripts/preview-verify.mjs`
- `supabase/migrations/*_sandbox_delegations.sql`
- `types/database.ts`

Test files referencing changed APIs:

- `__tests__/lib/delegation-mode.test.ts`
- `__tests__/scripts/preview-verify.test.ts`

Type definitions/usages:

- `types/database.ts`
- `lib/delegation.ts`

Documentation referencing changed names:

- `.env.preview.example`
- `docs/architecture.md`

## ADRs That Apply

- None found for this slice.

## Scope

In:

- Add delegation-only sandbox mode.
- Preserve mainnet delegation behavior unless sandbox mode is active.
- Add a Supabase table for sandbox delegation records.
- Add preview verification workflow/script for PR previews.
- Migrate preview/env naming toward Supabase publishable/secret key terminology and `POSTHOG_DEV_PROJECT_TOKEN`.

Out:

- Synthetic seed data (Job 3, after Pause B).
- Product homepage redesign phases.
- `lib/matching/`, `lib/globe/`, and governance read-path changes.
- Production dashboard mutation.

## Edge Cases

- Loading: preview verifier waits for `/api/health/ready`.
- Empty: preview verifier fails if homepage HTML lacks the JSON-LD marker.
- Error: sandbox API rejects when server mode is not `sandbox`.
- Mobile 375px: no UI layout changes in Jobs 1-2.
- A11y: no new visible controls in Jobs 1-2.
- Auth: sandbox insert API does not require user auth but is server-gated by `GOVERNADA_DELEGATION_MODE=sandbox`.
- Data freshness: preview reads remain mainnet-backed except sandbox delegation writes.

## Verification Plan

- URL: `https://stg.governada.io/api/health/ready` for staging smoke already checked before resuming.
- Screenshot: deferred until real PR preview is available.
- Grep-similar: verify no out-of-scope matching/globe/governance-read edits.
- Tests/checks:
  - `npm run agent:validate`
  - `npm run type-check`
  - targeted unit tests for delegation mode and preview verifier

## Evidence Trail

Commands run:

- `git status --short --branch`
- `rg` over delegation, preview, Supabase, PostHog, and health scripts
- `sed` reads of authority and implementation files
- `curl -I https://stg.governada.io/api/health/ready`
- `curl -I https://stg.governada.io/`

Claims verified:

- Staging `/api/health/ready` returned `HTTP/2 200`.
- Staging homepage returned `HTTP/2 200`.
- The current branch lacks the Phase 0 `delegated` dual-emit, but the Phase 0 worktree contains it.
- Supabase GitHub integration automatically runs migrations in `supabase/migrations` on preview branches.
