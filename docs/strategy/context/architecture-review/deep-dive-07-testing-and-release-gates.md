# Deep Dive 07 - Testing and Release Gates

**Status:** Completed
**Started:** 2026-04-06
**Owner branch:** `feature/platform-architecture-review-series`
**Review goal:** verify that regression coverage, CI gates, and release verification match the real blast radius of the app surfaces hardened in DD01-DD06.

## Scope

This pass focused on the gap between what the repo can change and what the release process actually proves before or after merge:

- Vitest project structure, coverage scope, and threshold enforcement
- Playwright route coverage versus critical public and authenticated journeys
- GitHub Actions CI, E2E, and post-merge sequencing
- repo wrappers such as `pre-merge-check` and `deploy:verify`
- places where important release safety depended on convention instead of an enforced gate

## Evidence Collected

- `vitest.config.ts`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/e2e.yml`
- `package.json`
- `e2e/`
- `coverage/coverage-summary.json`
- prior validated risks from DD01-DD06

## Findings

### 1. Playwright was not a pre-merge release gate

**Severity:** Fixed in this worktree

**Evidence**

- `.github/workflows/ci.yml` now uploads the build artifact on pull requests and runs a dedicated `browser-smoke` job before merge.
- `browser-smoke` runs `npm run test:e2e -- e2e/smoke.spec.ts e2e/critical-journeys.spec.ts --project=chromium --project=mobile`.
- `e2e/critical-journeys.spec.ts` now covers the highest-risk DD06 route contracts: anonymous `/workspace`, anonymous `/you`, durable `/match`, and proposal-detail reachability from discovery.

**Why it matters**

The repo previously had no browser-level proof on pull requests for route and action contracts that DD06 already showed can drift without showing up in unit coverage alone.

### 2. The mobile Playwright project existed but the main E2E workflow only ran Chromium

**Severity:** Fixed in this worktree

**Evidence**

- `playwright.config.ts` defines both `chromium` and `mobile` projects.
- `.github/workflows/e2e.yml` now installs both `chromium` and `webkit`, then runs `npm run test:e2e -- --project=chromium --project=mobile`.
- `e2e/navigation.spec.ts`, `e2e/quick-match.spec.ts`, and `e2e/smoke.spec.ts` now reflect the durable `/match` route contract instead of the pre-DD06 redirect shim.

**Why it matters**

Mobile-specific regressions were still possible even though the repo was already paying the maintenance cost of a dedicated mobile project.

### 3. Coverage enforcement was too narrow and the full-coverage baseline was not trustworthy

**Severity:** Fixed in this worktree

**Evidence**

- `vitest.config.ts` now includes direct DD04 and DD06 shared seams in coverage:
  - `lib/syncPolicy.ts`
  - `lib/navigation/civicIdentity.ts`
  - `lib/navigation/proposalAction.ts`
  - `lib/navigation/returnTo.ts`
  - `lib/navigation/workspaceEntry.ts`
- `.github/workflows/ci.yml` now enforces line thresholds for ten high-blast-radius files instead of three, and missing entries now fail the gate instead of silently skipping.
- The fresh `npm run test:coverage` baseline is green again after repairing:
  - stale route-test limiter mocks in `__tests__/api/auth.test.ts`, `__tests__/api/delegation.test.ts`, and `__tests__/api/polls.test.ts`
  - vote-schema drift in `__tests__/sync/integration.test.ts` and `__tests__/sync/koios-schemas.test.ts`
  - the transform failure in `lib/sync/data-moat.ts`
  - the stale page-shell expectation in `__tests__/app/match-page.test.tsx`
- The newly enforced line coverage values from the green run are:
  - `utils/scoring.ts`: 97.61%
  - `lib/alignment.ts`: 86.86%
  - `lib/koios.ts`: 80.53%
  - `lib/api/handler.ts`: 77.68%
  - `lib/api/withRouteHandler.ts`: 93.00%
  - `lib/syncPolicy.ts`: 100.00%
  - `lib/navigation/civicIdentity.ts`: 100.00%
  - `lib/navigation/proposalAction.ts`: 97.95%
  - `lib/navigation/returnTo.ts`: 100.00%
  - `lib/navigation/workspaceEntry.ts`: 98.48%

**Why it matters**

The previous coverage gate was no longer a meaningful proxy for the release risk introduced by DD01-DD06. The repo now has enforced protection on shared seams that own API behavior, sync-health policy, and route-intent preservation.

## Risk Ranking

1. The highest-risk route and contract seams now have a real pre-merge browser gate.
2. The main E2E workflow now tests both desktop and mobile projects.
3. Coverage gates are now intentionally tied to shared contracts with recent churn instead of historical leftovers.

## Remaining Watch Items

- The repo-wide `All files` coverage percentage is still low because DD07 intentionally tightened only a small set of high-signal seams instead of trying to gate the whole codebase in one pass.
- Local Playwright reproduction from the in-repo Windows worktree remains awkward because standalone output nests under the worktree path and local `mobile` execution depends on WebKit being installed.

## Handoff

**Current status:** Completed

**What changed this session**

- Added a PR-time `browser-smoke` job to `.github/workflows/ci.yml` that runs focused Playwright coverage for critical DD06 journeys against the build artifact.
- Updated `.github/workflows/e2e.yml` so post-merge E2E installs `chromium` plus `webkit` and runs both configured Playwright projects.
- Added `e2e/critical-journeys.spec.ts` and aligned stale `/match` assertions in `e2e/navigation.spec.ts`, `e2e/quick-match.spec.ts`, and `e2e/smoke.spec.ts`.
- Stabilized the full-coverage baseline by fixing stale limiter mocks, vote-schema drift, the `data-moat` coverage transform failure, and the stale match-page expectation.
- Expanded the coverage include set and raised CI thresholds to cover ten direct-test-backed high-blast-radius seams.

**Verification**

- `npm run build`
- `npm run lint -- e2e/critical-journeys.spec.ts e2e/navigation.spec.ts e2e/quick-match.spec.ts e2e/smoke.spec.ts playwright.config.ts`
- `npm run test:coverage`
- `npm run type-check`
- `npm run agent:validate`

**Validated findings**

- PR-time browser coverage is now enforced for the critical journeys hardened in DD06.
- The configured mobile Playwright project now participates in the main E2E workflow.
- Coverage enforcement is now broad enough to act as a meaningful release signal for the shared seams with the highest recent churn.

**Next agent starts here**

Start DD08 with `playwright.config.ts`, `app/layout.tsx`, `app/**/page.tsx` route shells, `components/`, and any locale/timezone/accessibility/mobile/legal surfaces that still rely on implicit defaults.
