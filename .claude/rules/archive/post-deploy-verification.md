---
paths:
  - 'scripts/**'
  - '.claude/skills/ship/**'
  - '.claude/commands/ship*'
  - '.claude/commands/hotfix*'
---

# Post-Deploy Verification Rules

Every deploy that changes user-facing UI MUST be verified visually in production using Claude Chrome (browser automation MCP). Code passing preflight and CI is necessary but NOT sufficient — the agent must confirm what real users will see.

## When Visual Verification Is Required

- Any change to components, pages, layouts, or CSS
- Any change to feature flags or conditional rendering
- Any change to navigation, routing, or redirects
- Any change to Seneca (companion AI) rendering or behavior
- Any multi-phase buildout (verify each phase independently)

## When Visual Verification Can Be Skipped

- Backend-only changes (API routes, sync logic, scoring models)
- Type-only changes (interfaces, type exports)
- Test-only changes
- Documentation or config changes

## Verification Protocol

After production deploy is healthy (`/api/health` returns ok):

1. **Open production in Claude Chrome** — navigate to `https://governada.io` (or the specific changed route)
2. **Screenshot the changed routes** — take screenshots at desktop (1280px+) and mobile (375px) viewports
3. **Verify against the build spec** — check each acceptance criterion from the plan/PR description:
   - Components render where expected
   - Data loads and displays correctly (no loading spinners stuck, no empty states)
   - Interactions work (clicks, toggles, navigation)
   - Conditional rendering works for the intended personas/segments
4. **Check for common autonomous-dev pitfalls:**
   - Feature hidden behind a disabled feature flag (check `lib/featureFlags.ts` if something doesn't appear)
   - Component renders but is invisible (zero opacity, display:none, z-index buried)
   - Component renders but data isn't wired (shows placeholder or skeleton indefinitely)
   - Route exists but isn't linked from navigation (orphan page)
   - Mobile layout broken (overflow, overlap, unreachable elements)
   - Seneca panel competing with other UI elements
5. **Check console for errors** — read browser console via Chrome MCP, filter for errors
6. **Report findings** — if anything doesn't match spec, fix it before moving to the next phase

## Multi-Phase Buildouts

For builds spanning multiple phases/PRs:

- **Verify each phase independently** after its deploy. Don't defer verification to the end.
- **Maintain a checkpoint file** at `.claude/checkpoints/<build-name>.md` with: current phase, what's done, what's verified, what remains.
- **Include verification screenshots in PR descriptions** when possible (save to disk via Chrome MCP).
- **If a phase introduces a new route**, verify it's reachable from at least one navigation path (not just direct URL).
- **If a phase introduces conditional rendering**, test with the admin View As picker to verify all relevant persona x state combinations.

## Context Handoff

When handing off a multi-phase build to a new agent:

1. Commit all work-in-progress
2. Push to the feature branch
3. Update the checkpoint file with verification status
4. Include in the handoff prompt: which phases are verified in production, which still need visual verification
5. The receiving agent MUST re-verify the last shipped phase before starting new work (production state may have changed between sessions)
