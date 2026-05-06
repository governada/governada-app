# Feature Plan

## Spec Link

Path or URL:

- `/Users/tim/dev/governada/governada-brain/governada/initiatives/homepage-redesign-prompts/phase-2-kickoff.md`
- `/Users/tim/dev/governada/governada-brain/governada/initiatives/homepage-redesign.md`
- `/Users/tim/dev/governada/governada-brain/plans/homepage-mvp.md` (Layer 1b, lines 191-227)
- `/Users/tim/dev/governada/governada-brain/plans/homepage-mvp-implementation-plan.md` (Phase 2, lines 525-595)
- `/Users/tim/dev/governada/governada-brain/agents/homepage-orchestrator.md`

## Files Read

- `AGENTS.md`
- `docs/templates/feature-plan.md`
- `app/page.tsx`
- `components/hub/HomePageShell.tsx`
- `components/globe/GlobeLayout.tsx`
- `components/GlobeConstellation.tsx`
- `components/globe/Constellation2D.tsx`
- `components/globe/GlobeCamera.tsx`
- `components/globe/NodePoints.tsx`
- `components/globe/shaders.ts`
- `lib/data.ts`
- `lib/actionQueue.ts`
- `lib/constellation/proposalNodes.ts`
- `lib/drepIdentity.ts`
- `app/api/governance/constellation/route.ts`
- `types/database.ts`

## Existing Implementations Found

- Homepage mounting already flows through `app/page.tsx`, `components/hub/HomePageShell.tsx`, and `components/globe/GlobeLayout.tsx`.
- The globe renderer already centralizes 3D constellation rendering in `components/GlobeConstellation.tsx`.
- Motion strength is already a prop boundary from `GlobeLayout` into the renderer, with 2D fallback support in `components/globe/Constellation2D.tsx`.
- Existing proposal node ids are derived in `lib/constellation/proposalNodes.ts`.
- Cached governance data access patterns live in `lib/data.ts`, with constellation API composition in `app/api/governance/constellation/route.ts`.
- Existing identity color mapping lives in `lib/drepIdentity.ts`.

## Sites Affected

Implementation files:

- `app/api/chain/activity-replay/route.ts`
- `components/GlobeConstellation.tsx`
- `components/globe/Constellation2D.tsx`
- `components/globe/GlobeCamera.tsx`
- `components/globe/Layer1Replay.tsx`
- `components/globe/NodePoints.tsx`
- `lib/chain/activityReplay.ts`
- `lib/globe/layer1Constants.ts`

Test files referencing changed APIs:

- `__tests__/components/GlobeConstellation.layer1.test.tsx`
- `__tests__/components/GlobeLayout.test.tsx`
- `__tests__/globe/layer1b.test.ts`

Type definitions/usages:

- `types/database.ts`
- `lib/constellation/types.ts`
- `lib/chain/activityReplay.ts`
- `lib/globe/layer1Constants.ts`

Documentation referencing changed names:

- `brain/plans/homepage-phase-2-layer-1.md`

## ADRs That Apply

- None found for this slice.

## Scope

In:

- Add the Layer 1b chain replay fetch pipeline using TanStack Query and a force-dynamic route.
- Render vote particles with identity color, log-scaled influence size, 24h replay sampling, gentle arc, and 500ms fade.
- Render rationale flickers with a +0.2 emissive bump and 300ms single fade.
- Tint treasury proposal nodes with logarithmic amber saturation from 10k to 100M ADA.
- Make globe rotation, breathing, and idle wobble scale with motion strength, including zero-motion halt.
- Cover empty-chain and motion-strength behavior with targeted tests.

Out:

- Homepage shell edits owned by Phase 4.
- `app/page.tsx` and `components/hub/HomePageShell.tsx`.
- Seneca surfaces, match flow changes, Phase 6 cinema, auth, telemetry infrastructure, migrations, and production-data writes.

## Edge Cases

- Loading: the renderer works before replay data returns; replay layers render no particles until events arrive.
- Empty: an empty chain replay stream emits no particles, flickers, or proposal overrides.
- Error: replay fetch failure is isolated to the query and does not block the existing constellation.
- Mobile 375px: 2D fallback preserves the existing canvas surface and scales breathing by motion strength.
- A11y: no new visible controls or text are added in this slice.
- Auth: replay route performs read-only cached governance reads and introduces no client auth surface.
- Data freshness: replay defaults to the Tim-approved 24h window and refetches once per minute.

## Verification Plan

- URL: local homepage at `http://127.0.0.1:<port>/` when app runtime env is available.
- Screenshot: deferred until a local or preview runtime has the required app env.
- Grep-similar: confirm no Phase 4 shell, Seneca, match, auth, telemetry, or migration files are modified.
- Tests/checks:
  - `npm run test:unit -- __tests__/globe/layer1b.test.ts`
  - `npm run test:component -- __tests__/components/GlobeLayout.test.tsx __tests__/components/GlobeConstellation.layer1.test.tsx`
  - `npm run type-check`
  - `npm run agent:validate`
  - `git diff --check`

## Evidence Trail

Commands run:

- `sed` reads of kickoff, dashboard, spec, implementation plan, orchestrator, feature-plan template, and relevant renderer/API files.
- `rg` searches for homepage mount paths, chain vote/rationale/proposal tables, motion-strength wiring, and reviewer prompt anchors.
- `npm run test:unit -- __tests__/globe/layer1b.test.ts`
- `npm run test:component -- __tests__/components/GlobeConstellation.layer1.test.tsx`
- `npm run test:component -- __tests__/components/GlobeLayout.test.tsx __tests__/components/GlobeConstellation.layer1.test.tsx`
- `npm run type-check`
- `npm run agent:validate`
- `git diff --check`

Claims verified:

- Chain replay is read-only and uses existing governance tables/types.
- The replay route exports `dynamic = 'force-dynamic'`.
- Client replay fetching uses TanStack Query, not `fetch` plus ad hoc `useEffect`.
- Layer 1b render helpers produce no particles for empty streams and motion strength zero.
- Tim's Q2.1-Q2.4 constants are covered by targeted unit tests.
- Local browser verification is blocked in this worktree until app runtime env values are available.
