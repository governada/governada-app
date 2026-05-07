# Feature Plan

## Spec Link

Path or URL: `/Users/tim/dev/governada/governada-brain/plans/homepage-mvp.md` lines 597-611, `/Users/tim/dev/governada/governada-brain/plans/homepage-mvp-implementation-plan.md` Phase 8, `/Users/tim/dev/governada/governada-brain/governada/initiatives/homepage-redesign-prompts/phase-8-kickoff.md`

## Files Read

- `/Users/tim/dev/governada/governada-brain/governada/initiatives/homepage-redesign-prompts/phase-8-kickoff.md`
- `/Users/tim/dev/governada/governada-brain/governada/initiatives/homepage-redesign.md`
- `/Users/tim/dev/governada/governada-brain/plans/homepage-mvp.md`
- `/Users/tim/dev/governada/governada-brain/plans/homepage-mvp-implementation-plan.md`
- `components/PageViewTracker.tsx`
- `components/globe/GlobeLayout.tsx`
- `components/GlobeConstellation.tsx`
- `components/governada/SenecaThread.tsx`
- `components/governada/panel/SenecaIdle.tsx`
- `components/governada/panel/SenecaMatch.tsx`
- `components/WalletConnectModal.tsx`
- `hooks/useQuickConnect.ts`
- `lib/globe/cinematicDispatcher.ts`
- `lib/globe/clusterDetection.ts`
- `lib/seneca/intentRouter.ts`
- `lib/seneca/telemetry.ts`

## Existing Implementations Found

- Phase 0/4/5/6 telemetry exists for `first_visit`, `homepage_viewed`, `seneca_interaction`, `cinema_state_chosen`, `match_started`, `match_completed`, `entity_inspected`, `delegation_completed`, and `delegated`.
- `cinema_arrival_state` was not present in the current codebase despite the Phase 6 dashboard note; the dispatcher currently emits only globe commands.
- `wallet_connected` was not present as a raw funnel event; wallet success paths currently emit `wallet_authenticated` or `quick_connect_succeeded`.
- Region-suggestion shown/dismissed telemetry already exists.
- Seneca panel open telemetry exists; panel dismiss, mechanical asked, guided path taken, and observation surfaced are missing.

## Sites Affected

Implementation files:

- `components/PageViewTracker.tsx`
- `components/globe/GlobeLayout.tsx`
- `components/GlobeConstellation.tsx`
- `components/governada/SenecaThread.tsx`
- `components/governada/panel/SenecaMatch.tsx`
- `components/WalletConnectModal.tsx`
- `hooks/useQuickConnect.ts`
- `lib/globe/cinematicDispatcher.ts`
- `lib/telemetry/perfMarks.ts`

Test files referencing changed APIs:

- `__tests__/components/GlobeLayout.test.tsx`
- `__tests__/components/GlobeConstellation.layer1.test.tsx`
- `__tests__/components/SenecaMatch.test.tsx`
- `__tests__/components/WalletConnectModal.test.tsx`
- `__tests__/globe/cinematicDispatcher.test.ts`
- `__tests__/hooks/useQuickConnect.test.tsx`
- `__tests__/telemetry/*.test.ts`

Type definitions/usages:

- `types/cinematic.ts`
- `lib/globe/types.ts`

Documentation referencing changed names:

- `governada-brain/plans/homepage-mvp.md`
- `governada-brain/plans/homepage-mvp-implementation-plan.md`

## ADRs That Apply

- GitHub App lane / Addendum #4 applies for branch publication and draft PR creation.

## Scope

In:

- Add missing Phase 8 PostHog events at existing call sites.
- Keep payloads compact and avoid large object capture.
- Add focused tests for each event trigger and the funnel event inventory.
- Use one small performance helper because `time_to_interactive`, `time_to_seneca_ready`, and `time_to_cinema_fire` share one-shot mark/measure behavior.

Out:

- Cinema choreography behavior changes.
- Seneca prompt/voice changes.
- Match algorithm changes.
- Auth behavior changes beyond dual-emitting the missing raw funnel event.
- PostHog infrastructure changes.
- Schema migrations.

## Edge Cases

- Loading: performance events emit once per homepage load, not every render.
- Empty: `match_no_candidates` fires from the existing empty match branch with trimmed answer payloads.
- Error: each forced failure path gets a discrete event with debug context.
- Mobile 375px: panel open/dismiss and tap-preview telemetry include viewport/input-mode context.
- A11y: no visual or keyboard interaction behavior changes.
- Auth: wallet-connected funnel event is telemetry-only and preserves existing authentication flow.
- Data freshness: no data fetching semantics changed.

## Verification Plan

- URL: homepage `/`, match mode `/?mode=match`, wallet modal from header.
- Screenshot: manual preview/PostHog screenshots remain acceptance criteria 10 after draft PR preview is available.
- Grep-similar: `rg -n "cinema_arrival_state|cinema_state_interrupted|cinema_state_completed|time_to_interactive|time_to_seneca_ready|time_to_cinema_fire|constellation_render_failed|seneca_answer_failed|match_no_candidates|cluster_fetch_failed|mechanical_question_asked|guided_path_taken|panel_dismissed|observation_surfaced|wallet_connected"`.
- Tests/checks: focused telemetry tests first, then `npm run agent:validate`.

## Evidence Trail

Commands run:

- `sed -n` on kickoff/spec/plan/dashboard files.
- `git status -sb`
- `git worktree list`
- `npm run worktree:new -- homepage-phase-8 --branch feat/homepage-phase-8-telemetry`
- `rg -n` telemetry and funnel call-site searches.
- `npx prettier --check <changed files>`
- `npm run type-check`
- `npm run test -- __tests__/globe/cinematicDispatcher.test.ts __tests__/telemetry/perfMarks.test.ts __tests__/telemetry/homepageEvents.test.ts __tests__/components/PageViewTracker.test.tsx __tests__/components/GlobeLayout.test.tsx __tests__/components/GlobeConstellation.layer1.test.tsx __tests__/components/SenecaMatch.test.tsx __tests__/hooks/useQuickConnect.test.tsx __tests__/components/WalletConnectModal.test.tsx`
- `npm run agent:validate`
- Playwright screenshot smoke at `http://127.0.0.1:3068/` using dummy non-secret env values: desktop and 375px mobile screenshots were nonblank with visible canvas regions.
- `.claude/hooks/pre-done.sh --url http://127.0.0.1:3068/ --screenshot /private/tmp/homepage-phase-8-desktop.png --grep-evidence <perf helper near-duplicate check>`

Claims verified:

- Existing app checkout was clean before creating the managed worktree.
- Phase 8 branch was created from `origin/main`.
- Current code lacks several Phase 8 events and the raw `wallet_connected` funnel event.
- Local acceptance criteria 1-9 are covered by event inventory, trigger tests, compact payload trimming, formatting/type-check, the agent constraint validator, and homepage visual smoke. Live PostHog funnel screenshots remain acceptance criterion 10 after preview deployment exists.
