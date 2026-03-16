# UX Constraints — Page-Level Jobs & Information Budget

> **Purpose:** Define the ONE JOB each page does, the maximum information it shows, and what it must NOT show. This document is the constraint layer that prevents information overload. Every page addition, audit recommendation, or build plan must check against these constraints before proceeding.
> **Rule:** If a change adds visible information to a page, it must either replace something or move something below the fold. The information budget is zero-sum.

---

## The Core Problem This Solves

World-class products (Linear, Stripe, Robinhood, Apple Health) share one trait: **radical focus**. Each page does one thing brilliantly. Our audit system historically rewarded adding features and surfacing intelligence — but never penalized cognitive overload. This document fixes that by defining hard constraints per page.

## Universal Rules

1. **One job per page.** Every page has a single core JTBD stated in <8 words. Everything on the page serves that job.
2. **The 5-second test.** A first-time user glancing at any page for 5 seconds must know: (a) what this page is for, and (b) what they should do.
3. **Information budget.** Above the fold: 1 dominant element + 2-3 supporting elements. Everything else is discoverable (tabs, scrolling, expandable sections) but not competing for attention.
4. **Progressive disclosure by default.** Show conclusions first, data behind interactions. "Your DRep is doing well" is the surface. The score breakdown is one click deeper.
5. **Subtraction before addition.** Before adding anything to a page, answer: "What can I remove or collapse to make room?" If nothing can move, the page is at capacity — the new thing doesn't belong here.
6. **Complexity gating.** Match information density to user readiness, not to data availability. First-visit users see less than returning users. Anonymous users see less than authenticated users. This is progressive disclosure, not artificial restriction.

---

## Page Constraints

### `/` — Landing (Anonymous)

| Attribute               | Constraint                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Core JTBD**           | Understand what Governada does                                                                                                                                                                                                             |
| **5-second answer**     | "This helps me participate in Cardano governance"                                                                                                                                                                                          |
| **Dominant element**    | Value proposition hero — one sentence, one visual                                                                                                                                                                                          |
| **Supporting elements** | 2 paths in: "Find your DRep" (Quick Match) + "Explore governance"                                                                                                                                                                          |
| **NOT on this page**    | Live metrics, stat counters, governance jargon, multi-tab navigation, data visualizations. An anonymous visitor has no context for "423 active DReps" or "GHI: 72." Those numbers mean nothing to someone who doesn't know what a DRep is. |
| **Benchmark**           | Robinhood landing: one sentence about investing, one CTA. Linear landing: one sentence about project management, one CTA.                                                                                                                  |

### `/` — Home (Authenticated Citizen)

| Attribute                  | Constraint                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**              | Check if anything needs my attention                                                                                                          |
| **5-second answer**        | "Everything's fine" (green) or "Something needs attention" (amber/red)                                                                        |
| **Dominant element**       | Delegation health status — one glanceable indicator (green/yellow/red) with one-line summary                                                  |
| **Supporting elements**    | Active alerts (if any), epoch briefing summary (2-3 headline cards)                                                                           |
| **NOT on this page**       | Charts, analytics, stat grids, governance health metrics, detailed score breakdowns, treasury deep dives. Citizens get conclusions, not data. |
| **Progressive disclosure** | "See full briefing" expands to epoch details. "View your DRep" links to profile.                                                              |
| **Benchmark**              | Apple Health summary: one number (move ring), one insight, drill down for details.                                                            |

### `/` — Home (DRep)

| Attribute               | Constraint                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Core JTBD**           | See what needs my action right now                                                                          |
| **5-second answer**     | "N proposals need your vote" or "You're caught up"                                                          |
| **Dominant element**    | Action queue — pending votes with deadline urgency                                                          |
| **Supporting elements** | Score summary (one number + trend arrow), recent delegator changes (if significant)                         |
| **NOT on this page**    | Full score breakdowns, alignment visualizations, historical analytics. Those live on the profile/workspace. |

### `/` — Home (SPO)

| Attribute               | Constraint                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| **Core JTBD**           | Check my governance reputation status                                                             |
| **5-second answer**     | "Your governance score is X, trending up/down/stable"                                             |
| **Dominant element**    | Governance score with trend + citizen briefing (SPOs are citizens too)                            |
| **Supporting elements** | Pending governance actions (if any), pool governance activity summary                             |
| **NOT on this page**    | Detailed analytics, delegator deep dives, competitive comparisons — those are workspace features. |

### `/governance/committee` — CC Accountability

| Attribute               | Constraint                                                              |
| ----------------------- | ----------------------------------------------------------------------- |
| **Core JTBD**           | Judge if my constitutional guardians are trustworthy                    |
| **5-second answer**     | "The CC is [healthy/needs attention] — here's the story"                |
| **Dominant element**    | CC Health Verdict — interpreted status with trend                       |
| **Supporting elements** | Key insight card (persona-adapted), member accountability rankings      |
| **NOT on this page**    | Raw stat cards, full methodology, unbounded tables, individual profiles |
| **Persona adaptation**  | DRep: CC-DRep tension elevated. SPO: CC-SPO alignment. CC: your rank    |
| **Benchmark**           | Apple Health cardio fitness: one number, one trend, one insight         |

### `/governance/committee/[id]` — CC Member Profile

| Attribute               | Constraint                                                             |
| ----------------------- | ---------------------------------------------------------------------- |
| **Core JTBD**           | Evaluate this CC member's accountability                               |
| **5-second answer**     | "This member is [above/below average] because [reason]"                |
| **Dominant element**    | Verdict hero — name, score, grade, one-line narrative                  |
| **Supporting elements** | 3 key stats (participation, rationale quality, independence)           |
| **NOT in the hero**     | Full pillar breakdown, voting record, alignment data (tabs below fold) |
| **Benchmark**           | LinkedIn profile: name, headline, key stats above fold. Details scroll |

### `/discover`

| Attribute               | Constraint                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**           | Find governance participants that match my values                                                                                                                      |
| **5-second answer**     | "Search or browse DReps/SPOs/proposals"                                                                                                                                |
| **Dominant element**    | Search bar + results                                                                                                                                                   |
| **Supporting elements** | Sort/filter controls (progressive: search + sort visible, detailed filters behind "Filters" panel)                                                                     |
| **NOT on this page**    | Leaderboards, rankings, detailed analytics, committee views. Discovery is about FINDING, not analyzing. Tabs should be minimal: DReps, SPOs, Proposals. Not 5+ tabs.   |
| **Card density**        | Each result card: name, score (one number), tier badge, 1-line summary, delegate CTA. NOT full radar charts, multi-pillar breakdowns, or voting history on every card. |

### `/match`

| Attribute               | Constraint                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**           | Find a DRep that represents my values                                                                                                                |
| **5-second answer**     | "Answer a few questions, get matched"                                                                                                                |
| **Dominant element**    | Current question (one at a time, full-screen focus)                                                                                                  |
| **Supporting elements** | Progress indicator, back button                                                                                                                      |
| **NOT on this page**    | Governance education, methodology explanations, data visualizations during the flow. Education happens in context (tooltips), not as content blocks. |
| **Results page**        | Top 3 matches with match %, one-line rationale for each, delegate CTA. Detail behind "Why this match?" expansion.                                    |

### `/engage`

| Attribute                  | Constraint                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**              | Make my governance voice heard                                                                                                                                                                    |
| **5-second answer**        | "Here's one thing you can do right now"                                                                                                                                                           |
| **Dominant element**       | The single most relevant action for this user right now (not all 7 mechanisms at once)                                                                                                            |
| **Supporting elements**    | Your engagement summary (participation level, one stat), secondary actions available                                                                                                              |
| **NOT on this page**       | All 7 engagement mechanisms displayed simultaneously. History/recap sections competing with active actions. Detailed credibility breakdowns. The page should feel like a ballot, not a dashboard. |
| **Progressive disclosure** | Show the most impactful action first. "See more ways to participate" reveals others. History/recap in a separate tab or below the fold.                                                           |

### `/pulse`

| Attribute                           | Constraint                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**                       | Is Cardano governance healthy right now?                                                                                                                                                |
| **5-second answer**                 | "Governance health: [Good/Fair/Critical]" with one number                                                                                                                               |
| **Dominant element**                | GHI score — one large number with a health band (like a credit score) and one-sentence narrative                                                                                        |
| **Supporting elements**             | 2-3 key indicators that drive the score (the "why"), trend arrow                                                                                                                        |
| **NOT on this page above the fold** | 8+ stat cards, activity tickers, detailed epoch reports, observatory charts, distribution breakdowns. Those are depth — accessible via tabs or scroll, not competing with the headline. |
| **Tab structure**                   | "Overview" (the above), "Details" (component breakdowns), "History" (trends). Overview is the default and must pass the 5-second test alone.                                            |
| **Benchmark**                       | Apple Health cardio fitness: one number, one trend, one insight. Drill down for charts.                                                                                                 |

### `/my-gov`

| Attribute               | Constraint                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**           | What should I do next in governance?                                                                                                                      |
| **5-second answer**     | "You have N actions to take" or "You're all caught up"                                                                                                    |
| **Dominant element**    | Action recommendations (personalized, max 3)                                                                                                              |
| **Supporting elements** | Civic identity summary (one stat: "Citizen since Epoch X"), delegation status                                                                             |
| **NOT on this page**    | Full civic identity breakdown, analytics, score history, governance footprint details. Those are sub-pages.                                               |
| **Sub-pages**           | Dashboard (the above), Identity (civic profile deep dive), Inbox (notifications), Profile (settings/wallet). Dashboard is lean. Depth lives in sub-pages. |

### `/drep/[id]` — DRep Profile

| Attribute               | Constraint                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**           | Decide if I should delegate to this DRep                                                                                            |
| **5-second answer**     | "Score: X, Active/Inactive, governance philosophy in one line"                                                                      |
| **Dominant element**    | Hero: name, score, tier, active status, delegate CTA                                                                                |
| **Supporting elements** | Governance philosophy summary, key stats (participation rate, rationale rate)                                                       |
| **NOT in the hero**     | Full score breakdowns, radar charts, voting history, delegator counts, alignment trajectories. Those are below the fold or in tabs. |
| **Benchmark**           | LinkedIn profile: photo, headline, key stats above the fold. Everything else scrolls.                                               |

### `/proposal/[tx]/[i]` — Proposal Detail

| Attribute               | Constraint                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**           | Understand this proposal and decide how to act                                                                                            |
| **5-second answer**     | "This proposal asks for X ADA for Y purpose, voting ends Z"                                                                               |
| **Dominant element**    | Proposal summary: title, plain-English description, amount, deadline                                                                      |
| **Supporting elements** | Vote status (% yes/no/abstain), citizen sentiment, your DRep's vote (if applicable)                                                       |
| **NOT above the fold**  | Full voter lists, detailed treasury analysis, constitutional alignment deep dive, similar proposals comparison. Those are depth sections. |

### `/governance/treasury`

| Attribute                  | Constraint                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**              | See where treasury money goes and whether it works                                                               |
| **5-second answer**        | "Budget [X]% used. [Y]% of spending delivered. [N] proposals pending."                                           |
| **Dominant element**       | Narrative hero — one glanceable paragraph synthesizing balance, NCL utilization, effectiveness, pending activity |
| **Supporting elements**    | NCL budget bar (enacted/pending/remaining segments), epoch flow, pending proposals                               |
| **NOT on this page**       | Raw simulator controls above the fold, standalone health bar, four competing section headers                     |
| **Progressive disclosure** | Accountability behind accordion. Simulator behind accordion. Health score components behind tooltip.             |
| **Persona adaptation**     | Citizens: narrative + proportional share. DReps: vote queue + track record + NCL impact per vote.                |
| **Benchmark**              | USAspending.gov summary: headline, budget context, drill-down. Government budget thermometers.                   |

### `/methodology`

| Attribute               | Constraint                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**           | Understand how scores are calculated                                                                                                                  |
| **5-second answer**     | "Here's how governance scoring works"                                                                                                                 |
| **Dominant element**    | Table of contents with clear section links                                                                                                            |
| **Information density** | HIGH — this is a reference page for researchers and curious citizens. Dense content is appropriate here because users arrive with specific questions. |
| **Exception**           | This page is allowed to be information-dense because its JTBD is "understand the methodology." Density serves the job.                                |

### `/learn`

| Attribute               | Constraint                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| **Core JTBD**           | Understand Cardano governance basics                                                          |
| **5-second answer**     | "Start here to learn about governance"                                                        |
| **Dominant element**    | 3-4 getting started cards (not 6+), ordered by learning path                                  |
| **Supporting elements** | Searchable glossary                                                                           |
| **NOT on this page**    | Exhaustive governance education. Keep it to essentials. Link to external resources for depth. |

### `/workspace/review` — Proposal Review

| Attribute               | Constraint                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Core JTBD**           | Review proposals, decide, vote, share — efficiently                                                                |
| **5-second answer**     | "You have N proposals to review. Here's the first one."                                                            |
| **Dominant element**    | The full proposal content (motivation, rationale, references) rendered as markdown                                 |
| **Supporting elements** | Intelligence accordion (constitutional check, similar proposals, treasury impact), vote action zone, notes sidebar |
| **NOT on this page**    | Full voter lists, detailed analytics, citizen engagement mechanisms. Those live on the proposal detail page.       |
| **Mobile**              | Proposal content scrolls, action zone as sticky footer. Queue as horizontal scroll. Notes via sheet drawer.        |

### `/workspace/author` — Proposal Authoring

| Attribute               | Constraint                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Core JTBD**           | Draft a governance action from idea to on-chain submission                         |
| **5-second answer**     | "Write your proposal, get feedback, submit."                                       |
| **Dominant element**    | Structured form: title, abstract, motivation, rationale with auto-save             |
| **Supporting elements** | Lifecycle status bar, version history, constitutional check, team management       |
| **NOT on this page**    | Proposal browsing, voting, analytics. Those are /workspace/review and /governance. |
| **Mobile**              | Form fields stack vertically, action sidebar becomes bottom sheet.                 |

---

## Complexity Gating by User State

Information density should scale with user familiarity, not be maximum for everyone:

| User State                                          | Information Tier | What They See                                                          |
| --------------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| **First visit** (anonymous)                         | Minimal          | Value prop, two paths in, no jargon, no metrics                        |
| **Exploring** (2+ page views, still anonymous)      | Basic            | Discovery, methodology, learn, still no raw numbers without context    |
| **Connected** (wallet linked)                       | Personalized     | Delegation status, personalized recommendations, engagement actions    |
| **Active** (has voted, set priorities, etc.)        | Engaged          | Full engagement system, history, epoch recaps, civic identity          |
| **Power user** (returning weekly, multiple actions) | Full             | Observatory, advanced analytics, detailed score breakdowns, API access |

This is NOT about hiding features behind a paywall. It's about matching information to readiness. A first-time visitor who sees "GHI: 72, EDI: 0.43, Participation: 67.2%" learns nothing. A power user who sees "Governance is healthy" without access to the underlying data feels patronized.

---

## How Agents Use This Document

### During audits (`/audit-experience`, `/audit-feature`)

1. For each page evaluated, check the constraints above
2. Score violations: if a page shows more than its budget allows, that's a finding
3. Score the 5-second test: does the page pass? If not, that's a higher-priority finding than missing features

### During builds (`/build-step`, `/fix-audit`)

1. Before adding ANY visible element to a page, check its constraint entry
2. If the addition would exceed the information budget, propose what to remove or collapse
3. If no constraint entry exists for a new page, create one before building

### During planning

1. When proposing new features, specify which page they live on and what they displace
2. If a feature doesn't fit any existing page's JTBD, it needs either a new page (with its own constraint entry) or it doesn't belong in the product yet

---

## Anti-Patterns This Prevents

1. **"Surface all the intelligence"** — Intelligence surfacing means interpreting data for the user, not dumping it on screen
2. **"Show everything, let users filter"** — Users shouldn't have to work to find what matters. The product should decide.
3. **"Add one more section"** — Every section addition increases cognitive load. The cost is real even if the section is well-designed.
4. **"Power users want density"** — Power users want RELEVANT density. Even they don't want everything at once.
5. **"But the data exists"** — Data availability is not a reason to display data. The question is whether displaying it serves the page's JTBD.
