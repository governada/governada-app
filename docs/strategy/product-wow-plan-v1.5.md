# Product "Wow" Plan v1.5 — DRepScore

> Continuation of the product vision. Sessions 1-7 built the feature set. Sessions 8-11 make it premium — closing every gap, fixing infrastructure, adding intelligent engagement, and completing both sides of the marketplace.

**Created:** March 1, 2026
**Predecessor:** `docs/strategy/product-wow-plan.md` (Sessions 1-7 + original Session 8 ideas)
**Context:** Deep audit of all Session 1-7 deliverables against the original plan, identifying gaps in implementation, analytics instrumentation, and infrastructure. See agent transcript for the raw analysis.

---

## Table of Contents

1. [Audit Summary](#audit-summary)
2. [Session 8 — Debt Payoff & Full Instrumentation](#session-8--debt-payoff--full-instrumentation)
3. [Session 9 — Mobile Excellence & Platform Foundation](#session-9--mobile-excellence--platform-foundation)
4. [Session 10 — Engagement Engine](#session-10--engagement-engine)
5. [Session 11 — Differentiators & Citizen Identity](#session-11--differentiators--citizen-identity)
6. [Deferred Items](#deferred-items)
7. [Anti-Patterns (Continued)](#anti-patterns-continued)

---

## Audit Summary

A comprehensive audit of Sessions 1-7 revealed three categories of issues that must be addressed before the product can be called premium.

### Category 1: Session 1-7 Gaps (Planned but not fully delivered)

**Homepage (Session 1):**

- Governance Pulse spotlight missing DRep vote % and community sentiment for the active proposal
- `SinceLastVisit` renders `proposalsOpened` and DRep votes but does NOT render `proposalsClosed` (API returns it, UI ignores it) and has no "new delegator activity"
- `RepresentationScoreCard` has no trend indicator (plan said "prominent with trend")
- "How it works" section is still text-heavy (plan said "more visual and less text-heavy")

**Session 5 (Governance Citizen):**

- **Governance Calendar: MISSING.** No component, no epoch countdown, no "what's coming" section. Named deliverable.
- Community pulse only shows delegator sentiment — no DRep voting % comparison (the gap analysis is the headline feature)
- Governance digest writes to `governance_events` in-app but has no push/email delivery

**Session 6 (Visual Polish) — Largest gap:**

- **Signature visual element (governance constellation): MISSING.**
- **Page transitions: MISSING.** No View Transitions API usage.
- **Micro-interactions: MISSING.** No button press scale, no staggered animations.
- **Custom iconography: MISSING.** Still using Lucide throughout.
- Dark mode audit: not systematically done.

**Session 4 (Shareable Moments):**

- Delegation ceremony only triggers from in-app delegation — no on-chain detection
- Score change moment cards show in dashboard but no push notification to DReps
- Pulse page has page-level share but no per-stat share buttons

**Session 2 (Discovery):**

- `DRepQuickView` uses right-side sheet only — no bottom sheet on mobile as specified

### Category 2: Infrastructure Gaps (Never planned but critical)

- **Mobile navigation is broken.** Nav links are `hidden sm:flex` with no hamburger menu. Users on phones can only see the logo and wallet button.
- **No email channel.** Most important retention channel for digests isn't built.
- **No sitemap, robots.txt, or loading boundaries.** SEO and perceived performance leaving value on table.
- **No PWA manifest.** Push SW exists but app isn't installable.
- **Push notifications split.** Legacy push works; new notification engine's push sender returns `false`.
- **Delegator side has no progression system.** DReps have milestones, badges, gamification. ADA holders have a dashboard.

### Category 3: Analytics Instrumentation Gaps

**Missing page view events (9 pages untracked):**
`homepage_viewed`, `discover_page_viewed`, `governance_page_viewed`, `proposals_page_viewed`, `proposal_detail_viewed`, `dashboard_page_viewed`, `compare_page_viewed`, `drep_profile_viewed` (client-side — server `profile_viewed` exists)

**Missing interaction events:**
`watchlist_added` / `watchlist_removed`, `compare_drep_added` / `compare_drep_removed`, `competitive_context_viewed`, `delegation_trend_viewed`, `representation_scorecard_viewed`, `leaderboard_viewed` (client), `notification_pref_changed` (client)

**Missing server events:**
`rationale_draft_served`, `epoch_summary_generated`

**Missing Observable data loaders (5 feature areas):**
Profile views, governance events, DRep milestones, notification delivery, claim funnel

---

## Session 8 — Debt Payoff & Full Instrumentation

### Goal

Close every gap from Sessions 1-7 and achieve complete analytics coverage across the platform. When Session 8 is done, every planned feature is fully delivered and every user interaction is measurable. No more debt — only a solid foundation.

### Problems This Solves

- Homepage feels incomplete (missing data in pulse spotlight, SinceLastVisit, rep score trend)
- Governance calendar was promised but never built — users have no forward-looking governance view
- Community pulse lacks its headline feature (DRep vs delegator sentiment gap)
- Session 6 visual polish is mostly undelivered (micro-interactions, dark mode)
- Multiple session 4 features are wired but don't trigger (score change notifications, QuickView mobile)
- 9 pages have no view tracking; multiple interactions are silent to analytics
- 5 feature areas have no Observable dashboard representation
- Accessibility has uneven coverage

### Specific Changes

**1. Homepage completeness**

_Unauth — Governance Pulse spotlight enrichment:_

- Add DRep vote coverage % to spotlight proposal: "X% of DReps have voted"
- Add community poll sentiment to spotlight: "Community sentiment: Y% in favor"
- Enrich `getGovernancePulse()` API to include vote coverage and poll aggregation for the spotlight proposal
- Files: `lib/data.ts` or `app/api/governance/pulse/route.ts`, `components/GovernancePulseHero.tsx`

_Auth — SinceLastVisit completeness:_

- Render `proposalsClosed` (API returns it, UI drops it)
- Add delegator activity: "Your DRep gained/lost N delegators" from `drep_power_snapshots` delta
- Enrich `/api/governance/since-visit` with delegator change data
- Files: `components/SinceLastVisit.tsx`, `app/api/governance/since-visit/route.ts`

_Auth — Representation score trend:_

- Add up/down arrow with delta vs last epoch to `RepresentationScoreCard`
- Files: `components/governance-cards.tsx`

**2. Governance Calendar (Session 5 gap)**

- New `GovernanceCalendar` component: "What's Coming" section
- Epoch countdown with next epoch boundary timer (compute from current slot/epoch)
- Proposals expiring this epoch with urgency markers (red/amber by time remaining)
- Recently opened proposals (last 7 days) and recent outcomes
- Simple vertical timeline, not a full calendar widget
- Placement: `/governance` page and auth homepage
- Data: existing proposal data (expiry epochs) + epoch computation
- Files: new `components/GovernanceCalendar.tsx`, update `app/governance/page.tsx`, update `components/HomepageAuth.tsx`

**3. Community Pulse gap analysis (Session 5 gap)**

- Compute DRep voting breakdown (Yes/No/Abstain %) per proposal from `drep_votes`
- Compare against delegator poll sentiment from `poll_responses`
- Display: "72% of polled delegators support this, but only 45% of DReps voted Yes"
- Surface on proposal detail pages and `/pulse` page
- Files: update community pulse components, update `/api/governance/pulse`

**4. Micro-interactions (Session 6 gap — high ROI items only)**

- Button press: `active:scale-[0.97]` + `transition-transform` on primary buttons
- Card hover: subtle lift + shadow increase (`hover:-translate-y-0.5 hover:shadow-lg transition-all`)
- Pillar bars: staggered fill animation on mount (CSS `animation-delay` per bar)
- Score ring: verify easing curve is premium
- Copy actions: checkmark morph (swap icon for 1.5s on copy)
- Files: `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ScoreBreakdown.tsx`, various copy handlers

**5. Dark mode audit (Session 6 gap)**

- Check all gradient backgrounds render in dark mode
- Check chart readability (Recharts in dark)
- Verify contrast ratios on key components (score ring colors, badge colors, status indicators)
- Fix all issues found
- Files: `app/globals.css`, chart components, badge components

**6. Session 4 partial builds**

- _Score change push notifications:_ Verify `score-change` notification type fires correctly in Inngest `check-notifications`. Wire so significant delta triggers push.
- _DRepQuickView mobile bottom sheet:_ Change `side="right"` to responsive — bottom sheet on mobile, side sheet on desktop. shadcn Sheet `side` prop set conditionally.
- Files: `components/DRepQuickView.tsx`, Inngest notification function

**7. Accessibility baseline**

- Add skip-to-content link in root layout
- Ensure all interactive elements have `aria-label` where visual label is insufficient
- Add keyboard navigation for DRep card grid (arrow keys)
- Audit color contrast ratios for both light and dark mode (WCAG AA)
- Add `aria-live` regions for dynamic content updates (score changes, notification badges)
- Files: systematic pass across Header, DRepCard, DRepTable, GovernanceDashboard

**8. Full analytics backfill**

_Page view events (client) — add `posthog.capture` on mount:_

| Event                    | Location                                     | Properties                            |
| ------------------------ | -------------------------------------------- | ------------------------------------- |
| `homepage_viewed`        | `HomepageDualMode.tsx`                       | `mode` (auth/unauth)                  |
| `discover_page_viewed`   | `app/discover/page.tsx` or `DRepTableClient` | `view_mode`, `has_quiz_data`          |
| `governance_page_viewed` | `app/governance/page.tsx`                    | `is_delegated`, `rep_score`           |
| `proposals_page_viewed`  | `ProposalsPageClient`                        | `filter_status`, `count`              |
| `proposal_detail_viewed` | Proposal detail page                         | `proposal_type`, `status`, `has_poll` |
| `dashboard_page_viewed`  | `DRepDashboard.tsx`                          | `drep_id`, `score`, `tier`            |
| `compare_page_viewed`    | `CompareView`                                | `drep_count`                          |
| `drep_profile_viewed`    | DRep profile page (client wrapper)           | `drep_id`, `score`, `is_claimed`      |

_Missing interaction events (client):_

| Event                             | Location                       | Properties                         |
| --------------------------------- | ------------------------------ | ---------------------------------- |
| `watchlist_added`                 | Watchlist toggle handler       | `drep_id`, `source`                |
| `watchlist_removed`               | Watchlist toggle handler       | `drep_id`, `source`                |
| `compare_drep_added`              | Compare selection handler      | `drep_id`, `total_selected`        |
| `compare_drep_removed`            | Compare selection handler      | `drep_id`, `total_selected`        |
| `competitive_context_viewed`      | `CompetitiveContext.tsx`       | `drep_id`, `rank`                  |
| `delegation_trend_viewed`         | `DelegatorTrendChart.tsx`      | `drep_id`                          |
| `representation_scorecard_viewed` | `RepresentationScorecard.tsx`  | `drep_id`, `alignment_score`       |
| `leaderboard_viewed`              | Pulse page leaderboard section | `tier_filter`                      |
| `notification_pref_changed`       | `NotificationPreferences.tsx`  | `channel`, `event_type`, `enabled` |
| `governance_calendar_viewed`      | `GovernanceCalendar.tsx` (new) | `upcoming_count`                   |

_Missing server events:_

| Event                     | Location                          | Properties                 |
| ------------------------- | --------------------------------- | -------------------------- |
| `rationale_draft_served`  | `/api/rationale/draft/route.ts`   | `drep_id`, `proposal_hash` |
| `epoch_summary_generated` | `generateEpochSummary` Inngest fn | `epoch`, `events_count`    |

_New Observable data loaders:_

| Loader                          | Source Table(s)         | Dashboard Page      |
| ------------------------------- | ----------------------- | ------------------- |
| `profile-views.json.ts`         | Profile view tracking   | DRep Engagement     |
| `governance-events.json.ts`     | `governance_events`     | Governance Activity |
| `milestones.json.ts`            | `drep_milestones`       | DRep Engagement     |
| `notification-delivery.json.ts` | `notification_log`      | System Status       |
| `claim-funnel.json.ts`          | `users` (claimed DReps) | Executive Overview  |

### Files Affected

- `components/GovernancePulseHero.tsx` — Spotlight enrichment
- `components/SinceLastVisit.tsx` — proposalsClosed + delegator activity
- `components/governance-cards.tsx` — Rep score trend
- New: `components/GovernanceCalendar.tsx` — Epoch countdown + upcoming
- `app/governance/page.tsx` — Add calendar section
- `components/HomepageAuth.tsx` — Add calendar section
- Community pulse components — DRep vs delegator gap
- `components/ui/button.tsx`, `components/ui/card.tsx` — Micro-interactions
- `components/ScoreBreakdown.tsx` — Staggered pillar bars
- `app/globals.css` — Dark mode fixes
- `components/DRepQuickView.tsx` — Mobile bottom sheet
- Inngest notification function — Score change push
- `app/layout.tsx` — Skip-to-content link
- 8+ page/component files for PostHog view events
- 10+ component files for PostHog interaction events
- 2 API routes for server events
- 5 new `analytics/src/data/*.json.ts` loaders

### Session 6 Items Deferred (Design-Heavy)

These Session 6 items require visual design iteration and are deferred until a designer is engaged or a dedicated visual session is planned:

- **Signature governance constellation** — The Governance Identity Radar (Session 11) partially fills this role
- **Page transitions (View Transitions API)** — Next.js 16 support still experimental; browser compatibility risk
- **Custom iconography** — Lucide icons are high quality and consistent; custom icons require a designer

### Success Criteria

- Homepage spotlight shows DRep vote % and community sentiment
- `SinceLastVisit` shows proposals closed and delegator activity
- Rep score card shows trend indicator
- Governance Calendar is live with epoch countdown and proposal urgency
- Community pulse shows DRep vs delegator sentiment gap on proposals and /pulse
- Micro-interactions are perceptible on buttons, cards, and score animations
- Dark mode has no contrast or readability issues on any primary page
- DRepQuickView shows as bottom sheet on mobile
- Score change notifications fire for DReps via push
- Accessibility: skip-to-content, keyboard nav on card grid, WCAG AA contrast
- Every page has a `_viewed` event (target: 11/11)
- Every state-changing interaction has a corresponding event
- Observable dashboards cover all feature areas (target: 19 loaders, up from 14)

### Risks

- Governance calendar epoch computation must account for Cardano epoch boundaries accurately (5-day epochs, variable slot timing)
- Dark mode audit may reveal extensive issues requiring cascading fixes
- Analytics backfill is high volume of small changes — risk of merge conflicts if other work is in progress

---

## Session 9 — Mobile Excellence & Platform Foundation

### Goal

Make DRepScore feel like a native app on mobile and establish the platform infrastructure (SEO, performance, security) that a premium product requires. When Session 9 is done, the app is installable, discoverable, fast on every device, and hardened.

### Problems This Solves

- Mobile users can't navigate — nav links hidden with no hamburger menu
- App isn't installable despite having a push service worker
- DRep profiles aren't discoverable by search engines (no sitemap)
- No loading boundaries means hard cuts on navigation (perceived as slow)
- No security headers on non-API routes
- Empty states are generic and unhelpful

### Specific Changes

**1. Mobile navigation**

- New `MobileNav.tsx` component: hamburger menu triggering a sheet from the right
- All nav items: Discover, Proposals, Pulse, Treasury, My Governance, Dashboard
- Wallet connect button in the sheet
- Close on navigation, close on outside click
- Conditional render: only below `sm:` breakpoint (640px)
- Consistent with existing sheet pattern (`DRepQuickView`)
- Files: `components/HeaderClient.tsx`, `components/Header.tsx`, new `components/MobileNav.tsx`
- Analytics: `mobile_nav_opened` event with `page` property

**2. PWA manifest and installability**

- Add `public/manifest.json`: app name, icons, theme colors, `display: standalone`
- Generate PWA icons (192x192, 512x512) from existing branding
- Add manifest link and explicit `viewport` export to `app/layout.tsx`
- Extend `public/push-sw.js` with offline fallback page
- Files: `public/manifest.json`, `app/layout.tsx`, icon assets
- Analytics: `pwa_installed` event via `beforeinstallprompt` handler

**3. SEO infrastructure**

- New `app/sitemap.ts`: dynamic sitemap with all DRep profiles (~700+), proposal pages, static pages (discover, pulse, treasury, governance)
- New `app/robots.ts`: standard robots with sitemap reference
- Add canonical URLs to page metadata where missing
- Each DRep profile is already server-rendered with `generateMetadata` — sitemap makes them discoverable
- Files: new `app/sitemap.ts`, new `app/robots.ts`, metadata updates across pages

**4. Loading boundaries and perceived performance**

- New `app/loading.tsx` (root loading boundary)
- Route-specific loading files with content-aware skeletons:
  - `app/discover/loading.tsx` — card grid skeleton
  - `app/drep/[drepId]/loading.tsx` — score card + section skeletons
  - `app/governance/loading.tsx` — dashboard card skeletons
  - `app/treasury/loading.tsx` — treasury stat row + chart skeletons
  - `app/pulse/loading.tsx` — stat grid + leaderboard skeletons
  - `app/proposals/loading.tsx` — proposal list skeletons
- Use content-specific skeleton shapes matching actual page layouts
- Files: 7 new `loading.tsx` files

**5. Security headers**

- Add headers via `next.config.ts` (preferred for static headers):
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Files: `next.config.ts`

**6. Empty state and error state polish**

- Audit every component that loads data for empty/error handling
- Replace generic "No data" with contextual, actionable empty states:
  - "No poll votes yet? Take the Governance DNA Quiz to start building your governance identity."
  - "No proposals open? Here's what happened last epoch."
  - "No DReps on your watchlist? Explore DReps to find representatives that match your values."
  - "No vote explanations yet? Use the rationale assistant to draft your first one."
- Each empty state includes a CTA that routes to the relevant action
- Files: systematic audit of all data-fetching components

### Files Affected

- `components/HeaderClient.tsx` — Mobile menu trigger
- `components/Header.tsx` — Mobile menu integration
- New: `components/MobileNav.tsx` — Sheet-based mobile navigation
- `app/layout.tsx` — Manifest link, viewport export
- New: `public/manifest.json` — PWA manifest
- New: `app/sitemap.ts` — Dynamic sitemap
- New: `app/robots.ts` — Robots configuration
- New: 7 `loading.tsx` files across routes
- `next.config.ts` — Security headers
- 15-20+ components — Empty state audit and polish

### Analytics for This Session

| Event                     | Type   | Properties                |
| ------------------------- | ------ | ------------------------- |
| `mobile_nav_opened`       | Client | `page`                    |
| `pwa_installed`           | Client | -                         |
| `empty_state_cta_clicked` | Client | `component`, `cta_action` |

### Success Criteria

- Mobile users can navigate to all pages (zero nav items hidden)
- PWA is installable on mobile devices (Android prompt, iOS add-to-homescreen)
- All DRep profiles appear in sitemap and are crawlable
- Every route has a loading boundary with content-aware skeletons
- Security headers present on all responses
- Zero generic "No data" empty states — every empty state is contextual with a CTA

### Risks

- Sitemap generation for 700+ DReps needs to be performant (use ISR or build-time generation)
- PWA `display: standalone` changes the header/chrome appearance — test thoroughly
- Mobile nav z-index must layer correctly with existing sheets and modals

---

## Session 10 — Engagement Engine

### Goal

Build the infrastructure and features that turn DRepScore from a tool users visit occasionally into a platform that reaches out to them weekly. Unify the fragmented notification system, add email as a channel, and ship the AI governance brief — the single most impactful retention feature in the roadmap.

### Problems This Solves

- Push notifications are split between legacy (working) and new engine (broken)
- No email channel exists — the most effective retention channel for digests
- No automated, personalized outreach to bring users back
- Governance digest (Session 5) writes events in-app but never delivers them externally
- DReps have no weekly touchpoint that summarizes their competitive position
- ADA holders have no reason to return unless they actively decide to check

### Specific Changes

**1. Consolidate push notifications**

- Fix `CHANNEL_SENDERS.push` in `lib/notifications.ts` — currently returns `false`
- Wire the new notification engine's push sender to use existing `web-push` infrastructure from `app/api/push/send/route.ts`
- Migrate legacy push call sites (sync routes) to use `notifyUser` / `broadcastEvent`
- Result: one notification engine, three working channels (Discord, Telegram, Push)
- Files: `lib/notifications.ts`, `app/api/push/send/route.ts`, sync route files

**2. Add email channel via Resend**

- Add Resend as email provider (simple API, generous free tier, excellent DX)
- New `lib/email.ts`: send transactional emails via Resend API
- Add `email` channel to `CHANNEL_SENDERS` in notification engine
- Email templates (React Email or clean HTML):
  - Governance digest (weekly summary — the brief template)
  - Score change alert (DRep)
  - Delegation change alert (DRep)
  - Proposal deadline reminder (delegator)
- Email collection: add optional email field to user profile / wallet connect flow
- Email preferences: digest frequency (weekly, bi-weekly, monthly, off)
- SPF/DKIM/DMARC: use Resend's managed domain initially for deliverability
- Files: new `lib/email.ts`, update `lib/notifications.ts`, email templates, user profile update

**3. Notification preferences UI enhancement**

- `components/NotificationPreferences.tsx` already exists — extend it
- Add email channel toggle and email address input
- Add digest frequency preference
- Add per-event-type channel matrix (which events on which channels)
- Files: `components/NotificationPreferences.tsx`

**4. AI Governance Brief (weekly digest)**

The flagship retention feature. A weekly, AI-personalized governance summary delivered via email (primary), push, and Telegram (summary).

_For DReps:_

- "This week: 3 new proposals opened. Your score changed by +2 (rationale rate improved). You're ranked #14, up 2 spots. DRep X below you closed the gap by 1 point. Your delegator alignment is 78% — 2 proposals diverged from delegator sentiment. You gained 3 delegators (+45K ADA)."
- Actionable: "2 proposals need your vote before epoch end. Here's what your delegators think."

_For ADA Holders:_

- "This week: Your DRep voted on 2 of 3 proposals. They agreed with you on Proposal X but diverged on Proposal Y. Your representation score is 72% (stable). 1 proposal is closing soon — poll now to make your voice heard. Treasury health: 75/100 (steady)."
- Actionable: "3 DReps match your governance DNA better — explore them."

_Implementation:_

- New Inngest function `generate-governance-brief`: runs weekly, assembles per-user context from existing data sources (votes, polls, scores, power snapshots, treasury, proposals)
- AI layer: start with template-based generation with AI polish (cheaper, more reliable). Structured data assembled into prompt, AI generates natural-language narrative. Progressively add full personalization.
- Delivery via unified notification engine (email primary, push/Telegram summary variant)
- New API: `POST /api/briefs/generate` (admin/cron trigger), `GET /api/briefs/latest` (user retrieval)
- In-app: "Your Weekly Brief" card on authenticated homepage
- Brief storage: store generated briefs for in-app viewing (new `governance_briefs` table or JSONB in `governance_events`)
- Files: new `lib/governanceBrief.ts`, new Inngest function, new API routes, new `components/GovernanceBriefCard.tsx`

### Data Model Changes

| Change                                                      | Purpose                                    |
| ----------------------------------------------------------- | ------------------------------------------ |
| `users.email`                                               | Optional email address for digest delivery |
| `users.digest_frequency`                                    | Enum: weekly, biweekly, monthly, off       |
| `notification_preferences` enhancement                      | Per-event-type channel matrix              |
| `governance_briefs` table (or JSONB in `governance_events`) | Store generated briefs for in-app viewing  |

### New API Routes

| Route                  | Method | Purpose                                 |
| ---------------------- | ------ | --------------------------------------- |
| `/api/briefs/generate` | POST   | Admin/cron trigger for brief generation |
| `/api/briefs/latest`   | GET    | Fetch user's most recent brief          |

### New Components

| Component             | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `GovernanceBriefCard` | "Your Weekly Brief" card on auth homepage |

### Files Affected

- `lib/notifications.ts` — Push sender fix, email channel addition
- `app/api/push/send/route.ts` — Extracted into shared function for notification engine
- New: `lib/email.ts` — Resend integration
- New: `lib/governanceBrief.ts` — Brief assembly + AI generation
- New: Inngest function `generate-governance-brief`
- New: `app/api/briefs/generate/route.ts`, `app/api/briefs/latest/route.ts`
- New: `components/GovernanceBriefCard.tsx`
- `components/NotificationPreferences.tsx` — Email channel + digest frequency
- `components/HomepageAuth.tsx` — Add GovernanceBriefCard
- Sync route files — Migrate legacy push calls
- Email templates (4)

### Analytics for This Session

| Event                           | Type   | Properties                                      |
| ------------------------------- | ------ | ----------------------------------------------- |
| `governance_brief_generated`    | Server | `user_type`, `drep_id`, `brief_type`, `channel` |
| `governance_brief_delivered`    | Server | `user_address`, `channel`, `brief_type`         |
| `governance_brief_opened`       | Client | `brief_id`, `source` (email/push/in-app)        |
| `email_subscribed`              | Server | `user_address`, `digest_frequency`              |
| `email_delivered`               | Server | `template`, `success`                           |
| `notification_channel_migrated` | Server | `from` (legacy), `to` (new engine)              |

New Observable data loaders: `governance-briefs.json.ts`, `notification-delivery.json.ts` (if not added in Session 8)

### Inngest Alert Additions

- **Email bounce rate alert:** If bounce rate exceeds 5%, alert via Discord
- **AI brief generation failure:** If weekly generation fails for >10% of users, alert
- **Push consolidation regression:** After migrating legacy push, monitor delivery rate — alert if it drops below previous baseline

### Success Criteria

- Push notifications work through unified engine (legacy paths removed)
- Email channel delivers with <5% bounce rate
- AI governance brief generates for all active users weekly
- Brief open rate >30% (email channel)
- Brief drives measurable return visits (PostHog: `governance_brief_opened` → `homepage_viewed` within 24h)
- "Your Weekly Brief" card appears on auth homepage
- Notification preferences UI covers all 4 channels with per-event control

### Risks

- **AI API costs:** Briefs generate per-user content. Template-based + AI polish controls cost. Monitor token usage per brief and set budget alerts.
- **Email deliverability:** New domain needs warm-up period. Use Resend managed domain. Monitor bounce/spam rates.
- **Push migration:** Consolidating legacy push requires careful testing. Run both paths in parallel for 1 week before removing legacy.
- **Brief quality:** AI-generated content must be accurate. Validate facts (scores, ranks, vote counts) against source data before including in prompts. Never let AI hallucinate governance data.

---

## Session 11 — Differentiators & Citizen Identity

### Goal

Complete both sides of the governance marketplace. Add the Governance Identity Radar that makes every DRep visually distinctive. Build the delegator progression system that makes ADA holders feel invested. Ship cross-proposal intelligence that creates unique, shareable content. When Session 11 is done, DRepScore is the first governance _relationship_ platform in crypto — both sides engaged, both sides progressing, both sides sharing.

### Problems This Solves

- DReps have no visual governance identity — all look the same beyond their score number
- The 6 alignment dimensions already stored on `dreps` table are underutilized
- ADA holders have no progression, no gamification, no reason to keep engaging
- DReps don't know how engaged their delegators are
- No macro-level governance pattern analysis exists
- The delegator side of the marketplace lacks emotional investment

### Specific Changes

**1. DRep Governance Identity Radar**

Already recommended as "Build now" in the original Session 8 — lowest complexity, highest visual impact.

- Radar/spider chart using the 6 `alignment_`\* scores already stored on `dreps` table (treasury, decentralization, security, innovation, community, sustainability)
- Appears on: DRep profile page, DRep quick view, compare page, shareable report cards
- Uses Recharts RadarChart with custom DRepScore styling (consistent with existing chart aesthetic)
- Generates a "governance identity" narrative: "This DRep prioritizes fiscal conservatism and protocol stability" based on highest alignment dimensions
- Shareable: "My Governance Identity" card for DReps, "My DRep's Governance Identity" for delegators
- OG image: `/api/og/governance-identity/[drepId]` showing the radar
- Files: new `components/GovernanceIdentityRadar.tsx`, update DRep profile page, update compare page, update `DRepQuickView`, new OG route

**2. Governance Citizen Levels**

Existing `GovernanceLevelBadge` and `lib/governanceLevels.ts` already compute a level. Deepen into a full progression system:

- **Levels:** Observer (connected) -> Participant (first poll vote) -> Citizen (5+ polls) -> Guardian (delegated + 10+ polls) -> Advocate (20+ polls + accountability votes + stable delegation 90+ days)
- Each level unlocks a visual badge displayed on governance dashboard and shareable
- Level-up moments: celebration animation (reuse `canvas-confetti` pattern), shareable card, push notification
- Progress bar showing actions needed for next level: "3 more poll votes to reach Citizen"
- Displayed prominently on `/governance` page and auth homepage
- Files: update `lib/governanceLevels.ts`, new `components/CitizenProgressBar.tsx`, update `components/GovernanceLevelBadge.tsx`, celebration in `components/HomepageAuth.tsx`

**3. Delegation anniversary and milestones**

The `DelegationAnniversaryCard` component already exists. Extend:

- Track delegation duration milestones: 1 month, 3 months, 6 months, 1 year
- Rich context: "You've been delegated to [DRep] for 6 months. In that time, they've voted on 45 proposals and your representation score averaged 78%."
- Shareable milestone card: "6 months as a Governance Guardian"
- Push notification on anniversary
- Files: update `lib/delegationMilestones.ts`, update `components/DelegationAnniversaryCard.tsx`

**4. Delegator engagement recognition on DRep profiles**

Give DReps visibility into their delegator base engagement (anonymized):

- "Your delegators are highly engaged: 45% have voted in polls (vs 12% platform average)"
- "Your most active delegators align with your votes 82% of the time"
- Aggregate stats only — no individual delegator identification
- Displayed in DRep dashboard representation scorecard
- Files: update `components/RepresentationScorecard.tsx`, update `/api/dashboard/representation`

**5. Delegation event detection (simplified)**

- Epoch-level detection: compare `delegator_count` between consecutive `drep_power_snapshots`
- Dashboard card: "You gained 5 delegators this epoch (+120K ADA)" / "You lost 2 delegators (-30K ADA)"
- Push notification to DRep on significant changes (threshold: >=3 delegators or >=50K ADA change)
- Shareable moment card for gains
- Files: update Inngest `check-notifications` function, new `components/DelegationChangeCard.tsx`

**6. Cross-Proposal Intelligence**

Surface macro governance patterns no one else tracks:

- "Treasury proposals pass at 73% rate but have only 52% community support — DReps are more treasury-friendly than their delegators"
- "DReps who provide rationale are 2.3x more likely to vote No than those who don't"
- "Proposal pass rate has increased 15% this quarter — governance is becoming less contentious"
- "Average DRep participation this epoch: 67%, up from 54% last epoch"
- Section on `/pulse` page and included in weekly brief (Session 10)
- Data: aggregated from existing tables (proposals, drep_votes, poll_responses, vote_rationales)
- AI-generated narrative from statistical patterns (or template-based if AI costs concern)
- Files: new `lib/proposalIntelligence.ts`, new `components/CrossProposalInsights.tsx`, update pulse page

### Data Model Changes

| Change                 | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `users.citizen_level`  | Cached level for quick display (or compute on fly from existing data) |
| No new tables required | All data sources already exist                                        |

### New API Routes

| Route                                  | Method | Purpose                            |
| -------------------------------------- | ------ | ---------------------------------- |
| `/api/og/governance-identity/[drepId]` | GET    | Governance identity radar OG image |

### New Components

| Component                 | Purpose                                 |
| ------------------------- | --------------------------------------- |
| `GovernanceIdentityRadar` | Radar chart of 6 alignment dimensions   |
| `CitizenProgressBar`      | Level progression with actions needed   |
| `DelegationChangeCard`    | Epoch-level delegator gain/loss display |
| `CrossProposalInsights`   | Macro governance pattern cards          |

### Files Affected

- New: `components/GovernanceIdentityRadar.tsx`
- New: `components/CitizenProgressBar.tsx`
- New: `components/DelegationChangeCard.tsx`
- New: `components/CrossProposalInsights.tsx`
- New: `lib/proposalIntelligence.ts`
- New: `app/api/og/governance-identity/[drepId]/route.tsx`
- `app/drep/[drepId]/page.tsx` — Add governance identity radar
- `components/DRepQuickView.tsx` — Add mini radar
- `app/compare/page.tsx` or `components/CompareView.tsx` — Add radar comparison
- `lib/governanceLevels.ts` — Full progression logic
- `components/GovernanceLevelBadge.tsx` — Visual enhancement
- `components/HomepageAuth.tsx` — Level-up celebration, progress bar
- `app/governance/page.tsx` — Citizen progression section
- `lib/delegationMilestones.ts` — Duration milestones
- `components/DelegationAnniversaryCard.tsx` — Rich context
- `components/RepresentationScorecard.tsx` — Delegator engagement stats
- `/api/dashboard/representation` — Add engagement metrics
- Inngest `check-notifications` — Delegation event detection
- `app/pulse/page.tsx` — Cross-proposal insights section

### Analytics for This Session

| Event                           | Type   | Properties                                         |
| ------------------------------- | ------ | -------------------------------------------------- |
| `governance_identity_viewed`    | Client | `drep_id`, `viewer_type` (self/other)              |
| `governance_identity_shared`    | Client | `drep_id`, `platform`                              |
| `citizen_level_up`              | Server | `user_address`, `new_level`, `old_level`           |
| `citizen_progress_viewed`       | Client | `current_level`, `next_level`, `actions_remaining` |
| `delegation_milestone_reached`  | Server | `user_address`, `drep_id`, `milestone`             |
| `delegation_milestone_shared`   | Client | `milestone`, `platform`                            |
| `delegation_change_detected`    | Server | `drep_id`, `delta_count`, `delta_ada`              |
| `cross_proposal_insight_viewed` | Client | `insight_type`                                     |

New Observable data loaders: `citizen-levels.json.ts`

### Success Criteria

- Governance Identity Radar appears on every DRep profile, quick view, and compare page
- Radar becomes the most-shared visual asset from DRepScore
- At least 20% of active delegators reach Citizen level or higher within 2 months of launch
- Level-up celebrations trigger social sharing at >15% rate
- Delegation milestones (1mo, 3mo, 6mo) generate shareable cards
- DReps with claimed profiles view delegator engagement stats weekly
- Cross-proposal insights section on /pulse generates social discussion
- Delegation event notifications fire reliably for all claimed DReps

### Risks

- Governance Identity Radar alignment scores may cluster (all DReps look similar) — verify score distribution before shipping. If scores lack variance, consider normalization.
- Citizen level thresholds may be too easy or too hard — monitor distribution and adjust after 1 month of data.
- Cross-proposal intelligence requires sufficient voting data to generate meaningful patterns — may need minimum thresholds before showing insights.
- Delegation event detection is epoch-level only — users may expect real-time. Set expectations clearly in UI copy.

---

## Deferred Items

These items from the original Session 8 ideas and Session 6 are deferred with rationale:

| Item                                    | Original Recommendation | Status       | Rationale                                                                                                       |
| --------------------------------------- | ----------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| On-chain rationale submission           | Revisit after data      | **Deferred** | Monitor GovTool usage. If DReps consistently draft in DRepScore then switch to GovTool, demand signal is clear. |
| AI score coach chatbot                  | Revisit after data      | **Deferred** | Score Simulator serves the "how do I improve" use case. Revisit when demand signal emerges.                     |
| Proposal discussion threads             | Defer                   | **Deferred** | High moderation overhead for current user base. Position statements serve similar purpose with lower risk.      |
| Multi-DRep team dashboard               | Defer                   | **Deferred** | Very few organizations run team DReps. Revisit when demand signals emerge.                                      |
| Signature governance constellation      | Session 6               | **Deferred** | Design-heavy, requires visual design iteration. Governance Identity Radar partially fills this role.            |
| Page transitions (View Transitions API) | Session 6               | **Deferred** | Next.js 16 support still experimental. Browser compatibility risk. Defer until API stabilizes.                  |
| Custom iconography                      | Session 6               | **Deferred** | Lucide is high quality and consistent. Custom icons require a designer.                                         |

---

## Parallel Work: Sync Pipeline Hardening

A comprehensive sync audit revealed 7 significant issues in the Koios-to-Supabase sync pipeline. The critical fix (`sync_log` CHECK constraint) is included in Session 8 pre-work. The remaining hardening work is planned separately in `.cursor/plans/sync-hardening.plan.md` and can run in parallel with Sessions 8-11 on its own worktree.

Key items: deprecate orphan sync routes, add Zod schema validation on Koios responses, fix 207 degraded-state monitoring, review Inngest concurrency keys, add integration tests, document sync architecture.

---

## Anti-Patterns (Continued)

In addition to the anti-patterns from v1.0:

1. **Don't ship analytics gaps.** Every new feature must include PostHog events and Observable loader consideration before the PR is merged. "We'll add tracking later" is a pattern that got us to 9 untracked pages.
2. **Don't let push/email become noisy.** The engagement engine (Session 10) is powerful. Respect user attention. Default to minimal notifications, let users opt in to more. One great weekly brief > five mediocre daily pings.
3. **Don't confuse progression with coercion.** Citizen levels should feel rewarding, not mandatory. Never gate features behind levels. Levels are recognition, not access control.
4. **Don't ship without mobile testing.** After Session 9, every feature must be tested on a phone-sized viewport before merging. The "mobile is primary" principle is meaningless if we only test on desktop.
