# Build Manifest (derived from ultimate-vision.md V3.0)

> **Purpose:** Machine-readable audit checklist. Agents verify `[x]` items exist, report `[ ]` items as gaps.
> **Last synced with vision:** 2026-03-10
> **Usage:** `Phase 1 audit` = read this file, verify files/routes/tables. `Phase 2 audit` = read ultimate-vision.md for qualitative alignment.
> **Scoring:** After each `/audit`, record dimension scores in the Audit Score History section at the bottom.

---

## Foundation [COMPLETE]

Backend intelligence engine. Do not modify unless fixing bugs or extending.

- [x] DRep Score V3 (4-pillar: EQ 35%, EP 25%, R 25%, GI 15%) | `lib/scoring/drepScore.ts`
- [x] Percentile normalization | `lib/scoring/percentile.ts`
- [x] Momentum tracking | inline in `lib/scoring/drepScore.ts`
- [x] 6D PCA alignment system | `lib/alignment/`
- [x] AI proposal classification | `lib/alignment/classifyProposal.ts`
- [x] GHI with 6 components + 7 EDI metrics | `lib/ghi/`
- [x] PCA-based Quick Match | `lib/matching/`, `/match` route
- [x] User governance profiles | table: `user_governance_profiles`
- [x] Persona-agnostic matching (`match_type` param) | `lib/matching/`
- [x] Treasury intelligence | `/api/treasury/*` (8 routes)
- [x] SPO + CC vote fetching & sync | `lib/sync/`
- [x] Inter-body alignment | table: `inter_body_alignment`
- [x] Governance calendar + AI epoch recaps | table: `epoch_recaps`
- [x] Proposal semantic classification | table: `proposal_similarity_cache`
- [x] SPO 4-pillar scoring | `lib/scoring/spoScore.ts`
- [x] SPO 6D alignment, SPO matching | `lib/alignment/`, `lib/matching/`
- [x] CC Transparency Index | `lib/scoring/ccTransparency.ts`
- [x] Daily snapshots: drep_score_history, alignment_snapshots, ghi_snapshots, decentralization_snapshots, spo_score_snapshots, spo_alignment_snapshots
- [x] 36 Inngest sync functions | `inngest/functions/`
- [x] 75+ database tables
- verify: `GET /api/v1/drep-scores`, `GET /api/v1/spo-scores`, `POST /api/governance/quick-match` return data

## Foundation — Shipped Features (needs recomposition into new architecture)

- [x] Epoch Briefing component | `components/civica/home/EpochBriefing.tsx`
- [x] Civic Identity Card | `components/civica/shared/CivicIdentityCard.tsx`
- [x] Treasury Citizen View | `components/civica/home/TreasuryCitizenView.tsx`
- [x] Citizen milestone detection | migration 051, `citizen_milestones` table
- [x] Generate citizen briefings Inngest function
- [x] Vote casting (CIP-95/MeshJS) | PR #143
- [x] Rationale submission (CIP-100) | PR #145
- [x] Governance statement (CIP-100 anchoring) | PR #148
- [x] Constitutional alignment analysis | PR #150
- [x] DRep epoch updates | PR #150
- [x] SPO vote casting | PR #162
- [x] Proposal Sentiment (stake-weighted) | PR #157
- [x] Priority Signals (ranked-choice) | PR #157
- [x] Concern Flags | PR #157
- [x] Impact Tags | PR #157
- [x] Citizen Questions (proposal-linked) | PR #157
- [x] Citizen Assemblies (AI-generated) | PR #157
- [x] Citizen Endorsements | `components/engagement/CitizenEndorsements.tsx`
- [x] Engagement integrity (anti-spam + quorum) | PR #169
- [x] Engagement -> score feedback loop | PR #161
- [x] Wrapped generation (all entity types) | `generate-governance-wrapped` Inngest
- [x] OG image generation | `app/api/og/`
- [x] Civic identity OG images | PR #170

---

## Phase 0: Architecture Reset [COMPLETE]

### Route structure

- [x] Hub page (`/`) — persona-adaptive | `app/page.tsx` → `HubHomePage`
- [x] Workspace section (`/workspace`) — DRep/SPO only | `app/workspace/` (7 sub-pages)
- [x] Governance section (`/governance`) with sub-pages | `app/governance/` (6 sub-pages)
- [x] Delegation page (`/delegation`) | `app/delegation/page.tsx`
- [x] You section (`/you`) with sub-pages | `app/you/` (identity, inbox, public-profile, settings)
- [x] Help section (`/help`) with sub-pages | `app/help/` (glossary, methodology, support)
- [x] Match page (`/match`) — expanded for DRep + Pool | `app/match/page.tsx`

### Navigation shell

- [x] Desktop sidebar — persona-adaptive, collapsible | `components/civica/CivicaSidebar.tsx`
- [x] Mobile bottom bar — 4 items, persona-adaptive | `components/civica/CivicaBottomNav.tsx`
- [x] Mobile pill bar — section sub-page navigation | `components/civica/SectionPillBar.tsx`
- [x] Desktop top bar — search, notifications, user menu | `components/civica/CivicaHeader.tsx`
- [x] Route redirects (301s) for old routes | `next.config.ts` (15+ redirects) + `middleware.ts`

### Hub card system

- [x] HubCardRenderer — persona-aware card composition | `components/hub/HubCardRenderer.tsx`
- [x] Action cards (time-sensitive) | `components/hub/cards/ActionCard.tsx`
- [x] Status cards (health indicators) | `components/hub/cards/StatusCard.tsx`
- [x] Engagement cards (polls/votes) | `components/hub/cards/EngagementCard.tsx`
- [x] Discovery cards (suggestions) | `components/hub/cards/DiscoveryCard.tsx`
- [x] Representation card (delegation health) | `components/hub/cards/RepresentationCard.tsx`
- [x] Governance health card (GHI summary) | `components/hub/cards/GovernanceHealthCard.tsx`

### MLE per persona

- [x] Citizen MLE — Hub with cards + delegation dual-rep view | `components/civica/home/HomeCitizen.tsx`
- [x] DRep MLE — Workspace action queue, vote flow | `components/civica/home/HomeDRep.tsx`
- [x] SPO MLE — Workspace gov score, pool profile | `components/civica/home/HomeSPO.tsx`
- [x] Anonymous MLE — landing with value prop + two CTAs | `components/civica/home/HomeAnonymous.tsx`

### Definition of done

- verify: each persona completes #1 JTBD in <60 seconds
- verify: old routes redirect properly (301s)
- verify: sidebar/bottom bar adapt per persona

---

## Phase 1: Recompose & Activate [~95% COMPLETE]

### 1a: Entity profiles in new architecture

- [x] DRep profiles with breadcrumbs from `/governance/representatives` | `app/drep/[drepId]/page.tsx`
- [x] SPO profiles with breadcrumbs from `/governance/pools` | `app/pool/[poolId]/page.tsx`
- [x] CC profiles with breadcrumbs from `/governance/committee` | `app/governance/committee/page.tsx`
- [x] Proposal pages with breadcrumbs from `/governance/proposals` | `app/proposal/[txHash]/[index]/page.tsx`
- [x] Entity page tabs as proper navigation | `DRepProfileTabsV2`, `SpoProfileTabsV1`

### 1b: Governance section populated

- [x] `/governance/proposals` — active proposals, status, deadlines | `ProposalsBrowse.tsx`
- [x] `/governance/representatives` — DRep directory with scores | `CivicaDRepBrowse.tsx`
- [x] `/governance/pools` — pool directory with governance scores | `CivicaSPOBrowse.tsx`
- [x] `/governance/committee` — CC transparency | `app/governance/committee/page.tsx`
- [x] `/governance/treasury` — treasury spending transparency | `TreasuryOverview.tsx`
- [x] `/governance/health` — GHI + epoch history | `app/governance/health/page.tsx`
- [x] Persona-aware default landing per sub-page | `GovernanceRedirect` routes by segment

### 1c: Workspace recomposition

- [x] DRep: action queue with vote casting + CIP-100 flow | `WorkspacePage.tsx` + `VoteCastingPanel.tsx`
- [x] DRep: voting record, rationales, delegators, performance sub-pages | PR #255
- [x] SPO: gov score dashboard, pool profile, delegators, position sub-pages | `app/workspace/pool-profile/`, `app/workspace/position/`
- [x] DRep+SPO: both sets grouped by role header in sidebar | PR #254

### 1d: Governance Coverage

- [x] Coverage calculation (DRep + SPO action type coverage per epoch) | PR #255
- [x] Hub status card: "Your governance coverage: X%" | PR #255
- [x] Delegation page: coverage breakdown with gaps/alerts | `CoverageCard.tsx` + `DelegationPage.tsx`
- [x] Gap/conflict alerts | PR #255

### 1e: Citizen-Delegated UX Polish

- [x] Hub card dead-end links fixed (engagement, governance health) | PR #257
- [x] DRep score tier context + narratives on delegation page | PR #257
- [x] WCAG interactive-inside-interactive fix in inbox | PR #257
- [x] CLS flash fix on Hub home page | PR #257
- [x] 5-second test heading on proposals browse | PR #257
- [x] CDN cache headers on proposals API | PR #257

### 1f: Citizen-Anonymous UX Polish

- [x] Stale `/discover` route references purged (46 files) — all internal links now point to `/governance/*` routes directly
- [x] Match results "Browse All DReps/SPOs" links fixed → `/governance/representatives` and `/governance/pools`
- [x] Help page: heading "Learn" → "Help", stale links fixed, cards reduced from 6 to 4 (per UX constraints)
- [x] Score narratives surfaced on DRep browse cards — `getScoreNarrative()` rendered as subtitle on `CivicaDRepCard`
- [x] Landing page SSR optimized — heavy `info` JSONB fetch replaced with count-only queries (`head: true`)
- [x] BrandedLoader "$governada" → "Governada", tagline → "Governance Intelligence for Cardano"
- [x] `/governance` anonymous redirect moved to middleware (server-side, no client-side skeleton flash)
- [x] AnonymousNudge conversion CTAs on proposals, representatives, and health pages — dismissible, localStorage-persisted
- [x] Shareable match results — `/match/result?profile=<base64>` page, OG image generation with radar chart, share button with `navigator.share()` + clipboard fallback

### Remaining

- [ ] `/you/inbox` notifications — page exists but notification pipeline not wired to real events
- [ ] Dual-role sidebar expansion — currently shows single role, needs multi-role toggle for DRep+SPO users

### Flywheels activated: Accountability, Content/Discourse

- verify: DRep/SPO profiles accessible via Governance section
- verify: vote casting flow works from Workspace
- verify: governance coverage displays for delegated citizens

---

## Phase 2: Engagement Flywheel Activation [NOT STARTED]

- [ ] Hub engagement cards — active sentiment polls, priority signals, assemblies
- [ ] Anonymous glass window — see engagement results, can't participate, conversion CTA
- [ ] Contextual prompts on proposal pages — inline sentiment voting
- [ ] Contextual prompts on DRep profiles — endorsement prompt
- [ ] Contextual prompts on funded projects — impact tags
- [ ] Concern flags inline on proposal pages
- [ ] Citizen sentiment visible in DRep Workspace
- [ ] Engagement metrics in Hub briefings
- [ ] Endorsement counts on discovery cards

### Flywheel activated: Engagement

- verify: engagement actions possible from Hub without visiting separate page
- verify: anonymous users see engagement results but cannot participate

---

## Phase 3: Anonymous Funnel + Coverage Polish [NOT STARTED]

- [ ] Two-path anonymous landing optimized (Match + Governance)
- [ ] Match flow expanded: DRep matching + Pool matching ("governance team")
- [ ] Inline education (tooltips, contextual explainers)
- [ ] Wallet connect at moment of intent
- [ ] PostHog funnel measurement + iteration
- [ ] Governance Coverage prominent on Hub and Delegation
- [ ] "Complete your governance team" CTA
- [ ] Coverage trend over time
- [ ] Shareable coverage card

- verify: anonymous -> citizen conversion measurable via PostHog funnel

---

## Phase 4: Viral/Identity Flywheel Activation [NOT STARTED]

- [ ] GovernanceImpactScore calculation + display
- [ ] CivicMilestoneShare cards (first delegation, DRep milestones, coverage streaks)
- [ ] Enhanced Wrapped (multi-role, engagement stats, coverage)
- [ ] Animated share preview generation
- [ ] citizen_impact_scores table

### Flywheel activated: Viral/Identity

- verify: milestone share cards generate shareable OG images

---

## Phase 5: Monetization Layer [NOT STARTED]

- [ ] Subscription infrastructure (Stripe)
- [ ] subscriptions + subscription_events tables
- [ ] ProGate component (paywall CTA)
- [ ] DRep Pro ($15-25/mo) — delegation analytics, score simulator, competitive intel, AI rationale drafting
- [ ] SPO Pro ($15-25/mo) — governance analytics, competitive landscape, growth coaching
- [ ] Premium Delegator ($5-10/mo) — AI advisor, advanced alerts, portfolio management
- [ ] Verified Project ($10-25/project) — identity verification, milestone suite

---

## Phase 6: Integration Flywheel Activation [NOT STARTED]

- [ ] API v2 expansion — full entity, governance, scoring, matching endpoints
- [ ] OpenAPI spec + SDK generation (TypeScript, Python)
- [ ] Rate limiting tiers (free/basic/pro/enterprise)
- [ ] Research tier with bulk exports
- [ ] Embeddable widgets (Quick Match, DRep Score, SPO Badge, GHI gauge)
- [ ] Partner integrations (Eternl -> Lace -> PoolTool -> Vespr)

### Existing API v1

- [x] 11 public routes at `/api/v1/`
- [x] Developer page | `DeveloperPage.tsx`
- [x] API explorer | `ApiExplorer.tsx`
- [x] Embed routes | `app/embed/`

### Flywheel activated: Integration/Distribution

---

## Phase 7+: Advanced Intelligence & New Products [NOT STARTED]

- [ ] Delegation network graph + influence mapping
- [ ] Governance simulation engine
- [ ] delegation_snapshots per-epoch collection
- [ ] Catalyst Score (separate product line)
- [ ] Cross-ecosystem governance identity

---

## Quality Packages (post-architecture-reset)

Tracked in `docs/strategy/world-class-packages.md`. 13 QPs targeting 84->95+ score.

| QP       | Name                             | Status            |
| -------- | -------------------------------- | ----------------- |
| QP-1/2   | Accessibility (WCAG 2.1 AA)      | SHIPPED (PR #164) |
| QP-3     | Core algorithm tests             | SHIPPED (PR #165) |
| QP-4     | Error recovery + resilience      | SHIPPED (PR #166) |
| QP-5/6   | Scoring calibration + PCA        | SHIPPED (PR #167) |
| QP-7/8   | Animation + onboarding education | SHIPPED (PR #168) |
| QP-9     | Civic identity elevation         | SHIPPED (PR #170) |
| QP-10/11 | Engagement feedback + integrity  | SHIPPED (PR #169) |
| QP-12    | Citizen endorsements             | SHIPPED           |
| QP-13    | Load testing + performance       | NOT STARTED       |

---

## Audit Score History

> Updated by `/audit` and `/verify-audit` commands. Tracks score trends across sessions.
> Rubric: `docs/strategy/context/audit-rubric.md` (10 dimensions, 10 pts each = 100 total)

| Date                       | Engine | Citizen | Workspace | Engagement | Data | UX  | Perf | Testing | API | Completeness | Total  |
| -------------------------- | ------ | ------- | --------- | ---------- | ---- | --- | ---- | ------- | --- | ------------ | ------ |
| _Run `/audit` to populate_ | --     | --      | --        | --         | --   | --  | --   | --      | --  | --           | --/100 |

### Experience Audit History

| Date       | Persona-State     | E1 JTBD | E2 Friction | E3 Intel | E4 Emotion | E5 Craft | E6 Vision | Total | PR   |
| ---------- | ----------------- | ------- | ----------- | -------- | ---------- | -------- | --------- | ----- | ---- |
| 2026-03-10 | citizen-delegated | 7/10    | 6/10        | 6/10     | 6/10       | 7/10     | 6/10      | 38/60 | #257 |
| 2026-03-10 | citizen-anonymous | 6/10    | 5/10        | 7/10     | 6/10       | 7/10     | 5/10      | 36/60 | —    |
