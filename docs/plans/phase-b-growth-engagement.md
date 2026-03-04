# Phase B: Growth & Engagement Engine — Build Plan

> Follows Phase A (Backend Completion + Civic Foundation). Builds the mechanics that bring citizens back and bring new citizens in.

---

## What Phase A Delivered (Prerequisites)

### Backend (Batches 0-8)

- **SPO Score V2** — 4-pillar model with Governance Identity, momentum, percentile normalization (ADR-006)
- **Score Tier System** — Emerging → Legendary, tier history, tier change detection, tier API
- **Alignment Drift Detection** — 6D drift engine, Inngest function, drift API, re-delegation intelligence
- **Score Impact Prediction** — generalized simulator for DReps and SPOs, prediction API
- **SPO Experience** — wallet-to-pool detection, claim flow, competitive context API
- **Intelligent Notification Triggers** — event registry for tier changes, drift, inactivity, competitive movement, delegation milestones
- **Channel Renderers** — push, email, Discord, Telegram content builders for all event types
- **Citizen Intelligence** — engagement level computation, personalized epoch summary, DRep report card, expanded achievement engine
- **Feature Flags** — `spo_governance_identity`, `score_tiers`, `alignment_drift`, `score_impact_prediction`, `citizen_intelligence`, `spo_claim_flow`
- **Database** — `tier_changes`, `citizen_epoch_summaries`, `alignment_drift_records` tables; extended `pools` and `dreps` with tier + identity columns
- **SPO `delegator_count` live refresh** — `sync-spo-scores` refreshes `delegator_count` for ALL pools each run (not just first-time enrichment)
- **`spo_power_snapshots` table** — epoch-level snapshots of `delegator_count` + `live_stake_lovelace` per pool, mirroring `drep_power_snapshots`. Populated each `sync-spo-scores` run. Enables SPO delegator trend charts and temporal analysis.

### Frontend Plan (Batch 9)

- Clean-sheet redesign plan in `docs/plans/civica-frontend-redesign.md`
- 4-destination navigation, segment detection, action feed, celebration/sharing system, tier visual identity
- The Civica frontend plan creates the **surfaces** Phase B fills with content

---

## Phase B Scope

Three workstreams, all building on Phase A infrastructure:

| Workstream                             | Core Idea                          | Phase A Foundation                                                                   |
| -------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| **B1: Governance Wrapped**             | Shareable civic identity cards     | Epoch summaries, tier history, score snapshots, OG image infrastructure, share modal |
| **B2: DRep-to-Citizen Communication**  | Representative-constituent channel | Action feed, notification registry, DRep profiles, citizen inbox                     |
| **B3: Notification-Driven Civic Life** | Return visits with purpose         | Channel renderers, notification triggers, epoch summaries, deep-linking              |

---

## B1: Governance Wrapped & Shareable Moments

### Concept

Every citizen, DRep, and SPO gets a "Wrapped" — a visual summary of their governance life over an epoch or a year. Every stat in the Wrapped generates a shareable card. This is the primary viral growth mechanic.

### Backend Tasks

**B1.1 — Wrapped Data Aggregation Engine**

New Inngest function: `generate-governance-wrapped`

- Triggers: end of each epoch + annually
- Computes per-entity Wrapped data packages:

_Citizen Wrapped:_

- DRep accountability: how their DRep voted, score trend, tier changes
- Alignment status: drift events, dimension shifts
- Governance footprint: epoch participation, delegation duration
- Civic engagement level progression
- Top governance moments (achievements unlocked)

_DRep Wrapped:_

- Score journey: start → end, tier changes, personal best
- Votes cast, rationales written, rationale quality trend
- Delegators: gained, lost, net, milestone
- Competitive movement: rank changes, top movers
- Most impactful votes (proposals where their vote was decisive)
- Pillar breakdown comparison: start of period vs end

_SPO Wrapped:_

- Governance participation rate vs SPO average
- Score + tier journey
- Voting consistency analysis
- Pool differentiation: how governance sets them apart
- Delegator count trajectory (from `spo_power_snapshots`)
- Delegator governance awareness stats (future: requires `/pool_delegators` Koios endpoint, Phase C/D)

Storage: `governance_wrapped` table with `entity_type`, `entity_id`, `period_type` (epoch/annual), `period_id`, `data` (JSONB), `generated_at`.

**B1.2 — Shareable Card Generation**

Extend OG image infrastructure:

- New OG routes per Wrapped stat type:
  - `/api/og/wrapped/citizen/[userId]/[period]`
  - `/api/og/wrapped/drep/[drepId]/[period]`
  - `/api/og/wrapped/spo/[poolId]/[period]`
  - `/api/og/wrapped/stat/[statId]` — individual stat cards
- Each route renders a purpose-built visual card (not a screenshot)
- Cards branded with Civica identity + tier colors
- Include CTA: "Find your governance story at civica.app"

**B1.3 — "Your Staking Governance" Card**

Special Wrapped card for stakers:

- How their SPO voted this epoch/year
- SPO governance score + tier
- Participation rate vs SPO average
- "Your ADA supports a [tier] governance participant"
- Delegator count trend (from `spo_power_snapshots` — Phase A prerequisite)
- Shareable via same infrastructure

> **Data dependency:** This card requires `spo_power_snapshots` (temporal delegator/stake data) to show meaningful trends. Phase A must deliver that table and the SPO delegator trends API before this card can render historical context.

### Frontend Tasks

**B1.4 — Wrapped Experience Flow**

New route: `/my-gov/wrapped/[period]`

- Full-screen, story-like presentation (swipe through stats)
- Each stat is a screen with:
  - Visual (custom, animated)
  - Stat value + context
  - "Share this" button → ShareModal with generated card preview
- Progress indicator showing Wrapped position
- Final screen: "Share your Governance Wrapped" with combined card

**B1.5 — Wrapped Entry Points**

- Notification on epoch end: "Your Governance Wrapped is ready"
- My Gov action feed card: "View your epoch summary"
- Profile badge: "Wrapped available" indicator
- Home page highlight when Wrapped is new

**B1.6 — Share Flow Enhancement**

- Extend `ShareModal` from Phase A frontend plan:
  - Pre-filled tweet text with governance stats
  - Card preview with download option
  - "Share to X" deep link with image + text
  - Copy shareable link (resolves to public Wrapped page)
- Public Wrapped page: `/wrapped/[entityType]/[entityId]/[period]`
  - Viewable without wallet
  - CTA: "Find YOUR governance story" → Quick Match

### Database Migration

```sql
-- governance_wrapped table
CREATE TABLE governance_wrapped (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('citizen', 'drep', 'spo')),
  entity_id text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('epoch', 'annual')),
  period_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, period_type, period_id)
);

CREATE INDEX idx_wrapped_entity ON governance_wrapped (entity_type, entity_id);
CREATE INDEX idx_wrapped_period ON governance_wrapped (period_type, period_id);

-- Feature flag
INSERT INTO feature_flags (key, enabled, description)
VALUES ('governance_wrapped', false, 'Enable Governance Wrapped generation and display');
```

---

## B2: DRep-to-Citizen Communication Loop

### Concept

DReps can post position statements that their delegators see in their action feed. Citizens can see what their DRep thinks about active proposals. This creates the first direct representative-constituent communication channel in crypto governance.

### Backend Tasks

**B2.1 — Position Statements Data Model**

```sql
CREATE TABLE position_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drep_id text NOT NULL REFERENCES dreps(id),
  proposal_tx_hash text,
  proposal_index int,
  statement_type text NOT NULL CHECK (statement_type IN ('position', 'rationale', 'general')),
  title text,
  content text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_pinned boolean DEFAULT false,
  visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'delegators'))
);

CREATE INDEX idx_statements_drep ON position_statements (drep_id, published_at DESC);
CREATE INDEX idx_statements_proposal ON position_statements (proposal_tx_hash, proposal_index);

-- Citizen question/feedback
CREATE TABLE citizen_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_stake_address text NOT NULL,
  drep_id text NOT NULL REFERENCES dreps(id),
  question text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_public boolean DEFAULT true,
  upvotes int DEFAULT 0
);

CREATE INDEX idx_questions_drep ON citizen_questions (drep_id, created_at DESC);

-- Feature flag
INSERT INTO feature_flags (key, enabled, description)
VALUES ('drep_communication', false, 'Enable DRep-to-citizen communication features');
```

**B2.2 — Position Statement API**

- `POST /api/drep/[drepId]/statements` — create (authenticated, must be the DRep)
- `GET /api/drep/[drepId]/statements` — list (public or delegator-filtered)
- `PUT /api/drep/[drepId]/statements/[id]` — update
- `DELETE /api/drep/[drepId]/statements/[id]` — delete
- `GET /api/proposals/[txHash]/[index]/statements` — position statements for a proposal

**B2.3 — Citizen Questions API**

- `POST /api/drep/[drepId]/questions` — submit (authenticated citizen)
- `GET /api/drep/[drepId]/questions` — list
- `POST /api/drep/[drepId]/questions/[id]/upvote` — upvote

**B2.4 — Communication Notification Triggers**

New Inngest function: `notify-drep-communication`

- Trigger: new position statement published
- Find all delegators of this DRep
- Check notification preferences
- Generate notification: "Your DRep [Name] posted about [Proposal Title]"
- Dispatch via existing channel renderers

New event types in notification registry:

- `drep-position-statement` — DRep publishes a position
- `citizen-question` — citizen submits a question (notify DRep)
- `question-upvote-milestone` — question reaches 5/10/25 upvotes (notify DRep)

### Frontend Tasks

**B2.5 — DRep Profile: Communication Section**

On DRep profile page (`/drep/[drepId]`):

- "Statements" tab showing position statements
- Pinned statement at top
- Statement cards: title, preview, proposal link, timestamp
- Expand to read full statement

For the DRep themselves (authenticated):

- "Write a Statement" button in My Gov action feed
- Statement editor: rich text, proposal link, visibility toggle
- Draft/publish flow

**B2.6 — Citizen Feed Integration**

In My Gov action feed (delegated citizen):

- Statement cards: "Your DRep posted about [Proposal]"
- CTA: "Read their position" → expands or navigates to profile
- Questions CTA: "Ask your DRep a question"

On proposal detail page:

- "What representatives are saying" section
- Position statements from DReps who voted on this proposal
- Your DRep's statement highlighted if they posted

**B2.7 — Questions Feed**

On DRep profile:

- "Questions from citizens" section
- Sorted by upvotes + recency
- Citizens can submit + upvote
- DRep sees question feed in their My Gov command center

---

## B3: Notification-Driven Civic Life

### Concept

Notifications become the primary return-visit driver. Every notification has a specific purpose and deep-links to an action. Weekly digest gives citizens a reason to return even during quiet epochs.

### Backend Tasks

**B3.1 — Weekly Governance Digest**

New Inngest scheduled function: `generate-weekly-digest`

- Runs weekly (configurable day)
- For each authenticated citizen:
  - DRep score change summary
  - New proposals requiring attention
  - Alignment drift status
  - Governance activity stats (votes cast in ecosystem)
  - Top achievements across network
  - Personalized insight: "Your DRep is in the top 15% this epoch"
- Render digest per channel (email gets full digest, push gets headline + deep link)

**B3.2 — Epoch Recap Notification**

New Inngest function: `notify-epoch-recap`

- Triggers on epoch boundary (detected from sync pipeline)
- For each citizen with notifications enabled:
  - "Epoch [N] Recap: Your government made [X] decisions"
  - Personalized: your DRep's votes, alignment status
  - Deep-link to `/pulse/epoch/[N]` or personalized My Gov view

**B3.3 — Deep-Link Resolution**

Notification deep-links must resolve to specific actions, not just pages:

- Tier change → My Gov with celebration overlay triggered
- Alignment drift → My Gov with drift alert expanded
- New proposal → Proposal detail page with DRep's expected impact highlighted
- DRep statement → DRep profile, statement section scrolled to
- Epoch recap → Pulse epoch report, personalized header

Implement via URL query parameters: `?action=celebrate-tier&tier=Gold`, `?action=view-drift`, etc.
Frontend reads these on mount and triggers appropriate behavior.

**B3.4 — Notification Scheduling & Rate Limiting**

Prevent notification fatigue:

- Maximum 3 push notifications per day per user
- Batch low-priority notifications into daily summary
- Priority system: tier changes > alignment drift > proposals > digest > achievements
- Respect user preferences per channel per category
- Quiet hours: no push between 22:00-08:00 user local time (stored preference)

Storage: `notification_preferences` table if not already sufficient. Add columns for:

- `quiet_hours_start`, `quiet_hours_end`
- `max_daily_push`
- Per-category toggles

**B3.5 — Notification Analytics**

Track engagement to optimize:

- `notification_events` table: sent, delivered, opened, action_taken
- Weekly digest open rate
- Push → app return rate
- Notification → action conversion rate
- Use to tune priority, frequency, and content

```sql
CREATE TABLE notification_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid,
  user_stake_address text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'action_taken')),
  channel text NOT NULL,
  notification_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_analytics_user ON notification_analytics (user_stake_address, created_at DESC);
CREATE INDEX idx_notif_analytics_type ON notification_analytics (notification_type, event_type);
```

### Frontend Tasks

**B3.6 — Digest Email Template**

Rich HTML email:

- Civica branded header
- Personalized greeting with segment acknowledgment
- Score/tier update section
- Proposal highlights
- Alignment status
- "Open Civica" CTA buttons linking to deep-linked actions
- Unsubscribe link

**B3.7 — Push Notification Handling**

Service worker updates:

- Click handler routes to deep-linked URL
- Badge count management
- Notification grouping by category

**B3.8 — In-App Notification Indicators**

- My Gov nav item: unread count badge
- Inbox: real-time updates (TanStack Query polling or Supabase realtime)
- Toast notifications for high-priority events when app is open
- Action feed: new items animate in at top

---

## Build Sequence

| Batch | Workstream     | Scope                                                                  | Depends On                                   |
| ----- | -------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| B-0   | Infrastructure | Database migrations, feature flags, notification preferences schema    | Phase A complete                             |
| B-1   | B1             | Wrapped data aggregation engine + OG card generation                   | Epoch summary data (A), score snapshots      |
| B-2   | B2             | Position statements + questions backend (API, data model)              | DRep profiles (A)                            |
| B-3   | B3             | Weekly digest + epoch recap + deep-link resolution                     | Notification triggers (A), channel renderers |
| B-4   | B1             | Wrapped frontend: story flow, share enhancement, public Wrapped page   | B-1, Civica frontend (A7)                    |
| B-5   | B2             | Communication frontend: statement editor, feed integration, questions  | B-2, Civica frontend (A7)                    |
| B-6   | B3             | Digest email template, push handling, in-app indicators, rate limiting | B-3, Civica frontend (A7)                    |
| B-7   | All            | Notification analytics, A/B testing hooks, polish                      | B-4, B-5, B-6                                |

**Note:** Batches B-1, B-2, B-3 are backend-only and can proceed in parallel. Batches B-4, B-5, B-6 require the Civica frontend (Phase A7) to be at least partially shipped. B-7 is integration and polish.

---

## Success Criteria (from Vision)

- [ ] Weekly return rate > 40% for authenticated citizens
- [ ] At least 10% of tier changes result in a social share
- [ ] DReps posting position statements visible to delegators
- [ ] Weekly governance digest delivering personalized insights
- [ ] Epoch recap push notifications driving return visits
- [ ] Every notification deep-links to a specific in-app action
- [ ] Governance Wrapped generates shareable content for all segments
- [ ] Citizen questions feed operational on DRep profiles

---

## Preparing for Phase C

Phase B creates the **engagement** and **growth loops** that Phase C monetizes:

- **DRep Pro (C1):** Communication tools (B2) become the foundation for pro features — enhanced statement analytics, AI-assisted drafting, smart inbox for citizen questions, campaign pages.
- **SPO Pro (C2):** Wrapped stats and competitive context become pro analytics. Enhanced governance reporting.
- **Verified Projects (C3):** The notification and digest infrastructure (B3) extends to project accountability tracking.
- **Subscription infrastructure (C4):** Notification preferences UI (B3) naturally extends to subscription/entitlement management.

Phase B proves the engagement model. Phase C turns engagement into revenue.
