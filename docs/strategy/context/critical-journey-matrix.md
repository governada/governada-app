# Critical Journey Matrix

> **Purpose:** Define the user and operator journeys that are important enough to protect with launch-grade verification.
> **Primary references:** `docs/strategy/context/build-manifest.md`, `docs/strategy/context/systems-operating-system.md`, `playwright.config.ts`
> **Rule:** A journey belongs here only if failure would materially damage launch trust, conversion, or operator confidence.

---

## How To Use This Document

- Use this matrix when deciding what should gate before merge.
- Use it during launch readiness reviews to check whether the highest-risk promises are actually protected.
- Update it whenever a journey becomes more important than it used to be, or when a feature moves from advisory to launch-critical.

---

## Gate Levels

| Level | Meaning                                              | Expected proof                                                               |
| ----- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| L0    | Pre-merge blocker                                    | Stable automated gate on PRs touching risky surfaces                         |
| L1    | Launch-critical, not yet stable enough for full gate | Targeted automated coverage plus required manual or post-deploy verification |
| L2    | Important but advisory                               | Coverage preferred, but not a launch blocker                                 |

---

## Journey Matrix

| ID  | Persona / operator | Journey                                                         | User promise protected                                     | Gate level | Current evidence                                                                 | Gap                                                     | Recommended proof                                                                         |
| --- | ------------------ | --------------------------------------------------------------- | ---------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| J01 | Anonymous citizen  | Land on home, shell renders, app is reachable                   | "Governada is up and worth trying"                         | L0         | `e2e/smoke.spec.ts`, `e2e/navigation.spec.ts`, `e2e/a11y.spec.ts`, `/api/health` | None at the shell level                                 | Keep in pre-merge gate                                                                    |
| J02 | Anonymous citizen  | Browse DReps from home/discovery and open a profile             | "I can discover representatives without friction"          | L0         | `e2e/discover.spec.ts`, `e2e/navigation.spec.ts`, `e2e/a11y.spec.ts`             | Needs to stay stable as routes evolve                   | Keep in pre-merge gate                                                                    |
| J03 | Anonymous citizen  | Browse proposals and open proposal detail                       | "I can understand live governance activity quickly"        | L0         | `e2e/proposals.spec.ts`, `e2e/a11y.spec.ts`                                      | Detail assertions are still light                       | Keep in pre-merge gate, deepen assertions over time                                       |
| J04 | Anonymous citizen  | Start Quick Match and interact with the quiz                    | "Governada can guide me to representation"                 | L0         | `e2e/quick-match.spec.ts`, `__tests__/components/QuickMatch.test.tsx`            | Does not yet assert end-state quality                   | Keep in pre-merge gate, add one stronger result-state assertion later                     |
| J05 | Public platform    | Health endpoint responds and core shell does not crash          | "The product is operational, not silently broken"          | L0         | `e2e/smoke.spec.ts`, `__tests__/api/health.test.ts`                              | Does not capture all degraded states                    | Keep in pre-merge gate and pair with post-deploy smoke                                    |
| J06 | Anonymous citizen  | Key pages load without console render-loop errors               | "The public experience is stable and not obviously broken" | L0         | `e2e/navigation.spec.ts` console error guard                                     | Coverage is page-sample based                           | Keep in pre-merge gate for public pages                                                   |
| J07 | Delegated citizen  | View delegation and governance coverage state                   | "My representation status is visible and trustworthy"      | L1         | Partial API coverage, build-manifest verification notes                          | No dedicated E2E journey                                | Add targeted read-path test and manual launch check                                       |
| J08 | Wallet user        | Connect wallet / authenticate                                   | "I can enter the personalized product safely"              | L1         | `__tests__/api/auth.test.ts`, component tests for wallet modal                   | No stable browser-level auth journey in CI              | Keep as manual + lower-layer verification until a deterministic harness exists            |
| J09 | DRep operator      | Open workspace review queue and inspect proposal intelligence   | "The DRep workspace is usable for real work"               | L1         | Workspace unit tests, build-manifest verification, no E2E                        | No end-to-end read journey                              | Add deterministic seeded E2E or staging smoke                                             |
| J10 | DRep operator      | Vote and submit rationale                                       | "Critical governance actions are dependable"               | L1         | Lower-layer tests, build-manifest, no browser E2E                                | On-chain and auth dependencies make CI gating difficult | Require targeted lower-layer tests plus manual pre-ship smoke until a test harness exists |
| J11 | Proposal author    | Create / review / advance a draft                               | "Governada can be trusted as a proposal workspace"         | L1         | Workspace unit tests, feature-flagged surfaces, no E2E                           | No journey-level automation                             | Add staging or sandbox flow before treating as launch-blocking                            |
| J12 | Operator           | Detect stale sync or dependency degradation and know what to do | "The founder can see and respond to system drift"          | L1         | `docs/runbook.md`, health endpoints, post-deploy verification                    | No recurring drill or incident log history yet          | Weekly scorecard + monthly failure drill                                                  |
| J13 | Anonymous citizen  | Public pages meet basic accessibility expectations              | "The product is usable and credible"                       | L0         | `e2e/a11y.spec.ts`                                                               | Coverage is key-page based, not exhaustive              | Keep in pre-merge gate on key pages                                                       |
| J14 | Visual polish      | Major public surfaces avoid obvious visual regressions          | "The product feels premium, not broken"                    | L2         | `e2e/visual-regression.spec.ts`                                                  | Likely too noisy to gate every PR                       | Keep advisory or post-merge until flake/noise is low                                      |

---

## Recommended Minimum Pre-Merge Gate

This is the smallest high-signal gate that should protect launch trust without crushing iteration speed.

### Include

- `e2e/smoke.spec.ts`
- `e2e/discover.spec.ts`
- `e2e/proposals.spec.ts`
- `e2e/quick-match.spec.ts`
- `e2e/a11y.spec.ts` for the core public pages only

### Keep Advisory Or Post-Merge

- `e2e/navigation.spec.ts` full legacy-route sweep if runtime is too heavy for every risky PR
- `e2e/visual-regression.spec.ts`
- Any future DRep workspace or authoring E2E until deterministic fixtures exist

---

## Immediate Gaps

1. No deterministic browser-level auth and workspace harness exists yet for DRep/operator flows.
2. The current public E2E suite proves reachability and basic interaction more than deep correctness.
3. Critical-path status is not yet wired to a risk-based CI rule set.

---

## Next Actions

1. Decide which PR types trigger the minimum pre-merge gate.
2. Split public-path gate specs from advisory/post-merge specs if runtime or flake becomes an issue.
3. Design a seeded or sandboxed harness for DRep workspace read flows.
4. Add one stronger assertion to proposal detail and Quick Match result-state coverage.
