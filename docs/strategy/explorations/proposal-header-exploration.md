# Exploration: Proposal Page Header

> **Date**: 2026-03-16
> **Trigger**: Founder feedback — "I hate the proposal page header. Not facilitating quick storytelling, not enabling JTBDs, and I don't know where to look."
> **Scope**: Everything above the Living Brief (which is praised and retained)
> **Method**: `/explore-feature` — 6-phase generative exploration

---

## Phase 1: Current State Snapshot

### What Exists Today (Living Brief Layout)

The header is a **vertical stack of 6 independent components**, each in its own card/container:

1. **CompactHeader** — type badge + title + status + deadline + treasury amount (single row, 80px max)
2. **1-line summary** — `aiSummary || abstract`, 2-line clamp, muted text
3. **YourRepresentativeCard** — citizen-only: DRep name, tier, score, their vote on this proposal
4. **CitizenProposalSummary** — citizen/anonymous-only: 2-3 sentence accessible explanation
5. **ConvictionTugOfWar** — force balance beam + conviction/polarization metrics + threshold bar
6. **InlineActionNudge** — persona-branching CTA bar (DRep: "Cast Your Vote", Citizen: "Signal", Anonymous: "Connect Wallet")

**Key files**: `app/proposal/[txHash]/[index]/page.tsx`, `components/governada/proposals/CompactHeader.tsx`, `ConvictionTugOfWar.tsx`, `InlineActionNudge.tsx`, `YourRepresentativeCard.tsx`, `CitizenProposalSummary.tsx`

### The JTBD (from ux-constraints.md)

> "Understand this proposal and decide how to act"

**5-second answer**: "This proposal asks for X ADA for Y purpose, voting ends Z"

### What's Working Well (DO NOT CHANGE)

- **Living Brief** below the header — praised by founder, strong storytelling
- **YourRepresentativeCard** concept — citizens seeing their DRep's vote is powerful accountability
- **ConvictionTugOfWar** animation — the beam visualization is visually engaging
- **Persona branching** — different personas see different content (good principle)
- **Depth gating** — ConvictionTugOfWar adapts to depth level (hands-off vs engaged)

### What's At Its Ceiling

- **CompactHeader** — it's a metadata dump, not a story. Type badge + status badge + deadline badge + treasury badge = "I don't know where to look"
- **Vertical stacking of 6 cards** — each component is its own visual island. No hierarchy. No flow. The eye bounces between containers without a reading path.
- **No dominant element** — violates the UX constraint: "1 dominant element + 2-3 supporting elements." Currently there are 6 co-equal elements.
- **Storytelling is absent** — the header presents FACTS (type, status, amount, deadline) but doesn't tell a STORY ("This contested treasury request is losing support with 2 epochs left")
- **Action is separated from context** — InlineActionNudge is the last thing you see, but it should be the most prominent for governance actors
- **The verdict is buried** — "Is this passing or failing?" is the #1 question for any open proposal. It's hidden inside ConvictionTugOfWar's threshold section, not immediately visible.

### Current Score Estimate

| Dimension          | Score | Note                                                              |
| ------------------ | ----- | ----------------------------------------------------------------- |
| Visual hierarchy   | 4/10  | No dominant element, 6 competing cards                            |
| Storytelling       | 3/10  | Facts without narrative                                           |
| JTBD facilitation  | 5/10  | Action nudge exists but is buried                                 |
| Persona adaptation | 7/10  | Good branching, but could be bolder                               |
| Emotional impact   | 4/10  | Force balance beam is cool, but overall feels like reading a form |
| Craft/polish       | 6/10  | Components are well-built individually, but don't compose well    |

---

## Phase 2: Inspiration Research

### Pattern 1: ESPN Score Bug — "The State of the Game in One Glance"

- **Source**: ESPN live game broadcasts + ESPN app game page
- **What they do**: A persistent "score bug" shows both teams, the score, the period/quarter, and time remaining. It never disappears — it morphs based on game state. Color-coded team identities. The score bug tells you WHO'S WINNING and HOW MUCH TIME IS LEFT in <1 second of looking.
- **Why it's remarkable**: An entire complex live event distilled into one horizontal strip that's always readable. The bug adapts to game state (pre-game, live, halftime, final) with different layouts per state.
- **Applicable to**: A proposal IS a live governance event. The "teams" are Yes vs No. The "score" is the voting power balance. The "clock" is epochs remaining. The "game state" is the proposal status (voting/ratified/enacted/dropped/expired).

### Pattern 2: Robinhood Stock Detail — "Color as Functional Language"

- **Source**: Robinhood stock detail page
- **What they do**: The ENTIRE page color shifts based on one thing: is this stock up or down? Green = up, Red = down. The dominant element is the price + change. Everything else (charts, news, earnings) is progressive disclosure below. Card-based info grouping lets you drill into depth.
- **Why it's remarkable**: Color communicates the single most important fact before you read a single word. The page "feels" bullish or bearish instantly.
- **Applicable to**: A proposal page should "feel" like it's passing (green tint) or failing (red tint) or contested (amber tint) before you read anything. The dominant element should be the verdict, not the metadata.

### Pattern 3: GitHub PR Status Bar — "Merge Readiness as Single Strip"

- **Source**: GitHub pull request page
- **What they do**: A single status bar at the top shows: mergeable/not mergeable, check status (green/red/pending), reviewer status, and the merge button. It's one horizontal component that answers "can I merge this?" instantly. The conversation/details are progressive disclosure below.
- **Why it's remarkable**: Collapses a complex multi-signal status (CI, reviews, conflicts, permissions) into one actionable strip. The action button (Merge) is RIGHT THERE next to the status.
- **Applicable to**: A proposal's "merge readiness" is its vote threshold status. The action (vote/signal) should be next to the status, not separated by 3 other components.

### Pattern 4: Notion Document Header — "Invisible Until Needed"

- **Source**: Notion page header
- **What they do**: The header is just the title. Properties (status, assignee, dates) are a compact row of pills below the title. Contextual actions appear on hover. The page feels like a DOCUMENT, not a dashboard.
- **Why it's remarkable**: Radical restraint. The header doesn't try to tell you everything — it orients you (title) and gives you metadata access (properties row) without visual noise.
- **Applicable to**: The proposal header could be dramatically simpler — title as dominant element, metadata as a compact pill row, verdict as the one accent element.

### Pattern 5: Pol.is — "Consensus Visualization as Real-Time Landscape"

- **Source**: Pol.is (used by vTaiwan, g0v)
- **What they do**: A real-time 2D opinion landscape showing clusters of agreement and consensus statements. Participants see WHERE they sit relative to others. The visualization itself IS the engagement hook — you want to see how your position relates to the community.
- **Why it's remarkable**: Turns voting from a "cast and forget" action into a spatial, social experience. The visualization creates curiosity and continued engagement.
- **Applicable to**: The force balance visualization could evolve from a simple beam into something that shows the COMMUNITY — not just Yes vs No power, but the clusters of reasoning, the citizen sentiment overlay, the narrative of WHY people are voting the way they are.

### Pattern 6: Apple Health Summary — "One Number, One Trend, One Insight"

- **Source**: Apple Health summary card
- **What they do**: Each health metric gets: one large number, one trend arrow, one contextual sentence. The summary page shows 3-4 of these. Drill down for charts and history.
- **Why it's remarkable**: Proves that even complex health data can be a 5-second glance. The insight sentence is what transforms a number into something actionable.
- **Applicable to**: The proposal verdict could follow this pattern: one verdict word ("Passing"), one trend indicator (momentum arrow), one insight sentence ("Strong DRep support with 2 epochs remaining").

---

## Phase 3: Data Opportunity Scan

### Data That EXISTS Today

| Data                                              | Source                                       | Status              |
| ------------------------------------------------- | -------------------------------------------- | ------------------- |
| Proposal metadata (type, title, abstract, amount) | `proposals` table                            | Stored              |
| AI-generated summary                              | `proposals.ai_summary`                       | Stored (nullable)   |
| Tri-body vote counts + power                      | `proposal_voting_summary`                    | Stored/cached       |
| Individual DRep/SPO/CC votes                      | `drep_votes`, `spo_votes`, `cc_votes` tables | Stored              |
| Vote rationales + AI summaries                    | `vote_rationales` table                      | Stored              |
| Conviction score (0-100)                          | `computeConvictionPulseData()`               | Computed on-request |
| Polarization score (0-100)                        | `computeConvictionPulseData()`               | Computed on-request |
| Vote projection + verdict                         | `computeVoteProjection()`                    | Computed on-request |
| Threshold % progress                              | `getVotingPowerSummary()`                    | Computed on-request |
| Historical pass rate by type                      | `getHistoricalBaseRate()`                    | Computed on-request |
| Historical amount percentile                      | `getProposalHistoricalContext()`             | Computed on-request |
| Citizen sentiment (support/oppose/unsure)         | `citizen_sentiment` table                    | Stored              |
| Concern flags                                     | `citizen_concern_flags` table                | Stored              |
| User's delegated DRep + their vote                | `useGovernanceHolder` + `useDRepVotes`       | Client-side query   |
| Proposal classification (6 dimensions)            | `classification_history` table               | Stored              |
| Living Brief narrative                            | `getProposalBrief()`                         | Stored/generated    |
| NCL utilization                                   | `getNclUtilization()`                        | Computed            |
| Rationale quality scores                          | `drep_votes.rationale_quality`               | Stored (nullable)   |

### Data That COULD Exist (New Computations)

| Opportunity                                                                                                                                                                                                | What It Unlocks                                                   | Effort                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| **AI editorial headline** — Claude-generated 1-line contextual headline summarizing the proposal's CURRENT STATE, not just its content (e.g., "Contested: DRep majority backing erodes as SPOs push back") | Transforms header from metadata dump to narrative                 | Small — one Claude call during brief generation                |
| **Momentum indicator** — is voting power trending toward or away from threshold over last 2 epochs?                                                                                                        | "Gaining support" vs "Losing ground" as a trend signal            | Small — diff of power snapshots across epochs                  |
| **Citizen sentiment summary for DReps** — "63% of citizens who signaled support this proposal" as a compact stat                                                                                           | DReps see citizen pulse without scrolling to engagement section   | Small — aggregate query on `citizen_sentiment`                 |
| **DRep rationale consensus** — among DReps who provided rationales, what are the top 2 themes?                                                                                                             | "Key arguments: budget sustainability, technical risk" above fold | Medium — AI clustering of rationale texts                      |
| **Personal alignment prediction** — based on citizen's alignment profile + proposal classification, predict "This proposal aligns with your values"                                                        | Citizens get personal relevance signal before reading details     | Medium — exists in matching engine, needs per-proposal surface |
| **Inter-body tension alert** — when DReps and SPOs are voting differently, surface the split                                                                                                               | "DReps favor, SPOs oppose — bodies are split on this one"         | Small — compare tri-body percentages                           |

### Data That Would Be Transformative (New Sources)

| Opportunity                                                                            | What It Unlocks                                              | Effort                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| **Real-time vote stream** — WebSocket/SSE for live vote updates                        | Header updates live as DReps cast votes (ESPN-like liveness) | Large — requires real-time infrastructure  |
| **Social sharing engagement** — track which proposals get shared, discussed externally | "Trending" or "High attention" badges based on social signal | Large — requires external signal ingestion |

---

## Phase 4: Three Alternative Concepts

### Concept A: "The Verdict Strip" — Radical Simplification

**Core Insight**: The header's job is ONE thing: tell me the verdict and let me act. Everything else belongs in the Living Brief or below.

**Inspiration Source**: GitHub PR status bar + ESPN score bug + Apple Health summary card

#### The Experience

The entire header collapses into **two elements**:

**Element 1: Verdict Hero (dominant)** — A single horizontal component, ~120px tall:

- Left side: **Verdict word** in large type, color-coded (green "Passing" / red "Failing" / amber "Contested" / gray "Closed")
- Center: **Inline force beam** — the tug-of-war visualization embedded horizontally, compact (no separate card)
- Right side: **Action button** — persona-specific ("Cast Vote" for DRep, "Signal" for citizen, "Connect" for anonymous)
- Below verdict word: **One-sentence AI editorial headline** — "Strong DRep support for 50M ADA treasury request • 2 epochs remaining"

**Element 2: Metadata Pills** — A single row of compact pills directly below:

- Type pill (icon + label, colored)
- Status pill
- Deadline pill (if open)
- Amount pill (if treasury)
- "Your DRep: Voted Yes" pill (if citizen with delegation — replaces the full YourRepresentativeCard)

**What happens to the current components**:

- CompactHeader → dissolved. Title moves to breadcrumb or above verdict. Metadata becomes pills.
- 1-line summary → becomes the AI editorial headline inside the verdict hero
- YourRepresentativeCard → compressed to a pill in the metadata row. Full card moves into Living Brief.
- CitizenProposalSummary → moves into the Living Brief's opening paragraph
- ConvictionTugOfWar → the beam visualization embeds inline in the verdict hero. Metrics (conviction, polarization) move to Living Brief.
- InlineActionNudge → the button embeds in the verdict hero, right side.

**The Title**: Large h1 ABOVE the verdict strip, standalone, dominant. This is the ONE thing you read first.

**Total vertical height**: ~200px (vs ~500-600px currently)

#### The Emotional Arc

- **Entry**: See title → instant verdict color washes the strip → you KNOW if this is passing/failing before reading anything
- **During**: The editorial headline gives you the story in one sentence. Pills give you the facts.
- **Action**: The CTA button is right there, inside the verdict. No scrolling to find it.

#### Data Requirements

- AI editorial headline: **NEEDS_COMPUTATION** — one Claude call per proposal, cached. Updates when vote state changes significantly.
- Verdict label + color: **EXISTS** — `voteProjection.verdictLabel` + `projectedOutcome`
- Force beam: **EXISTS** — `ConvictionTugOfWar` internals
- Metadata pills: **EXISTS** — all from current props
- "Your DRep voted X" pill: **EXISTS** — from `YourRepresentativeCard` data

#### What It Removes

- YourRepresentativeCard as a standalone card (→ compressed pill + detail in Living Brief)
- CitizenProposalSummary as a standalone section (→ absorbed into Living Brief)
- ConvictionTugOfWar as a standalone card (→ beam embedded inline, metrics in Living Brief)
- InlineActionNudge as a standalone bar (→ button embedded in verdict hero)
- The entire concept of "6 stacked cards" → replaced by 2 tight elements

#### The Ceiling

| Dimension          | Score | Rationale                                                           |
| ------------------ | ----- | ------------------------------------------------------------------- |
| Visual hierarchy   | 9/10  | ONE dominant element (verdict hero), one supporting row (pills)     |
| Storytelling       | 8/10  | AI headline tells the story; color tells the mood                   |
| JTBD facilitation  | 9/10  | Action button is in the verdict strip — zero scroll to act          |
| Persona adaptation | 7/10  | Pills adapt, CTA adapts, but the structure is the same for everyone |
| Emotional impact   | 9/10  | Color-washed verdict creates instant emotional read                 |
| Craft/polish       | 9/10  | Dramatically cleaner, more intentional                              |

#### What It Sacrifices

- **DRep representation detail** — "Your DRep voted Yes" as a pill loses the avatar, tier, score detail. Citizens who care about their DRep's context must look in the Living Brief.
- **Citizen-friendly explanation** — moving CitizenProposalSummary into the Living Brief means first-time citizens don't get the "this proposal requests X from the treasury" context above the fold unless the AI headline covers it.
- **Conviction/polarization metrics** — these interesting numbers lose above-fold visibility. Only the beam visual remains.

#### Effort: **Medium** (M)

- New: VerdictStrip component, AI editorial headline generation, metadata pills row
- Refactor: dissolve 4 existing components into 2 new ones
- Migration: move displaced content into Living Brief

#### The Share Moment

A screenshot of a proposal with a massive green "PASSING" verdict, the force beam showing 80/20 split, and the headline "Historic: Largest treasury request in Cardano history nears ratification" — that gets shared on X/Twitter.

---

### Concept B: "The Living Headline" — Editorial Storytelling

**Core Insight**: Every proposal has a STORY that changes over time. The header should read like a newspaper front page — headline + lede + photo (visualization) — not like a database record.

**Inspiration Source**: Newspaper front pages + GeoBarta multi-level briefings + MAPLE public testimony + Pol.is opinion landscapes

#### The Experience

The header is a **single narrative component** that generates a different "article" based on proposal state:

**Structure**:

```
┌─────────────────────────────────────────────────────────────┐
│ [Type pill]  [Status pill]  [Deadline pill]     [Action ▶]  │
│                                                              │
│  ██  AI Editorial Headline (large, bold)                     │
│  ██  "DRep majority backs 50M ADA treasury request,         │
│  ██   but SPO opposition grows as deadline approaches"       │
│                                                              │
│  ┌─ Force Beam ──────────────────────────────────────────┐  │
│  │ ████████░░░░░░░░░░░░░░████████████████████████████████│  │
│  │ 31% No          ·          69% Yes                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  📊 42 DReps voted · Conviction 78 · 2 epochs remaining     │
│                                                              │
│  ┌─ Your Angle ──────────────────────────────────────────┐  │
│  │ 👤 Your DRep "CardanoMaestro" voted Yes on this       │  │
│  │    63% of citizens who signaled support this proposal  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key innovation — "Your Angle" section**: This is the persona-adaptive part:

- **Citizen with DRep**: "Your DRep [name] voted [Yes/No/Abstain]. 63% of citizens support this."
- **Citizen without DRep**: "63% of citizens support this proposal. You haven't delegated yet — your voice counts."
- **DRep (hasn't voted)**: "You haven't voted. 47 of 120 active DReps have voted. Citizen pulse: 63% support."
- **DRep (has voted)**: "You voted [X]. Your delegators: 71% support, 18% oppose. Your vote aligns with citizen sentiment."
- **SPO**: "Your pool hasn't cast a governance vote. SPO participation: 23%. This affects infrastructure parameters."
- **Anonymous**: "Connect your wallet to see how your representative voted and add your voice."

**The headline is AI-generated and STATE-AWARE**:

- Open + early: "New treasury request opens for DRep review — 50M ADA for Catalyst Fund 15"
- Open + contested: "Contested: DRep support for parameter change splits along treasury-conservative lines"
- Open + nearing deadline: "Final epoch: Hard fork proposal needs 12% more Yes voting power to clear threshold"
- Ratified: "Ratified: 50M ADA treasury withdrawal approved after 4-epoch deliberation"
- Dropped: "Dropped: No-confidence motion fails to gain traction, withdrawn by proposer"

#### The Emotional Arc

- **Entry**: The headline hits you like a news story. You immediately know what's happening and why it matters.
- **During**: The force beam gives you the quantitative reality. The "Your Angle" makes it personal.
- **Action**: The action button is top-right, always visible. But you WANT to act because the story engaged you.

#### Data Requirements

- AI editorial headline: **NEEDS_COMPUTATION** — contextual, state-aware headline generation. More sophisticated than Concept A's headline — needs vote trajectory, inter-body dynamics, deadline proximity.
- Citizen sentiment summary stat: **NEEDS_COMPUTATION** — aggregate % from `citizen_sentiment` table. Simple query.
- DRep delegator sentiment: **EXISTS** — `getDelegatorIntelligence()` already computes this.
- "Your Angle" persona data: **EXISTS** — combination of existing hooks + data.
- Force beam: **EXISTS** — extracted from ConvictionTugOfWar.

#### What It Removes

- CompactHeader → dissolved into the pill row at top
- YourRepresentativeCard → absorbed into "Your Angle" section
- CitizenProposalSummary → the AI headline IS the citizen-friendly summary
- ConvictionTugOfWar as standalone → beam embedded, metrics in the stat line
- InlineActionNudge → button in top-right of the component
- The title (h1) → the AI headline IS the title experience. The actual proposal title goes in the pill row or breadcrumb.

#### The Ceiling

| Dimension          | Score | Rationale                                                                 |
| ------------------ | ----- | ------------------------------------------------------------------------- |
| Visual hierarchy   | 8/10  | Headline is dominant, beam is secondary, pills are tertiary               |
| Storytelling       | 10/10 | The header IS a story — AI-generated, state-aware, persona-adapted        |
| JTBD facilitation  | 8/10  | "Your Angle" tells you exactly what to do; action button is visible       |
| Persona adaptation | 10/10 | Every persona gets a different story AND different "Your Angle"           |
| Emotional impact   | 9/10  | Reading a story about YOUR governance is emotionally engaging             |
| Craft/polish       | 8/10  | Requires excellent AI headline quality — brittle if headlines are generic |

#### What It Sacrifices

- **The proposal title as h1** — the AI headline replaces it as the dominant text. The actual title becomes secondary. This is bold but might confuse users who want to verify they're on the right proposal.
- **Quantitative detail** — conviction score, polarization score, ADA amounts are compressed or moved below. Data-oriented users (researchers) lose above-fold density.
- **AI dependency** — if the headline generation fails or produces a generic result, the entire header loses its magic. Need robust fallbacks.
- **Cacheability** — state-aware headlines need to update frequently (at least once per epoch, ideally on significant vote changes). This adds computational cost.

#### Effort: **Large** (L)

- New: AI editorial headline pipeline (state-aware, persona-aware), "Your Angle" component, unified narrative header
- Refactor: dissolve all 6 current components into 1 unified component
- Infrastructure: headline generation triggers, caching strategy, fallback templates

#### The Share Moment

The AI headline itself: "Historic: Cardano's largest-ever treasury request passes with 89% DRep support after contentious 5-epoch debate" — that's a tweet. The entire header is shareable as a governance news snippet.

---

### Concept C: "The Split-Screen Decision" — Action-First Interface

**Core Insight**: The JTBD is "understand and **decide how to act**." Current design: understand first (header), then scroll to act (action zone below). Flip it: the ACTION is the header. Understanding supports the action.

**Inspiration Source**: Tinder/Hinge (action-first card interface) + Decidim (proposal wizard with contextual help) + Loomio (spectrum-of-opinion voting) + Robinhood (the Buy/Sell buttons are THE interface)

#### The Experience

The header is a **two-column layout** (stacks on mobile):

```
┌─────────────────────────────┬────────────────────────────────┐
│                              │                                │
│  CONTEXT COLUMN              │  ACTION COLUMN                 │
│                              │                                │
│  [Type] [Status] [Deadline]  │  ┌─ Your Decision ──────────┐ │
│                              │  │                            │ │
│  Proposal Title (h1, large)  │  │  [DRep: Cast Your Vote]   │ │
│                              │  │  ┌───┐ ┌───┐ ┌─────────┐ │ │
│  AI summary (2 lines)        │  │  │Yes│ │No │ │Abstain  │ │ │
│                              │  │  └───┘ └───┘ └─────────┘ │ │
│  ┌─ Force Balance ────────┐  │  │                            │ │
│  │ ██████░░░░░████████████│  │  │  + Add Rationale           │ │
│  │ 31% No     69% Yes     │  │  │                            │ │
│  └────────────────────────┘  │  │  ─── or ───                │ │
│                              │  │                            │ │
│  Your DRep voted Yes ✓       │  │  [Citizen: Signal below]   │ │
│  63% of citizens support     │  │  Support · Oppose · Unsure │ │
│                              │  │                            │ │
│                              │  └────────────────────────────┘ │
└─────────────────────────────┴────────────────────────────────┘
```

**Left column (Context)**: What you need to know to decide.

- Compact metadata row
- Title (dominant)
- AI summary
- Force balance beam (compact)
- Key facts (your DRep's vote, citizen pulse)

**Right column (Action)**: What you can do right now.

- For **DRep/SPO/CC**: Vote buttons (Yes/No/Abstain) + "Add Rationale" link. If already voted: "You voted Yes ✓ · Change vote · Edit rationale"
- For **Citizen**: Sentiment buttons (Support/Oppose/Unsure) + concern flag toggles. Inline, not scrolling to a separate section.
- For **Anonymous**: "Connect wallet to participate" with preview of what they'll unlock.

**On mobile**: Stacks to context-first, then action section. Sticky action bar at bottom (like Robinhood's persistent Buy button).

**Key innovation**: The right column IS the engagement surface. Citizens don't need to scroll to the engagement section — sentiment voting is IN THE HEADER. DReps don't need to leave the page or find an action zone — voting intent capture starts here (actual submission still via gov.tools, but the rationale flow can begin on Governada).

#### The Emotional Arc

- **Entry**: Two clear zones — left is information, right is action. Your eye goes to whichever matters more to you.
- **During**: Context and action are side-by-side, so you can reference while deciding. No "scroll down to find the vote button" problem.
- **Action**: Zero-scroll action. The moment you understand, you can act. For citizens, the sentiment vote is literally right there.

#### Data Requirements

- All existing data: **EXISTS**
- Inline citizen sentiment (in header): **EXISTS** — same as ProposalSentiment component, just relocated
- DRep vote intent capture: **NEEDS_NEW_UX** — not a data problem, but a UX flow for capturing vote + rationale intent before redirecting to gov.tools
- Mobile sticky action bar: **NEEDS_COMPUTATION** — simple scroll-aware component

#### What It Removes

- InlineActionNudge → replaced by the full action column
- YourRepresentativeCard → compressed to a single line in context column
- CitizenProposalSummary → replaced by AI summary line
- ConvictionTugOfWar → compressed to inline beam in context column
- ProposalActionZone (below fold) → partially absorbed into header action column. The full engagement section below becomes supplementary, not primary.

#### The Ceiling

| Dimension          | Score | Rationale                                                                |
| ------------------ | ----- | ------------------------------------------------------------------------ |
| Visual hierarchy   | 8/10  | Clear two-zone layout, but two dominant areas compete                    |
| Storytelling       | 6/10  | AI summary helps, but the split-screen prioritizes action over narrative |
| JTBD facilitation  | 10/10 | THE action IS the header. Zero-scroll to participate.                    |
| Persona adaptation | 9/10  | Right column is completely different per persona                         |
| Emotional impact   | 7/10  | Empowering (you can act NOW), but less emotionally engaging than a story |
| Craft/polish       | 7/10  | Two-column layout is harder to get right, especially responsive          |

#### What It Sacrifices

- **Storytelling depth** — the editorial narrative approach of Concept B is lost. This is functional, not narrative.
- **Mobile experience** — two-column doesn't work on mobile. The stacked fallback with sticky bar is a different (arguably worse) experience.
- **Reading flow** — two-column layouts create "which side do I read first?" ambiguity. Needs very strong visual hierarchy within each column.
- **Vertical space** — the two-column layout may actually use MORE vertical space on mobile than the current stacked layout.
- **DRep voting flow** — capturing vote intent in the header then redirecting to gov.tools creates a split experience. Users might think they've voted when they haven't.

#### Effort: **Large** (L)

- New: two-column responsive layout, inline sentiment voting in header, DRep vote intent capture, mobile sticky action bar
- Refactor: relocate engagement components into header, redesign ProposalActionZone
- Risk: responsive design complexity, potential confusion about vote submission

#### The Share Moment

A DRep screenshots the split-screen showing their vote alongside the community context — "Voted Yes with 78% conviction, here's my rationale" — sharable governance transparency.

---

## Phase 5: Comparative Analysis

| Dimension              | Current  | A: Verdict Strip  | B: Living Headline | C: Split-Screen |
| ---------------------- | -------- | ----------------- | ------------------ | --------------- |
| **Visual Hierarchy**   | 4/10     | 9/10              | 8/10               | 8/10            |
| **Storytelling**       | 3/10     | 8/10              | **10/10**          | 6/10            |
| **JTBD Facilitation**  | 5/10     | 9/10              | 8/10               | **10/10**       |
| **Persona Adaptation** | 7/10     | 7/10              | **10/10**          | 9/10            |
| **Emotional Impact**   | 4/10     | **9/10**          | 9/10               | 7/10            |
| **Simplicity**         | 3/10     | **10/10**         | 7/10               | 5/10            |
| **Feasibility**        | —        | **9/10**          | 6/10               | 6/10            |
| **Differentiation**    | 4/10     | 8/10              | **10/10**          | 7/10            |
| **Data Requirements**  | baseline | 1 new computation | 2 new computations | 1 new UX flow   |
| **Effort**             | —        | **M**             | L                  | L               |
| **CEILING (avg)**      | 4.3      | **8.7**           | **8.7**            | 7.5             |

**The Question**: Concept A has the highest ceiling-to-effort ratio. Concept B has the highest storytelling and differentiation ceiling but costs more. Concept C has the best JTBD score but sacrifices storytelling and is complex to build.

---

## Phase 6: Recommendation

### Winner: Hybrid A+B — "The Verdict Strip with Living Headline"

Take Concept A's radical simplification and vertical compression, but replace its plain AI summary line with Concept B's editorial headline and "Your Angle" personalization. This gives us:

**The best of both worlds:**

- Concept A's visual clarity (ONE dominant element, pills for metadata, action in the strip)
- Concept B's storytelling (AI editorial headline that tells the story, "Your Angle" for personal relevance)
- Concept A's feasibility (Medium effort, not Large)

### The Recommended Design

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  Proposal Title (h1, large, standalone above strip)          │
│                                                              │
│  [Type pill] [Status pill] [Deadline pill] [₳ Amount pill]   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🟢 PASSING                              [Cast Your Vote ▶]  │
│                                                              │
│  "Strong DRep support for 50M ADA treasury request,         │
│   but SPO opposition emerges with 2 epochs remaining"        │
│                                                              │
│  ████████░░░░░░░░░░░░░░████████████████████████████████████  │
│  31% No          ·          69% Yes    · 42 DReps voted      │
│                                                              │
│  Your DRep "CardanoMaestro" voted Yes · 63% citizens support │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### What to steal from each concept:

- **From A**: Single unified component, metadata pills row, action button embedded in the verdict area, dramatic vertical compression
- **From B**: AI editorial headline (state-aware, persona-adapted), "Your Angle" as the bottom line of the strip, citizen sentiment stat
- **From C**: On mobile, a sticky action bar at the bottom of the viewport (small, unobtrusive) so the action is always reachable even after scrolling into the Living Brief

### Implementation Roadmap

#### Phase 1: Foundation (Small, ~2-3 hours)

1. Create `ProposalVerdictStrip` component combining:
   - Title (h1) above the strip
   - Metadata pills row
   - Verdict label (large, color-coded) + action button (right-aligned)
   - Force beam (inline, extracted from ConvictionTugOfWar)
   - "Your Angle" line (persona-adapted, using existing data)
2. Replace the 6 current header components with this single component
3. Move displaced content (CitizenProposalSummary, full YourRepresentativeCard, conviction metrics) into the Living Brief

#### Phase 2: Editorial Headline (Small, ~1-2 hours)

1. Add AI editorial headline generation to `getProposalBrief()` pipeline
   - Input: proposal metadata + current vote state + inter-body dynamics + deadline proximity
   - Output: 1-2 sentence contextual headline
   - Cache strategy: regenerate when vote state changes significantly (>5% shift) or at epoch boundary
   - Fallback: `aiSummary || abstract` (what we have today)
2. Wire headline into the VerdictStrip

#### Phase 3: Polish + Mobile (Small, ~1-2 hours)

1. Add citizen sentiment summary stat (aggregate query)
2. Add momentum indicator (vote power trend)
3. Mobile sticky action bar (scroll-aware, shows only after scrolling past the strip)
4. Color theming — the strip background subtly tints based on verdict (green/red/amber)

### What to REMOVE from the current implementation

| Component                    | Action                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `CompactHeader.tsx`          | **Delete** — replaced by pills row in VerdictStrip                                                                              |
| `InlineActionNudge.tsx`      | **Delete** — action button embedded in VerdictStrip                                                                             |
| `ConvictionTugOfWar.tsx`     | **Refactor** — extract beam SVG as a reusable `ForceBeam` component. Full card version stays for depth-3 analytics.             |
| `YourRepresentativeCard.tsx` | **Keep** — but move from header to Living Brief. Add a compact "Your DRep voted X" summary to VerdictStrip's "Your Angle" line. |
| `CitizenProposalSummary.tsx` | **Move** — into Living Brief's opening section. Header relies on AI headline for citizen context.                               |

### New Data Requirements

| Need                                | Feasibility                           | Priority                           |
| ----------------------------------- | ------------------------------------- | ---------------------------------- |
| AI editorial headline (state-aware) | **High** — one Claude call, cacheable | P0 (core to the concept)           |
| Citizen sentiment aggregate stat    | **High** — simple COUNT query         | P1 (enhances "Your Angle")         |
| Momentum indicator                  | **High** — diff of power snapshots    | P2 (nice-to-have for storytelling) |

### Risk Assessment

| Risk                                                | Mitigation                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| AI headline quality varies                          | Robust fallback chain: editorial headline → aiSummary → abstract → template                       |
| Losing above-fold DRep detail for citizens          | "Your Angle" line provides the key fact; full card is one scroll away in Living Brief             |
| Losing conviction/polarization metrics above fold   | These are engagement metrics, not decision metrics. Living Brief is the right home.               |
| Color theming accessibility                         | Ensure verdict is communicated by text + icon, not color alone                                    |
| Over-compression loses context for first-time users | The Living Brief immediately below provides full context — the header orients, the brief educates |

### Validation Suggestion

Before building the full implementation:

1. **Quick mockup test**: Create a static HTML mockup of the VerdictStrip for 3 proposal states (passing treasury, contested parameter change, expired info action). Show to 2-3 Cardano community members. Ask: "What's happening with this proposal?" — they should answer correctly in <5 seconds.
2. **A/B with depth toggle**: Ship the VerdictStrip as the default for depth 0-1, keep the current layout for depth 2-3. Compare engagement metrics (time-to-action, sentiment vote rate, scroll depth).

---

## Summary

The current proposal header suffers from **visual democracy** — 6 components of equal visual weight competing for attention. The fix is **radical hierarchy**: one dominant verdict strip that tells the story and enables action, with everything else either compressed into pills or moved to the Living Brief below.

The recommended hybrid (A+B) achieves:

- **10x visual clarity** — from 6 stacked cards to 1 unified strip
- **Storytelling** — AI editorial headline turns metadata into narrative
- **Zero-scroll action** — CTA embedded in the verdict strip
- **Personal relevance** — "Your Angle" line adapts per persona
- **Medium effort** — buildable in a single session, no infrastructure changes

The Living Brief (which you love) becomes even more powerful — it inherits the rich context (full DRep card, citizen summary, conviction metrics) that the header sheds, creating a clear information hierarchy: **verdict strip → Living Brief → source material → deep dive**.
