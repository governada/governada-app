# Feature Exploration: Citizen Hub & Workspace (Revised)

> **Date**: 2026-03-12 (revised after citizen-centricity review)
> **Feature**: Governance Hub (citizen view) + Citizen Workspace
> **Core JTBD (reframed)**: "Understand my place in Cardano governance" — not just "check if anything needs attention"
> **Personas served**: Citizen (80%+ of users)
> **Key correction**: First draft was DRep-monitoring-centric. This revision centers on what makes CITIZENS come back: identity, voice, consequence, community.

---

## Phase 1: Current State Snapshot

### What exists today (more than initially realized)

**Already built but NOT surfaced as the citizen Hub:**

| Component              | What It Does                                                                                                            | Where It Lives                        | Status                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------- |
| `CitizenCommandCenter` | Full intelligence dashboard: DRep report card, alignment bars (6D), epoch context, recommended actions, score sparkline | `components/governada/mygov/`         | Built, feature-gated      |
| `EpochBriefing`        | Comprehensive briefing: DRep performance, treasury transparency, "Your Voice" section, civic identity strip             | `components/governada/home/`          | Built, feature-gated      |
| `CivicIdentityCard`    | Delegation streak, proposals influenced, ADA governed, shareable                                                        | `components/governada/shared/`        | Built                     |
| `CivicIdentityProfile` | Full footprint: health status (Champion/Active/Participant/Observer), milestones                                        | `components/governada/identity/`      | Built, at `/you/identity` |
| `TreasuryCitizenView`  | Treasury balance, runway, pending proposals, "Where Your Money Goes"                                                    | `components/governada/home/`          | Built, feature-gated      |
| Engagement system      | Sentiment voting, concern flags, impact tags, priority signals, assemblies, endorsements                                | `hooks/useEngagement.ts` + components | Built, feature-gated      |
| Engagement levels      | Registered → Informed → Engaged → Champion progression                                                                  | `lib/citizen/engagementLevel.ts`      | Built                     |
| Citizen credibility    | Weight computation (0.1-1.0) based on delegation, engagement, balance                                                   | `lib/citizenCredibility.ts`           | Built                     |
| Milestone gallery      | Earned badges with celebration moments                                                                                  | `components/governada/identity/`      | Built                     |

**What citizens actually see (the Hub):** 6 abstract status cards (alert, representation, coverage, governance-health, briefing, engagement). No depth. No workspace. No engagement mechanisms surfaced.

### The gap is not features — it's surfacing

The backend and component layer is **8/10**. The citizen-facing experience that USES it is **3/10**. Everything needed for a world-class citizen experience is built or partially built. The problem is:

1. Most citizen features are **feature-gated** — they exist but citizens never see them
2. The Hub shows **abstract system metrics** instead of the rich citizen-identity components
3. There's no **engagement loop** — the engagement mechanisms (signals, priorities, endorsements) exist but aren't woven into the daily experience
4. There's no **identity narrative** — civic identity accumulates passively but is hidden at `/you/identity`, not front and center
5. The JTBD is framed as **monitoring** ("check if anything needs attention") instead of **identity** ("who am I in this democracy?")

### What's working well

- **Engagement system architecture** is superb — structured signals (not free-text chaos), credibility weighting, 4-level progression. This is ahead of most civic tech platforms.
- **Treasury transparency** approach ("Where Your Money Goes") is the right framing — personalized, not abstract.
- **Epoch briefing** content structure is comprehensive — DRep performance, proposals, alignment, network health in one view.
- **Alignment infrastructure** (6D PCA) provides the raw material for governance personality/identity features.

### What's at its ceiling

The current Hub card approach maxes out at "glanceable status check" — it can never deliver identity, voice, community, or progression. The ceiling isn't about improving the cards; it's about replacing the paradigm.

---

## Phase 2: Inspiration Research

### The 5 Stickiness Drivers for Passive Users

Research across domains reveals what makes people return to apps where their primary action is passive (listening to music, holding investments, delegating governance):

**1. Identity Reflection** (Spotify Wrapped)

- 200M users in 24 hours, 500M shares in first day (2025)
- 16 "Listening Personality" archetypes — users get a label that feels true
- Key: take data the user generates PASSIVELY and reflect it back as a STORY about who they are
- Transfer: "You're a Treasury Hawk" / "You're a Community Builder" based on delegation patterns, signals, engagement

**2. Self-Discovery** (iSideWith / Political Compass)

- iSideWith: 81M users, 83% quiz completion rate (35 of 42 questions)
- Political Compass spawned a Reddit subculture (600K+ members) where the 2D grid IS identity
- Key: visual placement on a map creates shareable, debatable identity. Low stakes, high self-expression
- Transfer: Governance personality mapped on alignment dimensions — where you sit relative to your DRep, relative to the ecosystem

**3. Consequence Visibility** (Participatory Budgeting research)

- #1 cited factor for repeat participation: "closing the feedback loop"
- Platforms that collect input but never show outcomes see participation COLLAPSE in subsequent rounds
- Key: "Your vote helped fund Project X" — not just "thanks for participating"
- Transfer: "Your delegation contributed to 3 proposals passing worth 5M ADA this epoch"

**4. Personal Stake in Spending** (Treasury transparency apps)

- "Where Does My Money Go?" (UK): personalized tax receipt — "Of YOUR money..." not "of the budget..."
- Drill-down treemaps create exploration sessions; comparison over time creates narrative
- Key: the shift from abstract to personal IS the entire engagement trick
- Transfer: "Your delegation represents X ADA of voting power. This epoch, treasury proposals worth Y ADA were decided."

**5. Low-Friction Voice** (Pol.is / vTaiwan)

- 80% of Pol.is discussions led to actual government action
- No reply button (kills trolling). You can only vote agree/disagree/pass or write a new statement
- Consensus statements (where all groups agree) surface automatically
- Key: lightweight signals create agency without debate fatigue
- Transfer: The engagement system (sentiment, flags, priorities) already does this — it just needs to be the MAIN experience, not a hidden feature

### Critical Insight from Research

> "The citizen doesn't need to DO more. They need to SEE more of what their existing delegation already does."

The product challenge is **reflection and meaning-making**, not additional participation burden. But when reflection naturally invites lightweight participation (one-tap signals), that creates the engagement loop.

---

## Phase 3: Data Opportunity Scan

### What exists (ready to surface)

| Data                    | Computation                | Current Use           | Could Power                      |
| ----------------------- | -------------------------- | --------------------- | -------------------------------- |
| User alignment (6D PCA) | `user_governance_profiles` | Matching engine       | Governance personality/archetype |
| Engagement level        | `engagementLevel.ts`       | Hidden progression    | Visible identity growth          |
| Civic credibility       | `citizenCredibility.ts`    | Signal weighting      | Credibility badge, trust metric  |
| Delegation streak       | `CivicIdentityCard`        | Sub-component         | Hero metric, epoch streak        |
| Proposals influenced    | `CivicIdentityCard`        | Sub-component         | Impact counter, consequence feed |
| DRep alignment match    | `alignment_snapshots`      | Drift detection       | Personal alignment radar         |
| Community sentiment     | `poll_responses`           | User profile building | Public intelligence layer        |
| Treasury flows          | `TreasuryCitizenView`      | Feature-gated         | "Your Money" section             |
| Engagement signals      | `useEngagement` hooks      | Feature-gated         | Voice/participation layer        |

### What needs NEW computation

1. **Governance Archetype** — Classify citizens into personality types based on alignment vector + engagement patterns + signal history. E.g., "Treasury Hawk" (conservative on spending, high engagement), "Protocol Guardian" (security-focused, tracks parameters), "Community Builder" (engaged across proposals, high endorsement activity). NEEDS: archetype classification rules/model mapping PCA dimensions to labels.

2. **Delegation Impact Score** — "Your delegation contributed to X governance decisions worth Y ADA." Requires: mapping DRep votes → proposal outcomes → citizen's delegation share. NEEDS: new computation linking `drep_votes` + `proposals` lifecycle + citizen voting power fraction.

3. **Community Consensus Map** — Aggregate citizen signals per proposal into community position. "73% of citizens who weighed in support this." Already partially exists in `poll_responses` but needs aggregation + privacy-preserving presentation. NEEDS: new API endpoint + aggregation logic.

4. **Governance Personality Evolution** — How has the citizen's alignment vector shifted over time? Requires: periodic snapshots of `user_governance_profiles.pca_coordinates`. NEEDS: new snapshot table or append to existing.

### What new data would unlock

| New Capability                | What It Enables                                 | Stickiness Driver |
| ----------------------------- | ----------------------------------------------- | ----------------- |
| Governance Archetype          | "You're a Treasury Hawk" — shareable identity   | Identity          |
| Impact Score                  | "Your delegation influenced 47 decisions"       | Consequence       |
| Consensus Map                 | "73% of citizens agree with you on this"        | Community         |
| Personality Evolution         | "You've shifted toward innovation this quarter" | Discovery         |
| Epoch-scoped consequence feed | "This epoch, your DRep's votes led to..."       | Consequence       |

---

## Phase 4: Three Alternative Concepts

### Concept A: "Governance Identity" — You Are What You Delegate

**Core Insight**: The Hub IS your governance identity card. Not a dashboard, not a monitor — a mirror that shows you who you are as a governance participant.

**Inspiration Source**: Spotify Wrapped (passive data → shareable identity) + Political Compass (visual self-placement) + iSideWith (governance personality)

**The Experience**:

Citizen opens Governada. The Hub is their **governance identity**.

**Above the fold (the 5-second view):**

- **Governance Personality Hero**: Large archetype label — "Treasury Hawk" or "Community Builder" or "Protocol Guardian" — with a one-line description: "You prioritize fiscal responsibility and track how Cardano's treasury is spent."
- **Alignment Radar**: Small 6-dimension radar chart showing where you sit (treasury, decentralization, security, innovation, transparency + overall). Your DRep's position overlaid in a different color.
- **Three Identity Numbers**: Delegation Streak (epochs) | Proposals Influenced | Civic Level (Informed/Engaged/Champion)

**First scroll (the 30-second view):**

- **"This Epoch"** — 3-4 sentence AI briefing: what your DRep did, what was decided, whether outcomes aligned with your profile. Written in second person: "Your DRep voted on 4 proposals. The treasury allocation you'd probably support passed. The parameter change you'd likely question was rejected."
- **"Your Voice"** — If the citizen has signaled on proposals, show: community agreement %, DRep alignment %. If not: gentle invitation to signal ("Weigh in on 2 active proposals to sharpen your governance personality")

**Second scroll (the identity depth):**

- **Milestone Gallery** — Earned badges, next milestone preview
- **Governance Wrapped CTA** — Quarterly or annual: "See your Governance Year in Review"
- **"Citizens Like You"** — Anonymous: "42% of citizens share your governance personality. Your type tends to value X and push back on Y."

**The Workspace** (`/you/identity` — already partially built):

- Full alignment radar (interactive, hover for dimension details)
- Personality evolution timeline: how your archetype has shifted over epochs
- "What If?" — explore how re-delegating would change your representation profile
- Signal history + influence score
- Shareable governance personality card (designed for social media aspect ratios)

**The Emotional Arc:**

- Entry: "Who am I in Cardano governance?" → sees "Treasury Hawk" + radar → self-recognition ("yeah, that's me") (3 seconds)
- During: reads epoch briefing → "My DRep voted the way I'd want" → trust confirmed (30 seconds)
- Completion: sees streak + milestones → progress → shares personality card → identity expression
- Return trigger: "Has my governance personality evolved? What happened this epoch?"

**Data Requirements:**

- Governance Archetype classification: NEEDS_COMPUTATION (map PCA coordinates to archetype labels via rules or clustering)
- Alignment radar data: EXISTS (`user_governance_profiles` + `alignment_snapshots`)
- Identity numbers: EXISTS (`CivicIdentityCard` data)
- Epoch briefing: EXISTS (`EpochBriefing` component)
- Milestone system: EXISTS (`MilestoneGallery`)
- "Citizens Like You" aggregation: NEEDS_COMPUTATION (cluster citizens by archetype, compute distribution)
- Shareable personality card: NEEDS_NEW (card renderer with social media dimensions)

**What It Removes:**

- All 6 abstract Hub cards → replaced by identity-first layout
- `GovernanceHealthCard` → system metric, irrelevant to citizen identity
- `CoverageCard` checklist → coverage folded into alignment radar (full coverage = complete radar)
- Generic `EngagementCard` → engagement woven into "Your Voice" section
- Workspace rejection → citizens get `/you/identity` as their natural home

**The Ceiling:** F1 (JTBD): 8/10, F2 (Emotional): 10/10, F3 (Simplicity): 9/10, F4 (Differentiation): 10/10, F5 (Feasibility): 8/10, F6 (Data): 7/10

**What It Sacrifices:** Governance awareness breadth. The identity-first approach may under-serve citizens who care more about "what's happening" than "who am I." Treasury transparency becomes a supporting detail rather than a first-class surface. The archetype system needs careful design to feel authentic, not reductive.

**Effort:** **M** — Archetype classification logic + Hub redesign to surface existing `CivicIdentityCard`/`CivicIdentityProfile` components + alignment radar visualization + shareable card renderer. Most components exist; main work is composition and the archetype layer.

**The Share Moment:** The governance personality card. "I'm a Treasury Hawk — top 12% engagement, 24-epoch streak, my DRep is 91% aligned with my values." Designed for Twitter/X with Governada branding. This is the Spotify Wrapped moment for governance. Nobody else offers this.

---

### Concept B: "The Governance Feed" — What's Happening, What Do You Think?

**Core Insight**: The Hub is a living feed of governance activity where every item invites a lightweight reaction. Citizens don't just consume — they signal. Their signals aggregate into public intelligence.

**Inspiration Source**: Pol.is (one-tap opinion → consensus discovery) + Snapshot v2 (feed-first voting with AI summaries) + Apple News (curated, personal, habit-forming briefing)

**No governance tool has ever attempted this for delegators.** Every platform treats the proposal feed as a DRep tool. This makes it a citizen tool.

**The Experience:**

Citizen opens Governada. The Hub is a **governance feed** — not cards, not a dashboard, a feed.

**The feed structure (above the fold):**

- **Epoch Context Bar** (sticky): "Epoch 534 · Day 3 of 5 · 2 active proposals · Your DRep: voted on 1"
- **Feed items**, each one a card:

  **Proposal cards** (most common):
  - AI summary (2 sentences max)
  - Your DRep's position: "Ada voted Yes" or "Pending — hasn't voted yet" or "Your DRep abstained"
  - Community Signal bar: "73% support · 847 citizens weighed in"
  - **Your Signal**: three buttons — 👍 Support / 👎 Concern / 🤔 Need More Info — one tap, done
  - After signaling: "Your voice was counted. You agree with 73% of citizens and your DRep."

  **Outcome cards** (for decided proposals):
  - "Proposal #47: Fund Community Audits — **RATIFIED** ✓"
  - "2.5M ADA allocated. Your DRep voted Yes. 81% of citizens supported this."
  - Your signal vs. outcome: ✓ "Your signal matched the outcome" or ⚠ "This passed despite your concern"

  **DRep Activity cards** (when your DRep does something notable):
  - "Ada published a rationale for Proposal #48. She argues against the treasury request because..."
  - "Ada's score improved to 82 (Rising tier, rank #34). She's moved up 8 positions this epoch."

  **Governance Milestone cards** (periodic):
  - "Cardano governance just passed its 100th proposal. Your delegation has been active for 47 of them."
  - "Treasury update: 12.5M ADA remaining. At current spend rate, that's 8 months of runway."

**Below the feed:**

- **Your Governance Pulse** — small section: engagement level, streak, signals this epoch, credibility tier
- **"Sharpen Your Profile"** CTA — link to matching quiz if alignment confidence is low

**The Workspace** (`/you/voice`):

- **Signal History**: every proposal you've weighed in on, your signal, the outcome, whether your DRep aligned
- **Your Influence**: "Your signals matched governance outcomes 67% of the time"
- **Community Position**: Pol.is-style cluster map — where your views sit relative to community opinion clusters
- **Governance Priorities**: your ranked priorities vs. community priorities (from priority signals)
- **Alignment Drift Alerts**: "Your DRep has drifted on treasury spending — 3 votes diverged from your signals this quarter"

**The Feedback Loop (the unprecedented part):**

1. Citizens signal on proposals → aggregated into Community Sentiment
2. Community Sentiment shown on DRep workspace: "73% of your delegators support this proposal"
3. DReps vote informed by delegator intelligence → better representation
4. Citizens see outcomes: "Your DRep aligned with community on 4/5 votes"
5. Citizens' influence score updates → more signals → richer intelligence → better governance

**The Emotional Arc:**

- Entry: "What's happening in governance?" → scans feed → sees a treasury proposal → curiosity (3 seconds)
- During: reads AI summary → taps 👍 Support → sees "847 citizens weighed in, you agree with 73%" → belonging (10 seconds)
- Depth: opens outcome cards → "My signals matched outcomes 67% of the time" → agency (30 seconds)
- Return trigger: "There are 2 new proposals. My DRep hasn't voted yet. I want to signal before they do."

**Data Requirements:**

- Proposal feed with AI summaries: EXISTS (`proposals` + `ai_summary`)
- DRep vote status per proposal: EXISTS (`drep_votes`)
- Community signal aggregation: NEEDS_COMPUTATION (aggregate `poll_responses` or new `citizen_signals` per proposal)
- Outcome tracking: EXISTS (`proposals` lifecycle — ratified/expired/dropped)
- Signal-outcome correlation: NEEDS_COMPUTATION (new influence score)
- DRep-facing delegator sentiment: NEEDS_COMPUTATION (aggregate by DRep's delegator base)
- Opinion clustering: NEEDS_COMPUTATION (extend PCA clustering to citizen signals)

**What It Removes:**

- All 6 abstract Hub cards → replaced by feed
- Static briefing → replaced by living feed that updates as governance happens
- Separate engagement mechanisms → engagement IS the feed (signals are inline)
- Passive consumption → every feed item invites action

**The Ceiling:** F1 (JTBD): 9/10, F2 (Emotional): 9/10, F3 (Simplicity): 7/10, F4 (Differentiation): 10/10, F5 (Feasibility): 7/10, F6 (Data): 9/10

**What It Sacrifices:** Simplicity. A feed is more complex than cards or a single identity view. Citizens who want a 5-second check-in might find the feed overwhelming. The signal aggregation needs critical mass to be meaningful — with 50 users, "73% of citizens" is misleading. Feed staleness risk: in quiet governance periods, the feed could feel empty.

**Effort:** **L** — Signal aggregation pipeline (Inngest), community sentiment API, feed composition logic, inline signal UI, influence score computation, DRep-facing sentiment panel. The engagement components exist but need to be rewired into a feed paradigm.

**The Share Moment:** Two share moments: (1) "73% of citizens oppose this treasury proposal — read why" — the community intelligence itself is shareable content, potentially newsworthy. (2) "I've signaled on 47 governance proposals. My signals matched outcomes 82% of the time." — civic influence as identity.

---

### Concept C: "What Your Delegation Built" — The Consequence Engine

**Core Insight**: Show citizens the concrete, real-world consequences of their delegation. Not "your DRep voted Yes" but "your delegation helped fund a developer toolkit that 340 projects now use." Close the loop from delegation → decision → impact.

**Inspiration Source**: WHOOP WPA (epoch-cadence assessment) + "Where Does My Money Go?" (personal spending receipt) + Participatory budgeting research (consequence = return driver #1)

**This is dramatically SIMPLER than the current implementation.** Instead of 6 cards about different things, one story about one thing: what your delegation produced.

**The Experience:**

Citizen opens Governada. The Hub is an **epoch consequence report** — a single, scrollable story.

**The story structure:**

**Page 1 (above the fold): The Headline**

- Full-width, large text: "This epoch, your delegation helped decide the future of 15.2M ADA."
- Smaller: "Your DRep Ada voted on 4 proposals. 3 passed. Here's what happened."
- Background: subtle green wash (good epoch) or amber (mixed) — Robinhood-style emotional color

**Page 2 (first scroll): The Decisions**

- Each decided proposal as a "consequence card":
  - **"Fund Community Audits — PASSED ✓"**
  - "2.5M ADA allocated to security audits across 12 protocols."
  - "Your DRep voted: Yes. Community signal: 81% support."
  - Impact tag: "This affects: ecosystem security, treasury spend"
  - One-line outcome preview: "Audits begin in Epoch 540. First results expected Epoch 560."

**Page 3 (second scroll): Your Governance Footprint**

- **Lifetime impact counter** (growing number, large):
  - "Since you started delegating: 47 governance decisions | 125M ADA in treasury managed | 24-epoch streak"
- **Your Contribution**: "Your delegation represents 0.03% of total voting power. Without delegators like you, only 23% of governance capacity would be active."
- **Representation Quality**: single gauge — green/amber/red — "Your DRep is performing well (score 82, rank #34)"

**Page 4 (third scroll): Treasury Receipt**

- Personalized treasury view: "This quarter, the Cardano treasury allocated 45M ADA across 12 projects."
- Treemap visualization: categories of spending (developer tools, community, research, marketing)
- "Your proportional governance impact: ~13,500 ADA worth of decisions influenced"

**Page 5 (bottom): What's Coming**

- Active proposals preview: "2 proposals currently under consideration. Your DRep hasn't voted yet."
- Light CTA: "Want to signal your preference?" → links to proposal with signal buttons
- Epoch streak: "Epoch 24 — keep your streak alive by checking in next epoch"

**The Workspace** (`/you/impact`):

- **Impact Timeline**: epoch-by-epoch history of governance decisions your delegation contributed to
- **Treasury Flow**: cumulative view of treasury spending decisions your delegation was part of
- **Outcome Tracker**: proposals that passed — did they deliver? (when milestone tracking exists)
- **Your Governance Story**: AI-generated annual narrative — "In 2026, your delegation contributed to 156 governance decisions. The biggest was the 10M ADA developer fund that launched 47 new tools."

**The Emotional Arc:**

- Entry: "What did my delegation do this epoch?" → sees "helped decide 15.2M ADA" → significance (2 seconds)
- During: reads consequence cards → "That security audit funding is important" → informed pride (1 minute)
- Depth: sees lifetime footprint → "47 decisions, 125M ADA" → cumulative impact → "my delegation matters" (30 seconds)
- Return trigger: epoch boundary → "What happened this time?" + streak maintenance

**Data Requirements:**

- Proposal outcomes with ADA amounts: EXISTS (`proposals` table — `withdrawal_amount`, lifecycle status)
- DRep votes per proposal: EXISTS (`drep_votes`)
- Citizen voting power fraction: NEEDS_COMPUTATION (citizen's DRep's voting power / total active voting power)
- Lifetime impact counter: NEEDS_COMPUTATION (cumulative proposals decided during active delegation)
- Treasury spending categorization: EXISTS partially (`proposal_type`, `treasury_tier`) — needs enrichment for category treemap
- Epoch consequence narrative: NEEDS_COMPUTATION (AI-generated from proposal outcomes + DRep votes)
- Outcome tracking (did funded projects deliver?): NEEDS_NEW_DATA (future — project milestone tracking)

**What It Removes:**

- All 6 Hub cards → replaced by single scrollable story
- Abstract "Governance Health" → irrelevant when you're showing concrete consequences
- "Coverage" checklist → irrelevant when you're showing what was actually decided
- Engagement CTAs → engagement is contextual (signal on upcoming proposals at the bottom)
- Multiple competing information surfaces → one story, start to finish

**The Ceiling:** F1 (JTBD): 10/10, F2 (Emotional): 10/10, F3 (Simplicity): 10/10, F4 (Differentiation): 9/10, F5 (Feasibility): 8/10, F6 (Data): 8/10

**What It Sacrifices:** Breadth of governance awareness. Citizens won't see DRep score details, alignment dimensions, or system health metrics. This concept deliberately narrows to CONSEQUENCES — what happened because you delegated. Some citizens may want more analytical depth. The story format could feel repetitive in quiet governance periods (few proposals = thin story). Treasury receipt requires proposal categorization that may not be perfectly clean.

**Effort:** **M** — Redesign Hub as scrollable story, compute citizen voting power fraction, build consequence cards from existing proposal + vote data, AI-generate epoch consequence narrative (extend existing briefing pipeline), build impact counter, treasury treemap visualization. Most data exists; main work is composition and the voting power fraction computation.

**The Share Moment:** "Since I started delegating, my participation has contributed to 47 governance decisions managing 125M ADA in Cardano's treasury." The lifetime impact counter is inherently shareable and grows over time. Every citizen wants to prove their delegation matters. Also: the consequence cards are shareable governance news — "Cardano just allocated 2.5M ADA to security audits."

---

## Phase 5: Comparative Analysis

| Dimension                  | Current (6 Cards) | A: Governance Identity        | B: Governance Feed           | C: Consequence Engine        |
| -------------------------- | ----------------- | ----------------------------- | ---------------------------- | ---------------------------- |
| **JTBD Ceiling**           | 5/10              | 8/10                          | 9/10                         | 10/10                        |
| **Emotional Impact**       | 3/10              | 10/10                         | 9/10                         | 10/10                        |
| **Simplicity**             | 6/10              | 9/10                          | 7/10                         | 10/10                        |
| **Differentiation**        | 4/10              | 10/10                         | 10/10                        | 9/10                         |
| **Feasibility**            | —                 | 8/10                          | 7/10                         | 8/10                         |
| **Data Requirements**      | All exists        | 1 new computation             | 3 new computations           | 2 new computations           |
| **Effort**                 | —                 | M                             | L                            | M                            |
| **Stickiness Driver**      | None (monitoring) | Identity + Progress           | Voice + Community            | Consequence + Impact         |
| **What makes them return** | Epoch briefing    | "Has my personality evolved?" | "New proposals to signal on" | "What did my delegation do?" |
| **Share moment**           | None              | Personality card              | Community intelligence       | Impact counter               |
| **Existing code leverage** | Low               | High (CivicIdentity\*)        | Medium (engagement hooks)    | Medium (proposals + votes)   |

### The Question

Each concept has a different stickiness driver:

- **A** bets on **identity** — "I'm a Treasury Hawk" is something you tell people about
- **B** bets on **participation** — one-tap signals create engagement loops
- **C** bets on **consequence** — "my delegation produced real outcomes" creates meaning

The highest-ceiling combination: **C's consequence story as the Hub entry point, with A's identity as the persistent workspace, and B's signal buttons as the engagement layer within the consequence feed.**

---

## Phase 6: Recommendation

### Recommended: Concept C (Consequence Engine) as the Hub, with elements from A and B

**Why C wins as the foundation:**

Research is unambiguous: the #1 driver of return visits in participatory governance is **closing the feedback loop** — showing what your participation produced. Concept C does this better than anything in crypto governance. It answers the one question every delegator has but nobody answers: **"Did my delegation actually matter?"**

It's also the simplest concept (one scrollable story vs. cards or feeds), leverages mostly existing data, and produces the most emotionally impactful share moment.

**What to steal from A and B:**

| From Concept A (Identity)                    | From Concept B (Feed)                        |
| -------------------------------------------- | -------------------------------------------- |
| Governance Archetype label in the Hub header | Signal buttons on upcoming proposal cards    |
| Alignment radar in workspace                 | Community Sentiment bar on proposal cards    |
| Shareable personality card                   | Influence Score (signal-outcome correlation) |
| Milestone gallery in workspace               | DRep-facing delegator sentiment (Phase 2)    |

### The Hybrid: Three Progressive Layers

**Layer 1 — "What Your Delegation Built" (Hub redesign, effort M, ship first)**

The citizen Hub becomes a scrollable epoch consequence story:

1. Epoch headline: "Your delegation helped decide X ADA in governance"
2. Consequence cards for each decided proposal (outcome + DRep vote + community signal)
3. Active proposals with signal buttons (from Concept B — one-tap support/concern)
4. Governance footprint section (lifetime counter: decisions, ADA governed, streak)
5. Representation quality gauge (DRep score + alignment badge — compressed)

This surfaces: existing proposal data, existing DRep votes, existing engagement signals, existing civic identity metrics. New computation: voting power fraction + epoch consequence narrative.

**Layer 2 — "Your Governance Identity" (Workspace, effort M, ship second)**

The citizen workspace at `/you/identity` (already partially built) becomes:

1. Governance Archetype hero ("Treasury Hawk") with personality description
2. Alignment radar (your profile vs. your DRep — interactive)
3. Identity evolution timeline (how your archetype has shifted)
4. Signal history + influence score
5. Milestone gallery with celebration moments
6. Shareable governance personality card (social media dimensions)
7. "What If I Switched?" — alternative DRep comparison

This surfaces: existing `CivicIdentityProfile`, existing `MilestoneGallery`, existing alignment data. New computation: archetype classification, personality evolution tracking, shareable card renderer.

**Layer 3 — "The Intelligence Network" (Engagement flywheel, effort L, Phase 2)**

The signal layer matures into a public intelligence platform:

1. Community Consensus Map (Pol.is-style clustering)
2. DRep-facing delegator sentiment dashboard
3. Citizen credibility tiers with visible progression
4. Governance priority rankings (aggregated citizen priorities)
5. "Governance Wrapped" — annual identity + impact review (Spotify Wrapped for governance)
6. Push notifications for personally-relevant governance events

### What to REMOVE from current Hub

1. **`GovernanceHealthCard`** — System metric. Citizens don't care about GHI in the abstract. Move to `/governance` section. Governance health EMERGES from the consequence story ("3/4 proposals passed, participation at 67%").
2. **`CoverageCard`** (two-item checklist) — Too abstract. Coverage is demonstrated by the consequence story showing real decisions your delegation contributed to. If coverage is incomplete, show it as a gap in the story ("Your pool didn't participate in the hard fork vote — consider a governance-active pool").
3. **`EngagementCard`** (generic CTAs) — Engagement becomes contextual signal buttons ON proposals, not a separate call-to-action card.
4. **`AlertCard`** as separate card — Alerts fold into the consequence story as highlighted items ("⚠ Your DRep missed 2 votes this epoch").
5. **`RepresentationCard`** as a standalone card — Representation status folds into the DRep gauge at the bottom of the consequence story.
6. **Workspace rejection message** — Citizens get `/you/identity` as their workspace. Never show "you don't have access."

### New data requirements with feasibility

| Requirement                         | Type                                         | Effort | Feasibility                                       |
| ----------------------------------- | -------------------------------------------- | ------ | ------------------------------------------------- |
| Voting power fraction per citizen   | New computation from existing data           | S      | High — `drep_power_snapshots` + delegation status |
| Epoch consequence narrative         | AI generation from existing data             | M      | High — extend `generate-citizen-briefings`        |
| Governance Archetype classification | Rules/clustering on PCA coordinates          | M      | High — PCA data exists, need label mapping        |
| Lifetime impact counter             | Cumulative query on proposals + delegation   | S      | High — all data exists                            |
| Treasury category treemap           | Enrich proposal type categorization          | S      | Medium — some proposals lack clean categorization |
| Shareable personality card          | Frontend renderer                            | S      | High — pure frontend                              |
| Community signal aggregation        | New computation + API                        | M      | Medium — need critical mass of signaling users    |
| Influence score                     | New computation (signal-outcome correlation) | M      | Medium — needs signal + outcome history           |

### Risk assessment

1. **"My delegation helped decide 15M ADA" feels inflated** — A single citizen's delegation is a tiny fraction of total voting power. Risk of feeling performative. Mitigation: always show the fraction honestly ("You're part of the 67% of voting power that decided this"). Frame as contribution, not control.

2. **Quiet governance periods = thin story** — Some epochs have 0-1 proposals. The consequence story would be empty. Mitigation: in quiet epochs, shift to "Your Governance Over Time" — show cumulative footprint, upcoming proposals, governance health narrative. Never show an empty screen.

3. **Archetype system feels reductive** — "Treasury Hawk" might feel like a label that doesn't capture nuance. Mitigation: archetypes evolve over time + show the full radar for nuance + let citizens see how close they are to adjacent archetypes.

4. **Signal critical mass** — Community Sentiment is meaningless with 50 signals. Mitigation: defer B's community intelligence features to Layer 3 behind a threshold ("100+ citizens have weighed in"). In early phase, show DRep vote + AI analysis instead of community signal.

5. **Feature-gated components need ungating** — Much of this is surfacing existing feature-gated code. Risk: the components may have bugs or rough edges that were acceptable while gated. Mitigation: review + polish each component before surfacing.

### Validation suggestion

Before building Layer 1:

1. **Concept test**: Show 5 Cardano community members two mockups — the current 6-card Hub vs. the consequence story Hub. Ask: "Which one would make you come back every epoch?" and "Which one would you screenshot and share?"
2. **Data validation**: For 10 real delegators, manually compute the consequence story for the current epoch. Does it feel meaningful? Are there enough proposals to tell a story?
3. **Archetype validation**: Cluster 100 citizens by PCA coordinates. Do natural archetypes emerge? Do the labels feel authentic when you look at the underlying patterns?
4. **Share moment test**: Mock up the governance personality card. Would YOU share this on Twitter? If not, iterate until you would.

---

## Summary of Stickiness Analysis

| What makes citizens RETURN            | How this design delivers it                               |
| ------------------------------------- | --------------------------------------------------------- |
| **Identity** ("Who am I?")            | Governance Archetype + personality card + alignment radar |
| **Consequence** ("Did it matter?")    | Epoch consequence story + lifetime impact counter         |
| **Voice** ("I have agency")           | Signal buttons on proposals + influence score             |
| **Community** ("I belong")            | Community sentiment bars + "Citizens like you" clustering |
| **Progress** ("I'm growing")          | Epoch streak + engagement level + milestones              |
| **Discovery** ("I learned something") | Epoch consequence narrative + treasury receipt            |

The current 6-card Hub delivers **zero** of these. The recommended hybrid delivers all six through a progressive three-layer build, leveraging components that are mostly already built.
