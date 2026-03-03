# Product "Wow" Plan — DRepScore

> The definitive product vision and execution plan for transforming DRepScore from a useful governance tool into the product that makes the entire crypto space say "wow."

**Created:** March 1, 2026
**Context:** Full product/UX critique and strategic planning session. See agent transcript for the raw conversation.

---

## Table of Contents

1. [Core Thesis](#core-thesis)
2. [What We Built vs What We Need](#what-we-built-vs-what-we-need)
3. [Session 1 — IA Restructure & Narrative Homepage](#session-1--ia-restructure--narrative-homepage)
4. [Session 2 — DRep Discovery Reimagined](#session-2--drep-discovery-reimagined)
5. [Session 3 — DRep Command Center](#session-3--drep-command-center)
6. [Session 4 — Shareable Moments & Viral Mechanics](#session-4--shareable-moments--viral-mechanics)
7. [Session 5 — Governance Citizen Experience](#session-5--governance-citizen-experience)
8. [Session 6 — Visual Identity & Polish](#session-6--visual-identity--polish)
9. [Session 7 — Treasury Intelligence Dashboard](#session-7--treasury-intelligence-dashboard)
10. [Session 8 — Platform Deepening & Strategic Bets](#session-8--platform-deepening--strategic-bets)
11. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
12. [Competitive Positioning](#competitive-positioning)

---

## Core Thesis

### The Problem With What We Built

DRepScore is an **information product** that needs to become an **experience product**.

The data layer is excellent: 4-pillar scoring model (V3), 51 API routes, Koios → Supabase → Next.js data pipeline, background sync via Inngest, multi-channel notifications, PostHog analytics, Observable dashboards. The engineering is genuinely impressive.

But the presentation layer treats every user as an **analyst who wants to evaluate data**. The homepage is a data table. The DRep detail page is a dashboard. The governance page is a report. The proposals page is a list. Everything is rational and informational.

The "wow" comes when you treat users as **citizens who want to feel empowered, informed, and part of something meaningful**.

### The Reframe

| Current Framing                 | "Wow" Framing                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| "Which DRep should I pick?"     | "What's happening with my money, is my voice being heard, and does my participation matter?" |
| DRep directory                  | Personal governance dashboard for every ADA holder                                           |
| DRep shopping (one-time action) | Governance citizenship (ongoing identity)                                                    |
| Information display             | Emotional experience with storytelling                                                       |
| Functional tool                 | Platform nobody in crypto has built for any chain                                            |

### Two-Sided Marketplace Dynamics

DRepScore is a two-sided marketplace. Both sides need to feel the product is indispensable:

**ADA Holders (demand side):** Currently treated as DRep shoppers. Need to be treated as governance citizens with financial stakes, ongoing representation monitoring, and community identity.

**DReps (supply side):** Currently given a read-only report card. Need a command center with delegation management, competitive context, gamified improvement, positioning tools, and the feeling that DRepScore is where their reputation lives.

**The flywheel:** DReps engage → data gets richer → delegators find more value → more delegators use the platform → DReps need to be on the platform → DReps invest in their score → data gets even richer.

### Design Principles for "Wow"

1. **Story first, data second.** Every screen should tell a story before showing a spreadsheet.
2. **Financial stakes are real.** Connect governance to ADA holdings. Make it personal.
3. **Emotional moments matter.** Celebration, warning, pride, discovery — design for feelings, not just information.
4. **Mobile is primary.** The majority of crypto users are mobile-first. Design for phones, adapt for desktop.
5. **Viral by design.** Every feature should have a shareable output. If it can't be screenshotted and posted, add a way.
6. **Progressive complexity.** Simple by default, powerful on demand. Never overwhelm a new user.
7. **Return users are different from new users.** The homepage should adapt. "Since you were last here" is more valuable than "Welcome to DRepScore."

---

## What We Built vs What We Need

### Information Architecture — Current

```
/ (Homepage)
├── Hero "Your ADA. Your Voice." + 3 step cards
├── GovernanceWidget (small, for connected users)
└── DRepTableClient (the main table)

/drep/[drepId] — DRep detail (score card, history, votes)
/compare — Side-by-side comparison (radar, trends, overlap)
/proposals — Proposal list
/proposals/[txHash]/[index] — Proposal detail + voters
/governance — My Governance (auth-gated, delegation health, representation score)
/dashboard — DRep Dashboard (auth-gated, for DRep owners)
/dashboard/inbox — Governance inbox for DReps
/profile — User profile, prefs, watchlist
/claim/[drepId] — Claim DRep profile
/methodology — Scoring methodology (standalone dead-end page)
/admin/integrity — Admin dashboard
```

**Header Nav:** Proposals | Methodology | My Governance (auth) | DRep Dashboard (DRep/admin) | Inbox (badge)

### Information Architecture — Target

```
/ (Homepage — DUAL MODE)
├── Unauthenticated: Story-first governance pulse + financial stakes + discovery preview
└── Authenticated: Personal governance hub + "since last visit" + delegation health + discovery

/discover — Full DRep discovery (table + card views, all power-user filters)
/drep/[drepId] — DRep detail (enhanced with score storytelling)
/compare — Side-by-side comparison (keep, enhance)
/proposals — Governance feed (living newsfeed, not archive)
/proposals/[txHash]/[index] — Proposal detail (impact framing, prominent polls)
/governance — My Representation (merged governance + profile)
/dashboard — DRep Command Center (enhanced)
/dashboard/inbox — Governance inbox (enhanced)
/claim/[drepId] — Claim flow (overhaul with FOMO + ceremony)
/pulse — Governance ecosystem health (public)
```

**Header Nav:** Discover | Proposals | My Governance (auth) | DRep Dashboard (DRep)

**Kill:** `/methodology` as standalone page → replace with progressive disclosure inside score cards.
**Kill:** `/dev/delegation-test` → dev-only, remove before launch.
**Merge:** Governance + Profile → unified "My Governance" hub.
**New:** `/pulse` → Governance ecosystem health (public-facing).

### Components to Rethink

| Component                            | Current State                                       | Target State                                                                                                                             |
| ------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `HeroSection`                        | Static marketing copy, same for everyone            | Dual-mode: unauth sees governance pulse with financial stakes; auth sees personal governance summary                                     |
| `DRepTableClient`                    | Table with 8+ visible controls, overwhelming        | Default: search + sort; everything else behind progressive "Filters" expand; card view toggle for mobile                                 |
| `HomepageShell`                      | Orchestrates table + onboarding                     | Orchestrates dual-mode homepage experience (no onboarding wizard; quiz moves to /discover)                                               |
| `GovernanceWidget`                   | Small widget on homepage for connected users        | Promoted to hero component for authenticated homepage                                                                                    |
| `GovernanceDashboard`                | Full page at `/governance`                          | Core content integrated into authenticated homepage                                                                                      |
| `DelegationInsightBanner`            | Dismissible banner below header                     | Integrated into homepage layout, not a banner                                                                                            |
| `OnboardingWizard`                   | 3-step dialog: welcome → 6 value cards → done       | **Kill.** Replace with non-blocking Governance DNA Quiz on /discover (Session 2). Users vote on real proposals, not abstract categories. |
| `ScoreCard`                          | Dense dashboard with ring, bars, hints              | Add score storytelling: what does this score MEAN for the delegator                                                                      |
| `EmptyState`                         | Generic icon + title + message                      | Contextual storytelling: guide, educate, motivate                                                                                        |
| `DRepDashboard`                      | Read-only recommendations + missing rationale table | Actionable command center with inline rationale assistant, delegator analytics                                                           |
| `GovernanceInboxWidget`              | Top proposals with score impact                     | Enhanced with rationale assistant integration                                                                                            |
| `ClaimPageClient`                    | Score + 3 value props + CTA                         | FOMO-driven: show platform activity, delegator search volume, competitive positioning                                                    |
| `ValueSelector` / `OnboardingWizard` | 6 static value cards                                | **Kill entirely.** Governance DNA Quiz replaces both.                                                                                    |

---

## Session 1 — IA Restructure & Narrative Homepage

### Goal

Transform the homepage from a table-first data display into a story-first governance experience that adapts to user state. Restructure navigation to follow user intent, not product architecture.

### Problems This Solves

- First-time visitors see a data table and don't understand why they should care
- No urgency, no financial stakes, no emotional hook
- Returning connected users scroll past marketing copy they've already internalized
- Best feature (governance dashboard) is buried behind auth on a sub-nav link
- Homepage hero is dead weight for returning users
- Nav organized by feature, not user journey
- `/methodology` is a dead-end academic document

### Specific Changes

**1. Kill `/methodology` as standalone page**

- Remove from navigation
- Move scoring explanation into progressive disclosure inside `ScoreCard` and DRep detail pages
- Add expandable "How is this calculated?" sections to each pillar
- This reclaims a nav slot and keeps users in-flow

**2. Restructure header navigation**

- Old: Proposals | Methodology | My Governance (auth) | DRep Dashboard (DRep/admin) | Inbox (badge)
- New: Discover | Proposals | My Governance (auth) | Dashboard (DRep)
- "Discover" links to `/discover` (the DRep table/card experience)
- "My Governance" merges current governance + profile into one authenticated hub
- Inbox badge moves into the My Governance section or stays as a notification bell

**3. Build dual-mode homepage**

**Unauthenticated mode — Story-first:**

- Hero: Live governance stats — total ADA under governance, active proposals count, votes cast this week, DRep participation rate. Animated/updating numbers (or at least fetched server-side for freshness). "X billion ADA is being governed right now. Do you know who's voting with yours?"
- Governance Pulse preview: "This week: [proposal title] is being decided. [X]% of DReps have voted. Community sentiment: [Y]% in favor." This creates urgency and context.
- "How it works" section: Keep the 3-step concept but make it more visual and less text-heavy
- Preview of the governance dashboard: Blurred/demo version showing what a connected user sees — delegation health, representation score, active proposals. CTA: "Connect your wallet to see your governance status."
- DRep discovery table below (simplified initial view, with "View all DReps" CTA linking to `/discover`)
- Kill the current static hero text that says the same thing every visit

**Authenticated mode — Personal governance hub:**

- Above-the-fold: "Since you were last here" summary — proposals opened/closed, your DRep's votes, score changes, new delegator activity
- Delegation health card (currently in GovernanceDashboard) — promoted to hero position
- Active proposals needing attention (from GovernanceDashboard) — with "X need your vote" badge
- Representation score (from GovernanceDashboard) — prominent with trend
- Re-delegation nudge (conditional, from GovernanceDashboard)
- Quick DRep discovery section below — "Explore DReps" link to `/discover`
- Kill the marketing hero entirely for authenticated users

**4. Integrate `DelegationInsightBanner` into layout**

- Stop rendering as a dismissible banner below the header
- Integrate the alignment/inactivity insight into the authenticated homepage cards
- The information is valuable; the delivery mechanism (dismissible banner) is not

**5. Create `/discover` route**

- Move the full DRep table experience (with all filters) to `/discover`
- Homepage shows a simplified preview of DRep discovery
- `/discover` becomes the power-user destination

**6. Server-render the initial data**

- Currently `DRepTableClient` fetches `/api/dreps` on mount (blocking first meaningful paint)
- Server-render the first page of DRep results in the homepage for instant load
- Client-side hydration takes over for filtering/sorting/pagination

### Files Affected

- `app/page.tsx` — Complete rewrite (dual-mode homepage)
- `app/discover/page.tsx` — New route (move table here)
- `app/methodology/page.tsx` — Delete (or redirect to homepage)
- `components/HeroSection.tsx` — Complete rewrite (dual-mode)
- `components/HomepageShell.tsx` — Complete rewrite (orchestrate dual-mode)
- `components/HeaderClient.tsx` — Nav restructure
- `components/Header.tsx` — Nav restructure
- `components/GovernanceDashboard.tsx` — Extract cards for homepage reuse
- `components/GovernanceWidget.tsx` — Promote to hero component
- `components/DelegationInsightBanner.tsx` — Kill as banner, integrate content into homepage
- `app/layout.tsx` — Remove DelegationInsightBanner from layout
- New: `components/GovernancePulse.tsx` — Live governance stats for unauth homepage
- New: `components/SinceLastVisit.tsx` — Returning user summary
- New: `components/HomepageAuth.tsx` — Authenticated homepage layout
- New: `components/HomepageUnauth.tsx` — Unauthenticated homepage layout
- New: API route for governance pulse stats (total ADA governed, active proposals, participation rates)

### Success Criteria

- A first-time visitor immediately understands the financial stakes of governance
- A returning connected user sees their governance status above-the-fold without scrolling
- No user sees marketing copy they've already internalized
- Time-to-value for new visitors decreases (measured by PostHog funnel: land → meaningful interaction)
- The homepage feels alive, not static

### Risks

- Server-rendered governance stats need a fast API (cache aggressively in Supabase)
- "Since last visit" requires tracking last visit timestamp per user (add to `users` table)
- Dual-mode complexity — need clean separation between auth/unauth experiences
- Moving the table to `/discover` changes the primary flow; need clear CTAs from homepage to discovery

---

## Session 2 — DRep Discovery Reimagined

### Goal

Transform DRep discovery from a desktop-first data table into a mobile-first, progressive, intelligent experience powered by **Governance DNA** — behavioral matching that learns how you'd govern from real decisions, not abstract labels. Kill the preference system entirely.

### The Systemic Change: Preferences → Governance DNA

The OnboardingWizard (6 abstract value cards) is replaced by the **Governance DNA Quiz** — a non-blocking, engaging quiz where users vote on real governance proposals and get matched to DReps based on actual vote agreement. This is the personalization engine for the entire platform going forward.

**What dies:** `OnboardingWizard`, `ValueSelector`, `UserPrefKey` as primary matching input, preference-based "Match %" column, the wizard-before-content anti-pattern.

**What stays (repositioned):** Pre-computed per-category alignment scores on `dreps` table — repurposed as DRep descriptive trait tags (labels on cards/profiles), not user-selected matching input. `poll_responses` table becomes the primary data source for matching. Existing representation score logic in `governance/holder` API already compares poll votes to DRep on-chain votes — this is extracted and generalized.

### Problems This Solves

- The DRep table is hostile on mobile (horizontal scroll, tiny text, 8+ filter controls)
- Discovery is a spreadsheet, not an experience
- The OnboardingWizard asks users to self-declare abstract ideologies before seeing any DReps — a gate, not a hook
- "Match %" is based on category-level proxies, not actual vote agreement
- Search is basic client-side substring matching with no intelligence
- Pagination is prev/next buttons instead of modern patterns
- All DReps fetched client-side, blocking first meaningful paint
- No visual DRep card format for casual browsing
- No quick preview without full-page navigation

### Specific Changes

**Phase 0: Session 1 Cleanup**

- Remove `OnboardingWizard` from `HomepageDualMode.tsx` (currently auto-opens if no prefs stored)
- Remove `openPreferencesWizard` event dispatch from `InlineDelegationCTA.tsx`
- Homepage (Session 1 output) stops gating on preferences immediately

**Phase 1: Server-rendered foundation + DRep cards**

- Server-render `/discover` with first 20 DReps from Supabase (kill the loading skeleton)
- New `DRepCard` component: avatar/initial, name, score ring, DRep trait tags (derived from `alignment_*` scores), pillar mini-bars, size/power, action buttons
- Responsive card grid: 1 column on mobile, 2 on tablet, 3 on desktop
- Toggle between card view and table view (persist in localStorage, default cards on mobile)
- Background hydration loads full dataset for client-side filtering

**Phase 2: Governance DNA Quiz + Progressive Filters**

- New `GovernanceDNAQuiz` component — non-blocking CTA above the DRep grid: "Find Your Ideal DRep in 60 Seconds"
- Quiz shows 5-7 real proposals that are maximally discriminating (close to 50/50 DRep vote split)
- Each question: proposal type badge, title, plain-language summary, financial context, Yes/No/Abstain buttons
- Quiz votes go directly into `poll_responses` (same table, same schema — zero new infrastructure)
- **The reveal:** Quiz card transforms into results showing top 3 matching DReps with vote agreement counts, delta vs current DRep, grid re-sorts by match
- New API route `GET /api/governance/quiz-proposals` — selects maximally discriminating proposals
- Progressive filter disclosure: search + sort always visible, filters behind expand button with active count badge
- Smart search with `fuse.js` fuzzy matching, suggestions dropdown, recent searches
- **Kill preference system:** Delete `OnboardingWizard.tsx`, gut preference management from `HomepageShell` and `DRepTableClient`, remove pref-based Match column

**Phase 3: Infinite scroll + Quick View**

- Replace prev/next pagination with `IntersectionObserver` infinite scroll + "Load more" fallback
- New `DRepQuickView` bottom sheet (mobile) / side sheet (desktop)
- Quick view shows: score breakdown, recent votes, Governance DNA match with vote-by-vote comparison (for users with quiz/poll data), DRep trait tags fallback (for users without)
- "View Full Profile" and "Delegate" CTAs

**Phase 4: Representation Matching Engine**

- Extract matching logic from `governance/holder` API into shared `lib/representationMatch.ts`
- New API route `GET /api/governance/matches` — returns match scores for all DReps based on user's poll history
- "Best Match" sort option on discovery page (available when user has >= 3 poll votes)
- Match % appears on cards/table rows, quick view shows vote-by-vote comparison
- Fix broken alignment score bug in `governance/holder` route (display-label key mismatch) by replacing with representation score
- Refactor governance dashboard to use shared matching functions

### Files Affected

- `components/HomepageDualMode.tsx` — Remove wizard integration (Phase 0)
- `components/InlineDelegationCTA.tsx` — Remove preference event dispatch (Phase 0)
- `app/discover/page.tsx` — Rewrite as server component with data fetching
- `lib/data.ts` — Add `getDRepsPage()` function
- `lib/alignment.ts` — Add `getDRepTraitTags()` utility
- `components/DRepTableClient.tsx` — Complete overhaul (remove prefs, add view toggle, infinite scroll, quiz integration)
- `components/DRepTable.tsx` — Remove pref-based Match column (re-added as behavioral match in Phase 4)
- `components/HomepageShell.tsx` — Gut preference management, add quiz CTA
- New: `components/DRepCard.tsx` — Card-based DRep display with trait tags / match %
- New: `components/DRepCardGrid.tsx` — Responsive card grid layout
- New: `components/GovernanceDNAQuiz.tsx` — The quiz experience
- New: `components/GovernanceDNAReveal.tsx` — Quiz results card
- New: `components/DRepQuickView.tsx` — Bottom/side sheet for quick preview
- New: `components/SmartSearch.tsx` — Fuzzy search with suggestions
- New: `components/FilterPanel.tsx` — Progressive filter disclosure
- New: `lib/representationMatch.ts` — Shared matching functions
- New: `app/api/governance/quiz-proposals/route.ts` — Quiz proposal selection
- New: `app/api/governance/matches/route.ts` — Discovery-page matching
- Kill: `components/OnboardingWizard.tsx` — Delete
- Kill: `components/ValueSelector.tsx` — Delete
- Update: `app/api/governance/holder/route.ts` — Refactor to use shared matching, fix broken alignment score

### Success Criteria

- A new user goes from landing on /discover to personalized DRep matches in under 90 seconds (quiz flow)
- Quiz completion rate > 60% of users who start it
- Mobile discovery feels native-app quality, not a shrunken desktop table
- Page loads with DReps visible in < 1 second (server-rendered)
- "Best Match" becomes the most-used sort option for users with quiz data
- OnboardingWizard is fully deleted from the codebase

---

## Session 3 — DRep Command Center (Implemented)

### Goal

Transform the DRep experience from a read-only report card into an actionable command center that makes DReps return weekly — with inline rationale authoring, delegator analytics, competitive leaderboard, delegator representation scoring, score simulation, activity heatmaps, gamification milestones, positioning tools, a FOMO-driven claim funnel, and shareable report cards.

### What Was Built

**Phase 1: Data Foundation + Claim Funnel**

- Migration `023_drep_command_center.sql`: 4 new tables (`drep_milestones`, `position_statements`, `vote_explanations`, `governance_philosophy`) + `users.onboarding_checklist` JSONB + `drep_power_snapshots.delegator_count` + RLS policies + updated_at triggers
- Claim page overhaul (`ClaimPageClient.tsx`): outcome-driven hero with live governance pulse stats, blurred dashboard preview, social proof (top claimed DReps), competitive nudge, lowest-pillar identification
- Post-claim celebration (`ClaimCelebration.tsx`): full-screen confetti, animated score reveal, pillar breakdown, "first 3 actions" checklist

**Phase 2: Dashboard Action Center**

- **Rationale dual-flow**: Pre-vote "Draft Rationale" buttons in GovernanceInboxWidget + post-vote "Explain Your Vote" in DRepDashboard with `VoteExplanationEditor` (off-chain explanations with AI assist, stored in `vote_explanations`, clearly labeled as DRepScore-native)
- **Vote explanations API**: `GET/POST /api/drep/[drepId]/explanations` with session auth
- **Delegator analytics**: `DelegatorTrendChart` + `GET /api/dashboard/delegator-trends` — voting power over time from `drep_power_snapshots`
- **Competitive context**: `CompetitiveContext` + `GET /api/dashboard/competitive` — rank, nearby DReps (2 above/below), top-10 path with pillar gap analysis
- **Onboarding checklist**: `OnboardingChecklist` + `GET/POST /api/dashboard/onboarding` — persistent interactive checklist stored in `users.onboarding_checklist`
- **Representation scorecard**: `RepresentationScorecard` + `GET /api/dashboard/representation` — aggregate DRep-vs-delegator alignment from `poll_responses` (min 3 responses per proposal), per-proposal breakdown, divergence alerts
- **Score simulator**: `ScoreSimulator` + `GET /api/dashboard/simulate` — interactive sliders for vote/rationale count, real-time score projection using actual scoring formula, rank impact, quick presets
- **Activity heatmap**: `ActivityHeatmap` — GitHub-style epoch grid from `drep_votes`, tooltip with vote/rationale counts, displayed on dashboard + public profile

**Phase 3: Gamification + Positioning**

- **Milestone system**: `lib/milestones.ts` (9 milestone definitions + check logic), `MilestoneBadges` component, `GET/POST /api/dashboard/milestones` — badges on dashboard + public profile
- **Governance philosophy**: `GovernancePhilosophyEditor` + `GET/POST /api/drep/[drepId]/philosophy` — free-text editor, read-only on public profile
- **Position statements**: `PositionStatementEditor` + `GET/POST /api/drep/[drepId]/positions` — pre-vote intent per proposal
- **Shareable report card**: `DRepReportCard` — score preview card, share on X, copy link

**Phase 4: Notifications + Dashboard Layout**

- **Notification wiring**: 5 new DRep-specific event types (`delegator-growth`, `rank-change`, `near-milestone`, `proposal-deadline`, `score-opportunity`) + Inngest `check-notifications` function wiring all 5 previously-untriggered types (`score-change`, `pending-proposals`, `urgent-deadline`, `delegation-change`, `profile-view`)
- **Dashboard layout overhaul**: Score hero + onboarding → left column (Inbox, Recommendations, Score Simulator, Score History) → right column (Competitive Context, Representation, Delegator Analytics, At a Glance, Activity Heatmap, Achievements, Profile Health) → bottom (Philosophy, Report Card)
- **Public profile enhanced**: Milestone badges (compact), governance philosophy (read-only), activity heatmap

### Data Model

| Table                                  | Purpose                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `drep_milestones`                      | `(drep_id, milestone_key)` PK, `achieved_at`                                       |
| `position_statements`                  | `drep_id`, `proposal_tx_hash`, `proposal_index`, `statement_text`                  |
| `vote_explanations`                    | `drep_id`, `proposal_tx_hash`, `proposal_index`, `explanation_text`, `ai_assisted` |
| `governance_philosophy`                | `drep_id` PK, `philosophy_text`                                                    |
| `users.onboarding_checklist`           | JSONB column for checklist state                                                   |
| `drep_power_snapshots.delegator_count` | INT column for historical delegator tracking                                       |

### New API Routes

| Route                             | Method   | Purpose                                    |
| --------------------------------- | -------- | ------------------------------------------ |
| `/api/drep/[drepId]/explanations` | GET/POST | Vote explanation CRUD                      |
| `/api/drep/[drepId]/philosophy`   | GET/POST | Governance philosophy CRUD                 |
| `/api/drep/[drepId]/positions`    | GET/POST | Position statement CRUD                    |
| `/api/dashboard/delegator-trends` | GET      | Delegator + power trends                   |
| `/api/dashboard/competitive`      | GET      | Rank, nearby DReps, top-10 gap             |
| `/api/dashboard/onboarding`       | GET/POST | Onboarding checklist state                 |
| `/api/dashboard/milestones`       | GET/POST | Milestone check + fetch                    |
| `/api/dashboard/representation`   | GET      | Delegator alignment scorecard              |
| `/api/dashboard/simulate`         | GET      | Score projection from hypothetical actions |

### New Components

| Component                    | Location                                           |
| ---------------------------- | -------------------------------------------------- |
| `ClaimCelebration`           | Post-claim confetti + score reveal + first actions |
| `VoteExplanationEditor`      | Off-chain vote explanation dialog                  |
| `DelegatorTrendChart`        | Voting power line chart over epochs                |
| `CompetitiveContext`         | Rank, nearby DReps, top-10 path                    |
| `OnboardingChecklist`        | Persistent post-claim checklist                    |
| `RepresentationScorecard`    | DRep-vs-delegator alignment                        |
| `ScoreSimulator`             | What-if score projection                           |
| `ActivityHeatmap`            | GitHub-style epoch voting grid                     |
| `MilestoneBadges`            | Achievement badges (full + compact)                |
| `GovernancePhilosophyEditor` | Philosophy editor/viewer                           |
| `PositionStatementEditor`    | Pre-vote position statement dialog                 |
| `DRepReportCard`             | Shareable score card with X share                  |

### Success Criteria

- DReps return to dashboard weekly (PostHog `dashboard_viewed` frequency)
- Claim conversion rate increases (`claim_page_viewed` → `claim_completed`)
- On-chain rationale rate increases via pre-vote drafting flow
- Vote explanation adoption: >30% of missing-rationale votes get DRepScore explanations within first month
- At least 10 DReps share report cards in first month
- Onboarding checklist completion rate > 50%
- Representation Scorecard engagement: >50% of claimed DReps view within first month
- Score Simulator usage: >30% of dashboard visitors interact with sliders
- All 5 previously-untriggered notification types fire within first week

---

## Session 4 — Shareable Moments & Viral Mechanics

### Goal

Build the organic growth engine. Every feature should have a shareable output. Create mechanics that spread without the user explicitly deciding to share.

### Problems This Solves

- Sharing is limited to "Share on X" and "Copy Link" — minimum viable social
- No organic DRep acquisition funnel (how do DReps discover DRepScore?)
- No embeddable content that lives outside the platform
- No viral moments designed into the user journey
- Score changes happen silently
- Delegation is a transaction, not a ceremony
- No leaderboard creating competitive content

### Specific Changes

**1. Embeddable DRep score badges**

- PNG/SVG badges at `/api/badge/[drepId]` (route already exists — enhance it)
- Multiple formats: shield (like GitHub badges), card (like npm badges), full (mini score card)
- Markdown/HTML embed code with one-click copy: `![DRepScore](https://drepscore.io/badge/drep1...)`
- DReps put these in: Twitter/X bio, forum signatures, governance proposals, personal websites
- This is the #1 growth loop: badges link back to DRepScore, creating inbound traffic from everywhere DReps are active
- Auto-updating: badge re-generates on each request (cache with short TTL)
- "Get your badge" prominent CTA on DRep dashboard and claim page

**2. "Wrapped-style" shareable score cards**

- Beautiful, auto-generated images designed for social sharing (1080x1080 for X, 1080x1920 for stories)
- For DReps: "My DRepScore this month: 82/100. Voted on 12 proposals. Provided rationale on 10. Top 8% of DReps."
- For delegators: "I'm delegated to [DRep Name]. They scored 85/100 and voted on 100% of proposals this month. Who's your DRep?"
- "Who's your DRep?" becomes a social mechanic: people share, others check their own, creates a loop
- Generate via server-side canvas/OG image route — optimize for visual impact
- Share buttons: X, copy image, download

**3. Delegation ceremony**

- When a user delegates through the platform (or we detect a new delegation on-chain):
  - Full-screen celebration: confetti, animated score reveal of their new DRep
  - "You're now a Governance Guardian" messaging
  - Shareable card: "I just delegated to [DRep Name] on DRepScore. My voice in Cardano governance is now active."
  - Social proof: "You're one of X active Governance Guardians"
  - Track and surface this moment: the canvas-confetti dependency is already installed but underutilized

**4. Score change moment cards**

- When a DRep's score changes significantly (±5 points), auto-generate a shareable moment card
- "DRep X gained 8 points this month after improving rationale quality from 40% to 75%"
- For the DRep: push notification + "Share your progress"
- For delegators watching: watchlist alert + "DRep X on your watchlist is improving"
- Design these as beautiful, branded cards that look great in a tweet

**5. Public leaderboard**

- `/leaderboard` or section on `/pulse` page
- Top 20 DReps by score, filterable by size tier
- Weekly movers: biggest score gains and drops
- "Hall of Fame": DReps who've maintained score above 80 for 90+ days
- This creates competitive content: DReps share their ranking, debate positions
- Leaderboard entries link to profiles, driving traffic

**6. Governance Pulse public page**

- `/pulse` — the public face of Cardano governance health
- Total ADA governed, active proposals, participation rates, rationale rates
- Trend charts: governance health over time
- "This week in governance" summary
- Community sentiment vs DRep voting gap analysis
- Designed to be the page journalists, researchers, and community leaders link to
- Shareable stats: each stat has a share button that generates an image

**7. OG image overhaul**

- Current OG images (`/api/og/drep/[drepId]`, `/api/og/compare`) — enhance visual quality
- Make them look like premium cards, not basic text layouts
- Include score ring visualization, pillar summary, key stats
- Compare OG image should show the radar chart comparison
- These are what people see when links are shared on X, Discord, Telegram

### Files Affected

- `app/api/badge/[drepId]/route.ts` — Enhance with multiple formats
- `app/api/og/drep/[drepId]/route.ts` — Visual overhaul
- `app/api/og/compare/route.ts` — Visual overhaul
- New: `app/pulse/page.tsx` — Governance Pulse public page
- New: `app/leaderboard/page.tsx` (or section of `/pulse`)
- New: `components/ShareableScoreCard.tsx` — Wrapped-style cards
- New: `components/DelegationCeremony.tsx` — Full-screen celebration
- New: `components/BadgeEmbed.tsx` — Badge preview + embed code copy
- New: `components/LeaderboardTable.tsx`
- New: `components/GovernancePulseStats.tsx`
- New: `components/ScoreChangeMoment.tsx`
- New: API routes for leaderboard data, governance pulse stats
- Enhancement: Inngest functions to detect significant score changes and trigger moment card generation

### Success Criteria

- Embeddable badges appear on 20+ DRep external profiles within first month
- "Who's your DRep?" shares generate measurable inbound traffic
- Governance Pulse page becomes the most-linked DRepScore URL
- Delegation ceremony completion → social share rate > 15%
- DRep leaderboard creates organic X/Twitter discussion

---

## Session 5 — Governance Citizen Experience

### Goal

Build the features that transform ADA holders from passive DRep shoppers into active governance citizens. This is the differentiator that no other crypto governance tool has built — the first governance _relationship_ platform.

### Problems This Solves

- Financial stakes of governance are invisible to ADA holders
- No personal governance timeline or history
- No "what if" delegation intelligence (proactive, not just when rep score < 50%)
- Watchlist is passive filtering, not active intelligence
- No governance calendar or forward-looking view
- No community pulse beyond isolated proposal polls
- No governance digest / "since you were last here" depth
- No delegator collective identity
- No sense that participation is consequential

### Specific Changes

**1. Financial impact framing on proposals**

- Every proposal page shows financial context:
  - Treasury proposals: "This would withdraw X ADA (Y% of the Z ADA treasury)"
  - Parameter changes: "This changes [parameter] from X to Y. Here's what that means for staking rewards / fees / block sizes."
  - Hard forks: "This is a fundamental protocol change. Only N have been proposed in Cardano's history."
- On the homepage governance pulse: "X billion ADA is under governance. Y ADA has been requested from the treasury this quarter."
- ADA-denominated thinking throughout: if we know the user's wallet balance, show "Your X ADA gives your DRep Y% of their voting power"

**2. Personal governance timeline**

- `/governance/timeline` or section within My Governance
- Chronological story: "Connected March 1 → Delegated to DRep X March 5 → DRep X voted Yes on Proposal Y March 8 → You polled Abstain on Proposal Y March 10 → DRep X's score rose 3 points March 15 → You gained Governance Guardian status"
- Visual timeline with icons for each event type
- Events: wallet connection, delegation changes, DRep votes on your behalf, your poll votes, score changes, milestone achievements, proposal outcomes
- Data sources: `users` table (connection/delegation), `drep_votes` (DRep activity), `poll_responses` (user polls), `drep_score_history` (score changes)
- This creates a narrative of ongoing participation, not a snapshot

**3. "What if" delegation intelligence (deepens Session 2 Governance DNA)**

- Session 2 builds the foundation: Governance DNA Quiz, `representationMatch.ts`, `/api/governance/matches`, "Best Match" sort on /discover
- Session 5 deepens this with **proactive suggestions and triggers** on the governance dashboard:
- "Based on your 12 poll votes, here's how other DReps would represent you:" (top 3 best-match DReps with profile link)
- Current DRep's match rate for comparison: "Switch to DRep Y for 92% representation (vs 61% current)"
- Trigger: recalculate and surface a nudge whenever user casts a new poll vote
- The representation matching engine (`lib/representationMatch.ts`) is shared between /discover and /governance — Session 5 adds proactive triggers, not duplicate logic

**4. Watchlist intelligence**

- Transform watchlist from passive filter to active monitoring tool
- Watchlist dashboard section (in My Governance):
  - "DRep X dropped 8 points this week after missing 3 critical votes"
  - "DRep Y published rationale on the treasury proposal — here's what they said"
  - "DRep Z gained 50 delegators this month — fastest growing on your watchlist"
- Watchlist notifications: push/email alerts when watched DReps have significant events
- "Why you're watching vs why you're delegated" tension: "DRep Z on your watchlist has an 88% representation match vs your current DRep's 61%" (based on Governance DNA / poll vote comparison)

**5. Governance calendar / "what's coming"**

- Section on homepage (auth mode) and My Governance
- Next epoch boundary with countdown
- Proposals expiring this epoch with urgency markers
- Recently opened proposals
- Historical: recent proposal outcomes
- Future: any known upcoming governance events
- Simple timeline view, not a full calendar — think "upcoming" section in a news app

**6. Community governance pulse**

- Aggregate poll data into community-wide insights:
  - "72% of polled delegators support Proposal X, but only 45% of DReps voted Yes"
  - "Growing gap between community sentiment and DRep voting on treasury proposals"
  - "Delegators who voted No on treasury proposals are 80% opposed to this withdrawal" (behavioral cohort derived from poll data, not self-selected labels)
- Visible on proposal pages and on the `/pulse` public page
- This is the "headline" feature — the insight people share and discuss
- Creates narrative tension that drives engagement

**7. Governance digest**

- In-app: "Since your last visit" section on authenticated homepage (built in Session 1, enriched here)
- Push/email: Epoch-based summary
  - "This epoch: 2 proposals closed (1 passed, 1 failed), 3 new proposals opened, your DRep voted on 4 and provided rationale on 3"
  - "Your representation score: 75% (↑5% from last epoch)"
  - "Community highlight: Proposal X passed with 82% DRep support despite 45% delegator opposition"
- Designed to be the thing that pulls users back weekly

**8. Governance impact / agency framing**

- On proposal outcome pages: "Your DRep's vote was part of the [winning/losing] majority. Your ADA helped shape this outcome."
- On delegation: "Your X ADA represents Y% of your DRep's voting power"
- On My Governance: "Since you delegated, your DRep has voted on Z proposals on your behalf, shaping decisions worth W ADA in treasury allocations"
- This creates the feeling that participation is consequential, not performative

**9. Delegator collective identity (behavioral cohorts)**

- Based on voting patterns (Governance DNA), not self-selected preferences: "You and 340 other delegators who voted No on large treasury withdrawals represent 22M ADA in combined voting power"
- Behavioral cohorts derived from poll data clustering (e.g., "treasury skeptics", "innovation advocates") — labels generated from voting patterns, not declared by users
- Cohort stats: how your cohort's DReps are performing, how cohort sentiment compares to outcomes
- This makes individual delegators feel part of a movement
- Potential for cohort leaderboards or badges (stretch)

### Data Model Changes

- `users` table: `last_visit_at` (timestamp for "since last visit"), `governance_events` (JSONB log or separate table)
- New `governance_events` table: `user_address`, `event_type`, `event_data` (JSONB), `created_at` — for personal timeline
- Enhancement to `poll_responses`: aggregate views for community pulse
- New `proposal_outcomes` tracking: store pass/fail results for impact framing
- New governance stats API: total ADA governed, participation rates, sentiment gaps

### Files Affected

- `app/governance/page.tsx` — Major enhancement with timeline, watchlist intelligence, calendar
- `components/GovernanceDashboard.tsx` — Add "what if" intelligence, governance calendar
- `app/proposals/[txHash]/[index]/page.tsx` — Add financial impact framing, community pulse
- `components/ProposalDescription.tsx` or new component — Financial context
- New: `components/GovernanceTimeline.tsx`
- New: `components/WatchlistIntelligence.tsx`
- New: `components/GovernanceCalendar.tsx`
- New: `components/CommunityPulse.tsx`
- New: `components/GovernanceDigest.tsx`
- New: `components/DelegationImpact.tsx`
- New: `components/CohortIdentity.tsx`
- Enhancement: Inngest functions for governance event tracking, digest generation

### Success Criteria

- Connected users return weekly (measured by `last_visit_at` frequency)
- "What if" intelligence drives measurable re-delegation events
- Community pulse insights get shared on social media
- Financial framing increases poll voting participation
- Governance digest push notifications have > 30% open rate
- Users describe DRepScore as "my governance dashboard" not "that DRep scoring site"

---

## Session 6 — Visual Identity & Polish

### Goal

Create a visual identity that is instantly recognizable — every screenshot, every shared card, every page is unmistakably DRepScore. Add the micro-interactions and polish that separate a "good app" from a "wow" experience.

### Problems This Solves

- Visual design is "good shadcn app" — indistinguishable from 10,000 other Next.js + shadcn projects
- No signature visual element that's ownable
- Recharts defaults for data visualization (same as every dashboard)
- No page transitions (hard cuts between pages)
- No micro-interactions beyond basic hover states
- No celebration animations that reinforce brand
- Dark mode may be less polished than light mode
- Achievement system exists conceptually but not visually

### Specific Changes

**1. Signature visual element**

- Design a custom score visualization that's uniquely DRepScore — not a standard ring/donut chart
- Consider: a "governance constellation" where each pillar is a node with connections, or a custom radial design with Cardano-inspired geometry
- This visualization appears: on DRep profiles, on shared cards, on badges, on the homepage, on OG images
- It should be so distinctive that seeing it in a tweet immediately signals "that's DRepScore"

**2. Custom data visualization style**

- Replace Recharts defaults with custom-styled charts that have a consistent DRepScore aesthetic
- Custom tooltip designs, grid styles, color palettes that are ownable
- Score trend chart: custom styling with gradient fills, subtle animations on load
- Radar chart (compare page): custom styling that matches the signature visual language
- Consider WebGL or Canvas-based visualizations for hero stats (stretch)

**3. Page transitions**

- Implement View Transitions API (Next.js 15 supports this) for smooth navigation
- Shared element transitions: DRep card in the table animates into the detail page header
- Slide transitions between related pages (discovery → detail → compare)
- Fade transitions for unrelated navigation
- Keep transitions fast (200-300ms) — polish, not delay

**4. Micro-interactions**

- Button press: subtle scale-down (0.97) on press, scale-up on release
- Score ring: animated fill on mount (already exists, enhance with easing)
- Pillar bars: staggered fill animation on mount
- Card hover: subtle lift + shadow increase
- Like/watchlist: heart fill animation
- Compare selection: card briefly highlights with brand color
- Poll vote: button pulses briefly after selection
- Copy actions: checkmark morph animation
- Scroll-triggered animations for sections below the fold

**5. Celebration animations**

- Delegation ceremony: confetti (canvas-confetti), score ring dramatic reveal, badge unlock animation
- Milestone achieved: badge appears with shine effect, shareable card auto-generates
- Score increase: number counter animation with positive color pulse
- Claim success: full-screen brand moment with animated elements
- All celebrations should be brief (1-2 seconds), skippable, and delightful

**6. Custom iconography**

- Replace generic Lucide icons for core concepts with custom-designed icons:
  - Governance (not just Shield)
  - Delegation (not just Users)
  - Score/reputation (not just TrendingUp)
  - Proposals (not just Vote)
- These appear in: navigation, feature sections, empty states, badges, shared cards
- Consistent stroke weight and style across all custom icons

**7. Typography refinements**

- Use Geist display weights more dramatically for hero numbers and headings
- Score displays: tabular-nums with custom letter-spacing for emphasis
- Consider a secondary display font for the brand name "$drepscore" in marketing contexts
- Ensure typographic hierarchy is consistent across all pages

**8. Dark mode audit**

- Systematic review of every component in dark mode
- Ensure gradient backgrounds work in both modes
- Verify chart readability in dark mode
- Check contrast ratios meet WCAG AA standards
- Make dark mode feel intentional, not auto-generated

**9. Achievement / badge visual system**

- Design a consistent badge visual language for milestones
- Badges should look like real achievement badges (not just colored circles)
- Badge levels: Bronze, Silver, Gold for progressive milestones
- Displayed on public DRep profiles and in shared cards
- Consider animated badge reveals

**10. Loading state refinements**

- Skeleton loaders with subtle shimmer animation (beyond basic animate-pulse)
- Content-specific skeleton shapes (score ring placeholder, chart placeholder)
- Loading states that hint at what's coming (not just gray blocks)
- Consider brief loading tips/facts about governance during longer loads

### Success Criteria

- Screenshots of DRepScore are instantly recognizable without seeing the URL
- Users comment on the visual quality ("this looks amazing" / "this is beautiful")
- Dark mode and light mode are equally polished
- Page transitions feel native-app quality
- Celebration moments are shared on social media as screenshots/recordings

---

## Session 7 — Treasury Intelligence Dashboard

### Goal

Build the first treasury health intelligence dashboard in crypto governance. Transform the Cardano treasury from an opaque number into a living, accountable financial story — with health scoring, runway projections, What-If simulation, spending accountability polls, and cross-app integration that makes every proposal vote treasury-aware.

### What Was Planned

Full plan: `.cursor/plans/treasury_intelligence_review_aefaa0d6.plan.md`

### What Was Built

**Phase 0: Prerequisites & Wiring**

- Migration `024_governance_citizen.sql`: `governance_stats` and `governance_events` tables (required by Session 6 orphaned components)
- Migration `025_treasury_intelligence.sql`: `treasury_snapshots`, `treasury_accountability_polls`, `treasury_accountability_responses` tables + `proposals.meta_json` column
- Added Koios treasury API functions (`fetchTreasuryBalance`, `fetchTreasuryHistory`) to `utils/koios.ts`
- Built `lib/treasury.ts`: comprehensive library with balance/trend, burn rate, runway, health score (0-100 composite), income vs outflow, pending proposal impact, runway projections (multi-scenario), counterfactual analysis, proposal similarity matching, DRep treasury track record, spending effectiveness, accountability poll scheduling
- Registered `generateEpochSummary` in Inngest serve config (was built but never registered)
- Built `FinancialImpactCard` component (reusable treasury context on proposals)
- Wired ~12 orphaned Session 5/6 governance citizen components into `/governance` page via new `GovernanceCitizenSection` wrapper

**Phase 1: Treasury Data Foundation**

- Inngest function `sync-treasury-snapshot`: daily sync from Koios `/totals`, calculates per-epoch withdrawals and reserve income, upserts to `treasury_snapshots`
- Inngest function `check-accountability-polls`: hybrid gating model — opens initial polls at tier-based intervals (3/6/12 months post-enactment), closes expired windows, aggregates results, schedules recurring re-evaluation cycles
- 6 API routes: `/api/treasury/current`, `/api/treasury/history`, `/api/treasury/pending`, `/api/treasury/simulate`, `/api/treasury/accountability` (GET + POST), `/api/treasury/similar`

**Phase 2: /treasury Page**

- `TreasuryDashboard`: 5-stat hero row (balance, runway, health score, burn rate, pending), health score breakdown with per-component progress bars, tab navigation (Overview / What-If Simulator / Accountability)
- `TreasuryCharts`: Area chart for balance over time, bar chart for income vs outflow per epoch, time range selector (30/90/all)
- `TreasuryPendingProposals`: Pending treasury withdrawal list with tier badges, % of treasury, amount
- `TreasuryHistoryTimeline`: Epoch-grouped enacted withdrawal timeline with cumulative totals
- Added "Treasury" to header navigation (between Pulse and My Governance)

**Phase 3: What-If Simulator + Counterfactual Analysis**

- `TreasurySimulator`: Interactive spending rate slider (0x-3x), preset buttons, real-time scenario projection chart showing 4 scenarios (Current/Moderate/All Pending Pass/Freeze), per-scenario runway estimates
- Counterfactual section: "What if the largest withdrawals had been rejected?" with hypothetical balance, additional runway months, top 5 largest withdrawal listing
- Share functionality copies scenario summary to clipboard

**Phase 3b: Treasury Accountability System**

- `TreasuryAccountabilitySection`: Spending effectiveness scorecard with donut chart, rating breakdown (Delivered/Partial/Not Delivered/Too Early/Pending), best-rated and lowest-rated spending lists
- `TreasuryAccountabilityPoll`: Per-proposal poll UI with primary question (delivered?), secondary question (approve again?), optional evidence field, historical cycle results display
- `SimilarProposalsCard`: "Learn From History" showing past proposals matched by tier + keyword similarity + amount proximity
- Hybrid gating model: Routine ~3mo, Significant ~6mo, Major ~12mo post-enactment; recurring re-evaluation every ~6 months; "Too Early to Tell" as critical signal

**Phase 4: Cross-App Integration**

- `TreasuryHealthWidget`: Compact treasury health card on `/pulse` page
- `DRepTreasuryStance`: Full treasury track record card on DRep profiles (approved/opposed/abstained counts + ADA, stance classification, judgment score)
- `FinancialImpactCard` wired into proposal detail pages (replaces plain text withdrawal amount)
- `TreasuryAccountabilityPoll` + `SimilarProposalsCard` wired into treasury proposal detail pages
- 3 OG image routes: `/api/og/treasury` (balance + health score + runway), `/api/og/treasury-scenario` (shareable simulation), `/api/og/treasury-accountability` (effectiveness rate)

### Data Model

| Table                               | Purpose                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `treasury_snapshots`                | Epoch-level balance, withdrawals, reserves, income tracking (PK: `epoch_no`)          |
| `treasury_accountability_polls`     | Recurring evaluation cycles per enacted proposal (PK: `tx_hash, index, cycle_number`) |
| `treasury_accountability_responses` | Per-user per-cycle accountability votes (PK: `tx_hash, index, cycle, user_address`)   |
| `governance_stats`                  | Singleton epoch tracker for generate-epoch-summary                                    |
| `governance_events`                 | Per-user governance timeline events                                                   |
| `proposals.meta_json`               | New JSONB column for future AI timeline extraction                                    |

### New API Routes

| Route                             | Method   | Purpose                                            |
| --------------------------------- | -------- | -------------------------------------------------- |
| `/api/treasury/current`           | GET      | Balance, runway, health score, pending count       |
| `/api/treasury/history`           | GET      | Epoch-level snapshots + income vs outflow          |
| `/api/treasury/pending`           | GET      | Pending withdrawal proposals with impact           |
| `/api/treasury/simulate`          | GET      | Multi-scenario runway projections + counterfactual |
| `/api/treasury/accountability`    | GET/POST | Accountability poll data + vote submission         |
| `/api/treasury/similar`           | GET      | Similar past proposal matching                     |
| `/api/og/treasury`                | GET      | Treasury OG image                                  |
| `/api/og/treasury-scenario`       | GET      | Simulation scenario OG image                       |
| `/api/og/treasury-accountability` | GET      | Accountability scorecard OG image                  |

### New Components

| Component                       | Location                                               |
| ------------------------------- | ------------------------------------------------------ |
| `TreasuryDashboard`             | Main `/treasury` page orchestrator                     |
| `TreasuryCharts`                | Balance + income/outflow charts with time range        |
| `TreasuryPendingProposals`      | Pending withdrawal proposals with impact analysis      |
| `TreasurySimulator`             | What-If scenario projections with interactive controls |
| `TreasuryHistoryTimeline`       | Epoch-grouped enacted withdrawal history               |
| `TreasuryAccountabilitySection` | Spending effectiveness scorecard                       |
| `TreasuryAccountabilityPoll`    | Per-proposal accountability poll UI                    |
| `SimilarProposalsCard`          | "Learn From History" similar proposals                 |
| `TreasuryHealthWidget`          | Compact treasury card for /pulse                       |
| `DRepTreasuryStance`            | Treasury track record for DRep profiles                |
| `FinancialImpactCard`           | Reusable treasury context on proposals                 |
| `GovernanceCitizenSection`      | Wrapper wiring orphaned Session 6 components           |

### Why This Is the "Wow"

- **First treasury health intelligence in crypto.** No governance tool on any chain tracks treasury health with a composite score, runway projections, and spending accountability.
- **Closes the accountability loop.** Money goes out → time passes → community rates outcome → record informs future votes. Nobody else does this.
- **Creates shareable content.** "Cardano Treasury Health: 78/100" and "Only 60% of treasury spending delivered on promises" are headlines that get debated on X.
- **Makes individual DRep voting records tangible.** "This DRep approved 3 projects that didn't deliver" is concrete accountability.
- **Forces honest reflection on new proposals.** "Similar proposals have a 50% delivery rate" makes voters think harder.
- **Positions DRepScore as governance infrastructure.** Not just tracking scores — tracking whether governance _works_.

### Relationship to Session 8 (Platform Deepening)

Session 8 item #9 "Proposal financial impact simulation" was previously listed as "Build simplified" — it is now **fully built** as the Treasury Intelligence Dashboard with What-If Simulator and counterfactual analysis far exceeding the original scope.

### Success Criteria

- `/treasury` becomes a top-5 trafficked page within first month
- Treasury Health Score gets shared on social media as a community health metric
- What-If Simulator usage: >20% of treasury page visitors interact with controls
- Accountability polls receive responses within first eligible cycle
- DReps and delegators reference treasury track records in governance discussions
- At least one media/researcher uses the accountability data in public analysis

---

## Session 8 — Platform Deepening & Strategic Bets

> **Superseded:** Session 8 was expanded into Sessions 8-11 in `docs/strategy/product-wow-plan-v1.5.md` after a comprehensive audit revealed gaps in Sessions 1-7, analytics instrumentation, and infrastructure. The original Session 8 ideas (below) informed the v1.5 plan but are no longer the execution target.

### Goal

Evaluate high-complexity, high-impact ideas that could transform DRepScore from a governance analytics tool into the governance operating system for Cardano. Each item is assessed for strategic value, complexity, dependencies, and recommendation.

### Ideas to Evaluate

**1. On-chain rationale submission via DRepScore**

- **Description:** Host CIP-100 metadata, let DReps vote and submit rationale without leaving the platform. DRepScore becomes the place where governance actions happen, not just where they're tracked.
- **Strategic value:** Highest. Transforms DRepScore from scoring tool to governance tool. Creates strongest possible lock-in.
- **Complexity:** Very high. Requires transaction building (cardano-serialization-lib), CIP-100 metadata hosting, wallet signing integration, and deep understanding of governance transaction structure.
- **Dependencies:** Wallet integration improvements, metadata hosting infrastructure, CIP-100 compliance.
- **Recommendation:** **Revisit after data.** Monitor GovTool usage patterns. If DReps consistently draft rationale in DRepScore then context-switch to GovTool, the demand signal is clear. Start with a prototype that pre-fills GovTool with DRepScore-drafted rationale before building full submission.

**2. AI-powered personalized governance brief**

- **Description:** Weekly AI-generated digest personalized to DRep's voting pattern, delegator sentiment, upcoming proposals, and competitive position. Delivered via email, push, Discord, or Telegram.
- **Strategic value:** High. Creates a weekly touchpoint that pulls DReps back. Differentiates from every other governance tool.
- **Complexity:** Medium-high. Requires AI pipeline (prompt engineering, context assembly from multiple data sources), delivery infrastructure (already partially built via notification system), and content quality control.
- **Dependencies:** Notification channels (Session 3), DRep data richness, AI API costs.
- **Recommendation:** **Build.** Start with a simple template-based brief using existing data, progressively add AI personalization. The notification infrastructure from Session 3 handles delivery.

**3. Proposal discussion threads**

- **Description:** Comment threads per proposal for DRep deliberation. Creates engagement and platform-exclusive content visible to delegators.
- **Strategic value:** Medium-high. Creates content moat and engagement loop. DReps discussing proposals publicly is extremely valuable for delegators making decisions.
- **Complexity:** Medium. Requires comment storage, moderation infrastructure, spam prevention, and UX for threaded discussions.
- **Dependencies:** User auth (already exists), moderation policy, potential abuse mitigation.
- **Recommendation:** **Defer.** High moderation overhead for a small user base. Revisit when claimed DRep count exceeds 50. In the meantime, position statements (Session 3) serve a similar purpose with lower risk.

**4. Delegation event detection + ceremony**

- **Description:** Detect individual delegation/undelegation events and celebrate them. "You just received a new delegator with X ADA!" with shareable moment card.
- **Strategic value:** Medium. Creates delightful moments and content for sharing. Strengthens the DRep-delegator relationship.
- **Complexity:** Medium. Requires per-delegator tracking (currently only aggregate count from Koios), which means monitoring delegation transactions or polling Koios delegator lists.
- **Dependencies:** Koios delegator list API, background sync enhancement, `drep_power_snapshots.delegator_count` (added in Session 3).
- **Recommendation:** **Build (simplified).** Start with epoch-level "you gained/lost N delegators" detection (already wired in Session 3 notifications). Full per-delegation ceremony requires transaction monitoring — defer that to after data validation.

**5. DRep governance identity visualization**

- **Description:** Surface existing alignment scores (6 dimensions already stored on `dreps` table) as a radar/spider chart showing governance identity. "This DRep prioritizes fiscal conservatism and protocol stability."
- **Strategic value:** Medium-high. Instantly communicable identity. Radar charts are highly shareable and differentiate DReps visually.
- **Complexity:** Low. Data already exists. Visualization is the only work.
- **Dependencies:** `dreps.alignment_*` scores (already computed by sync).
- **Recommendation:** **Build.** Low effort, high visual impact. Add to DRep profile page and discovery cards. Could be part of Session 4's visual identity work.

**6. Watchlist intelligence**

- **Description:** Transform passive watchlist into active monitoring with alerts on watched DRep events. "DRep X on your watchlist dropped 8 points after missing 3 critical votes."
- **Strategic value:** Medium. More of a delegator feature than DRep feature. Strengthens the governance citizen experience.
- **Complexity:** Medium. Requires event detection per watched DRep, notification routing, and UI for watchlist dashboard.
- **Dependencies:** Notification system (Session 3), watchlist data (already exists in profile).
- **Recommendation:** **Defer to Session 5.** This fits naturally into the Governance Citizen Experience session. The notification infrastructure from Session 3 enables it.

**7. Multi-DRep team dashboard**

- **Description:** Team management for organizational DReps (e.g., stake pools running DReps, governance organizations). Multiple team members can access and manage a single DRep profile.
- **Strategic value:** Low-medium. Niche audience but high retention for those who need it.
- **Complexity:** High. Requires auth/permissions infrastructure, invitation system, role management.
- **Dependencies:** Robust auth system, team identity model.
- **Recommendation:** **Defer.** Very few organizations currently run team DReps. Revisit when demand signals emerge from claimed DReps requesting multi-user access.

**8. AI score coach chatbot**

- **Description:** Conversational AI with full DRep context for personalized improvement advice. "How do I get to 90?" → contextual answer based on their specific pillar gaps, recent activity, and competitive position.
- **Strategic value:** Medium-high. Highly engaging, creates a "personal advisor" feeling. Strong differentiation.
- **Complexity:** Medium-high. Requires RAG pipeline with DRep context, conversation management, guardrails to prevent hallucination about scoring.
- **Dependencies:** Scoring formula understanding, DRep data access, AI API.
- **Recommendation:** **Revisit after data.** The Score Simulator (Session 3) serves the "how do I improve" use case with a deterministic UI. Monitor whether DReps want more nuanced guidance before building a chatbot.

**9. Proposal financial impact simulation**

- **Description:** Interactive visualizations of treasury/parameter proposal consequences. "If this passes, the treasury will have X ADA remaining. At current burn rate, that's Y months of runway."
- **Strategic value:** High for the ecosystem. Makes governance decisions tangible and concrete for delegators.
- **Complexity:** High. Requires financial modeling per proposal type (treasury math, parameter impact modeling, staking reward calculations), data sources for treasury state, and visualization.
- **Dependencies:** Treasury data APIs, parameter change impact formulas, proposal type-specific modeling.
- **Status:** **FULLY BUILT in Session 7.** The Treasury Intelligence Dashboard includes a What-If Simulator with multi-scenario projections, counterfactual analysis, interactive spending rate controls, and cross-app integration (FinancialImpactCard on every treasury proposal). Far exceeds the original "simplified" scope. Remaining opportunity: parameter change impact simulation (non-treasury proposals).

### Priority Matrix

| Idea                              | Impact      | Complexity  | Recommendation         |
| --------------------------------- | ----------- | ----------- | ---------------------- |
| Governance identity visualization | Medium-high | Low         | **Build now**          |
| AI governance brief               | High        | Medium-high | **Build next**         |
| Delegation event detection        | Medium      | Medium      | **Build simplified**   |
| Financial impact simulation       | High        | High        | **BUILT (Session 7)**  |
| On-chain rationale submission     | Highest     | Very high   | **Revisit after data** |
| AI score coach                    | Medium-high | Medium-high | **Revisit after data** |
| Proposal discussion threads       | Medium-high | Medium      | **Defer**              |
| Watchlist intelligence            | Medium      | Medium      | **Defer to Session 5** |
| Multi-DRep team dashboard         | Low-medium  | High        | **Defer**              |

---

## Anti-Patterns to Avoid

1. **Don't gamify re-delegation too aggressively.** Frequent switching destabilizes governance. Frame re-delegation as a considered decision, not a game.
2. **Don't create DRep tribalism.** Comparison and competition are healthy; factions and hostility are not. Keep the tone constructive.
3. **Don't make governance feel like a chore.** Too many notifications, too many "you need to vote" nudges = notification fatigue. Quality over quantity.
4. **Don't gate accountability features behind payment.** Basic scores, voting records, and delegation tools must always be free. This is governance infrastructure.
5. **Don't over-animate.** Celebrations should be brief and skippable. Micro-interactions should be subtle. Never slow down the user for animation.
6. **Don't fake real-time.** If data syncs every 30 minutes, don't create a fake "live" ticker. Design around the actual data freshness with honest timestamps.
7. **Don't show empty/broken states at launch.** If DRep data is sparse, design around it. "This DRep hasn't provided metadata yet" is better than empty cards.
8. **Don't forget accessibility.** ARIA labels, keyboard navigation, screen reader support. Governance tools should be inclusive by definition.

---

## Competitive Positioning

### What Exists in Crypto Governance

| Tool      | Chain       | What It Does                 | Where We Differentiate                                        |
| --------- | ----------- | ---------------------------- | ------------------------------------------------------------- |
| Tally     | Ethereum    | Proposal voting + delegation | No scoring, no value matching, no delegator intelligence      |
| Snapshot  | Multi-chain | Off-chain voting             | Voting tool only, no representative evaluation                |
| Realms    | Solana      | DAO governance               | Basic voting, no scoring or analytics                         |
| Boardroom | Multi-chain | Governance aggregator        | Information display, no personalization or citizen experience |
| GovTool   | Cardano     | Official governance tool     | Functional, not experiential; no scoring, no analytics        |

### Our Unique Position

DRepScore would be the **first governance relationship platform** in all of crypto — not a voting tool, not a directory, not an aggregator, but a platform that makes every token holder feel like an empowered governance citizen with personal stakes, ongoing representation monitoring, and community identity.

No one has built this for any chain. The opportunity is to define the category.
