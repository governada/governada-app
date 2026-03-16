# Feature Exploration: The Proposal Review Tool

> **Status:** Exploration complete — awaiting founder decision
> **Created:** 2026-03-16
> **Triggered by:** Founder realization that DRep/SPO proposal evaluation is significantly underserved
> **Scope:** End-to-end proposal review, voting, rationale, and sharing for DReps and SPOs

---

## Phase 1: Current State Snapshot

### What Exists Today

The proposal experience is a single route (`/proposal/[txHash]/[index]`) designed primarily as a **citizen-facing information page**. Its JTBD per `ux-constraints.md`: _"Understand this proposal and decide how to act."_

DRep/SPO voting is served by two components embedded within this citizen page:

- **`VoteRationaleFlow`** — A well-built 4-step wizard (select → rationale → review → submit) with AI draft assistance, CIP-100 compliance, and on-chain submission
- **`ProposalActionZone`** — Persona-branching wrapper that shows vote flow for DReps/SPOs, engagement for citizens, blurred teaser for anonymous

**Supporting intelligence already built:**

- AI-generated summaries and living briefs (`ProposalBriefRow` with conviction/polarization scores)
- Constitutional alignment analysis
- Citizen sentiment aggregation
- Vote projection engine
- Similar proposals matching
- Treasury context (percentile, historical median)
- Inter-body vote tracking (DRep/SPO/CC tabs)
- Proposal lifecycle timeline
- CIP-100 rationale hosting + metadata anchor bundling

### What's Working Well

- **Vote + rationale in one transaction** — This is genuinely strong. The CIP-100 flow (write rationale → publish → get anchor → bundle with vote) is the best implementation in the ecosystem. Do NOT change this.
- **AI draft assistance** — Generates rationale drafts from proposal context + DRep history. Solid foundation.
- **Living brief** — AI-synthesized rationale digest with conviction/polarization scoring. Unique intelligence.
- **Proposal data enrichment** — Treasury context, similar proposals, inter-body votes. Rich data layer.

### What's at Its Ceiling

The current approach treats DRep voting as a **feature within a citizen page**. No amount of polish to the `VoteRationaleFlow` card will fix the fundamental architectural problem: **the DRep's most important job is a sidebar activity on someone else's page.**

Specific gaps that can't be closed incrementally:

1. **No triage queue.** DReps browse the proposals list, click into each one, scroll to the vote card, vote, go back, repeat. There's no "here are the 5 proposals that need your attention."
2. **No proposal-type-specific analysis.** A 50M ADA treasury request and a protocol parameter change show the same layout. The decision factors are completely different.
3. **No personalized relevance.** Nothing says "this matters to you because..." or "this conflicts with your stated position on X."
4. **No post-vote sharing.** After voting, the DRep sees a CardanoScan link. No share card, no social broadcast, no "tell your delegators."
5. **No workflow state.** No tracking of reviewed/unreviewed, no snooze, no "come back to this later."
6. **No keyboard navigation.** Every interaction requires mouse clicks through a scrollable page.
7. **No batch context.** When reviewing proposal 3 of 7, the DRep has no awareness of the other 6 — how they relate, what the cumulative treasury impact is, how their votes so far form a pattern.

### The Core JTBD (Reframed)

The citizen JTBD is: _"Understand this proposal."_

The DRep JTBD is fundamentally different: **"Evaluate this proposal, form a position, cast my vote with rationale, and communicate my decision to my delegators — efficiently, for every active proposal."**

This is not a page JTBD. It's a **workflow JTBD.** It needs a workspace, not a page.

---

## Phase 2: Inspiration Research

### Key Patterns Discovered

| Pattern                                             | Source                                             | Core Insight                                                                                                                   |
| --------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Personalized relevance scoring**                  | Quorum AI legislative tracking                     | Don't show everything — show what matters TO THIS USER first                                                                   |
| **Single-screen decision workspace**                | Bloomberg Terminal, Quorum                         | Never make the user leave the page to find decision-relevant info                                                              |
| **Keyboard-first rapid processing**                 | Superhuman, Linear triage, PACS radiology          | Triage throughput directly tied to input speed                                                                                 |
| **Three-state verdict**                             | GitHub PR review (approve/request changes/comment) | Force a clear stance, not ambiguous feedback                                                                                   |
| **AI-drafted responses**                            | Superhuman auto-drafts                             | Change the user's job from "author" to "editor"                                                                                |
| **Hanging protocols (auto-layout by content type)** | PACS radiology workstations                        | Auto-configure the workspace based on content type — user's cognitive energy goes to the decision, not arranging the workspace |
| **Consensus-surfacing algorithms**                  | Pol.is, All Our Ideas                              | Find what people agree on, not just what divides them                                                                          |
| **Identity-based share cards**                      | Spotify Wrapped, Strava activity cards             | People share identity signals, not data                                                                                        |
| **Post-action share moment**                        | Strava post-run flow                               | Capture the user when they feel most accomplished                                                                              |
| **Engagement analytics on shared docs**             | DocSend pitch deck tracking                        | Show proposal authors what actually gets read                                                                                  |
| **Snooze / time-shift**                             | Linear triage, Superhuman                          | Not every decision needs to be made right now                                                                                  |
| **Structured argument visualization**               | Kialo argument trees, Consider.it                  | Make the logical structure of debate explicit                                                                                  |

Full research findings cataloged in `docs/strategy/context/world-class-patterns.md`.

---

## Phase 3: Data Opportunity Scan

### What Exists Today

| Data Source                                     | Status | Used For                       |
| ----------------------------------------------- | ------ | ------------------------------ |
| Proposal metadata (type, amount, epoch, status) | EXISTS | Display on proposal page       |
| AI-generated summaries                          | EXISTS | Living brief, citizen summary  |
| Constitutional alignment analysis               | EXISTS | Intelligence briefing section  |
| Citizen sentiment (support/concern/abstain)     | EXISTS | Engagement section, DRep pulse |
| Vote projection (likely to pass %)              | EXISTS | Verdict strip                  |
| Similar proposals                               | EXISTS | Related proposals sidebar      |
| Treasury context (percentile, NCL %)            | EXISTS | Value context component        |
| Inter-body votes (DRep/SPO/CC breakdown)        | EXISTS | Voter tabs section             |
| DRep voting history                             | EXISTS | DRep profile, alignment engine |
| DRep governance philosophy                      | EXISTS | Profile page                   |
| Rationale quality scoring                       | EXISTS | Score engine                   |
| Conviction/polarization scores                  | EXISTS | Living brief                   |
| Proposal classification dimensions              | EXISTS | Dimension tags                 |

### What Could Exist (New Computations)

| Data                                                                                                                                                  | Effort                | What It Unlocks                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| **Personalized relevance score** — "How much does this proposal matter to THIS DRep based on their priorities, voting history, and stated positions?" | NEEDS_COMPUTATION (M) | Intelligent queue ordering. "This is your #1 priority proposal this epoch."                             |
| **Position prediction** — "Based on your voting history and alignment, you're 85% likely to vote Yes on this."                                        | NEEDS_COMPUTATION (S) | AI-drafted rationale is more accurate. DRep can "confirm or challenge" rather than decide from scratch. |
| **Cumulative epoch impact** — "If you vote Yes on this AND the two other treasury proposals, total epoch spending would be X% of NCL."                | NEEDS_COMPUTATION (S) | Batch context. DReps see the forest, not just individual trees.                                         |
| **Delegator alignment check** — "72% of your delegators' Quick Match positions align with voting Yes on this."                                        | NEEDS_COMPUTATION (M) | Accountability signal. "Your delegators expect you to vote X."                                          |
| **Argument graph** — Structured pro/con arguments extracted from existing rationales                                                                  | NEEDS_COMPUTATION (L) | Structured deliberation view instead of raw rationale text                                              |
| **DRep peer votes** (post-vote reveal) — "After you voted, here's how other DReps in your alignment cluster voted."                                   | NEEDS_COMPUTATION (S) | Social validation / calibration without anchoring bias                                                  |
| **Vote streak / consistency tracking** — "You've voted on 12 consecutive proposals."                                                                  | NEEDS_COMPUTATION (S) | Gamification, share moments, score coaching                                                             |
| **Share card generation** — Pre-rendered OG images with vote + rationale summary + DRep branding                                                      | NEEDS_NEW_DATA (M)    | One-tap social sharing                                                                                  |
| **Proposal author track record** — Delivery success rate on past funded proposals                                                                     | NEEDS_COMPUTATION (M) | Trust signal for treasury proposals                                                                     |

### What New Data Would Unlock

The two highest-leverage new data capabilities:

1. **Personalized relevance scoring** transforms the experience from "here are all proposals" to "here's what matters to you, ranked." This is the Quorum insight: professional governance participants tracking dozens of proposals need intelligent filtering, not a firehose.

2. **Share card generation** transforms voting from a private action into a public identity signal. The Spotify Wrapped insight: people don't share data, they share identity. A DRep sharing "I voted No on this proposal because..." is building their governance brand.

---

## Phase 4: Three Alternative Concepts

### Concept A: "The Review Bench"

**Core Insight:** Proposal review is a triage workflow, not a page visit. Build the Bloomberg Terminal of governance — a multi-panel workspace where DReps process proposals without ever leaving the workspace.

**Inspiration Sources:** Bloomberg Terminal (unified data environment), Linear triage (queue + accept/decline/snooze), PACS radiology (hanging protocols + priority worklists), Superhuman (keyboard-first flow state), GitHub PR review (three-state verdict with batched comments)

#### The Experience

**Entry:** DRep opens `/workspace/review` (or keyboard shortcut from Hub). They see:

**Layout — Three-panel workspace:**

```
┌─────────────────┬──────────────────────────────────┬───────────────────┐
│  PROPOSAL QUEUE  │       REVIEW PANEL               │  INTELLIGENCE     │
│                 │                                    │  SIDEBAR          │
│  ◆ Prop #47     │  [Proposal Title]                 │                   │
│    Treasury 5M  │  [Type badge] [Deadline badge]    │  YOUR ALIGNMENT   │
│    ⏰ 3 days    │                                    │  Predicted: Yes   │
│                 │  ┌──────────────────────────┐     │  Confidence: 82%  │
│  ○ Prop #48     │  │ AI BRIEF (2 min read)    │     │                   │
│    Param change │  │ ...personalized to your  │     │  DELEGATOR PULSE  │
│    ⏰ 8 days    │  │ priorities and history... │     │  72% align w/ Yes │
│                 │  └──────────────────────────┘     │                   │
│  ○ Prop #49     │                                    │  CITIZEN SENTIMENT│
│    Info action  │  ┌──────────────────────────┐     │  ▓▓▓▓▓░░ 71% Yes │
│    ⏰ 12 days   │  │ TREASURY IMPACT          │     │                   │
│                 │  │ 5M ADA (1.2% of NCL)    │     │  PEER VOTES       │
│  ○ Prop #50     │  │ Category: Dev tooling    │     │  (hidden until    │
│    Treasury 2M  │  │ Similar: 3 past (2 del.) │     │   you vote)       │
│    ⏰ 12 days   │  └──────────────────────────┘     │                   │
│                 │                                    │  CONSTITUTION     │
│  ─ Reviewed ──  │  ┌──────────────────────────┐     │  No conflicts     │
│  ✓ Prop #45     │  │ YOUR VOTE                │     │  detected         │
│    Voted Yes    │  │ [YES] [NO] [ABSTAIN]     │     │                   │
│  ✓ Prop #46     │  │                          │     │  BATCH CONTEXT    │
│    Voted No     │  │ [AI-drafted rationale]   │     │  If Yes: epoch    │
│                 │  │ [Edit] [Quick Vote]      │     │  treasury spend   │
│                 │  │ [Submit & Next →]        │     │  = 12.4M (6.1%)   │
│                 │  └──────────────────────────┘     │                   │
└─────────────────┴──────────────────────────────────┴───────────────────┘
  [Y] Yes  [N] No  [A] Abstain  [S] Snooze  [→] Next  [R] Rationale  [P] Share
```

**Left panel — Proposal Queue:**

- Auto-sorted by urgency (deadline) + relevance (personalized score)
- Each card: title, type badge, amount (if treasury), deadline countdown, relevance dot (high/medium/low)
- Visual states: unreviewed (bold), in-review (highlighted), voted (checkmark + vote color), snoozed (dimmed)
- Keyboard: `↑`/`↓` to navigate, `Enter` to select

**Center panel — Review Panel (adapts by proposal type):**

_Hanging protocol for Treasury Requests:_

- AI brief (personalized: "Based on your priority for developer tooling, this proposal directly addresses...")
- Treasury impact (amount, % of NCL, spending category, author's delivery track record)
- Similar past proposals and their outcomes
- Vote action zone (buttons + rationale editor + submit)

_Hanging protocol for Parameter Changes:_

- AI brief with parameter context
- Current value → proposed value with impact simulation
- Technical risk assessment
- Inter-body context (SPO votes matter most here)

_Hanging protocol for Info Actions:_

- AI brief (lighter — these don't require on-chain votes from all bodies)
- Key arguments for/against
- Related governance discussions

**Right panel — Intelligence Sidebar:**

- Your predicted alignment (before you vote, to reduce cognitive load)
- Delegator pulse (how your delegators' positions align)
- Citizen sentiment
- Peer votes (revealed AFTER you vote, preventing anchoring)
- Constitutional analysis summary
- Batch context (cumulative epoch spending if you keep voting Yes)

**The Vote Flow (within the center panel):**

1. DRep presses `Y`, `N`, or `A` (or clicks button)
2. AI-drafted rationale appears instantly (pre-generated based on predicted position)
3. DRep edits rationale (or accepts as-is)
4. `Cmd+Enter` submits vote + rationale in one transaction
5. **Post-vote share card** slides in: "Share your vote" with pre-rendered card showing vote, 1-line rationale summary, DRep branding
6. Share to Twitter/Farcaster/copy link, or dismiss
7. Queue auto-advances to next proposal

**Keyboard shortcuts (always visible in footer):**

- `Y` / `N` / `A` — Vote
- `R` — Focus rationale editor
- `S` — Snooze proposal (comes back in 2 days or when new activity)
- `→` — Next proposal
- `←` — Previous proposal
- `P` — Share/publish
- `Cmd+Enter` — Submit
- `?` — Show all shortcuts

#### The Emotional Arc

- **Entry:** "I have 5 proposals to review. That's manageable." (Not: "I have to visit 5 different pages and scroll through citizen content each time.")
- **During use:** Flow state. The keyboard-first interface and auto-advancing queue create momentum. Each vote feels like progress. The intelligence sidebar removes the need to research independently.
- **Completion:** "I reviewed and voted on every proposal in 15 minutes. My rationales are published. My delegators know where I stand." Accomplishment + relief.

#### Data Requirements

| Requirement                  | Status            |
| ---------------------------- | ----------------- |
| Proposal data + AI summaries | EXISTS            |
| Vote casting + CIP-100       | EXISTS            |
| AI rationale drafting        | EXISTS            |
| Constitutional analysis      | EXISTS            |
| Citizen sentiment            | EXISTS            |
| Personalized relevance score | NEEDS_COMPUTATION |
| Position prediction          | NEEDS_COMPUTATION |
| Delegator alignment check    | NEEDS_COMPUTATION |
| Cumulative epoch impact      | NEEDS_COMPUTATION |
| Share card generation        | NEEDS_NEW_DATA    |
| Peer vote reveal (post-vote) | NEEDS_COMPUTATION |

#### What It Removes

- The proposal detail page is NOT replaced — citizens still use it. The Review Bench is a **parallel surface** exclusively for DReps/SPOs.
- The `ProposalActionZone` on the proposal page remains for DReps who arrive via direct link. But it becomes the fallback, not the primary workflow.
- The intelligence sidebar consolidates data that currently lives across multiple sections (sentiment, voters, constitution) into one focused view.

#### The Ceiling

| Dimension            | Max Score                                                        |
| -------------------- | ---------------------------------------------------------------- |
| F1: JTBD fulfillment | 10/10 — purpose-built for the exact workflow                     |
| F2: Emotional impact | 9/10 — flow state is achievable but multi-panel can feel dense   |
| F3: Simplicity       | 7/10 — three panels is inherently more complex than alternatives |
| F4: Differentiation  | 10/10 — nothing like this exists in governance                   |
| F5: Feasibility      | 7/10 — significant frontend build, new data computations needed  |
| F6: Share moment     | 9/10 — post-vote share card is strong                            |

#### What It Sacrifices

- **Simplicity.** Three panels is dense. Mobile would need a completely different layout (probably sequential).
- **Build effort.** This is a full new route with complex state management. XL effort.
- **Onboarding.** New DReps need to learn the workspace. There's a learning curve, though keyboard shortcuts are discoverable.

**Effort:** XL (new route, multi-panel layout, queue state, new data computations, share card generation, keyboard navigation system)

#### The Share Moment

A DRep screenshots their Review Bench showing "5/5 proposals reviewed, all rationales published" — proof they're doing their job. The individual vote share cards (auto-generated) go to Twitter/Farcaster. DRep Wrapped at epoch end: "You reviewed 12 proposals in 3 sessions. Your average review time: 3 minutes. Your rationale rate: 100%."

---

### Concept B: "The Governance Brief"

**Core Insight:** DReps don't need a dashboard — they need a **briefing document**. Like a legislative staffer preparing a memo for a senator, AI generates a personalized brief for each proposal that understands the DRep's history, priorities, and philosophy. The DRep reads, decides, and acts — all from a clean reading interface.

**Inspiration Sources:** Quorum's AI personalized bill summaries ("why this matters to YOU"), Superhuman's AI auto-drafts (change authoring to editing), DocSend's engagement analytics, newsletter/reading apps (Substack, Instapaper — clean reading UX)

#### The Experience

**Entry:** DRep opens `/workspace/review` and sees a reading-mode interface. No panels, no sidebars — just a clean document view with a proposal queue as a slim navigation rail.

**Layout — Reading mode with action footer:**

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to Queue    Proposal 1 of 5    ⏰ 3 days remaining  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                YOUR GOVERNANCE BRIEF                    │  │
│  │                                                        │  │
│  │  Re: Plutus Developer Toolkit Grant — 5M ADA           │  │
│  │  Treasury Request · Proposed Epoch 524 · Exp. Epoch 530│  │
│  │                                                        │  │
│  │  ── WHY THIS MATTERS TO YOU ──                         │  │
│  │                                                        │  │
│  │  This proposal directly addresses your stated priority  │  │
│  │  of "developer ecosystem growth." You voted Yes on 3   │  │
│  │  of 4 similar proposals in the past. The one you voted │  │
│  │  No on (Prop #31) was because the team had no prior    │  │
│  │  delivery record — this team delivered Prop #22.       │  │
│  │                                                        │  │
│  │  ── THE ASK ──                                         │  │
│  │                                                        │  │
│  │  5M ADA ($2.1M) over 6 months for a comprehensive     │  │
│  │  Plutus developer toolkit. This represents 2.4% of    │  │
│  │  this epoch's NCL budget. If funded alongside the 2    │  │
│  │  other pending treasury proposals, total epoch spend   │  │
│  │  would reach 7.1% of NCL.                             │  │
│  │                                                        │  │
│  │  ── TRACK RECORD ──                                    │  │
│  │                                                        │  │
│  │  Team "Cardano Forge": 2 prior funded proposals, both  │  │
│  │  delivered on time. Community rating: 4.2/5.           │  │
│  │                                                        │  │
│  │  ── THE DEBATE ──                                      │  │
│  │                                                        │  │
│  │  FOR (12 DReps, 61%): Strong developer demand, team's  │  │
│  │  track record, fills a real ecosystem gap.             │  │
│  │                                                        │  │
│  │  AGAINST (5 DReps, 26%): Amount too high for current   │  │
│  │  treasury conditions. Some overlap with existing tools.│  │
│  │                                                        │  │
│  │  YOUR DELEGATORS: 72% of expressed citizen sentiment   │  │
│  │  aligns with Yes. 3 citizen concerns flagged about     │  │
│  │  overlap with existing tooling.                        │  │
│  │                                                        │  │
│  │  ── CONSTITUTIONAL CHECK ──                            │  │
│  │                                                        │  │
│  │  No constitutional conflicts detected.                 │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌── YOUR POSITION ─────────────────────────────────────┐   │
│  │                                                       │   │
│  │  Based on your history: [YES ████████░░] 82% likely   │   │
│  │                                                       │   │
│  │  [  YES  ]    [  NO  ]    [ ABSTAIN ]                 │   │
│  │                                                       │   │
│  │  ┌─ RATIONALE (AI draft — edit as needed) ──────────┐ │   │
│  │  │ I support this proposal because the Cardano Forge │ │   │
│  │  │ team has a proven delivery record and the Plutus  │ │   │
│  │  │ toolkit addresses a real gap in developer tooling │ │   │
│  │  │ that I've consistently prioritized. The ask is    │ │   │
│  │  │ within reason for the impact expected.            │ │   │
│  │  └──────────────────────────────────────────────────┘ │   │
│  │                                                       │   │
│  │  [ Submit Vote + Rationale ]  [ Quick Vote (no rat.) ]│   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ── AFTER VOTING ──                                          │
│                                                              │
│  ┌── SHARE YOUR VOTE ──────────────────────────────────┐    │
│  │                                                      │    │
│  │  [Pre-rendered share card preview]                   │    │
│  │                                                      │    │
│  │  [ 𝕏 Twitter ] [ Farcaster ] [ Copy Link ]          │    │
│  │  [ → Next Proposal ]                                 │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**The Queue Rail (left edge, collapsible):**

- Minimal: proposal number, type icon, deadline
- States: unread (dot), in-progress (highlight), voted (checkmark)
- Click or `↑`/`↓` to navigate

**The Brief (center — the star of the show):**
A single, flowing document generated per proposal per DRep. Sections:

1. **Why This Matters to You** — Personalized relevance. References the DRep's stated priorities, past votes on similar proposals, and any conflicts with their governance philosophy. This section is what makes the brief personal, not generic.

2. **The Ask** — Plain-English summary. Amount, duration, treasury context. No jargon.

3. **Track Record** — For treasury proposals: team's delivery history. For parameter changes: historical context of the parameter.

4. **The Debate** — Aggregated pro/con positions from existing DRep rationales, with counts. Not individual names (to avoid anchoring), but aggregate sentiment with cited arguments.

5. **Your Delegators** — Citizen sentiment summary + specific concern flags.

6. **Constitutional Check** — AI analysis result, one line.

**The Action Zone (below the brief):**

1. Position prediction shown as a soft nudge: "Based on your history: 82% likely Yes"
2. Vote buttons
3. AI-drafted rationale (pre-generated, contextually aware of the brief content)
4. Submit
5. Share card (post-vote)
6. "Next Proposal" to advance queue

#### The Emotional Arc

- **Entry:** "Oh, someone prepared a briefing for me. I just need to read it." (Not: "I need to research this proposal.")
- **During use:** Feeling informed and supported. The brief answers the questions the DRep would have asked. The AI draft means the rationale is 80% done. The cognitive load is dramatically lower than assembling context from multiple sources.
- **Completion:** "I made an informed decision in 3 minutes. My rationale sounds like me. My delegators will see why I voted this way." Confidence + efficiency.

#### Data Requirements

| Requirement                                         | Status                         |
| --------------------------------------------------- | ------------------------------ |
| Proposal data + AI summaries                        | EXISTS                         |
| Vote casting + CIP-100                              | EXISTS                         |
| AI rationale drafting                               | EXISTS                         |
| Constitutional analysis                             | EXISTS                         |
| Citizen sentiment                                   | EXISTS                         |
| **Personalized brief generation** (new AI pipeline) | NEEDS_NEW_DATA                 |
| DRep's stated priorities                            | EXISTS (governance philosophy) |
| DRep's voting history on similar proposals          | EXISTS (can be computed)       |
| Position prediction                                 | NEEDS_COMPUTATION              |
| Delegator alignment check                           | NEEDS_COMPUTATION              |
| Cumulative epoch impact                             | NEEDS_COMPUTATION              |
| Share card generation                               | NEEDS_NEW_DATA                 |

#### What It Removes

- The intelligence sidebar (Concept A) — all context is woven INTO the brief narrative instead of displayed in panels
- Proposal-type-specific hanging protocols — the AI brief adapts its sections based on proposal type, so the layout stays consistent
- Visual complexity — no multi-panel layout, no dense sidebar

#### The Ceiling

| Dimension            | Max Score                                                              |
| -------------------- | ---------------------------------------------------------------------- |
| F1: JTBD fulfillment | 9/10 — covers the full cycle but less batch-aware than Concept A       |
| F2: Emotional impact | 10/10 — "someone prepared this for me" is the most delightful feeling  |
| F3: Simplicity       | 9/10 — reading a document is the simplest possible UX                  |
| F4: Differentiation  | 10/10 — personalized governance briefs don't exist anywhere            |
| F5: Feasibility      | 8/10 — AI pipeline is the main new build; UI is simpler than Concept A |
| F6: Share moment     | 9/10 — same share card engine                                          |

#### What It Sacrifices

- **Information density.** Power-user DReps who want to see raw data (exact vote counts, alignment scores, historical charts) won't find it in the brief. They'd need to expand/drill down.
- **Batch overview.** No side-by-side awareness of all proposals at once. The queue rail is minimal.
- **Non-AI fallback.** If the AI brief is mediocre for a specific proposal, the experience degrades because the brief IS the experience.

**Effort:** L (new AI pipeline for personalized briefs, new route with reading-mode UI, share card generation, queue state management)

#### The Share Moment

The brief itself is shareable — "Here's how I analyzed this proposal" with the DRep's name on it. After voting, the share card shows the vote + one-line rationale summary. DReps who share their brief + vote become visible governance thought leaders. The brief format makes their reasoning accessible to citizens and other DReps.

---

### Concept C: "The 60-Second Vote"

**Core Insight:** The biggest barrier to DRep participation isn't lack of information — it's friction. Most DReps already have a position within 30 seconds of reading a proposal summary. The tool should make acting on that position as fast as possible, and only slow down when the DRep _wants_ to go deeper.

**Inspiration Sources:** Superhuman's auto-drafts (authoring → editing), PACS radiology priority worklists (rapid sequential processing), Tinder's card-based decisioning (one item, full focus, clear actions), RSS readers' "mark all as read" (acknowledging that not everything needs deep review)

#### The Experience

**Entry:** DRep opens `/workspace/review`. Full-screen, single proposal, zero distractions.

**Layout — Full-screen focus card:**

```
┌──────────────────────────────────────────────────────────────┐
│     1 of 5  ●●●○○                         ⏰ 3 days left    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    Treasury Request                          │
│                                                              │
│           Plutus Developer Toolkit Grant                     │
│                    5M ADA · 6 months                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Team Cardano Forge wants funding to build a Plutus    │  │
│  │  developer toolkit. They've delivered 2 past proposals │  │
│  │  on time. This would use 2.4% of this epoch's NCL.    │  │
│  │                                                        │  │
│  │  You voted Yes on 3 of 4 similar proposals.            │  │
│  │  72% of your delegators lean Yes.                      │  │
│  │  No constitutional conflicts.                          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│           AI suggests: Yes (82% confidence)                  │
│                                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│   │          │  │          │  │          │                  │
│   │   YES    │  │    NO    │  │ ABSTAIN  │                  │
│   │          │  │          │  │          │                  │
│   └──────────┘  └──────────┘  └──────────┘                  │
│                                                              │
│           [Go Deeper ↓]    [Snooze ⏰]                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
     Y = Yes    N = No    A = Abstain    D = Deep Dive    S = Snooze
```

**After tapping a vote:**

```
┌──────────────────────────────────────────────────────────────┐
│     1 of 5  ●●●○○                                ✓ Voted    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  You voted YES ✓                             │
│                                                              │
│  ┌── Rationale (AI draft — tap to edit) ────────────────┐   │
│  │                                                       │   │
│  │  I support this proposal because the Cardano Forge    │   │
│  │  team has demonstrated reliable delivery and the      │   │
│  │  Plutus toolkit addresses an ecosystem gap I've       │   │
│  │  consistently prioritized.                            │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│     [ Submit Vote + Rationale ]                              │
│                                                              │
│  ┌── Share ────────────────────────────────────────────┐     │
│  │  [Card preview]                                     │     │
│  │  [ 𝕏 ] [ Farcaster ] [ Copy ] [ Skip ]             │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│                  [ → Next Proposal ]                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**The "Go Deeper" expansion** reveals the full intelligence panel inline — AI brief, treasury context, debate summary, constitutional analysis, similar proposals — for DReps who want more before deciding. This is the escape valve from speed to depth.

**The "Snooze" option** removes the proposal from the current session and brings it back either when new activity occurs or 2 days before expiry. This acknowledges that not every proposal needs immediate attention.

**Key design decisions:**

- The AI summary is maximum 4 sentences. Front-loaded with the decision-relevant facts.
- The AI-suggested position is shown transparently. If the DRep disagrees, one tap changes it.
- Rationale auto-appears after voting. The DRep's job is to edit, not write.
- Share is inline and immediate — no navigation required.
- The queue is a dot indicator (1 of 5), not a list. Zero visual distraction.

#### The Emotional Arc

- **Entry:** "Just 5 proposals. I'll knock these out over coffee." (Not: "I need to sit down and do governance work.")
- **During use:** Speed creates momentum. Each vote takes 30-60 seconds for the quick path, 3-5 minutes if going deep. The auto-drafted rationale removes the biggest friction point. It feels like responding to messages, not writing reports.
- **Completion:** "Done. All 5 voted with rationales. Shared to Twitter. Took 8 minutes." Pride + ease.

#### Data Requirements

| Requirement                                    | Status            |
| ---------------------------------------------- | ----------------- |
| Proposal data + AI summaries                   | EXISTS            |
| Vote casting + CIP-100                         | EXISTS            |
| AI rationale drafting                          | EXISTS            |
| Constitutional analysis                        | EXISTS            |
| Citizen sentiment                              | EXISTS            |
| Position prediction                            | NEEDS_COMPUTATION |
| Compact personalized summary (4 sentences max) | NEEDS_COMPUTATION |
| Share card generation                          | NEEDS_NEW_DATA    |

#### What It Removes

- **Multi-panel layouts.** No sidebars, no split views. One thing on screen.
- **Proposal queue list.** Replaced by dot indicator. You don't need to see the whole queue to process it.
- **Upfront deep analysis.** The summary is compact by design. Deep analysis is opt-in ("Go Deeper").
- **Separate rationale step.** Rationale appears automatically after voting. The step distinction is gone — it's one flow.

#### The Ceiling

| Dimension            | Max Score                                                                        |
| -------------------- | -------------------------------------------------------------------------------- |
| F1: JTBD fulfillment | 8/10 — covers the cycle but may feel shallow for complex proposals               |
| F2: Emotional impact | 9/10 — speed is delightful, but "too fast" can feel flippant                     |
| F3: Simplicity       | 10/10 — the simplest possible UX for voting                                      |
| F4: Differentiation  | 8/10 — card-based voting exists (Quick Match), though not with this intelligence |
| F5: Feasibility      | 9/10 — least complex to build of the three concepts                              |
| F6: Share moment     | 9/10 — same share card engine, tighter integration                               |

#### What It Sacrifices

- **Depth for complex proposals.** A 50M ADA treasury request deserves more than 4 sentences. "Go Deeper" helps but adds a step. Some proposals genuinely need the Review Bench treatment.
- **Batch awareness.** No visibility into how proposals relate to each other or cumulative impact.
- **Professional gravity.** The speed-optimized UX might feel too casual for a DRep who takes governance seriously. "I'm making multi-million dollar decisions and it feels like swiping through notifications."
- **Information retrieval.** After voting, finding a specific past proposal or rationale isn't optimized. This is a "process forward" tool, not a reference workspace.

**Effort:** M (new route with card-based UI, position prediction, compact summary generation, share card generation)

---

## Phase 5: Comparative Analysis

| Dimension              | Current State                                | A: Review Bench                         | B: Governance Brief                         | C: 60-Second Vote                             |
| ---------------------- | -------------------------------------------- | --------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| **JTBD Ceiling**       | 5/10 — voting is a sidebar on a citizen page | 10/10 — purpose-built triage workspace  | 9/10 — covers full cycle, less batch-aware  | 8/10 — fast but shallow for complex proposals |
| **Emotional Impact**   | 4/10 — feels like paperwork                  | 9/10 — flow state, professional         | 10/10 — "someone prepared this for me"      | 9/10 — speed is delightful                    |
| **Simplicity**         | 6/10 — buried in citizen page complexity     | 7/10 — three panels is inherently dense | 9/10 — reading a document is simple         | 10/10 — the simplest possible                 |
| **Differentiation**    | 3/10 — standard proposal page                | 10/10 — Bloomberg for governance        | 10/10 — personalized briefs are unique      | 8/10 — card voting exists elsewhere           |
| **Feasibility**        | N/A (exists)                                 | 7/10 — XL build                         | 8/10 — L build                              | 9/10 — M build                                |
| **Share Moment**       | 1/10 — CardanoScan link only                 | 9/10 — post-vote share cards            | 9/10 — brief + vote shareable               | 9/10 — inline share flow                      |
| **Data Requirements**  | Everything exists                            | 5 new computations                      | 4 new computations + AI pipeline            | 2 new computations                            |
| **Effort**             | —                                            | XL                                      | L                                           | M                                             |
| **Mobile Experience**  | Mediocre (scrolling)                         | Needs separate mobile layout            | Good (reading is naturally mobile-friendly) | Excellent (card-based is mobile-native)       |
| **Power User Ceiling** | Low                                          | Very high                               | Medium-high (depends on AI quality)         | Medium (speed over depth)                     |

**The Question:** Which concept has the highest ceiling AND is buildable within a reasonable timeframe?

The answer is not one concept — it's a **specific hybrid.**

---

## Phase 6: Recommendation

### The Winning Concept: "The Governance Brief" (B) with surgical elements from A and C

**Why Concept B wins as the foundation:**

1. **Highest emotional ceiling.** "Someone prepared a personalized briefing for me" is the most powerful feeling. It transforms governance from a chore into a supported decision. This is what makes DReps abandon their current workflow.

2. **Best effort-to-impact ratio.** The AI brief pipeline is the main new build, and it leverages the existing intelligence infrastructure (summaries, constitutional analysis, citizen sentiment, similar proposals, rationale aggregation) by weaving them into a narrative. The UI is a reading-mode page with an action footer — simpler than a multi-panel workspace.

3. **Strongest differentiation.** Personalized governance briefs don't exist. Not in Cardano, not in any blockchain, not in most civic tech. This is genuinely novel.

4. **Mobile-first by nature.** A brief document reads well on any screen. A three-panel workspace doesn't.

5. **AI quality as moat.** The brief is only as good as the personalization engine. Competitors can't replicate this without Governada's dataset of DRep voting history, governance philosophies, citizen sentiment, and proposal intelligence. The brief IS the moat.

### What to Steal from Concept A (The Review Bench)

- **Queue state management.** The left-rail queue with unreviewed/in-progress/voted/snoozed states is essential. Concept B's slim queue rail should have A's state management.
- **Keyboard shortcuts.** `Y`/`N`/`A`/`S`/`→` for power users. Brief is the default, but keyboard accelerators enable rapid processing.
- **Batch context line.** At the top of each brief, a single line: "Proposal 2 of 5. If you vote Yes on this and the 2 pending treasury proposals, total epoch spend = 7.1% of NCL."
- **Post-vote peer reveal.** "After you voted: 68% of DReps in your alignment cluster also voted Yes." Social calibration without anchoring.
- **Cumulative epoch impact.** Show cumulative treasury impact across all proposals being reviewed.

### What to Steal from Concept C (The 60-Second Vote)

- **Quick mode toggle.** For simple proposals (Info Actions, non-controversial parameter changes), offer a compact card view within the same `/workspace/review` route. The DRep can toggle: "Full Brief" (default) vs "Quick Review" (Concept C's card view). This prevents the brief from feeling heavy for proposals that don't need it.
- **Rationale auto-appear after vote.** Don't make rationale a separate step. After the DRep clicks Yes/No/Abstain, the AI draft appears inline. Edit or accept.
- **Post-vote share inline.** The share card appears immediately after submission, within the same view. No navigation.
- **Dot progress indicator.** Show queue progress as dots in addition to the queue rail. Momentum visualization.

### Implementation Roadmap

#### Phase 0: Foundation (1-2 days)

- New route: `/workspace/review`
- Queue state management (proposals fetched, sorted by urgency + relevance)
- Proposal navigation (keyboard + click)
- Basic reading-mode layout with brief placeholder

#### Phase 1: The Brief Engine (3-5 days)

- **Personalized brief generation pipeline** — New Inngest function: `governada/proposal.brief.personalized`
  - Input: proposal data + DRep voting history + DRep governance philosophy + citizen sentiment + constitutional analysis + similar proposals + existing rationales
  - Output: Personalized brief with sections: "Why This Matters to You", "The Ask", "Track Record", "The Debate", "Your Delegators", "Constitutional Check"
  - Caching: per DRep per proposal, invalidated when new rationales arrive or DRep philosophy changes
- **Position prediction** — Lightweight computation from DRep alignment vectors + past votes on classified-similar proposals
- **Compact summary mode** — Generate both full brief (Concept B) and 4-sentence summary (Concept C's quick mode)

#### Phase 2: Vote + Rationale Flow (2-3 days)

- Inline vote action zone below brief
- Position prediction display ("Based on your history: 82% likely Yes")
- Vote button interaction → AI rationale auto-appears
- Rationale editor with AI draft pre-loaded
- Submit vote + rationale in one transaction (reuse existing `useVote` + CIP-100 pipeline)
- Post-vote rationale fallback (existing pattern)

#### Phase 3: Share Engine (2-3 days)

- **Share card generation API** — `/api/share/vote-card`
  - Renders an OG image: proposal title, DRep's vote, 1-line rationale summary, DRep name/avatar, Governada branding
  - Returns image URL + share links for Twitter, Farcaster, copy
- Post-vote share card appears inline
- Share to Twitter with pre-formatted text: "I voted [Yes/No/Abstain] on [Proposal]. Here's why: [1-line]. See my full rationale on @Governada [link]"
- Farcaster frame integration (if feasible)
- Copy link to shareable vote detail page

#### Phase 4: Queue Intelligence (2-3 days)

- Personalized relevance scoring (computed during sync)
- Queue sorting: urgency (deadline) + relevance + unreviewed first
- Snooze functionality
- Batch context line (cumulative treasury impact)
- Quick mode toggle (full brief vs compact card)
- Keyboard shortcut system

#### Phase 5: Polish + Edge Cases (1-2 days)

- Mobile responsive layout
- Empty state ("You're all caught up!")
- Error states (AI brief failed, vote failed, etc.)
- Hub integration (Hub shows "3 proposals need your review" card linking to `/workspace/review`)
- Analytics events (PostHog: `proposal_brief_viewed`, `proposal_review_completed`, `vote_shared`)

### What to REMOVE from the Current Implementation

Nothing should be removed from the current proposal detail page. The citizen experience remains unchanged. The workspace review tool is an **additive** surface.

However, the Hub card for DReps/SPOs should shift priority from "browse proposals" to "review proposals in workspace" as the primary CTA. The proposal detail page's `ProposalActionZone` remains functional for DReps who arrive via direct links.

### New Data Requirements

| Requirement                        | Feasibility                                                      | Dependencies                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Personalized brief generation (AI) | High — extends existing brief pipeline                           | DRep voting history (EXISTS), governance philosophy (EXISTS), proposal intelligence (EXISTS) |
| Position prediction                | High — simple cosine similarity on alignment vectors             | DRep alignment (EXISTS), proposal classification (EXISTS)                                    |
| Cumulative epoch impact            | High — sum pending proposals' treasury amounts                   | Proposal data (EXISTS)                                                                       |
| Share card OG image                | Medium — needs image generation endpoint (Satori/Vercel OG)      | Vote data (EXISTS), DRep profile (EXISTS)                                                    |
| Delegator alignment check          | Medium — requires citizen position data matched to delegator set | Citizen positions (EXISTS for Quick Match users)                                             |

### Risk Assessment

| Risk                                   | Likelihood | Mitigation                                                                                                          |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| AI brief quality is inconsistent       | Medium     | Degrade gracefully to existing AI summary + structured data. Brief sections fall back to non-personalized versions. |
| DReps don't discover the workspace     | Low        | Hub card prominently links to it. "Review proposals" becomes the primary DRep CTA.                                  |
| Brief generation is too slow           | Medium     | Pre-generate briefs during proposal sync (Inngest). Show loading skeleton with immediate data while brief loads.    |
| Position prediction feels presumptuous | Low        | Frame as "Based on your history" not "You should vote." Show confidence percentage. Easy to ignore.                 |
| Share cards feel spammy                | Low        | Sharing is opt-in. Card design is tasteful, not promotional.                                                        |

### Validation Suggestion

Before building the full pipeline, test the core hypothesis with a **manual prototype**:

1. Pick 3 active proposals
2. Manually write personalized briefs for 2-3 real DReps (using their actual voting history and stated priorities)
3. Share the briefs with those DReps and ask: "If this appeared in your workspace every time a new proposal dropped, would you use it? Would it replace your current review process?"
4. If the response is enthusiastic, build it. If the brief doesn't add value over reading the proposal directly, the concept fails.

The cheapest test: generate one personalized brief using the existing AI pipeline with enhanced prompting, screenshot the reading-mode mockup, and share it with 3-5 DReps in the community.

---

## Appendix: UX Constraints Entry for `/workspace/review`

This new route needs a constraint entry:

| Attribute               | Constraint                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Core JTBD**           | Review proposals, decide, vote, share — efficiently                                                                             |
| **5-second answer**     | "You have N proposals to review. Here's the first one."                                                                         |
| **Dominant element**    | The personalized governance brief for the current proposal                                                                      |
| **Supporting elements** | Vote action zone, queue progress indicator                                                                                      |
| **NOT on this page**    | Full voter lists, detailed analytics, historical charts, citizen engagement mechanisms. Those live on the proposal detail page. |
| **Persona restriction** | DRep and SPO only. Citizens never see this route.                                                                               |
| **Mobile**              | Brief is reading-mode (naturally responsive). Action zone is sticky footer. Queue is top navigation.                            |
| **Benchmark**           | Superhuman reading + acting on email. One item at a time, full context, clear actions, advance when done.                       |

---

## Addendum: Deep-Dive on Five Critical Dimensions

> **Added:** 2026-03-16 after founder feedback
> **Context:** The initial exploration focused on the review-vote-share cycle. The founder identified five dimensions that transform the concept from a "review tool" into a **governance thinking environment**: structured Q&A with proposal teams, peer deliberation, AI research assistance, source material access, and personal annotation/notes.

### Reframing: From "Review Tool" to "Thinking Environment"

The initial Concept B ("The Governance Brief") optimizes for throughput — read brief, decide, vote, share. But the founder's points reveal a higher ceiling: a workspace where DReps do their **best thinking about governance**, not just their fastest voting. Some proposals deserve 60 seconds. Others deserve 3 days of deliberation, research, discussion, and note-taking before casting a vote.

The workspace must support both modes — and everything in between — without forcing DReps into either. The brief is the entry point. What follows depends on the proposal and the DRep.

---

### Dimension 1: Structured Q&A with Proposal Teams

**The need:** DReps will have questions that the brief can't answer. "Your budget has 2M ADA for marketing — what's the specific plan?" "You reference Article 7 compliance — which section specifically?" These questions deserve direct, structured, publicly-visible answers from the proposal team.

#### The Pattern: SEC Comment Letter

The strongest inspiration is the SEC's comment letter process for IPO filings. The SEC issues numbered concerns. The company responds point-by-point. Multiple rounds continue until all concerns are addressed. The full correspondence becomes public record.

**Why this works for governance:** It creates **mandatory transparency**. A proposal team that ignores DRep questions is visibly unresponsive. A team that answers thoroughly demonstrates competence and accountability. The public record means future voters (and future proposals from the same team) benefit from the scrutiny.

#### The Design

**"Questions for the Team" section** within each proposal's workspace view:

```
+-- QUESTIONS FOR THE TEAM ------------------------------------+
|                                                              |
|  3 questions . 1 answered . 2 awaiting response              |
|                                                              |
|  +-- Q1 (answered) ----------------------------------------+ |
|  |  Asked by: DRep MariaG . 2 days ago                     | |
|  |  Supported by: 4 other DReps                            | |
|  |                                                         | |
|  |  > "2M ADA for marketing" (quoted from proposal S3)     | |
|  |                                                         | |
|  |  What is the specific marketing plan? Which channels,   | |
|  |  what metrics define success, and what's the monthly    | |
|  |  spend breakdown?                                       | |
|  |                                                         | |
|  |  -- Team Response (1 day ago) --                        | |
|  |  The 2M ADA breaks down as follows: [...]               | |
|  |                                                         | |
|  |  [Mark as Satisfactory] [Follow Up]                     | |
|  +----------------------------------------------------------+|
|                                                              |
|  +-- Q2 (awaiting) ----------------------------------------+ |
|  |  Asked by: DRep TechPool . 1 day ago                    | |
|  |  Supported by: 7 other DReps                            | |
|  |                                                         | |
|  |  Has the team delivered on their previous Catalyst      | |
|  |  proposal (#412)? What were the outcomes?               | |
|  |                                                         | |
|  |  Awaiting team response                                 | |
|  +----------------------------------------------------------+|
|                                                              |
|  [ Ask a Question ]  [ Quote from Proposal -> Ask ]          |
|                                                              |
+--------------------------------------------------------------+
```

**Key mechanics:**

- **Quote-from-proposal anchoring** (Kickstarter pattern): DReps can highlight any text in the proposal and convert it into a question. The quote appears as a blockquote in the Q&A, creating an unambiguous link between the claim and the question.
- **DRep endorsement**: Other DReps can "support" a question (like upvoting), signaling its importance. "7 DReps want to know this" is a powerful pressure signal.
- **Numbered point-by-point responses**: Proposal teams must address each question individually. No hand-waving. The format mirrors SEC comment letters.
- **Mark as Satisfactory / Follow Up**: The asking DRep (and supporters) can mark a response as satisfactory or request a follow-up. This creates a resolution checklist visible to all voters.
- **Response time visibility**: "Asked 3 days ago. No response" is itself a data point. Non-responsive teams lose trust.
- **Public record**: All Q&A threads are permanently attached to the proposal and visible to all voters. They become part of the proposal's evaluation history.

**What this enables for the Brief:** The personalized brief can incorporate Q&A status: "3 questions asked by DReps. 1 remains unanswered — the team hasn't clarified the marketing budget breakdown."

---

### Dimension 2: Peer Deliberation & Request for Feedback

**The need:** A DRep reviewing a highly technical proposal (e.g., protocol parameter change affecting Plutus execution costs) may not have the expertise to evaluate it alone. They need structured ways to (a) request expert feedback from DRep peers, and (b) consult their delegators.

#### The Pattern: OpenReview + Judicial Opinion Joining

From academic peer review (OpenReview): structured review forms with explicit dimensions, formal rebuttal periods, and meta-review synthesis. From judicial opinions: majority/concurrence/dissent architecture with part-by-part joining.

#### The Design

**Peer Review Request** — a DRep can post a request for expertise:

A DRep submits a request tagged by topic (e.g., [Plutus] [Protocol Parameters] [Technical]), specifying what they want input on. This is visible to all DReps. Experts can respond with a structured review: their position (Lean Yes / Lean No / Need More Info), key strengths, key concerns, and confidence level.

**Delegator Consultation** — a DRep can pose a question to their delegators:

The DRep writes a message ("I'm leaning Yes on this but want to hear your concerns, especially about the budget") which appears in delegators' next briefing with a response mechanism. This closes the accountability loop — delegators see their DRep actively consulting them, and the DRep gets crowd-sourced signal.

**Post-vote: Rationale Joining (Judicial Pattern)**

After a prominent DRep publishes a well-reasoned rationale, other DReps can:

- **Join** — "I agree with DRep X's rationale and adopt it as my own" (one-click, still creates a CIP-100 rationale that references the original)
- **Concur** — "I voted the same way but for different reasons" (write their own rationale, linked as a concurrence)
- **Dissent** — "I voted differently, and here's why" (formal disagreement, creating structured debate)
- **Partial join** — "I agree with their constitutional analysis but not their economic reasoning" (per-section endorsement)

This creates a **structured deliberation record** far richer than individual isolated votes. It makes the collective reasoning of DReps visible — not just how they voted, but the architecture of their agreement and disagreement.

---

### Dimension 3: Extended Deliberation Support

**The need:** Some proposals warrant days or weeks of thinking. The workspace must support a DRep who wants to come back to a proposal multiple times, accumulate notes, revise their position, and only vote when they're ready.

#### The Pattern: Decision Journal + ACH Framework

From Farnam Street's decision journal: structured pre-outcome capture of assumptions, confidence, and reasoning. From the intelligence community's Analysis of Competing Hypotheses: evidence-vs-hypothesis matrix that forces rigorous analysis.

#### The Design

**Proposal states in the workspace queue:**

- **New** — Unread, needs initial review
- **In Deliberation** — DRep has started reviewing but isn't ready to vote. Has notes, questions, or research in progress.
- **Ready to Vote** — DRep has formed a position and is ready to cast
- **Voted** — Vote submitted
- **Snoozed** — Deliberately deferred (returns on deadline proximity or new activity)

The key state is **"In Deliberation."** When a DRep moves a proposal here, the workspace preserves everything: their notes, questions asked, research, position history, and open questions checklist.

**Decision Journal fields (optional, DRep fills in what's useful):**

- **Current position** — Yes / No / Abstain / Undecided, with change history
- **Confidence** — percentage (trains calibration over time)
- **Key assumptions** — what the DRep is betting on being true
- **What would change my mind** — falsification criteria stated before voting
- **Open questions** — checklist of unresolved items (team responses, peer reviews, personal research)

The journal is filled out _before_ the outcome is known. After the proposal plays out (funded project delivers or doesn't), the system prompts a retrospective: were your assumptions correct? Was your confidence calibrated? This creates a **learning feedback loop** unique in governance — DReps who use it become better decision-makers over time.

**For complex/contentious proposals, optional ACH framework:**

An Analysis of Competing Hypotheses matrix: list possible outcomes (succeeds as planned, partially delivers, fails, creates harm), list evidence (track record, budget analysis, community sentiment, constitutional alignment), then rate each evidence item's consistency with each outcome. The matrix highlights "diagnostic" evidence — evidence that actually distinguishes between outcomes rather than being consistent with all of them. AI can assist in populating the matrix.

This isn't for every proposal. But for a 50M ADA treasury request, this level of rigor is exactly what responsible governance demands — and no tool in the ecosystem offers it.

---

### Dimension 4: AI as a Thinking Partner

**The need:** The AI shouldn't just summarize — it should be an **interactive research assistant** that the DRep can query, debate with, and use to stress-test their reasoning. Critically, it should adapt to the DRep's thinking style, not impose a rigid framework.

#### The Pattern: Elicit + Perplexity + Harvey AI

From Elicit: question-in, structured-table-out research that works across multiple documents with sentence-level citations. From Perplexity: visible multi-step reasoning with progressive disclosure. From Harvey AI: domain-specific intelligence with persistent case context that validates against authoritative sources.

#### The Design

**"AI Research" tab** — a conversational interface grounded in governance data:

The AI has access to: the current proposal's full text, all treasury data, DRep rationales on this and similar proposals, constitutional articles, historical governance actions, and the DRep's own notes and deliberation journal.

**Key design principles:**

1. **Grounded in data, not general knowledge.** Every AI response cites specific on-chain data, proposal text, constitutional articles, or historical precedent. No hallucinated expertise. The blockchain is Governada's authoritative source (analogous to Shepard's Citations in legal AI).

2. **Visible reasoning steps** (Perplexity pattern). When the AI performs multi-step analysis, it shows what it's doing: "Step 1: Searching constitution... Step 2: Finding precedent..." The DRep can expand or collapse these steps. Builds trust without overloading.

3. **Every claim links to source.** Inline citations link to the specific on-chain data, constitutional article, or proposal text. One click opens the original material. This is the bridge to Dimension 5 (source material access).

4. **Persistent context** (Clio pattern). The AI remembers the DRep's previous questions about this proposal, their notes, their position, and their deliberation journal. "Given your concern about the marketing budget, you might also want to check..." — proactive, not just reactive.

5. **Thinking partner, not oracle.** The DRep can ask the AI to:
   - **Summarize**: "Give me the 2-minute version of this proposal"
   - **Research**: "What happened with similar proposals in the past?"
   - **Analyze**: "Is this constitutional? What are the precedents?"
   - **Challenge**: "Play devil's advocate. Why should I vote No?"
   - **Structure**: "Help me organize my thoughts into a rationale"
   - **Compare**: "How does this compare to the other active treasury proposals?"
   - **Personalize**: "Based on my governance philosophy, how does this align with my stated priorities?"

6. **Adapts to thinking style.** The AI doesn't impose an analysis framework. If a DRep asks big-picture philosophical questions, it responds philosophically. If they ask detailed technical questions, it responds technically. Over time, it learns the DRep's preferred analysis dimensions. The ACH matrix in Dimension 3 is available but never forced — if a DRep prefers narrative reasoning over structured matrices, the AI adapts.

---

### Dimension 5: Source Material Access — The "Never Lose the Original" Principle

**The need:** AI summaries are powerful but dangerous. A DRep who only reads the brief and never checks the original proposal text is making decisions based on an interpretation, not the source. The workspace must make navigating to original material **seamless and encouraged**, not a detour.

#### The Design Principle

**AI is a lens, not a replacement.** The brief is a reading aid that helps the DRep understand the proposal faster. It is not a substitute for the proposal.

1. **Always show source attribution.** Every claim in the brief links to the specific section of the original proposal, the specific on-chain data point, or the specific DRep rationale it came from.

2. **"View Source" is one click away everywhere.** A small arrow icon next to every brief section opens the original material in a side panel or inline expansion. The DRep never leaves the workspace.

3. **Source material has a first-class tab.** `Source Material` shows: the raw proposal document (full text), the proposing team's on-chain identity and history, raw vote data (counts, power, by-body), raw rationale texts from other DReps (not just AI summaries), the proposal's on-chain metadata, and links to external references.

4. **Visual source confidence indicators.** The brief shows small indicators next to each section:
   - **Verified** — This claim is directly from on-chain data or the proposal text
   - **Interpreted** — This is AI analysis/synthesis based on multiple sources
   - **Computed** — This is a Governada-calculated metric (score, alignment, projection)

5. **Side-by-side mode.** For deep review, a DRep can split the view: brief on the left, original proposal on the right. As they scroll through the brief, the source panel auto-scrolls to the corresponding section.

This design means the brief **adds value** (personalization, synthesis, context) without **replacing** the original. A DRep who wants to go deep can always see exactly what the AI summarized and verify it against the source.

---

### Dimension 6: Personal Notes, Markup, and the Thinking Workspace

**The need:** The review workspace isn't just for consuming information — it's for **producing thought**. DReps need to annotate proposals, leave notes, markup sections, track their evolving thinking, and build up a personal governance knowledge base over time.

#### The Pattern: Hypothesis + Readwise + Google Docs Suggesting Mode

From Hypothesis: annotation as a transparent overlay on the original document, with group-scoped visibility. From Readwise: keyboard-first highlighting with marginalia. From Google Docs: non-destructive suggesting mode with threaded discussion.

#### The Design

**Inline annotations** on both the brief and source material:

- **Highlight** (`H`) — Select any text to highlight it. Personal, visible as colored overlay.
- **Margin note** (`N`) — Add a note to any highlight. Appears as marginalia next to the text.
- **Question flag** (`Q`) — Flag a passage as needing clarification. Can optionally be converted to a Q&A question for the team.
- **Concern flag** (`C`) — Flag a passage as concerning. Feeds into the DRep's rationale draft.

**Freeform notes section** for longer-form thinking: initial impressions, research findings, cross-references, draft positions. Markdown-supported, persistent across sessions.

**Key mechanics:**

1. **Notes persist across sessions.** A DRep can start reviewing Monday, add notes, come back Wednesday, and find everything preserved.

2. **Notes-to-rationale pipeline.** When ready to vote, the DRep clicks "Draft rationale from my notes" and the AI assembles a rationale from their annotations, position notes, and research — in their voice, using their actual reasoning.

3. **Private by default, shareable by choice.** All notes are private. But a DRep can choose to publish specific annotations as "Public Review Notes" — making their analysis process visible to delegators as a transparency signal.

4. **Cross-proposal notes search.** "What did I note about treasury proposals this epoch?" or "Find my notes mentioning constitutional concerns." Builds a personal governance knowledge base.

5. **Annotation heatmap (future).** If multiple DReps opt to share annotations, the workspace can show "14 DReps annotated this paragraph" — signaling areas of interest or concern.

---

### Revised Architecture: The Complete Governance Thinking Environment

Integrating all five dimensions, the `/workspace/review` route has this tab structure per proposal:

| Tab                 | Purpose                                                             | Mode          |
| ------------------- | ------------------------------------------------------------------- | ------------- |
| **Brief**           | AI-personalized governance brief (entry point)                      | Read + act    |
| **Source Material** | Raw proposal, team data, on-chain data, DRep rationales             | Read + verify |
| **Q&A**             | Structured questions to proposal team + responses                   | Communicate   |
| **Peer Review**     | Feedback requests to/from DRep peers + delegator consultations      | Collaborate   |
| **My Notes**        | Private annotations, margin notes, freeform notes, decision journal | Think         |
| **AI Research**     | Conversational AI assistant grounded in governance data             | Research      |

The tabs represent a natural workflow progression:

1. **Brief** — Get the 2-minute overview, personalized to you
2. **Source Material** — Verify anything from the brief, read the original
3. **Q&A** — Ask the team questions about things you don't understand
4. **Peer Review** — Consult experts and delegators on complex issues
5. **My Notes** — Record your thinking, track your evolving position
6. **AI Research** — Deep-dive into specific questions with an intelligent partner

Not every proposal needs every tab. A simple Info Action might only use Brief -> Vote. A 50M ADA treasury request might use all six tabs across multiple sessions over several days.

The **vote action zone** is always accessible — either as a sticky footer (reading mode) or as a dedicated section at the bottom of the Brief tab. The DRep can vote from any tab at any time, with their accumulated notes and research automatically informing the AI-drafted rationale.

### Revised Implementation Roadmap

The original roadmap (5 phases, ~10-16 days) covered the Brief + Vote + Share flow. The five new dimensions add:

| Phase                                     | What                                                                                                 | Effort   | Dependencies                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| **Phase 6: Source Material Access**       | Side-by-side mode, source confidence indicators, inline source links in brief                        | S (2-3d) | Phase 1 (brief engine)                    |
| **Phase 7: Personal Notes & Annotations** | Inline highlighting, margin notes, freeform notes, persistence                                       | M (3-5d) | Phase 0 (foundation)                      |
| **Phase 8: Structured Q&A**               | Quote-from-proposal, question posting, team response interface, DRep endorsement                     | M (3-5d) | New API endpoints, notification system    |
| **Phase 9: AI Research Assistant**        | Conversational AI tab, governance-grounded responses, visible reasoning, persistent context          | L (5-7d) | AI pipeline, existing data infrastructure |
| **Phase 10: Peer Deliberation**           | Feedback requests, delegator consultation, rationale joining/concurrence/dissent, structured reviews | L (5-7d) | Q&A system, notification system           |
| **Phase 11: Decision Journal**            | Position tracking, assumption surfacing, confidence calibration, optional ACH framework              | S (2-3d) | Notes system (Phase 7)                    |

**Suggested build order:**

- **Launch wave 1** (Phases 0-5): Brief + Vote + Share + Queue — The core review tool. Immediately useful.
- **Launch wave 2** (Phases 6-7): Source Material + Notes — Makes the tool a thinking environment. DReps can go deep.
- **Launch wave 3** (Phases 8-9): Q&A + AI Research — Adds communication and intelligence layers.
- **Launch wave 4** (Phases 10-11): Peer Deliberation + Decision Journal — The full governance professional workspace.

Each wave is independently valuable. Wave 1 alone replaces the current workflow. Wave 4 makes Governada indispensable.
