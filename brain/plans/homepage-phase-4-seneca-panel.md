# Feature Plan

## Spec Link

Path or URL:

- `/Users/tim/dev/governada/governada-brain/governada/initiatives/homepage-redesign-prompts/phase-4-kickoff.md`
- `/Users/tim/dev/governada/governada-brain/plans/homepage-mvp.md` lines 329-499
- `/Users/tim/dev/governada/governada-brain/plans/homepage-mvp-implementation-plan.md` lines 673-749

## Files Read

- `app/page.tsx`
- `components/hub/HomePageShell.tsx`
- `components/governada/GovernadaShell.tsx`
- `components/governada/SenecaOrb.tsx`
- `components/governada/SenecaThread.tsx`
- `components/governada/panel/SenecaIdle.tsx`
- `components/governada/panel/SenecaConversation.tsx`
- `stores/senecaThreadStore.ts`
- `lib/governance/prioritizationEngine.ts`
- `lib/governance/tier0Triggers.ts`
- `lib/governance/visitState.ts`
- `lib/governance/acknowledgments.ts`
- `app/api/governance/acknowledgments/route.ts`
- `types/cinematic.ts`
- `lib/navigation/session.ts`
- `lib/supabaseAuth.ts`
- `lib/api/client.ts`
- `lib/funnel.ts`
- `lib/posthog.ts`

## Existing Implementations Found

- Mounted homepage path is `app/page.tsx` -> `components/hub/HomePageShell.tsx` -> `components/globe/GlobeLayout.tsx`.
- The visible Seneca orb/thread is app-wide in `components/governada/GovernadaShell.tsx`, not owned by `GlobeLayout`.
- `stores/senecaThreadStore.ts` already centralizes Seneca open/mode/conversation state, so homepage engine output can be bridged there without modifying globe rendering.
- Phase 1 engine exports `getCinematicState`, `getTier0Triggers`, and `recordHomepageVisit` as described in the kickoff.
- Acknowledgment mutation must go through `POST /api/governance/acknowledgments`.

## Sites Affected

Implementation files:

- `components/hub/HomePageShell.tsx`
- `components/hub/HomepageSenecaBridge.tsx`
- `components/governada/GovernadaShell.tsx`
- `components/governada/SenecaOrb.tsx`
- `components/governada/SenecaThread.tsx`
- `components/governada/panel/SenecaIdle.tsx`
- `components/governada/panel/SenecaConversation.tsx`
- `stores/senecaThreadStore.ts`
- `lib/seneca/*`

Test files referencing changed APIs:

- `__tests__/seneca/intentRouter.test.ts`
- `__tests__/seneca/firstVisitBriefing.test.ts`
- `__tests__/components/HomePageShell.test.tsx`

Type definitions/usages:

- `types/cinematic.ts` imported only.
- `components/providers/SegmentProvider.tsx` type imported through `UserCinematicContext`.

Documentation referencing changed names:

- New source-controlled prompt files under `lib/seneca/prompts/`.

## ADRs That Apply

- None specific. Existing auth lane and telemetry policy from `AGENTS.md` applies.

## Scope

In:

- Versioned Seneca prompt/calibration assets.
- Intent routing and mechanical-answer handling.
- First-visit anonymous briefing and onboarding paths.
- Homepage server consumption of Phase 1 engine output.
- Seneca orb pulse, panel auto-open, event capture, and acknowledgment POST calls.

Out:

- Globe renderer files under `components/globe/*`.
- Chain replay files under `lib/chain/*`.
- Match flow internals.
- New auth or telemetry infrastructure.
- Region-suggestion calibrated phrasing beyond a Phase 3 placeholder.

## Edge Cases

- Loading: homepage renders even if Seneca data is quiet; queue falls back through the Phase 1 engine.
- Empty: no Tier 0 triggers still produces first-visit or quiet state.
- Error: LLM stream failure returns an evergreen fallback keyed to the current cinematic state.
- Mobile 375px: reuse existing Seneca bottom-sheet dimensions; new buttons wrap in the existing panel width.
- A11y: orb remains a button with an aria-label; onboarding paths and lifecycle actions are real buttons.
- Auth: lifecycle POSTs include the existing bearer token through `postJson`; anonymous users may see disabled lifecycle actions when no identity exists.
- Data freshness: `recordHomepageVisit` is called server-side on shell load, not from a client render loop.

## Verification Plan

- URL: local homepage `/`.
- Screenshot: first-visit anonymous panel auto-opening after clearing storage.
- Grep-similar: confirm no changes under `components/globe/*` or `lib/chain/*`.
- Tests/checks:
  - `npm test -- __tests__/seneca/intentRouter.test.ts __tests__/seneca/firstVisitBriefing.test.ts`
  - `npm test -- __tests__/components/HomePageShell.test.tsx`
  - `npm run agent:validate`

## Evidence Trail

Commands run:

- `sed -n '1,260p' /Users/tim/dev/governada/governada-brain/governada/initiatives/homepage-redesign-prompts/phase-4-kickoff.md`
- `sed -n '1,220p' /Users/tim/dev/governada/governada-brain/governada/initiatives/homepage-redesign.md`
- `sed -n '329,499p' /Users/tim/dev/governada/governada-brain/plans/homepage-mvp.md`
- `sed -n '673,749p' /Users/tim/dev/governada/governada-brain/plans/homepage-mvp-implementation-plan.md`
- `npm run worktree:new -- homepage-phase-4`
- `git branch -m feat/homepage-phase-4-seneca-panel`

Claims verified:

- Q4.1-Q4.4 defaults are the active values for this phase.
- `HomePageShell` is the server shell entry; `GovernadaShell` owns the app-wide Seneca UI.
- Phase 1 engine, visit-state, Tier 0 trigger, and acknowledgment route files exist in the current worktree.
