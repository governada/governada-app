# Vision Parity Work Packages (Steps 1-5)

> **Created:** 2026-03-07
> **Purpose:** Close all gaps between current production state and 100/100 vision parity for Steps 1-5 of `ultimate-vision.md`
> **Tracking:** Each WP is a focused unit of work. Ship individually or batch into PRs.

---

## Status Overview

| WP    | Name                                      | Step | Status      | PR   |
| ----- | ----------------------------------------- | ---- | ----------- | ---- |
| WP-1  | Briefing-first citizen home               | 4    | SHIPPED     | #159 |
| WP-2  | Simplified anonymous onboarding           | 4    | SHIPPED     | #159 |
| WP-3  | Citizen notification steps                | 4    | SHIPPED     | #159 |
| WP-4  | Citizen milestone detection               | 4    | SHIPPED     | #159 |
| WP-5  | Proportional treasury share in briefing   | 4    | SHIPPED     | #159 |
| WP-6  | DRep delegator sentiment view             | 5+6  | SHIPPED     | #160 |
| WP-7  | Engagement signals -> score feedback loop | 6->1 | IN PROGRESS |      |
| WP-8  | Inter-body dynamics narrative             | 2+5  | IN PROGRESS |      |
| WP-9  | SPO Command Center parity                 | 2.5  | PENDING     |      |
| WP-10 | SPO vote casting                          | 5    | PENDING     |      |
| WP-11 | Progressive match confidence              | 1    | PENDING     |      |
| WP-12 | Proposal outcome tracking                 | 2+4  | PENDING     |      |
| WP-13 | CC Member Transparency Index              | 2.5  | PENDING     |      |
| WP-14 | Mobile briefing optimization              | 4    | PENDING     |      |
| WP-15 | Vote + rationale flow timing              | 5    | IN PROGRESS |      |

---

## WP-1: Briefing-First Citizen Home (SHIPPED)

**Vision gap:** HomeCitizen showed a dashboard. Vision says citizens see the Epoch Briefing as primary surface.

**Changes:**

- Restructured `HomeCitizen.tsx` around `EpochBriefing` as the hero element
- Briefing replaces dashboard paradigm for connected citizens
- Treasury citizen view positioned below briefing

**Files:** `components/civica/home/HomeCitizen.tsx`

---

## WP-2: Simplified Anonymous Onboarding (SHIPPED)

**Vision gap:** Anonymous visitors saw a complex nav. Vision says two-path entry (Stake/Govern) with education woven in.

**Changes:**

- Simplified `HomeAnonymous.tsx` to two-path entry
- Education integrated into paths, not separate destination
- Messaging: "Your ADA gives you a voice"

**Files:** `components/civica/home/HomeAnonymous.tsx`

---

## WP-3: Citizen Notification Steps (SHIPPED)

**Vision gap:** `check-notifications` Inngest function only handled DRep/SPO alerts. No citizen-specific alert triggers.

**Changes:**

- Added 3 citizen-specific steps (12-14) to `check-notifications.ts`
- Step 12: Gather citizen delegators from `user_wallets`
- Step 13: Check citizen DRep alerts (score drops >3pts, inactivity 3+ epochs, missed votes)
- Step 14: Check citizen milestones and send `citizen-level-up` notifications

**Files:** `inngest/functions/check-notifications.ts`

---

## WP-4: Citizen Milestone Detection (SHIPPED)

**Vision gap:** `citizen_milestones` table existed but no detection logic to award milestones.

**Changes:**

- Created `lib/citizenMilestones.ts` with 13 milestone definitions across 4 categories
  - Delegation: first delegation, 10/50/100 epoch streaks, delegation loyalty
  - Influence: 1K/10K/100K ADA governed
  - Engagement: first sentiment vote, 10 polls completed
  - Identity: first briefing read, governance profile created
- `checkAndAwardCitizenMilestones(userId, drepId)` function
- Called from `generate-citizen-briefings` Inngest and `check-notifications` Step 14
- Milestones stored via upsert on `user_id,milestone_key`

**Files:** `lib/citizenMilestones.ts`, `inngest/functions/generate-citizen-briefings.ts`

---

## WP-5: Proportional Treasury Share in Briefing (SHIPPED)

**Vision gap:** Treasury section of briefing showed balance but not "your proportional share."

**Changes:**

- Extended `/api/briefing/citizen` to fetch DRep delegated stake from `drep_power_snapshots`
- Added `circulating_supply_lovelace` from `governance_stats`
- Computes `proportionalShareAda = treasury * (drepStake / circulatingSupply)`
- `EpochBriefing.tsx` displays "Your DRep's X ADA delegation represents Y ADA of the treasury"

**Files:** `app/api/briefing/citizen/route.ts`, `components/civica/home/EpochBriefing.tsx`

---

## WP-6: DRep Delegator Sentiment View (SHIPPED)

**Vision gap:** DReps saw community-wide sentiment but not how their own delegators felt about proposals.

**Changes:**

- Wired `ownDRepId` from `useWallet()` through to `useSentimentResults` hook
- Added "Your Delegators" highlighted section in `ResultsView` with per-sentiment bars
- Shows stake-weighted support percentage
- "All Citizens" label separates delegator vs community results

**Files:** `components/engagement/ProposalSentiment.tsx`

---

## WP-7: Engagement Signals -> Score Feedback Loop

**Vision gap:** Community engagement data (sentiment, endorsements, concern flags) is collected but doesn't feed back into the intelligence engine. The data flywheel diagram shows: Endorsements -> DRepScore & SPOScore, Sentiment -> CitizenIntel -> DRepProfiles.

**Goal:** Close the loop so citizen engagement data influences DRep/SPO intelligence surfaces.

**Scope:**

- Aggregate citizen engagement signals per DRep (endorsement count, sentiment alignment with delegators, concern flag activity)
- Surface engagement summary on DRep profile pages (citizen trust signal alongside algorithmic score)
- Add endorsement/sentiment data to proposal workspace context
- Wire precomputed engagement signals into profile API responses

**Key files to modify:**

- `inngest/functions/precompute-engagement-signals.ts` (extend aggregation)
- DRep profile API routes (include engagement data)
- DRep profile components (display citizen trust)
- `lib/data.ts` (engagement data reads)

---

## WP-8: Inter-Body Dynamics Narrative

**Vision gap:** Proposal pages show raw DRep/SPO/CC vote counts but no AI-generated narrative explaining governance body tensions. Vision says "The AI explains the tension."

**Goal:** Add AI-generated inter-body dynamics narrative to proposal pages.

**Scope:**

- Generate AI narrative when significant voting divergence exists between governance bodies
- Display on proposal detail pages alongside existing vote breakdown
- Narrative explains: why bodies might disagree, what the tension means, historical context
- Cache narrative to avoid regeneration

**Key files to modify:**

- Proposal detail page and/or API route
- New component for dynamics narrative display
- AI generation logic (Claude API call, similar to epoch recap pattern)

---

## WP-9: SPO Command Center Parity

**Vision gap:** SPO Command Center is 13.5KB vs DRep Command Center at 24.6KB. SPOs need governance inbox, pending votes, statement management, and delegator communication comparable to DReps.

**Scope:**

- SPO pending governance actions queue (like DRep's)
- SPO governance statement management
- SPO delegator communication channel
- SPO governance performance summary

**Key files:** `components/spo/SPOCommandCenter.tsx`, SPO API routes

---

## WP-10: SPO Vote Casting

**Vision gap:** Vote casting (PR #143) was built for DReps. SPOs need the same capability via MeshJS/CIP-95.

**Scope:**

- Adapt `VoteCaster` for SPO governance transactions
- SPO-specific vote transaction construction (different cert type)
- Integration into SPO Command Center pending votes queue
- SPO rationale submission flow

**Key files:** `components/governance/VoteCaster.tsx`, SPO command center, CIP-95 transaction building

---

## WP-11: Progressive Match Confidence

**Vision gap:** Quick Match shows results after 3 questions but confidence should improve as more data accumulates (voting history, quiz answers, engagement patterns).

**Scope:**

- Confidence indicator that grows with user data sources
- Sources: quiz answers, voting observations, engagement patterns, delegation history
- Visual confidence bar on match results
- "Improve your match" CTAs pointing to additional quiz questions

**Key files:** `lib/matching/`, `components/matching/`, match API routes

---

## WP-12: Proposal Outcome Tracking

**Vision gap:** Proposals show lifecycle but not delivery outcomes. Vision says trace treasury spending "from proposal to vote to delivery to citizen impact."

**Scope:**

- Track proposal status transitions (ratified -> enacted -> delivered/failed)
- Display delivery status on proposal cards and pages
- Connect to citizen impact tags for funded projects
- Proposal outcome summary in DRep voting record

**Key files:** Proposal components, proposal API routes, treasury tracking

---

## WP-13: CC Member Transparency Index

**Vision gap:** CC Transparency Index exists in scoring (`lib/scoring/`) but may not be fully surfaced on CC member profiles.

**Scope:**

- Ensure CC transparency metrics display on CC profile pages
- Voting record completeness, rationale provision rate, response time
- Inter-body alignment from CC perspective
- Historical transparency trend

**Key files:** CC profile components, CC scoring, CC API routes

---

## WP-14: Mobile Briefing Optimization

**Vision gap:** Epoch Briefing is the primary citizen surface but may not be optimized for mobile viewports where most citizens will read it.

**Scope:**

- Responsive layout audit of EpochBriefing component
- Touch-friendly interactions (swipe between sections, tap to expand)
- Performance optimization (lazy loading, reduced bundle for mobile)
- PWA-friendly briefing delivery

**Key files:** `components/civica/home/EpochBriefing.tsx`, related layout components

---

## WP-15: Vote + Rationale Flow Timing (IN PROGRESS)

**Vision gap:** Vote casting and rationale submission are separate flows. Vision says "one submission: vote + rationale together."

**Goal:** Unify vote + rationale into a single guided flow matching the vision's "analyze -> draft -> review -> submit" pattern.

**Changes:**

- Replaced flat `VoteCastingPanel` with stepped `VoteRationaleFlow` wizard:
  - Step 1 **Select Vote**: Yes/No/Abstain with preflight checks, then "Add Rationale" or "Quick Vote"
  - Step 2 **Write Rationale**: CIP-100 editor with AI Draft, collapsible proposal context
  - Step 3 **Review**: Transaction summary (vote + rationale + fee), rationale preview, edit links
  - Step 4 **Submit**: Animated submission timeline (publish rationale -> build tx -> sign -> submit -> confirm)
- **Post-vote rationale fallback**: After a quick vote (no rationale), a "Add rationale to your vote" link appears. Uses CIP-1694 re-voting to re-cast the same vote with a CIP-100 metadata anchor attached.
- **Enhanced timing UX**: Step progress indicator, phased submission timeline with status per step, estimated confirmation time, CardanoScan link
- Vote + CIP-100 rationale bundled in single transaction (anchor URL + hash passed to MeshTxBuilder)

**Files:**

- `components/civica/proposals/VoteRationaleFlow.tsx` (new — replaces VoteCastingPanel usage)
- `app/proposal/[txHash]/[index]/page.tsx` (modified — imports VoteRationaleFlow)
- Existing `hooks/useVote.ts`, `lib/voting.ts`, `lib/rationale.ts`, API routes unchanged
