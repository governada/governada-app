# Governada Frontend — Clean Sheet Redesign Plan

> Phase A, Task A7. Transforms the Governada data platform (32 pages, ~237 components) into a citizen-centric governance hub.

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
├── (governada)/                    # Route group — Governada layout shell
│   ├── layout.tsx               # GovernadaShell: nav, segment provider, tier theme
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
[Governada Logo]   Home   Discover   Pulse   My Gov        [⌘K] [Wallet]
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

## Contextual Education

The `/learn` route is dead. Governance concepts are taught contextually within every page.

Every non-obvious term has a `<GovTerm>` wrapper component that renders as slightly underlined text. On hover (desktop) or tap (mobile), it expands a tooltip with:

- One-sentence explanation
- "Why it matters to you" framing (segment-aware)
- Optional "Learn more" link to a deep-dive section within the relevant page

Examples:

- "Governance Health Index" → "A composite score measuring how well Cardano's governance is functioning. Higher = healthier democracy."
- "Alignment drift" → "Your DRep's voting pattern has shifted away from your stated values. Consider whether they still represent you."
- "Tri-body vote" → "Cardano governance has three voting bodies: DReps, SPOs, and the Constitutional Committee. All three must align for proposals to pass."

Implementation: `components/GovTerm.tsx` using shadcn `Tooltip` primitive. Definitions stored in `lib/microcopy.ts` (already exists as a pattern in the codebase). Terms are progressively dismissed — once a user has seen a tooltip 3 times, it stops auto-showing (stored in localStorage).

Phase: Build `GovTerm` component in Phase 1 (foundation). Apply to all surfaces as they're built in Phases 2-5.

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
- Dark mode is the default and primary design target. Light mode support maintained via existing `ThemeProvider` and CSS variable system. All new tier colors, ambient effects, and glow treatments designed for dark-first. Light mode gets the same structure with appropriate contrast — but dark is the "hero" experience. Governance data, constellation visualization, and tier glows all look dramatically better on dark. This is a deliberate aesthetic choice, not a limitation.

  1.2 — **`SegmentProvider` context**

- Wrap app in segment context
- On wallet connect, call `/api/user/detect-segment`
- Expose `useSegment()` hook: `{ segment, isLoading, stakeAddress, drepId?, poolId? }`
- Persist segment in session to avoid re-detection

  1.3 — **`TierThemeProvider` + Ambient Tier Identity**

- Context that sets CSS variables for tier-specific colors/effects
- `useTierTheme(score)` → returns tier name, color set, glow intensity
- Consumed by score displays, profile headers, badges

**Ambient tier concept:** When a DRep or SPO is viewing their own experience, the app subtly shifts its visual identity to match their tier:

- Emerging: neutral palette, no special treatment
- Bronze: warm bronze accent on nav active indicator, score displays, card borders
- Silver: cool silver accent, subtle metallic sheen on score hex
- Gold: warm gold accent, soft glow on score displays, gold nav indicator
- Diamond: cyan-diamond accent, prismatic glow effects on score hex
- Legendary: deep purple-gold accent, particle effects on score display, pulsing nav indicator

This is NOT just the score badge — it's the nav underline, the card borders, the glow on the header, the loading skeleton color. The tier colors cascade via CSS variables set by `TierThemeProvider`. The user FEELS their tier without being told.

For citizens viewing a DRep's profile: the profile page adopts that DRep's tier ambient. You walk into their tier world.

1.4 — **New `GovernadaShell` layout**

- `app/(governada)/layout.tsx` — the new layout group
- Desktop: `GovernadaHeader` with 4 nav items + wallet + ⌘K
- Mobile: `GovernadaBottomNav` with 4 tabs
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
- `/developers` → keep as standalone route outside `(governada)` group, similar to `/embed/*` and `/admin/*`. Developer docs are a different audience (API consumers) and don't need the civic shell. Link to it from footer and ⌘K only.

  1.6 — **Feature flag: `governada_frontend`**

- When off, serve old layout + routes (no disruption)
- When on, serve new GovernadaShell + new routes
- Allows progressive rollout

  1.7 — **`GovTerm` component**

- Build the contextual education tooltip component (see Contextual Education section above)
- Populate initial term definitions in `lib/microcopy.ts`
- Progressive dismissal logic (localStorage, 3-view threshold)
- Apply to all subsequent surfaces as they are built in Phases 2-5

  1.8 — **Metadata architecture**

- Every route in `(governada)` gets a `generateMetadata()` function with:
  - Dynamic title: "Governada — [Page Name]"
  - Description tailored to route (DRep profiles get DRep-specific descriptions)
  - OG image: route-specific (DRep/SPO profiles use existing OG generation, Pulse uses GHI OG, Home uses branded default)
  - Twitter card: `summary_large_image` for profiles and proposals
  - Canonical URLs for all redirected old routes
  - JSON-LD structured data for DRep and SPO profiles (Person schema with governance attributes)

**Deliverables:** New navigation works, old pages render in new shell, segment detected on wallet connect. `GovTerm` ready for use in all subsequent phases. Metadata architecture ensures every route is SEO-ready from day one.

---

### Phase 2: Home & Discover (Discovery Experience)

**Goal:** The two most-visited destinations redesigned from scratch.

#### First Visit Experience (The 10-Second Pitch)

A new citizen must understand the product within 10 seconds. No wallet connected:

1. **Second 0-3:** Constellation renders — immediate visual impact. Governance nodes pulse. The user sees something alive and thinks "what is this?"
2. **Second 3-6:** Value prop fades in over constellation: "Cardano has a government. Know who represents you." Short, opinionated, specific.
3. **Second 6-10:** CTA pulses: "Find Your Representative — 60 seconds." Ambient stats counters tick: "4,312 governance votes analyzed."

No cookie banners, no modals, no onboarding flows, no "welcome to..." interstitials. The constellation IS the onboarding. First interaction is the Quick Match CTA.

**Technical:** Constellation must render meaningfully within 3 seconds. SSR the stat counters, lazy-load the WebGL constellation with a gradient placeholder, prioritize LCP on the value prop text. The existing GPU tier detection in `GovernanceConstellation.tsx` already handles performance tiers — use the low-GPU fallback (gradient + floating dots) as the initial paint, upgrading to full WebGL once loaded.

#### Home vs My Gov: The Distinction

**Home = the glance.** What you see when you open the app. One score, one action, one trend. Answers: "How am I doing right now?" in 3 seconds. Designed for daily check-in, 10 seconds of attention.

**My Gov = the workspace.** Where you sit down and DO governance. Full score breakdown, all pending actions, complete delegator analytics, profile management. Designed for 5-30 minute work sessions.

**Implementation rule:** Home surfaces ONLY data that already exists via simple API calls (score, tier, rank, epoch summary). No complex computed feeds. Quick wins on Home are a maximum of 1 card, pulled from the same action feed API that My Gov uses but limited to the highest-priority item.

#### Constellation Behavior by Segment

- **Anonymous:** Full-screen hero (85vh). The product pitch.
- **Undelegated:** Half-screen (40vh) background, Quick Match overlaid. Constellation shows "your voice isn't connected yet" — user's node floats unlinked.
- **Delegated citizen:** Constellation shrinks to a decorative header element (15vh, blurred, ambient). Hero content is the DRep report card.
- **DRep:** No constellation. Score hero replaces it entirely. DReps are producers, not explorers.
- **SPO:** No constellation. Pool governance hero replaces it.

Technical: the existing `ConstellationHero.tsx` already has expanded/contracted states. Add a `mode` prop: `'hero' | 'ambient' | 'hidden'` controlled by segment.

#### Data Dependency Notes

- DRep Home "Quick Win" card (Task 2.3): uses `/api/dashboard/urgent` (already built). Does NOT require Phase 4 action feed architecture.
- DRep Home competitive context (Task 2.3): uses `/api/dashboard/competitive` (already built).
- Citizen Home DRep report card (Task 2.2): uses `/api/governance/report-card` (already built).
- SPO Home claim prompt (Task 2.4): uses `/api/spo/claim` status check (already built).
- All Home page data sources exist today. Phase 2 is NOT blocked by Phase 4.

**Tasks:**

2.1 — **Home page — anonymous/undelegated**

**VP1 contract:** Constellation fills 75% of viewport. Overlaid bottom-left: one-line value prop + glowing "Find Your Representative" CTA. Overlaid bottom-right: 3 live stats (total DReps, active proposals, participation rate) as ambient counters. No cards, no grids, no text walls. The constellation IS the product pitch — governance is alive, visual, connected. A user who never scrolls sees a living governance universe and one clear action.

- Hero: "Cardano has a government. Know who represents you."
- Constellation visualization (keep existing, polish — see constellation behavior above)
- Social proof strip below constellation: "12,000+ delegators use Governada to track their governance | 300+ DReps scored | 2,800+ SPOs tracked" — numbers pulled from `/api/stats/claimed` and governance stats
- Live governance stats (total DReps, active proposals, participation rate) as ambient counters overlaid on constellation

**Quick Match inline design:**

- "Find Your Representative" CTA triggers a bottom sheet (mobile) or inline expansion (desktop) — NOT a page navigation
- 3 governance value questions, one at a time, with animated transitions. Existing question set from `/match` is reused.
- Real-time radar builds as user answers — the user watches their governance profile form
- Results: top 3 DRep matches with confidence %, compact radar overlay, one-tap delegate button
- "Want better accuracy?" link → DNA Quiz (full `/discover` quiz flow)
- Post-match: celebration micro-animation + share CTA ("Share your governance values")
- Critical: the matching API (`/api/governance/quick-match`) and underlying `lib/matching/` infrastructure are already built. This is purely a UX redesign of the container.

**SPO matching toggle (scaffolded):** After DRep results render, a subtle toggle: "Also find an SPO aligned with your values." Same 3 answers, different result set via `/api/governance/quick-match-pool` (already built). Not prominent in Phase A — just scaffolded.

2.2 — **Home page — delegated citizen**

**VP1 contract:** Your DRep's name, score hex (tier-colored), and one-sentence verdict ("Voted on 4/5 proposals this epoch. Alignment: strong."). Below: one urgent action card if applicable, otherwise epoch recap CTA. The constellation shrinks to a decorative background element. VP1 answers: "Is my governance voice being used well?" in 3 seconds.

- DRep report card headline: name, score, tier badge, trend arrow
- "This epoch:" vote summary, alignment status, drift warning if applicable
- One action card max: top-priority item (proposals needing attention OR epoch recap CTA)
- Achievement feed (latest milestone)

  2.3 — **Home page — DRep**

**VP1 contract:** Score hero (number, tier badge, rank) dominates top-left. Momentum arrow + spark line top-right. Below: one "Quick Win" action card with estimated score impact. VP1 answers: "How am I doing, and what should I do next?" Zero scrolling required for the answer.

- Score hero: score, tier badge with visual treatment, rank, momentum
- One "Quick Win" card: "Submit rationale on Proposal X (+3 pts estimated)" — from `/api/dashboard/urgent`
- Competitive context: nearby DReps, movement — from `/api/dashboard/competitive`
- Delegator headline: count, trend

  2.4 — **Home page — SPO**

**VP1 contract:** Pool governance score hero with tier badge, rank among governance-active SPOs. Claim prompt if unclaimed dominates VP1. VP1 answers: "How is my pool's governance standing?"

- Claim prompt if unclaimed (dominates entire VP1 if pool is unclaimed)
- Governance score hero + competitive context
- Delegator headline: count, trend (from `spo_power_snapshots`)

  2.5 — **Discover — unified browse**

**VP1 contract:** Tab bar + search/filter controls + first row of cards visible immediately. No hero, no intro text. Discovery starts in VP1.

- Tab bar: DReps | SPOs | Proposals | Committee
- Each tab has filters, search, sort
- DRep/SPO cards show: name, tier badge, score, top alignment dimensions, action button
- Proposal browse cards show:
  - Title + AI category badge
  - Treasury impact: "4.2M ADA (0.12% of treasury)" — from `/api/treasury/current` balance
  - Tri-body vote summary: compact DRep/SPO/CC vote bars
  - Your DRep's vote: highlighted if delegated ("Your DRep voted Yes")
  - Similar proposals count: "Similar to 3 past proposals" — from `proposal_similarity_cache`
  - Urgency: epoch countdown badge ("Expires in 2 epochs")
  - This is the "how does this app know all this?" card. Every fact from a different system, unified into one glanceable surface.
- Compare mode: select 2-3 DReps/SPOs for side-by-side
- Quick Match embedded as prominent CTA when no wallet connected
- Social proof subtitle: "Used by [X] DReps to build their reputation"

  2.6 — **Custom DRep/SPO card component**

- Tier-colored border/glow
- Score displayed as hex badge (existing) with tier overlay
- Compact alignment radar
- "Match %" if user has profile

  2.7 — **Leaderboard** (within Discover)

Leaderboards are discovery tools — users browse them to find DReps/SPOs. They belong in Discover, not Pulse.

- Add a "Leaderboard" tab alongside DReps / SPOs / Proposals / Committee (or make it an alternate view mode within the DReps/SPOs tabs)
- DRep and SPO leaderboards by governance score
- Biggest movers this epoch (gamification hook)
- Tier distribution visualization
- Filterable by dimension/category

**Deliverables:** Home is segment-aware and action-first. Discover consolidates 4 old pages into unified browse with leaderboard.

---

### Phase 3: Pulse (State of the Nation)

**Goal:** Comprehensive governance health view — the "news desk" of Cardano governance.

**VP1 contract:** GHI score hero with trend spark line dominates. Below: epoch progress bar, active proposals count, treasury health one-liner. VP1 answers: "How healthy is Cardano's governance right now?" in one glance. If authenticated, personalized: "Your DRep's activity this epoch" one-liner above GHI.

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

  3.5 — **Cross-Chain Observatory** (absorbed from `/decentralization`)

- EDI comparison: Cardano vs Ethereum (Tally) vs Polkadot (SubSquare)
- Chain-native metrics — no scores/grades, just raw participation + decentralization data
- AI-generated insight: "Cardano's governance participation is 3x higher than Ethereum's delegate system"
- Visual: horizontal comparison bars, not tables
- Data source: `lib/crossChain/chainMetrics.ts` (already built)

  3.6 — **Governance Calendar**

- Epoch-based timeline of proposal deadlines, voting windows, epoch boundaries
- Replaces standalone `/governance` calendar view
- Restyle existing `GovernanceCalendar.tsx` component for Pulse layout
- Surface upcoming deadlines as `ActionCard` items in My Gov action feed ("3 proposals expire in 2 days")
- Add redirect: `/governance/calendar` → 301 to `/pulse`

**Deliverables:** Pulse is the "State of the Nation" destination. Treasury, decentralization, cross-chain observatory, and governance calendar absorbed. Leaderboard lives in Discover (Task 2.7).

---

### Phase 4: My Gov (Civic Command Center)

**Goal:** The most important destination — where governance HAPPENS for each segment.

**VP1 contract (all segments):** My Gov VP1 shows the user's governance status + their single most urgent action. Citizens see DRep report card + top action. DReps see score dashboard + top action. SPOs see pool score + top action. The workspace depth is below the fold — VP1 is always "here's what matters right now."

#### Empty State Design Principle

**Empty states are onboarding moments, not dead ends.**

- Citizen with no actions pending: "Your governance is healthy. Your DRep [name] voted on all proposals this epoch." (Positive reinforcement, not emptiness.)
- DRep with no pending proposals: "No proposals need your vote. Use this time to write a governance statement, update your philosophy, or review your rationale quality."
- Newly connected wallet (undelegated): My Gov IS the Quick Match flow — the entire page is the delegation onboarding. No empty feed, no "connect to see more."
- SPO unclaimed: "This pool is yours. Claim it to build your governance reputation." Full claim CTA as the page hero.
- Every empty state has one clear action. Never show a blank feed with "Nothing here yet."

**Tasks:**

4.1 — **Action feed architecture**

- Feed of `ActionCard` components, each with:
  - Context (what happened / what needs attention)
  - One primary CTA button
  - Predicted score impact (where applicable)
  - Timestamp / urgency indicator
- Actions sourced from: pending proposals, alignment drift, score changes, tier progress, achievements, epoch transitions
- **Extensibility:** Design ActionCard with a `variant` prop or composition pattern that allows Phase B to add new card types (Wrapped card, statement card) without modifying the base component. The action feed source list should be implemented as a pluggable source registry, not hardcoded. Phase B adds: Wrapped notifications, DRep statement notifications, weekly digest notifications.
- **Deep-link parameter handler:** Build a generic `useDeepLinkAction()` hook that reads `?action=` from the URL and dispatches to registered handlers. Phase A registers: `action=celebrate-tier`, `action=view-drift`.

  4.2 — **Citizen command center**

- **"Did Your DRep Represent You?"** — the primary accountability feature. Full-width card at the top of the citizen command center showing: alignment match %, drift status (stable/drifting/diverged), votes cast vs missed, rationale quality summary, personalized recommendation ("Your DRep is representing you well" or "Consider reviewing alternatives"). This is the headline of the citizen experience, not a tab — it answers the question every delegator should ask.
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

**SPO Claim Flow (detailed):**

- Entry: "Claim this pool" CTA on pool profile page OR "Claim your pool" in My Gov SPO command center
- Verification: wallet signature proving pool ownership (reward address or owner address match — already built in `lib/walletDetection.ts` `detectPoolOwnership()`)
- On success: celebration overlay (reuse `CelebrationOverlay`) + "Set up your governance profile" CTA → governance statement editor
- Mirror the existing DRep claim flow at `/claim/[drepId]` (`ClaimPageClient.tsx`) but adapted for pool context
- API: `/api/spo/claim` (already exists)

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

**VP1 contract:** Hero viewport: avatar, name, tier badge with visual treatment, score hex, rank, personality label, one-line AI narrative. The profile page adopts the DRep's tier ambient (via `TierThemeProvider`). A user who never scrolls sees a complete governance identity.

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
- **Phase B scaffold:** Add a "Statements" tab to the profile tab system. When feature flag `drep_communication` is off, the tab is hidden. When enabled, it renders the position statements feed. This prevents Phase B from having to restructure the profile page.

  5.2 — **SPO profile redesign**

**VP1 contract:** Mirrors DRep profile VP1 — pool name, SPO Score hex, tier badge, rank among governance-active SPOs, governance statement. Tier ambient applied. VP1 answers: "How seriously does this pool take governance?"

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

**VP1 contract:** Title, AI category badge, tri-body vote bars, your DRep's vote highlighted, treasury impact fraction, epoch countdown. VP1 answers: "What is this proposal, how did governance bodies vote, and what does it mean for me?"

- AI classification badge + summary
- Tri-body vote bars (DRep, SPO, CC) — custom visualization
- Your DRep's vote highlighted (if delegated)
- Score impact prediction: "If [DRep] votes Yes → estimated +2 points"
- Similar proposals with delivery track record: "Similar to 3 past proposals (2 delivered, 1 partial)"
- Treasury impact: "4.2M ADA (0.12% of treasury)" — shown for all treasury proposals
- Epoch countdown badge: "Expires in 2 epochs"
- Discussion/rationale feed from voting representatives
- Action: Share opinion, track outcome
- **Phase B scaffold:** Add "What representatives are saying" section header and container. When no position statements exist, show contextual empty state: "No representatives have commented on this proposal yet." Phase B populates it.

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
- Every shareable card includes "via Governada" branding + URL
- Share preview images (OG) always include the Governada logo — already enforced by `lib/og-utils.tsx` `OGFooter`

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

The redesign uses a **route group** (`(governada)`) alongside existing routes, gated by `governada_frontend` feature flag.

1. **Phase 1 ships:** New shell and nav live behind flag. Toggle on for testing.
2. **Phase 2-5 ship:** Each destination built and tested. Old routes still work.
3. **Phase 6 ships:** Polish pass. Full QA on new experience.
4. **Cutover:** Enable flag for all users. Old routes serve 301 redirects. Legacy page components archived (not deleted immediately).

No big-bang migration. Progressive, flag-controlled, reversible.

---

## Performance Targets

- **LCP (Largest Contentful Paint):** < 2.5s on home page (constellation gradient placeholder counts as LCP, WebGL upgrades after)
- **Route transitions:** < 300ms between destinations (perceived — skeleton can render while data loads)
- **Time to Interactive:** < 3.5s on first load, < 1.5s on subsequent (service worker cached)
- **API response budget:** All segment-aware APIs (detect-segment, tiers, report-card) < 500ms. Action feed APIs < 1s.
- **Bundle budget:** Constellation WebGL lazy-loaded. No page-level bundle > 150KB gzipped.
- **TanStack Query polling:** Score data = 5 min stale time. Proposals = 2 min. Pulse data = 10 min. Action feed = 1 min.
- **Skeleton rendering:** Every page renders a branded skeleton within 100ms of navigation. Never a blank screen.

---

## Accessibility

This is a governance tool — democratic participation should be maximally accessible.

- WCAG 2.1 AA compliance target
- All custom visualizations (constellation, radar, vote bars) must have text-based alternative representations. Constellation: screen reader announces top DReps as a list. Radar: dimension scores as a table.
- Tier colors must maintain 4.5:1 contrast ratio against backgrounds in both light and dark mode
- All interactive elements keyboard-navigable (Tab, Enter, Escape patterns)
- `prefers-reduced-motion` respected: constellation falls back to static, celebrations skip particle effects, transitions are instant
- `aria-live` regions for real-time score updates, action feed new items, epoch countdown
- Touch targets >= 44px throughout (not just Phase 6 — global constraint from day one)

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

### Measurement

PostHog is already instrumented (`lib/posthog.ts`, `lib/posthog-server.ts`). Instrument these events to validate the success criteria above:

- `governada_segment_detected` — segment type, wallet connected (yes/no)
- `governada_first_civic_action` — action type (delegate, match, share), time from landing (measures < 2 min target)
- `governada_quick_match_complete` — duration, result count, delegated (yes/no)
- `governada_tier_celebration_shown` — tier, entity type, shared (yes/no)
- `governada_share_triggered` — share type (X, link, download), content type (tier, achievement, profile, wrapped)
- `governada_action_feed_cta_clicked` — card type, action taken
- `governada_destination_viewed` — destination (Home/Discover/Pulse/My Gov), segment
- `governada_drift_alert_shown` — action taken (re-delegate, dismiss, view alternatives)
- `governada_education_chip_expanded` — term name (measures contextual education engagement)

Add events as each phase ships. Weekly PostHog dashboard review once Phase 2 is live.

---

## Estimated Effort

| Phase                          | Scope                                                                 | Estimate       |
| ------------------------------ | --------------------------------------------------------------------- | -------------- |
| Phase 1: Shell & Navigation    | Layout, nav, providers, redirects, flag, GovTerm, ambient tier        | 4-5 days       |
| Phase 2: Home & Discover       | 2 destinations, Quick Match inline, segment logic, cards, leaderboard | 6-8 days       |
| Phase 3: Pulse                 | GHI, treasury, observatory, epochs, trends                            | 4-5 days       |
| Phase 4: My Gov                | Command center × 5 segments, inbox, profile, empty states             | 6-8 days       |
| Phase 5: Profiles & Details    | DRep, SPO, Proposal pages, VP1 contracts, Phase B scaffolds           | 5-7 days       |
| Phase 6: Celebrations & Polish | Sharing, animations, mobile, a11y audit, performance audit            | 5-6 days       |
| **Total**                      |                                                                       | **30-39 days** |

---

## Preparing for Phase B

This redesign intentionally creates the **scaffolding** Phase B needs:

- **Governance Wrapped (B1):** Share modal and OG image infrastructure from Phase 6 directly supports Wrapped card generation. Epoch summary data from My Gov feeds into annual Wrapped.
- **DRep-to-Citizen Communication (B2):** Action feed architecture from Phase 4 is the delivery channel for DRep position statements. Profile page has the publishing surface.
- **Notification-Driven Civic Life (B3):** Inbox from Phase 4 and action feed cards are the notification consumption surfaces. Deep-linking to specific actions is built into the route structure.

Phase B adds content and mechanics to the surfaces Phase A builds. No structural rework needed.

---

## Phase B Scaffolding Requirements

Build these hooks in Phase A even though content comes later. Without them, Phase B has to restructure pages:

1. **DRep profile "Statements" tab** (Phase 5, Task 5.1): Add a tab to the profile tab system. When Phase B is not enabled (feature flag `drep_communication` is off), the tab is hidden. When enabled, it renders the statements feed. This prevents Phase B from having to restructure the profile page.

2. **Proposal detail "What representatives are saying" section** (Phase 5, Task 5.3): Add the section header and container. When no statements exist, show a contextual empty state: "No representatives have commented on this proposal yet." Phase B populates it.

3. **ActionCard variant system** (Phase 4, Task 4.1): Design ActionCard with a `variant` prop or composition pattern that allows Phase B to add new card types (Wrapped card, statement card) without modifying the base component. Use a registry or polymorphic pattern.

4. **My Gov action feed — extensible source list** (Phase 4, Task 4.1): The action feed sources list ("pending proposals, alignment drift, score changes...") should be implemented as a pluggable source registry, not hardcoded. Phase B adds: Wrapped notifications, DRep statement notifications, weekly digest notifications.

5. **Deep-link parameter handler** (Phase 4 or Phase 1): A generic `useDeepLinkAction()` hook that reads `?action=` from the URL and dispatches to registered handlers. Phase B registers: `action=view-wrapped`, `action=view-statement`. Phase A registers: `action=celebrate-tier`, `action=view-drift`.

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
