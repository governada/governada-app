# Civica Frontend — Clean Sheet Redesign Plan

> Phase A, Task A7. Transforms the DRepScore data platform (32 pages, ~237 components) into a citizen-centric civic hub.

---

## Principles Driving Every Decision

1. **Citizens first** — every screen answers "what does a citizen need here?"
2. **Action over information** — command center, not data wall
3. **Custom everything** — no off-the-shelf chart libraries for governance data
4. **Ship complete or don't ship** — feature-flag aggressively, never expose half-built UX
5. **Mobile-considered** — not desktop-first with responsive breakpoints bolted on
6. **V3 is the new V1** — quality over speed

---

## Architecture Overview

### What Stays

- Next.js 15 App Router
- Tailwind v4 + CSS variable design tokens
- shadcn/ui primitives (button, dialog, sheet, tabs, etc.)
- TanStack Query for server state
- MeshJS wallet integration
- `CommandPalette` (⌘K) — power-user escape hatch
- All backend API routes, Inngest functions, Supabase data layer
- OG image generation routes
- Embed routes (`/embed/*`)
- Admin routes (`/admin/*`)

### What Changes

- Root layout shell (new nav, new providers, new metadata)
- All 32 page routes replaced with 4-destination architecture
- ~210 feature components redesigned from first principles
- Navigation: 13 items → 4 destinations
- Mobile bottom nav completely redesigned
- Segment detection woven into every surface
- Score tier visual identity system (new)
- Celebration/sharing system (new)
- Font stack, color palette, motion system (new)

### What Dies

- `/methodology` → dead redirect (methodology is contextual, in-profile)
- `/simulate` → absorbed into My Gov action feed (impact prediction cards)
- `/delegation` → premature, Phase D feature
- `/learn` → replaced by contextual education within every page

### What Consolidates

- `/governance` → absorbed into My Gov (segment-adaptive command center)
- `/treasury` → section within Pulse
- `/decentralization` → section within Pulse
- `/compare` → feature within Discover (side-by-side in DRep/SPO browse)

---

## Route Architecture

```
app/
├── (civica)/                    # Route group — Civica layout shell
│   ├── layout.tsx               # CivicaShell: nav, segment provider, tier theme
│   ├── page.tsx                 # Home (constellation + personalized feed)
│   ├── discover/
│   │   ├── page.tsx             # Unified browse: DReps, SPOs, Proposals, CC
│   │   ├── dreps/page.tsx       # DRep directory with filters
│   │   ├── spos/page.tsx        # SPO directory with filters
│   │   ├── proposals/page.tsx   # Proposal browser
│   │   └── committee/page.tsx   # Constitutional Committee
│   ├── pulse/
│   │   ├── page.tsx             # State of the Nation: GHI, EDI, treasury, trends
│   │   ├── epoch/[epoch]/page.tsx  # Epoch report
│   │   └── history/page.tsx     # GHI/EDI historical view
│   ├── my-gov/
│   │   ├── page.tsx             # Civic command center (segment-adaptive)
│   │   ├── inbox/page.tsx       # Notifications/alerts
│   │   └── profile/page.tsx     # Governance profile + philosophy + settings
│   ├── drep/[drepId]/page.tsx   # DRep profile (standalone, shareable)
│   ├── pool/[poolId]/page.tsx   # SPO profile (standalone, shareable)
│   └── proposal/[txHash]/[index]/page.tsx  # Proposal detail
├── claim/
│   ├── drep/[drepId]/page.tsx   # DRep claim flow
│   └── spo/[poolId]/page.tsx    # SPO claim flow (new)
├── embed/                       # Existing embeds (keep)
├── admin/                       # Existing admin (keep)
├── api/                         # Existing API routes (keep)
├── layout.tsx                   # Root: fonts, theme, providers only
└── template.tsx                 # Page transitions
```

---

## Navigation Design

### Desktop

Horizontal top bar with 4 primary destinations + wallet button:

```
[Civica Logo]   Home   Discover   Pulse   My Gov        [⌘K] [Wallet]
```

- Active state: bold + accent underline
- Wallet button shows segment badge (citizen/DRep/SPO icon)
- ⌘K button opens command palette

### Mobile

Fixed bottom tab bar with 4 icons + labels:

```
[🏠 Home]  [🔍 Discover]  [📊 Pulse]  [🏛 My Gov]
```

- Active tab: filled icon + accent color
- No hamburger menu — everything accessible via 4 tabs + ⌘K
- Profile/settings accessible from My Gov

---

## Segment Detection & Routing

On wallet connect, detect segment via `/api/user/detect-segment` (already built in Phase A):

| Segment               | Detection                 | Home Experience                                   | My Gov Experience                                         |
| --------------------- | ------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| **Anonymous**         | No wallet                 | Constellation + "Find your representative" CTA    | Prompt to connect wallet                                  |
| **Undelegated**       | Wallet, no delegation     | "Your ADA has no governance voice" + Quick Match  | Quick Match → Delegation flow                             |
| **Delegated Citizen** | `delegatedDrepId` present | DRep report card headline + epoch summary         | Action feed: report card, drift alerts, delegation health |
| **DRep**              | `ownDRepId` present       | Score headline + quick wins + competitive context | Score dashboard, action feed, claim/profile management    |
| **SPO**               | Pool detected via wallet  | Pool governance summary + claim prompt            | SPO dashboard, voting actions, competitive context        |

Store detected segment in React context (`SegmentProvider`). Components conditionally render based on segment. Never show same generic page to all segments.

---

## Implementation Phases

### Phase 1: Shell & Navigation (Foundation)

**Goal:** New layout shell, 4-tab navigation, segment detection wired in. Old pages still render inside new shell.

**Tasks:**

1.1 — **Design tokens refresh**

- New font pairing (distinctive display + refined body — not Geist)
- Revised color palette with tier-aware accent system
- Motion tokens (enter, exit, hover, celebration durations/easings)
- Update `globals.css` `@theme` block

  1.2 — **`SegmentProvider` context**

- Wrap app in segment context
- On wallet connect, call `/api/user/detect-segment`
- Expose `useSegment()` hook: `{ segment, isLoading, stakeAddress, drepId?, poolId? }`
- Persist segment in session to avoid re-detection

  1.3 — **`TierThemeProvider`**

- Context that sets CSS variables for tier-specific colors/effects
- `useTierTheme(score)` → returns tier name, color set, glow intensity
- Consumed by score displays, profile headers, badges

  1.4 — **New `CivicaShell` layout**

- `app/(civica)/layout.tsx` — the new layout group
- Desktop: `CivicaHeader` with 4 nav items + wallet + ⌘K
- Mobile: `CivicaBottomNav` with 4 tabs
- Remove: `SyncFreshnessBanner` (fold into notifications), `Footer` (minimal inline), `EasterEggs`
- Keep: `CommandPalette`, `KeyboardShortcuts`, `OfflineBanner`, `InstallPrompt`

  1.5 — **Redirect old routes**

- `/methodology` → 301 to `/discover`
- `/simulate` → 301 to `/my-gov`
- `/delegation` → 301 to `/discover`
- `/learn` → 301 to `/`
- `/governance` → 301 to `/my-gov`
- `/dashboard` → 301 to `/my-gov`
- `/dashboard/spo` → 301 to `/my-gov`
- `/dashboard/inbox` → 301 to `/my-gov/inbox`
- `/proposals` → 301 to `/discover/proposals`
- `/committee` → 301 to `/discover/committee`
- `/treasury` → 301 to `/pulse`
- `/decentralization` → 301 to `/pulse`
- `/compare` → 301 to `/discover/dreps`
- `/match` → 301 to `/discover` (Quick Match embedded in Discover)
- `/profile` → 301 to `/my-gov/profile`

  1.6 — **Feature flag: `civica_frontend`**

- When off, serve old layout + routes (no disruption)
- When on, serve new CivicaShell + new routes
- Allows progressive rollout

**Deliverables:** New navigation works, old pages render in new shell, segment detected on wallet connect.

---

### Phase 2: Home & Discover (Discovery Experience)

**Goal:** The two most-visited destinations redesigned from scratch.

**Tasks:**

2.1 — **Home page — anonymous/undelegated**

- Hero: "Cardano has a government. Meet your representatives."
- Constellation visualization (keep existing, polish)
- Quick Match inline (no separate page)
- Trending DReps/SPOs by tier (social proof)
- Live governance stats (total DReps, active proposals, participation rate)

  2.2 — **Home page — delegated citizen**

- DRep report card headline: name, score, tier badge, trend arrow
- "This epoch:" vote summary, alignment status, drift warning if applicable
- Next actions: proposals needing attention, epoch recap CTA
- Achievement feed (latest milestone)

  2.3 — **Home page — DRep**

- Score hero: score, tier badge with visual treatment, rank, momentum
- Quick wins: "Submit rationale on Proposal X (+3 pts estimated)"
- Competitive context: nearby DReps, movement
- Delegator headline: count, trend

  2.4 — **Home page — SPO**

- Similar to DRep home but pool-centric
- Claim prompt if unclaimed
- Governance score hero + competitive context
- Delegator headline: count, trend (from `spo_power_snapshots`)

  2.5 — **Discover — unified browse**

- Tab bar: DReps | SPOs | Proposals | Committee
- Each tab has filters, search, sort
- DRep/SPO cards show: name, tier badge, score, top alignment dimensions, action button
- Proposal cards show: title, status, AI category, tri-body votes, your DRep's vote
- Compare mode: select 2-3 DReps/SPOs for side-by-side
- Quick Match embedded as prominent CTA when no wallet connected

  2.6 — **Custom DRep/SPO card component**

- Tier-colored border/glow
- Score displayed as hex badge (existing) with tier overlay
- Compact alignment radar
- "Match %" if user has profile

**Deliverables:** Home is segment-aware and action-first. Discover consolidates 4 old pages into unified browse.

---

### Phase 3: Pulse (State of the Nation)

**Goal:** Comprehensive governance health view — the "news desk" of Cardano governance.

**Tasks:**

3.1 — **Pulse overview**

- GHI hero with trend spark line
- EDI summary with cross-chain position
- Active proposals count + epoch progress bar
- Treasury health: balance, runway, recent withdrawals
- Latest epoch recap link

  3.2 — **Epoch report redesign**

- Personalized header if authenticated (your DRep's activity this epoch)
- Proposal outcomes with tri-body vote bars
- GHI movement explanation
- Treasury activity summary
- Inter-body alignment shifts
- Designed as a "newsletter" format — scannable, shareable sections

  3.3 — **Treasury section** (absorbed from `/treasury`)

- Treasury balance visualization (custom, not chart.js)
- Accountability polls
- Spending effectiveness ratings
- Fiscal sustainability indicators

  3.4 — **Governance trends**

- Participation trends over time
- DRep/SPO population growth
- Score distribution shift
- Delegation concentration / decentralization

  3.5 — **Leaderboard**

- DRep and SPO leaderboards by governance score
- Tier distribution visualization
- Biggest movers this epoch
- Filterable by dimension/category

**Deliverables:** Pulse is the "State of the Nation" destination. Treasury and decentralization absorbed.

---

### Phase 4: My Gov (Civic Command Center)

**Goal:** The most important destination — where governance HAPPENS for each segment.

**Tasks:**

4.1 — **Action feed architecture**

- Feed of `ActionCard` components, each with:
  - Context (what happened / what needs attention)
  - One primary CTA button
  - Predicted score impact (where applicable)
  - Timestamp / urgency indicator
- Actions sourced from: pending proposals, alignment drift, score changes, tier progress, achievements, epoch transitions

  4.2 — **Citizen command center**

- DRep Report Card (detailed)
- Alignment drift status + re-delegation prompt if drifted
- Epoch summary (personalized)
- Delegation health: time delegated, DRep score trend
- Achievement timeline
- Engagement level display + next level progress

  4.3 — **DRep command center**

- Score dashboard with pillar breakdown
- Tier display with progress to next
- Action feed: proposals to vote on (with impact estimates), rationales to write
- Competitive context panel
- Delegator stats + milestones
- Profile management: edit governance statement, philosophy, social links

  4.4 — **SPO command center**

- Pool governance dashboard
- Score + tier + competitive context
- Delegator stats: count, trend spark line (from `spo_power_snapshots`), milestones
- Voting history with rationale status
- Profile management (if claimed)
- Claim flow entry (if unclaimed)

  4.5 — **Inbox** (notifications hub)

- All notification types rendered in feed format
- Filter by category: score, proposals, alignment, achievements
- Mark read/unread, notification preferences
- Deep-link to relevant action from each notification

  4.6 — **Profile & settings**

- Governance philosophy editor
- Quiz/alignment profile management
- Notification channel preferences
- Connected wallet info
- Engagement level badge

**Deliverables:** My Gov is the segment-adaptive command center. Dashboard, inbox, profile all consolidated here.

---

### Phase 5: Profiles & Detail Pages

**Goal:** DRep, SPO, and Proposal detail pages redesigned with tier identity and action orientation.

**Tasks:**

5.1 — **DRep profile redesign**

- Hero: avatar, name, tier badge with visual treatment, score, rank
- Governance statement prominent
- Pillar breakdown (custom visualization)
- Voting record with rationale quality indicators
- Alignment radar
- AI-generated narrative
- Personality traits
- Delegator stats
- Tier history timeline
- Action: Delegate button (in-app via MeshJS)
- Action: Share profile
- For the DRep themselves: edit mode, claim celebration if first visit

  5.2 — **SPO profile redesign**

- Parity with DRep profile design
- Pool metadata + governance statement
- 4-pillar score breakdown (Participation, Consistency, Reliability, Governance Identity)
- Delegator stats: count + trend chart (from `spo_power_snapshots`), live stake
- Voting record with vote timeline
- Competitive context: nearby pools, rank, biggest movers
- Claim status indicator
- Action: Stake to this pool (link to wallet)
- Action: Share profile

  5.3 — **Proposal detail redesign**

- AI classification badge + summary
- Tri-body vote bars (DRep, SPO, CC) — custom visualization
- Your DRep's vote highlighted (if delegated)
- Score impact prediction: "If [DRep] votes Yes → estimated +2 points"
- Similar proposals
- Treasury impact (if treasury proposal)
- Discussion/rationale feed from voting representatives
- Action: Share opinion, track outcome

**Deliverables:** Profiles are tier-aware, action-oriented, and shareable. Full parity between DRep and SPO profiles.

---

### Phase 6: Celebrations, Sharing & Polish

**Goal:** Emotional design that drives virality and return visits.

**Tasks:**

6.1 — **Tier celebration system**

- Full-screen modal on tier change
- Tier-specific visual effects (particle system, glow, animation)
- "Share your achievement" CTA — prominent, not buried
- Auto-generate shareable image via OG infrastructure
- Share options: X, copy link, download image

  6.2 — **Achievement share flow**

- Consistent share modal for all milestones
- Preview of shareable card before sharing
- One-tap share to X with pre-filled text
- Copy link to profile with achievement highlighted
- Download image for manual sharing

  6.3 — **Score impact micro-interactions**

- When action feed card shows "+3 points estimated," animate the score change on hover
- Tier progress bar animates forward/backward based on prediction
- "X points to [next tier]" always visible in My Gov

  6.4 — **Loading states**

- Branded skeleton screens (not generic gray boxes)
- Constellation-themed loading animation
- Segment-aware loading (show segment-relevant placeholder)

  6.5 — **Error states**

- Helpful, actionable error messages
- "Governance data is updating — here's what we know so far"
- Offline mode: cached data with freshness indicator

  6.6 — **Page transitions**

- Polish existing `PageTransition` for new route structure
- Tab switches: cross-fade or slide
- Detail pages: expand from card
- Modal overlays: scale up from center

  6.7 — **Mobile polish**

- Touch targets ≥ 44px
- Swipe gestures on action feed cards
- Pull-to-refresh on feeds
- Bottom sheet for detail actions (not dropdown menus)
- Safe area handling for notch/pill

**Deliverables:** The product feels premium, celebrations drive sharing, mobile is first-class.

---

## Component Architecture

### New Shared Components

| Component              | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `TierBadge`            | Score tier with visual treatment (glow, color, icon)  |
| `ScoreHex`             | Hex-shaped score display with tier overlay            |
| `ActionCard`           | Feed card: context + CTA + impact prediction          |
| `AlignmentRadar`       | Custom 6D radar (citizen vs representative)           |
| `TriBodyVoteBar`       | DRep/SPO/CC vote split visualization                  |
| `EpochProgress`        | Current epoch progress indicator                      |
| `TierProgress`         | Points-to-next-tier bar                               |
| `ShareModal`           | Universal share flow (share image, X, link, download) |
| `CelebrationOverlay`   | Full-screen tier/achievement celebration              |
| `SegmentGate`          | Conditionally renders children based on user segment  |
| `QuickMatch`           | Inline matching flow (no separate page)               |
| `DRepCard` / `SpoCard` | Browse cards with tier treatment                      |
| `ProposalCard`         | Proposal browse card with vote bars                   |
| `ScoreImpactChip`      | "+3 pts estimated" inline indicator                   |
| `ReportCard`           | Citizen's DRep accountability summary                 |
| `DriftAlert`           | Alignment drift warning with alternatives             |

### Reusable from Existing (refactor, don't rewrite)

| Component         | Notes                                                  |
| ----------------- | ------------------------------------------------------ |
| `Constellation`   | Core visualization stays, update colors to new palette |
| `GovernanceRadar` | Refactor into `AlignmentRadar`                         |
| `ScoreHexBadge`   | Refactor into `ScoreHex` with tier awareness           |
| `CommandPalette`  | Keep as-is, extend search to new routes                |
| `WalletButton`    | Extend with segment indicator                          |
| `ThemeProvider`   | Keep, extend with tier theme tokens                    |

---

## Backend Prerequisites (Must Ship With Frontend)

The following backend fixes are required for SPO data accuracy and must be completed before the frontend ships SPO-facing surfaces:

| Fix                                         | Why                                                                                                                                                                                               | File                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **`delegator_count` refresh on every sync** | `fetch-koios-metadata` step only enriches pools where `ticker IS NULL`. After first enrichment, `delegator_count` goes stale. SPO Governance Identity pillar (6% of total score) uses stale data. | `inngest/functions/sync-spo-scores.ts` — change `fetch-koios-metadata` step to refresh ALL pools, not just null-ticker ones |
| **Create `spo_power_snapshots` table**      | DReps have `drep_power_snapshots` for delegator trend charts. SPOs have nothing equivalent — no temporal delegator/stake data. SPO home, profile, and command center all need trend data.         | New migration + populate during `sync-spo-scores`                                                                           |
| **SPO delegator trends API**                | `/api/dashboard/delegator-trends` only works for DReps. SPO profiles and command center need an equivalent.                                                                                       | New route or extend existing to accept `poolId` parameter                                                                   |

These are **not Phase B work** — they are Phase A data integrity fixes that were missed in the initial backend batches.

---

## Data Flow

```
Wallet Connect
    → /api/user/detect-segment
    → SegmentProvider (React context)
    → Every page reads useSegment()

Score Display
    → /api/governance/tiers?id=X&type=drep
    → TierThemeProvider sets CSS vars
    → TierBadge, ScoreHex, TierProgress render

Action Feed (My Gov)
    → /api/governance/impact (predictions)
    → /api/governance/drift (alignment)
    → /api/governance/report-card (citizen)
    → /api/user/epoch-summary (personalized)
    → ActionCard components with CTAs

SPO Trends
    → spo_power_snapshots table (populated each sync-spo-scores run)
    → /api/dashboard/delegator-trends?poolId=X (new or extended)
    → SPO home, profile, command center consume

Celebrations
    → tier_changes table (via TanStack Query subscription or Inngest webhook)
    → CelebrationOverlay triggers
    → /api/og/tier-change generates shareable image
```

---

## Migration Strategy

The redesign uses a **route group** (`(civica)`) alongside existing routes, gated by `civica_frontend` feature flag.

1. **Phase 1 ships:** New shell and nav live behind flag. Toggle on for testing.
2. **Phase 2-5 ship:** Each destination built and tested. Old routes still work.
3. **Phase 6 ships:** Polish pass. Full QA on new experience.
4. **Cutover:** Enable flag for all users. Old routes serve 301 redirects. Legacy page components archived (not deleted immediately).

No big-bang migration. Progressive, flag-controlled, reversible.

---

## Success Criteria (from Vision)

- [ ] New citizen understands the product within 10 seconds
- [ ] Time from landing to first civic action < 2 minutes
- [ ] Each segment sees a DIFFERENT experience
- [ ] 4 primary nav items max
- [ ] Command center is an action feed, not a data wall
- [ ] Every achievement triggers one-tap share flow
- [ ] Score tiers create emotional weight with visual distinction
- [ ] Mobile-considered design throughout
- [ ] Custom data visualizations for every governance context
- [ ] ⌘K as power-user escape hatch

---

## Estimated Effort

| Phase                          | Scope                                       | Estimate       |
| ------------------------------ | ------------------------------------------- | -------------- |
| Phase 1: Shell & Navigation    | Layout, nav, providers, redirects, flag     | 3-4 days       |
| Phase 2: Home & Discover       | 2 major destinations, segment logic, cards  | 5-7 days       |
| Phase 3: Pulse                 | GHI, treasury, epochs, trends, leaderboard  | 4-5 days       |
| Phase 4: My Gov                | Command center × 5 segments, inbox, profile | 6-8 days       |
| Phase 5: Profiles & Details    | DRep, SPO, Proposal pages                   | 5-6 days       |
| Phase 6: Celebrations & Polish | Sharing, animations, mobile, error states   | 4-5 days       |
| **Total**                      |                                             | **27-35 days** |

---

## Preparing for Phase B

This redesign intentionally creates the **scaffolding** Phase B needs:

- **Governance Wrapped (B1):** Share modal and OG image infrastructure from Phase 6 directly supports Wrapped card generation. Epoch summary data from My Gov feeds into annual Wrapped.
- **DRep-to-Citizen Communication (B2):** Action feed architecture from Phase 4 is the delivery channel for DRep position statements. Profile page has the publishing surface.
- **Notification-Driven Civic Life (B3):** Inbox from Phase 4 and action feed cards are the notification consumption surfaces. Deep-linking to specific actions is built into the route structure.

Phase B adds content and mechanics to the surfaces Phase A builds. No structural rework needed.

---

## Retrospective Action Items (from Phase A Audit)

The following items were identified during the Phase A backend review and should be addressed during the frontend redesign phases where they naturally fit. They are not blockers but represent debt that will improve UX quality if resolved alongside the relevant frontend work.

### 5. DRep Personality Label Stability

**Problem:** DRep personality labels (e.g. "The Bridge Builder", "The Pragmatist") can flicker between epochs when small alignment shifts push a DRep across a label boundary. This creates a confusing experience on profile pages and match results.

**Solution:** Add hysteresis logic to `lib/drepIdentity.ts` — a label should only change when the new dominant dimension leads by a configurable margin (e.g. 5+ points) over the previous dominant dimension. Store `last_personality_label` on the DRep record to enable comparison.

**Where it fits:** Phase 5 (Profiles & Details) — the DRep profile page displays personality labels prominently. Wire this when building the DRep profile page.

### 6. Tier Progress `recommendedAction` Field

**Problem:** `computeTierProgress()` in `lib/scoring/tiers.ts` returns `pointsToNext` and `progressPercent` but does not include a `recommendedAction` string as specified in the Phase A plan. The frontend tier badge component will want to show "Vote on 2 more proposals to reach Gold" type messaging.

**Solution:** Extend `computeTierProgress()` to accept the entity's current pillar breakdown and return a `recommendedAction: string` identifying which pillar has the most room for improvement and what action would raise it (e.g. "Submit rationales" for low Governance Identity, "Vote on pending proposals" for low Participation).

**Where it fits:** Phase 2 (Home & Discover) or Phase 4 (My Gov) — wherever tier badges with progress indicators are first rendered. The backend change is small; wire it when building the component that consumes it.

### 7. Koios `/pool_delegators` and `/pool_voting_power_history` Integration

**Problem:** Two Koios endpoints flagged in `ultimate-vision.md` under "External Data Sources" are still not wired: `/pool_delegators` (individual delegator list for a pool) and `/pool_voting_power_history` (historical voting power by epoch). Without these, SPO profile pages lack delegator breakdown and historical power context.

**Solution:** Create a utility in `lib/koios.ts` wrapping both endpoints. Integrate `/pool_delegators` into the SPO profile API (paginated, top delegators). Integrate `/pool_voting_power_history` into the SPO trends API to enrich `spo_power_snapshots` with Koios-sourced historical data for pools that existed before we started snapshotting.

**Where it fits:** Phase 5 (Profiles & Details) — the SPO profile page is the primary consumer. Can be built as a backend task during that phase since the frontend will need the data to render.
