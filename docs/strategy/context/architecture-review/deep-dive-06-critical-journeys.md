# Deep Dive 06 - Critical User Journeys

**Status:** Completed
**Started:** 2026-04-06
**Owner branch:** `feature/platform-architecture-review-series`
**Review goal:** verify that the app's highest-value journeys are durable, destination-preserving, and internally consistent across anonymous, citizen, and workspace flows.

## Scope

This pass focuses on the routes and transitions where the product either acquires intent or can silently lose it:

- protected entry routes like `/workspace` and `/you`
- anonymous-to-authenticated transitions
- persona routing into review and author workspaces
- discovery-to-match and match-to-result routing
- proposal detail as the main public deep-link surface
- legacy redirects and shared URLs that can weaken journey durability

## Evidence Collected

- `proxy.ts`
- `app/page.tsx`
- `app/match/page.tsx`
- `app/you/page.tsx`
- `app/workspace/page.tsx`
- `app/workspace/layout.tsx`
- `app/workspace/review/page.tsx`
- `app/workspace/author/page.tsx`
- `app/proposal/[txHash]/[index]/page.tsx`
- `app/my-gov/identity/page.tsx`
- `app/api/auth/wallet/route.ts`
- `components/governada/GovernadaHeader.tsx`
- `components/governada/GovernadaShell.tsx`
- `components/WalletConnectModal.tsx`
- `components/hub/HubHomePage.tsx`
- `components/hub/HomePageShell.tsx`
- `components/globe/GlobeLayout.tsx`
- `components/providers/SegmentProvider.tsx`
- `components/governada/MyGovClient.tsx`
- `components/governada/identity/CivicIdentityProfile.tsx`
- `components/governada/identity/CitizenMilestoneCelebration.tsx`
- `components/governada/identity/MilestoneStamps.tsx`
- `components/governada/shared/CivicIdentityCard.tsx`
- `components/governada/proposals/ProposalActionZone.tsx`
- `components/governada/proposals/ProposalBridge.tsx`
- `components/governada/proposals/ProposalVerdictStrip.tsx`
- `components/governada/proposals/MobileStickyAction.tsx`
- `components/workspace/review/ReviewPageRouter.tsx`
- `components/workspace/review/ReviewWorkspace.tsx`
- `hooks/useQuickConnect.ts`
- `hooks/useSenecaThread.ts`
- `utils/wallet.tsx`
- `lib/navigation/civicIdentity.ts`
- `lib/navigation/returnTo.ts`
- `lib/navigation/session.ts`
- `lib/navigation/workspaceEntry.ts`
- `lib/navigation/proposalAction.ts`
- `lib/nav/config.ts`
- `__tests__/proxy.test.ts`
- `__tests__/components/HomePageShell.test.tsx`
- `__tests__/components/MobileStickyAction.test.tsx`
- `__tests__/components/ProposalActionZone.test.tsx`
- `__tests__/lib/civicIdentityRoute.test.ts`
- `__tests__/lib/proposalAction.test.ts`
- `__tests__/lib/returnTo.test.ts`
- `__tests__/lib/workspaceEntry.test.ts`
- `__tests__/lib/nav-config.test.ts`

## Findings

### 1. Protected-route intent was being dropped, and the shared wallet-connect event had no listener

**Severity:** Fixed in this worktree

**Evidence**

- `proxy.ts` redirected anonymous `/workspace` and `/you` requests to `/` with no preserved destination.
- `components/hub/WorkspacePage.tsx` also replaced anonymous/default users back to `/`, so the workspace root had no durable recovery path.
- Many components dispatched `openWalletConnect`, but the repo had no global listener that actually opened `WalletConnectModal`.
- `app/api/auth/wallet/route.ts` and `utils/wallet.tsx` authenticate the wallet, but there was no existing `returnTo` or redirect-resume contract.

**Why it matters**

This is the most expensive kind of journey bug: users express clear intent by opening a protected route or clicking a connect CTA, and the app silently discards that context. It weakens trust, makes navigation feel random, and lowers completion on the highest-value transitions.

**Implementation status**

- Fixed in this worktree.
- `proxy.ts` now redirects anonymous protected-route requests to `/?connect=1&returnTo=...` instead of silently dropping destination intent.
- `components/governada/GovernadaHeader.tsx` now listens for the existing `openWalletConnect` event, auto-opens the wallet modal for redirected protected-route visits, and resumes the saved destination after authentication when the modal is no longer open.
- Added `lib/navigation/returnTo.ts` to centralize safe internal-path validation.
- Added focused regression coverage in `__tests__/proxy.test.ts` and `__tests__/lib/returnTo.test.ts`.

### 2. `/workspace` was a client-owned persona shell, not a durable server-owned journey entry

**Severity:** Fixed in this worktree

**Evidence**

- `app/workspace/page.tsx` originally just mounted `WorkspacePage`.
- The deleted `components/hub/WorkspacePage.tsx` made the real destination decision in a client `useEffect`.
- `components/providers/SegmentProvider.tsx` starts from an anonymous/default state and resolves the actual segment asynchronously from wallet/session state and `/api/user/detect-segment`.

**Why it matters**

The workspace root is supposed to be the canonical productivity entrypoint for governance actors, but it is currently a redirect shell whose ownership sits in client state instead of the route contract. That creates misrouting risk on first load and makes the URL itself less meaningful.

**Implementation status**

- Fixed in this worktree.
- `app/workspace/page.tsx` is now an async server route that reads the current session cookie, validates it, and redirects before render.
- Added `lib/navigation/workspaceEntry.ts` so the route uses one shared destination decision path for real sessions, preview sessions, and fallback behavior.
- Preview routing now mirrors the existing workspace API pattern by reading `preview_sessions.persona_snapshot` for synthetic preview users.
- Removed the old `components/hub/WorkspacePage.tsx` client redirect shell.
- Added focused regression coverage in `__tests__/lib/workspaceEntry.test.ts`.

### 3. `/match` was not a durable route; it was homepage overlay state

**Severity:** Fixed in this worktree

**Evidence**

- `app/match/page.tsx` redirects immediately to `/?match=true`.
- `app/page.tsx` forwards `match` into `HubHomePage`.
- `components/globe/GlobeLayout.tsx` starts the match flow in client state rather than through a route-owned page contract.
- Other flows still link users back to `/match`, which means they are targeting a redirect shim rather than a stable journey route.

**Why it matters**

Matching is a core acquisition and conversion journey. Treating it as query-param state on the homepage weakens deep-linking, sharing, analytics attribution, and future iteration on the flow as its own product surface.

**Implementation status**

- Fixed in this worktree.
- `app/match/page.tsx` now renders the homepage match shell directly instead of redirecting to `/?match=true`.
- Added `components/hub/HomePageShell.tsx` so `/` and `/match` share one server-owned shell.
- `components/governada/GovernadaShell.tsx`, `hooks/useSenecaThread.ts`, and `lib/nav/config.ts` now treat exact `/match` as a home-owned route for shell context, Seneca routing, and nav highlighting.
- Added focused regression coverage in `__tests__/components/HomePageShell.test.tsx` and `__tests__/lib/nav-config.test.ts`.

### 4. Proposal detail exposed multiple competing action journeys from the same page

**Severity:** Fixed in this worktree

**Evidence**

- `app/proposal/[txHash]/[index]/page.tsx` switches between `ProposalActionZone` and `ProposalBridge` based on feature flags.
- `components/governada/proposals/ProposalBridge.tsx` routes governance actors toward the workspace.
- `components/governada/proposals/ProposalActionZone.tsx` supports inline action paths.
- `components/governada/proposals/MobileStickyAction.tsx` can route governance actors to external `gov.tools` on mobile.

**Why it matters**

The proposal page is the strongest durable public journey in the app, but the user action model still changes by device and feature-flag branch. That makes it harder to reason about completion paths, support the product, and guarantee a consistent governance workflow.

**Implementation status**

- Fixed in this worktree.
- `components/governada/proposals/ProposalActionZone.tsx` now uses the shared proposal bridge for governance actors instead of keeping a separate inline vote-flow contract on the public route.
- Added `lib/navigation/proposalAction.ts` so workspace review hrefs, governance-body eligibility, and the citizen engagement anchor are shared instead of being re-derived independently.
- `components/governada/proposals/MobileStickyAction.tsx` now routes governance actors into the internal review workflow instead of kicking them out to `gov.tools`, gives citizens a real shared engagement anchor to scroll to, and uses the shared wallet-connect event for anonymous users.
- Added focused regression coverage in `__tests__/components/MobileStickyAction.test.tsx`, `__tests__/components/ProposalActionZone.test.tsx`, and `__tests__/lib/proposalAction.test.ts`.

### 5. `/you` had route-contract drift and a legacy share path

**Severity:** Fixed in this worktree

**Evidence**

- `app/you/page.tsx` mounts `CivicIdentityProfile`, which contains an anonymous connect-wallet state.
- `proxy.ts` still treats `/you` as a protected destination.
- `components/governada/identity/CivicIdentityProfile.tsx` shares `/my-gov/identity`.
- `app/my-gov/identity/page.tsx` redirects back to `/you`.

**Why it matters**

The identity surface currently mixes three contracts: a protected route, an anonymous-ready component state, and a legacy share URL. That drift is survivable, but it makes the product harder to explain and increases the chance that future work fixes one layer while leaving the others inconsistent.

**Implementation status**

- Fixed in this worktree.
- `app/you/page.tsx` is now route-owned and validates session state before render.
- Added `lib/navigation/session.ts` so `/workspace` and `/you` share the same validated cookie lookup.
- Added `lib/navigation/civicIdentity.ts` so the canonical identity path and share URL live in one place.
- Updated `app/my-gov/identity/page.tsx`, `components/governada/MyGovClient.tsx`, `components/governada/shared/CivicIdentityCard.tsx`, `components/governada/identity/CivicIdentityProfile.tsx`, `components/governada/identity/MilestoneStamps.tsx`, and `components/governada/identity/CitizenMilestoneCelebration.tsx` to target the canonical `/you` contract instead of leaking legacy `/my-gov/identity` links.
- The remaining anonymous identity CTA now routes through `/?connect=1&returnTo=/you`, matching the protected-route recovery flow.
- Added focused regression coverage in `__tests__/lib/civicIdentityRoute.test.ts`.

## Risk Ranking

No open DD06 findings remain. Any later journey follow-up should be driven by new evidence from DD07 or DD08 rather than by leaving DD06 half-closed.

## Handoff

**Current status:** Completed

**What changed this session**

- Started DD06 and mapped the first journey surfaces across workspace, match, identity, and proposal detail.
- Fixed the protected-route intent drop by preserving `returnTo` through the home fallback in `proxy.ts`.
- Added a real global `openWalletConnect` listener plus post-auth journey resume logic in `components/governada/GovernadaHeader.tsx`.
- Added `lib/navigation/returnTo.ts` for safe internal destination validation.
- Added focused regression coverage in `__tests__/proxy.test.ts` and `__tests__/lib/returnTo.test.ts`.
- Converted `/workspace` into a server-owned entry route in `app/workspace/page.tsx`.
- Added `lib/navigation/workspaceEntry.ts` so workspace routing decisions are explicit and preview-aware outside the client segment provider.
- Removed the old `components/hub/WorkspacePage.tsx` client redirect shell.
- Added focused regression coverage in `__tests__/lib/workspaceEntry.test.ts`.
- Made `/match` a durable route in `app/match/page.tsx` and added `components/hub/HomePageShell.tsx` so `/` and `/match` share one server-owned globe shell.
- Updated shell/nav heuristics in `components/governada/GovernadaShell.tsx`, `hooks/useSenecaThread.ts`, and `lib/nav/config.ts` so exact `/match` behaves like a home-owned route instead of a redirect shim.
- Added focused regression coverage in `__tests__/components/HomePageShell.test.tsx` and `__tests__/lib/nav-config.test.ts`.
- Made `/you` route-owned in `app/you/page.tsx`, shared validated cookie lookup via `lib/navigation/session.ts`, and collapsed civic-identity links/share URLs onto `lib/navigation/civicIdentity.ts`.
- Updated legacy identity callers and share surfaces to target the canonical `/you` contract.
- Added focused regression coverage in `__tests__/lib/civicIdentityRoute.test.ts`.
- Unified proposal-detail action ownership around one internal review/signal/connect contract by updating `ProposalBridge`, `ProposalActionZone`, `MobileStickyAction`, and `lib/navigation/proposalAction.ts`.
- Added focused component and helper coverage in `__tests__/components/MobileStickyAction.test.tsx`, `__tests__/components/ProposalActionZone.test.tsx`, and `__tests__/lib/proposalAction.test.ts`.
- Verification note: focused DD06 unit tests, focused DD06 component tests, lint, and `npm run agent:validate` all passed. `npm run type-check` is currently blocked by unrelated in-branch errors in `inngest/functions/sync-dreps.ts` and `lib/koios.ts`.

**Validated findings**

- Protected-route intent was being lost and shared wallet-connect CTAs had no actual modal listener. Fixed in this worktree.
- `/workspace` was a client persona shell rather than a route-owned destination. Fixed in this worktree.
- `/match` was homepage state instead of a durable route. Fixed in this worktree.
- Proposal detail exposed inconsistent action journeys depending on flag and device. Fixed in this worktree.
- `/you` had contract drift between route protection, anonymous UI state, and legacy share URLs. Fixed in this worktree.

**Next agent starts here**

DD06 is closed. Continue with DD07 in `deep-dive-07-testing-and-release-gates.md`, CI/workflow files under `.github/workflows/`, release verification wrappers in `package.json` and `scripts/`, and the highest-blast-radius test surfaces under `__tests__/`, `playwright/`, and `vitest.config.ts`.
