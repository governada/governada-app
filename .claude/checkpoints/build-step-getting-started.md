# Build Step: Getting Started — Unified Onboarding via Seneca + Globe Convergence + Civic Ceremony

**Status:** CHECKPOINT_WRITTEN
**Started:** 2026-03-23
**Scope:** Replace standalone `/get-started` flow with a seamless experience woven through Seneca (AI advisor), Globe Convergence (conversational matching), and a new Civic Identity Ceremony — plus a fast-connect bypass for returning users.

## Design Philosophy

**"Getting Started" is not a feature. It's what Seneca does when it meets someone new.**

The current `/get-started` route is a 4-stage linear wizard (Discover → Prepare → Connect → Delegate) that exists separately from the two systems that should own this experience:

1. **Seneca** (AI governance advisor) — already shipped, persists across the app, adapts per page. Should be the guide for first-time visitors.
2. **Globe Convergence** (conversational matching) — backend complete, frontend planned in 7 chunks. Should be the discovery mechanism on the homepage.

This build plan integrates Getting Started INTO these systems, adds a Civic Identity Ceremony for the emotional payoff, and adds a fast-connect header button for returning users who don't need the guided flow.

## Key Principle: Two Paths, Never Forced

| Path                        | Who                                       | Experience                                                                                                      |
| --------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Guided (Seneca + Globe)** | First-time visitors                       | Seneca welcome → Globe Convergence pills → Identity reveal → Segment-aware branching → Connect → Civic Ceremony |
| **Fast Connect**            | Returning users, wallet-ready power users | Header button → 1 click → connected → Hub loads                                                                 |

Neither path is gated behind the other. The header connect button is ALWAYS visible. Seneca's guided flow is the recommended first experience, not a required one.

## Relationship to Globe Convergence Build Plan

This build plan **extends** the existing Globe Convergence plan (`build-step-match.md`), not replaces it. All 7 existing chunks remain unchanged. This plan adds 4 new chunks (0, 3.5, 4.5, 8) that interleave with the existing sequence.

### Combined Chunk Map

```
Existing (from build-step-match.md):
  Chunk 1: Conversational Match Hook + Pill Components
  Chunk 2: Globe Match Highlighting
  Chunk 3: Hero Embedding + Conversational Flow Integration
  Chunk 4: Governance Identity Card + Match Results
  Chunk 5: Importance Weighting + Bridge Match Algorithm
  Chunk 6: Semantic Fast-Track + DRep Quote Integration
  Chunk 7: Analytics + Feature Flag Rollout + Polish

NEW (this plan):
  Chunk 0:   Fast Connect Header Button (ships first, independent)
  Chunk 3.5: Seneca Onboarding Mode (after Chunk 3)
  Chunk 4.5: Civic Identity Ceremony (after Chunk 4)
  Chunk 8:   Cleanup + Migration (after everything)
```

---

## Chunk 0: Fast Connect Header Button

**Priority:** P0 (critical — unblocks returning users immediately, ships independently)
**Effort:** S (2-4 hours)
**Depends on:** None
**PR group:** Independent — can ship before any Globe Convergence work

### Problem

Currently, anonymous users see a generic "Connect Wallet" button (GovernadaHeader.tsx:830-838) that opens a full `WalletConnectModal` dialog with wallet grid, sign step, push opt-in, and success screen. This is 4 steps for a returning user who just wants to authenticate.

### Scope

**Modify:** `components/governada/GovernadaHeader.tsx`

Replace the anonymous user's connect button area (lines 830-838) with a smart connect button:

1. **Auto-detect installed wallet extensions** on mount via `useWallet().availableWallets`
2. **Single wallet detected** → Button reads "Connect [Eternl]" with wallet icon
   - Click → directly call `connect(walletName)` + auto-authenticate
   - No modal, no wallet grid, no selection step
   - Show inline loading spinner during connection
3. **Multiple wallets detected** → Button reads "Connect" with wallet icon
   - Click → small DropdownMenu (not a modal) showing detected wallets
   - Select wallet → connect + auto-authenticate inline
4. **No wallets detected** → Button reads "Connect Wallet"
   - Click → opens existing `WalletConnectModal` (fallback for full flow with "no wallet" guidance)
5. **Post-connect**: Segment detection fires automatically via existing `SegmentProvider` pipeline
6. **Error handling**: If connection fails, show brief toast/tooltip, don't open a modal

**Create:** `hooks/useQuickConnect.ts` — Encapsulates auto-detect + connect + authenticate logic

```typescript
interface UseQuickConnectReturn {
  detectedWallets: string[]; // Available wallet extensions
  primaryWallet: string | null; // Best auto-detect candidate
  quickConnect: (walletName?: string) => Promise<boolean>;
  isConnecting: boolean;
  error: string | null;
  clearError: () => void;
  needsFullModal: boolean; // True when no wallets detected
}
```

- Auto-detect on mount + polling interval (2s) for late-loading extensions
- `quickConnect()` calls `connect()` → `authenticate()` in sequence
- `primaryWallet` returns first wallet from `PREFERRED_WALLETS` order that's available
- Fires PostHog events: `quick_connect_attempted`, `quick_connect_succeeded`, `quick_connect_failed`

**Retain:** `WalletConnectModal` as fallback (opened when no wallets detected, or from Seneca's guided flow)

### Visual Design

Anonymous header area becomes:

```
[EpochStrip] [Search] [Pulse] [Compass] [Language] [Connect Eternl ▾]
                                                     ↑ primary CTA
                                                     Compass Teal outline
                                                     Wallet icon prefix
```

If single wallet: solid button, no dropdown arrow.
If multiple: outline button with small chevron, dropdown on click.

### Quality Gates

- [ ] Single-wallet auto-detect works (mock Eternl extension)
- [ ] Multi-wallet dropdown renders correctly
- [ ] No-wallet fallback opens existing modal
- [ ] Connection + authentication completes without modal
- [ ] PostHog events fire correctly
- [ ] Mobile: button fits in header without overflow
- [ ] Keyboard accessible (Enter to connect, Escape to dismiss dropdown)
- [ ] Error state shows toast, not modal
- [ ] Preflight passes

### Files Changed

| File                                       | Change                                       |
| ------------------------------------------ | -------------------------------------------- |
| `components/governada/GovernadaHeader.tsx` | Replace anonymous connect button area        |
| `hooks/useQuickConnect.ts`                 | **New** — auto-detect + connect + auth logic |

---

## Chunk 3.5: Seneca Onboarding Mode

**Priority:** P0 (critical — the "guide" for first-time visitors)
**Effort:** M (4-8 hours)
**Depends on:** Chunk 3 (Hero Embedding — so Seneca has Globe Convergence to guide through)
**PR group:** Can start in parallel with Chunk 3 (Seneca changes are independent of hero embedding)

### Problem

Seneca currently has basic progression awareness (`first_visit` → `exploring` → `quiz_completed` → `connected`) and page-specific greetings, but:

1. `pageContext` is sent to the API but **NOT used** in the system prompt (`advisor.ts` ignores it)
2. `DiscoveryHub` never passes `currentPage` to `CompassPanel` — it's always `undefined`
3. No segment-aware branching after matching (CEX holder vs wallet-ready vs no-ADA)
4. No segment upgrade detection (anonymous → citizen transition)
5. No onboarding-specific tone/personality shift

### Scope

**Modify:** `lib/intelligence/advisor.ts` — Extend `buildAdvisorSystemPrompt()`

Add visitor-mode-aware system prompt sections:

```typescript
interface AdvisorContext {
  // ... existing fields ...
  visitorMode?: 'onboarding' | 'exploring' | 'returning' | 'authenticated';
  pageContext?: string;
  matchState?: 'idle' | 'matching' | 'matched' | 'delegated';
  walletState?: 'none_detected' | 'detected' | 'connected' | 'has_ada' | 'no_ada';
}
```

When `visitorMode === 'onboarding'`:

- System prompt adds guidance: explain concepts without jargon, celebrate first actions, surface one clear next action (not a menu)
- Temperature adjusts to 0.4 (slightly warmer/encouraging)
- Max tokens adjusts to 512 (shorter, punchier responses)

When `matchState === 'matched'` and `walletState` is known:

- System prompt includes segment-specific guidance:
  - `detected`: "Suggest connecting their detected wallet to delegate"
  - `none_detected`: "Explain what a wallet is, recommend ONE wallet for their device, save matches for later"
  - `connected` + `no_ada`: "Explain how to acquire ADA, emphasize ADA stays in their wallet during delegation"
  - `connected` + `has_ada`: "Guide to delegation, one click"

**Modify:** `components/discovery/DiscoveryHub.tsx` — Pass actual page context

Wire `currentPage` from route detection (usePathname) to CompassPanel.

**Modify:** `components/discovery/CompassPanel.tsx` — Enhance progression-based behavior

Add to `SENECA_GREETINGS` a first-visit welcome that integrates with Globe Convergence:

```typescript
const SENECA_ONBOARDING_GREETING = `Welcome to Cardano governance. Every light in that constellation is someone governing a ₿2B treasury. Let me help you find where you fit — it takes about 90 seconds.`;
```

Add suggestion chips for onboarding context:

- Post-match: "Connect to delegate to [match name]" or "Get a wallet to delegate"
- Post-connect: "Explore what your DRep has been voting on"
- Segment upgrade: "Welcome, Citizen. Your representative votes on your behalf starting next epoch."

**Modify:** `hooks/useAdvisor.ts` — Pass visitor mode and match/wallet state

Extend the context object sent to the API:

```typescript
context: {
  ...existing,
  visitorMode,
  matchState,
  walletState,
  pageContext: currentPage,
}
```

**Modify:** `app/api/intelligence/advisor/route.ts` — Accept and forward new context fields

### Segment-Aware Branching (Post-Match)

After Globe Convergence produces matches, Seneca detects wallet state and branches:

| Wallet State                | Seneca Says                                                                           | Suggestion Chip              |
| --------------------------- | ------------------------------------------------------------------------------------- | ---------------------------- |
| Wallet extension detected   | "I see [Eternl]. Ready to delegate to [match]? One click."                            | "Connect & Delegate"         |
| No wallet detected, desktop | "You'll need a Cardano wallet. For desktop, I recommend Eternl — it takes 2 minutes." | "Get Eternl" (external link) |
| No wallet detected, mobile  | "For mobile, I recommend Vespr or Eternl mobile."                                     | "Get Vespr" (app store link) |
| Connected, no ADA           | "To delegate, you'll need some ADA in this wallet. The simplest path is [exchange]."  | "How to get ADA"             |
| Connected, has ADA          | "Your wallet is ready. Delegate to [match] now?"                                      | "Delegate Now"               |

### Segment Upgrade Detection

When `useSegment().segment` transitions from `anonymous` → `citizen`:

- Seneca's next greeting becomes: "Welcome, Citizen. Your delegation is now active. Your representative will vote on [N] proposals this epoch."
- Suggestion chips update to citizen actions (explore proposals, check DRep activity)
- CompassGuide static narrative updates for the new segment

### Quality Gates

- [ ] pageContext correctly reaches system prompt (verify in API logs)
- [ ] Onboarding greeting renders for first_visit progression
- [ ] Post-match segment branching shows correct guidance per wallet state
- [ ] Segment upgrade (anonymous → citizen) triggers welcome message
- [ ] Temperature/token adjustments apply per visitor mode
- [ ] Mobile: onboarding suggestions render correctly in bottom sheet
- [ ] Preflight passes

### Files Changed

| File                                    | Change                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| `lib/intelligence/advisor.ts`           | Extend AdvisorContext, update buildAdvisorSystemPrompt |
| `components/discovery/DiscoveryHub.tsx` | Pass currentPage to CompassPanel                       |
| `components/discovery/CompassPanel.tsx` | Onboarding greeting, segment-aware chips               |
| `hooks/useAdvisor.ts`                   | Pass visitorMode, matchState, walletState in context   |
| `app/api/intelligence/advisor/route.ts` | Accept new context fields, forward to advisor          |

---

## Chunk 4.5: Civic Identity Ceremony

**Priority:** P1 (important — emotional payoff, but not blocking conversion)
**Effort:** M (4-8 hours)
**Depends on:** Chunk 4 (Identity Card + Match Results — ceremony builds on the identity reveal)
**PR group:** Can ship as separate PR after Chunk 4

### Problem

Currently, wallet connection produces a generic "You're a Governance Guardian!" message in the modal. There's no emotional transformation, no visual payoff, no shareable moment. The most important identity transition in the product (anonymous → citizen) feels like completing a form.

### Scope

**Create:** `components/matching/CivicCeremony.tsx` — Full-screen overlay ceremony

Triggered when: wallet connects AND delegation succeeds (either through Globe Convergence flow or later through DRep profile delegate button).

Ceremony sequence (3-4 seconds total):

1. **Screen dims** — Existing content fades to 20% opacity (200ms ease)
2. **Node materialization** (if constellation visible) — Particle convergence animation:
   - 50-100 golden particles stream from screen edges toward user's position in constellation
   - Particles converge into a single bright node (600ms, spring easing)
   - Node pulses once (existing `pulseNode()` method)
3. **Delegation line** — Golden line draws from user node to DRep node (400ms, ease-out)
4. **Governance Rings bloom** — Three rings appear around user's node:
   - Participation ring fills to ~20% (matching + connecting completed)
   - Deliberation and Impact rings appear empty with subtle shimmer
   - Rings use existing `GovernanceRings.tsx` component with entrance animation
5. **Civic Identity Card** slides up:
   - Governance Rings visualization (centered)
   - Civic title: "Citizen" (Fraunces 600, 32px)
   - Represented by: [DRep Name] · [Match %]
   - Governance Power: ₳[amount]
   - "Your voice in Cardano's future is now active."
   - [Share] [Continue to Hub] buttons
6. **Continue** → Card dismisses, Hub loads with Rings visible in user pill

**For fast-connect users (skipped matching):** No ceremony plays. Instead, a subtle notification appears: "Connected successfully." Seneca nudges matching later.

**For users who match first, then connect later:** Full ceremony plays when delegation completes, regardless of when matching happened.

**Create:** `app/api/og/civic-identity/route.tsx` — OG image generator for share cards

Uses Satori (or `@vercel/og`) to generate a 1200x630 image:

- Dark background with subtle constellation texture
- Governance Rings visualization (SVG)
- Citizen name (truncated stake address or display name if set)
- DRep match info
- Governada branding

**Modify:** `components/ui/GovernanceRings.tsx` — Add entrance animation variant

New prop: `animate?: 'bloom' | 'none'`

- `bloom`: Rings scale from 0 → 1 with spring easing, fill animates from 0 → target over 800ms
- `none`: Instant render (default, backwards compatible)

**Modify:** `components/governada/GovernadaHeader.tsx` — Show Rings in user pill post-ceremony

After ceremony completes, the user pill in header shows mini Governance Rings (12px) next to segment label:

```
[🔵🟡🟣 Citizen] ← mini rings + label
```

### Express Path for Power Users

If a user connects via the header fast-connect button:

- No ceremony
- Brief toast: "Connected as Citizen" (2s, bottom-right)
- Seneca suggestion chip: "Find your governance match — 60 seconds"

Ceremony ONLY plays when:

1. User completes Globe Convergence matching AND connects AND delegates in the same flow, OR
2. User matches at any point, then later delegates from a DRep profile page

### Quality Gates

- [ ] Ceremony plays after match + connect + delegate flow
- [ ] Ceremony does NOT play for fast-connect (no match)
- [ ] Particle convergence renders correctly (Three.js integration)
- [ ] Governance Rings bloom animation is smooth (60fps)
- [ ] Civic Identity Card renders with correct data
- [ ] Share button generates OG image via API route
- [ ] Share image is 1200x630, visually appealing
- [ ] Mini Rings appear in header after ceremony
- [ ] Respects `prefers-reduced-motion` (skip animations, instant render)
- [ ] Mobile: ceremony works in portrait orientation
- [ ] Constellation-free fallback: if globe not visible, ceremony uses card-only mode (no particles)
- [ ] Preflight passes

### Files Changed

| File                                       | Change                                |
| ------------------------------------------ | ------------------------------------- |
| `components/matching/CivicCeremony.tsx`    | **New** — ceremony overlay component  |
| `app/api/og/civic-identity/route.tsx`      | **New** — OG image generator          |
| `components/ui/GovernanceRings.tsx`        | Add `animate` prop with bloom variant |
| `components/governada/GovernadaHeader.tsx` | Mini Rings in user pill               |

---

## Chunk 8: Cleanup + Migration

**Priority:** P2 (housekeeping — after everything works)
**Effort:** S (2-4 hours)
**Depends on:** All previous chunks complete and deployed
**PR group:** Final PR

### Scope

**Remove:**

| File/Route                                      | Reason                                          |
| ----------------------------------------------- | ----------------------------------------------- |
| `app/get-started/page.tsx`                      | Replaced by homepage Globe Convergence + Seneca |
| `components/get-started/GetStartedLayout.tsx`   | No longer needed                                |
| `components/get-started/ProgressBar.tsx`        | No longer needed                                |
| `components/get-started/GovernancePassport.tsx` | Replaced by server-side passport                |
| `components/get-started/StageDelegate.tsx`      | Delegation happens inline                       |
| `components/get-started/StageDiscover.tsx`      | Replaced by Globe Convergence                   |
| `components/get-started/StagePrepare.tsx`       | Replaced by Seneca segment branching            |
| `components/get-started/StageConnect.tsx`       | Replaced by quick connect + inline connect      |
| `components/funnel/OnboardingChecklist.tsx`     | Replaced by Governance Rings progression        |

**Add redirect:** `/get-started` → `/` (Next.js redirect in `next.config.ts`)

**Create:** Server-side passport table (Supabase migration)

```sql
create table governance_passport (
  id uuid default gen_random_uuid() primary key,
  stake_address text unique not null,
  match_results jsonb,           -- saved Globe Convergence matches
  match_archetype text,          -- governance identity archetype
  civic_level text default 'explorer',  -- explorer → citizen → guardian → sentinel
  ceremony_completed boolean default false,
  ring_participation real default 0,
  ring_deliberation real default 0,
  ring_impact real default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: users can read/write their own passport
alter table governance_passport enable row level security;
create policy "Users can manage own passport"
  on governance_passport for all
  using (stake_address = current_setting('app.stake_address', true));
```

**Migrate:** `lib/passport.ts` — update to read/write from server-side table when authenticated, localStorage fallback for anonymous users.

**Update:** Any internal links pointing to `/get-started`:

- `components/hub/AnonymousLanding.tsx` — remove "Get Started" CTA (homepage IS getting started now)
- `components/WalletConnectModal.tsx` — remove "no wallet? go to /get-started" link
- `components/governada/shared/CompassGuide.tsx` — update any /get-started hrefs

**Run:** `npm run gen:types` after migration

### Quality Gates

- [ ] `/get-started` redirects to `/`
- [ ] No broken internal links to removed routes
- [ ] Server-side passport persists across sessions
- [ ] localStorage fallback works for anonymous users
- [ ] gen:types produces updated types
- [ ] Preflight passes
- [ ] Smoke test passes on production

### Files Changed

| File                                        | Change                                        |
| ------------------------------------------- | --------------------------------------------- |
| `app/get-started/page.tsx`                  | **Delete**                                    |
| `components/get-started/*` (7 files)        | **Delete**                                    |
| `components/funnel/OnboardingChecklist.tsx` | **Delete**                                    |
| `next.config.ts`                            | Add /get-started → / redirect                 |
| `lib/passport.ts`                           | Rewrite for server-side + localStorage hybrid |
| Supabase migration                          | New governance_passport table                 |
| `types/database.ts`                         | Regenerated                                   |

---

## Execution Schedule

```
Week 1 (parallel — independent of each other):
  ┌─ Chunk 0   — Fast Connect header button
  ├─ Chunk 1   — Hook + Pills (existing plan)
  └─ Chunk 2   — Globe Highlighting (existing plan)

Week 2:
  ┌─ Chunk 3   — Hero Embedding (existing, depends on 1+2)
  └─ Chunk 3.5 — Seneca Onboarding Mode (can start parallel with 3)

Week 3 (parallel):
  ┌─ Chunk 4   — Identity + Results (existing, depends on 3)
  ├─ Chunk 4.5 — Civic Ceremony (extends 4)
  └─ Chunk 5   — Importance Weighting (existing, depends on 1)

Week 4:
  ┌─ Chunk 6   — Semantic Fast-Track (existing, depends on 3+4)
  ├─ Chunk 7   — Analytics + Polish (existing, depends on all)
  └─ Chunk 8   — Cleanup + Migration (this plan, after all verified)
```

**Total new work from this plan:** ~16-24 hours across 4 new chunks
**Total combined (with Globe Convergence):** ~4-5 weeks, 11 PRs

---

## Visitor State Matrix

| State                               | Header Button                     | Homepage                  | Seneca                            | Ceremony                         |
| ----------------------------------- | --------------------------------- | ------------------------- | --------------------------------- | -------------------------------- |
| **First visit, no wallet**          | "Connect Wallet" → modal          | Globe Convergence flow    | Welcome mode, guides matching     | After match + connect + delegate |
| **First visit, wallet detected**    | "Connect [Eternl]" → 1-click      | Globe Convergence flow    | Welcome mode, "I see your wallet" | After match + connect + delegate |
| **Returning anon, has passport**    | "Connect [Eternl]" → 1-click      | Globe shows saved matches | "Welcome back, ready to connect?" | After connect + delegate         |
| **Returning anon, no passport**     | "Connect Wallet" → modal/dropdown | Globe Convergence flow    | Standard welcome                  | After match + connect + delegate |
| **Fast-connect (skip matching)**    | N/A (already connected)           | Hub loads                 | "Want to find your match?"        | NO ceremony (nudge matching)     |
| **Connected, no ADA**               | Shows address pill                | Hub with limited cards    | "You'll need ADA to delegate"     | NO ceremony until delegation     |
| **Connected, has ADA, undelegated** | Shows "Citizen" pill              | Hub with match nudge      | "Ready to delegate?"              | After delegation                 |
| **Citizen, delegated**              | Shows "Citizen" pill + Rings      | Full Hub                  | Contextual advisor                | Already completed                |

---

## Risk Assessment

| Risk                                  | Likelihood | Impact                 | Mitigation                                                                   |
| ------------------------------------- | ---------- | ---------------------- | ---------------------------------------------------------------------------- |
| Globe Convergence chunks delayed      | Medium     | High (blocks 3.5, 4.5) | Chunk 0 ships independently; Seneca work can start parallel                  |
| Ceremony feels over-the-top           | Low        | Medium                 | `prefers-reduced-motion` fallback; express path for power users              |
| Fast-connect confuses new users       | Low        | Medium                 | Button only says wallet name if detected; generic "Connect Wallet" otherwise |
| Server-side passport migration issues | Low        | Medium                 | localStorage fallback always works; server-side is enhancement               |
| Auto-detect misidentifies wallet      | Low        | Low                    | Fallback to dropdown; never auto-connect without user click                  |

---

## Success Metrics

| Metric                           | Current               | Target                               | Measurement                                |
| -------------------------------- | --------------------- | ------------------------------------ | ------------------------------------------ |
| Anonymous → wallet connect rate  | Unknown               | +50% improvement                     | PostHog funnel: landing → connected        |
| Time to first connection         | ~3 min (4-stage flow) | <60s (fast connect) or ~90s (guided) | PostHog: first_visit → connected timestamp |
| Connection drop-off rate         | Unknown (no tracking) | <30%                                 | PostHog: match_completed → connected       |
| Ceremony share rate              | N/A (doesn't exist)   | >10% of new citizens                 | PostHog: ceremony_share_clicked            |
| Return visit rate (post-connect) | Unknown               | >40% within 7 days                   | PostHog: citizen return cohort             |

---

## Decision Log

| Decision                               | Rationale                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| Fast-connect ships first (Chunk 0)     | Returning users shouldn't wait for the full build; immediate UX improvement                 |
| No forced flow for wallet connection   | Returning users, power users, and people who "just want to connect" should never be blocked |
| Ceremony only after match + delegate   | Matching creates emotional investment; connecting without matching is transactional         |
| Server-side passport in Chunk 8 (last) | localStorage works fine for MVP; server persistence is enhancement                          |
| Keep WalletConnectModal as fallback    | Still needed for no-wallet-detected case and for Seneca's guided flow                       |
| Seneca changes are additive            | Never break existing Seneca behavior; onboarding mode is layered on top                     |
