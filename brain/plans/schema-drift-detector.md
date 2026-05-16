# Feature Plan

## Spec Link

Path or URL:

- `/Users/tim/dev/governada/governada-brain/strategy/sync-pipeline-architecture.md` Phase 6 and Q5
- `/Users/tim/dev/governada/governada-brain/governada/initiatives/sync-pipeline-architecture.md`

## Files Read

- `utils/koios.ts`
- `utils/koios-schemas.ts`
- `app/api/inngest/route.ts`
- `inngest/functions/consolidate-feedback.ts`
- `bin/gh.sh`
- `bin/git-push.sh`
- `scripts/validate-agent-constraints.mjs`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `Dockerfile`
- `railway.toml`

## Existing Implementations Found

- `utils/koios.ts` has a single `koiosFetch` wrapper already extending the Phase 1 `recordSourceCall` metrics path.
- `utils/koios-schemas.ts` uses Zod `.passthrough()`, so additive fields validate but do not currently surface.
- `inngest/functions/consolidate-feedback.ts` shows the local Inngest debounce pattern.
- `bin/gh.sh` permits governed draft PR creation and blocks unsafe GitHub commands.
- `scripts/validate-agent-constraints.mjs` is the CI-enforced place for agent mechanical guards.

## Sites Affected

Implementation files:

- `lib/koios/schemaObserver.ts`
- `lib/koios/schemaDriftPr.ts`
- `lib/koios/knownShapes.json`
- `inngest/functions/schema-drift-pr.ts`
- `utils/koios.ts`
- `app/api/inngest/route.ts`
- `scripts/validate-agent-constraints.mjs`

Test files referencing changed APIs:

- `__tests__/lib/koios-schema-observer.test.ts`
- `__tests__/lib/schema-drift-pr.test.ts`
- `__tests__/inngest/schema-drift-pr.test.ts`
- `__tests__/scripts/agentConstraints.test.ts`

Type definitions/usages:

- Inngest event payload for `drepscore/schema-drift.detected`
- Shape signature types in `lib/koios/schemaObserver.ts`

Documentation referencing changed names:

- PR body generator references `utils/koios-schemas.ts` and precedent PR #664.

## ADRs That Apply

- No new ADR. This follows the approved sync-pipeline architecture Phase 6.

## Scope

In:

- Observe successful Koios responses through the existing fetch/metrics path.
- Compare stable endpoint shapes against committed `knownShapes.json`.
- Emit schema-drift Inngest events for novel fields or type changes.
- Open draft PRs from production via the GitHub App REST API; retain the governed `bin/gh.sh pr create --draft` path for local agent-wrapper runs.
- Add a CI guard that known shapes cover every instrumented endpoint key.

Out:

- No database migration.
- No production secret changes.
- No direct schema edits to `utils/koios-schemas.ts` by the auto-PR function; it proposes the delta and commits the known-shape update.
- No Phase 5/F3/F4 retry.

## Edge Cases

- Loading: no UI surface.
- Empty: empty arrays record an empty-array shape but do not erase known fields.
- Error: observer failures are warning-only and never fail Koios fetches.
- Mobile 375px: no UI surface.
- A11y: no UI surface.
- Auth: GitHub writes go through `bin/gh.sh`; pushes go through the governed lane in local publication.
- Runtime: production PR creation uses `GOVERNADA_GITHUB_CLIENT_ID`, `GOVERNADA_GITHUB_INSTALLATION_ID`, and `GOVERNADA_GITHUB_APP_PRIVATE_KEY` with GitHub App REST endpoints so the Railway standalone container does not need `.git`, `git`, `gh`, `op`, or `bin/`.
- Data freshness: committed known shapes prevent production fetches from false-triggering for already observed fields.

## Verification Plan

- URL: none, no UI route.
- Screenshot: not applicable.
- Grep-similar: verify Inngest registration and governed GitHub wrapper usage.
- Tests/checks:
  - targeted Vitest for shape hashing, nested arrays/nullables, synthetic novel field, 24h dedupe, and governed wrapper calls
  - `npm run agent:validate`
  - targeted `npm test -- schema-drift koios-schema-observer agentConstraints`
  - `npm run type-check`

## Evidence Trail

Commands run:

- `npm run worktree:new -- schema-drift-detector`
- `git -C /Users/tim/dev/governada/governada-app/.claude/worktrees/schema-drift-detector status --short --branch`
- Source reads listed above.

Claims verified:

- Phase 6 Q5 is approved as Auto-PR.
- Phase 5 is blocked on F3/F4 after a reproduced Supabase branch migration failure.
- Existing Koios validation allows unknown fields with `.passthrough()`.
- `bin/gh.sh` enforces draft PR creation through the governed lane.
