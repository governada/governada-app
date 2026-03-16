# Feature Exploration: Current Information Architecture

> **Date**: 2026-03-15
> **Feature**: Macro-level information architecture — sections, navigation, routing, depth management, entity relationships
> **Core JTBD**: "Navigate complex governance intelligence across multiple personas without feeling lost or overwhelmed"
> **Personas served**: All (anonymous, citizen, DRep, SPO, CC, researcher)
> **Related explorations**: `explore-citizen-hub-workspace.md` (March 12 — citizen hub deep dive)

---

## Phase 1: Current State Snapshot

### What exists today

**Section inventory (7 sections):**

| Section    | Route         | Purpose                             | Personas                        |
| ---------- | ------------- | ----------------------------------- | ------------------------------- |
| Hub (Home) | `/`           | Persona-adaptive control center     | All                             |
| Workspace  | `/workspace`  | Governance work tools               | DRep, SPO                       |
| Governance | `/governance` | Explore governance activity         | All                             |
| You        | `/you`        | Identity, settings, notifications   | Authenticated                   |
| Match      | `/match`      | DRep matching funnel                | Primarily anonymous/undelegated |
| Delegation | `/delegation` | Monitor both gov relationships      | Delegated citizens              |
| Help       | `/help`       | FAQ, glossary, methodology, support | All                             |

**Navigation surfaces:**

- **Desktop**: Collapsible left sidebar (240px/64px) + sticky top bar (logo, search, notifications, user menu)
- **Mobile**: 4-item bottom bar (persona-adaptive) + contextual pill bar within sections
- **Universal**: Command palette (Cmd+K), breadcrumbs on entity pages

**Entity pages (standalone, outside sections):**

- `/drep/[id]`, `/pool/[id]`, `/committee/[id]`, `/proposal/[tx]/[i]`, `/compare`
- Breadcrumb back to parent Governance sub-page

**Governance depth tuning:**

- `GovernanceDepth` system filters nav items by engagement level (hands_off → expert)
- Controls which sidebar items and pill bar entries are visible

**Data-driven nav config:**

- Single source of truth in `lib/nav/config.ts`
- `getSidebarSections()`, `getBottomBarItems()`, `getPillBarItems()` — all persona-aware

**Redirect infrastructure:**

- 20+ permanent redirects from legacy routes (discover, pulse, my-gov, engage, learn)
- Middleware-based query param redirects and auth gates

### Current IA score (self-assessment)

| Dimension                          | Score | Rationale                                                                                                                                                                                                       |
| ---------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Structural clarity**             | 7/10  | Sections are JTBD-organized (not entity-organized). Clear separation between Workspace (do) and Governance (explore). But: 7 sections may be too many for casual users.                                         |
| **Persona adaptation**             | 8/10  | Bottom bar, sidebar, Hub content, and governance default landing all adapt. Governance depth tuning is sophisticated. Strong.                                                                                   |
| **Wayfinding**                     | 6/10  | Entity pages have breadcrumbs, sections have pill bars. But: no persistent "you are here" indicator across the full IA. Jumping from a DRep profile to governance/proposals loses context.                      |
| **Progressive disclosure**         | 7/10  | Depth tuning exists. Feature-gated components. But: the gating is binary (on/off), not graduated. No smooth onramp from anonymous → power user.                                                                 |
| **Information density management** | 6/10  | UX constraints doc defines per-page budgets. Some pages respect them (committee, treasury). Others are still dense (representatives browse, health).                                                            |
| **Cross-section navigation**       | 5/10  | Entity pages are standalone — they don't naturally guide you to related content across sections. A DRep profile doesn't link to "proposals your DRep voted on" in the Governance section. Sections feel siloed. |
| **Mobile experience**              | 7/10  | 4-item bottom bar is well-configured per persona. Pill bar for sub-navigation. But: deep hierarchies (governance → committee → member → voting record) require many taps.                                       |

### What's working well (DO NOT change)

1. **JTBD-driven sections** — The spec's principle of "organized around what users DO, not what data types exist" is fundamentally correct and well-implemented. There's no "browse entities" section.
2. **Persona-adaptive navigation** — The bottom bar and sidebar configurations per segment are thoughtful. DReps see Workspace first; citizens see Governance first. This is ahead of every competitor.
3. **Single nav config source** — `lib/nav/config.ts` as single source of truth is clean engineering. Easy to modify, test, and reason about.
4. **Governance depth tuning** — The hands_off → expert spectrum is a genuine innovation in governance tools. No competitor offers this.
5. **Redirect infrastructure** — 20+ legacy route redirects protect SEO and old links. Well-maintained.

### What's at its ceiling

1. **Section-centric IA** — The sidebar presents sections as destinations. Once you're in Governance → Proposals, there's no natural path to "your DRep's votes on these proposals" or "how this affects your delegation." Sections don't talk to each other.
2. **Entity pages as dead ends** — `/drep/[id]` shows a DRep profile but doesn't deeply connect to the citizen's delegation context, the workspace context, or the governance activity context. It's an information island.
3. **Static nav hierarchy** — The sidebar is the same structure every time. It doesn't surface what's urgent, new, or personally relevant. A DRep with 3 pending votes sees the same sidebar as one with zero.
4. **Two-dimensional navigation** (section × sub-page) — Works for organized exploration but fails for "I heard about a treasury proposal and want to understand it" cross-cutting queries. Users need entry points that cut across sections.

---

## Phase 2: Inspiration Research

### Pattern 1: The "Hub-and-Spoke" IA (Apple Health)

Apple Health's iOS 26.4 redesign reorganizes from flat categories into a **hub-and-spoke model**: the Summary (Hub) surfaces the 3-5 most relevant metrics, with spokes leading to detailed category views. The hub is adaptive — it learns which categories you check most and promotes them.

**Why it's remarkable**: Manages 50+ health data types across 10+ categories without overwhelming. The hub acts as a personal gravity well — every spoke leads back to it. Users never feel lost because the hub is always one tap away.

**Transfer to Governada**: The Home page IS the hub. But currently it doesn't act like one — it shows static cards rather than being the gravity well that surfaces what matters NOW from all sections.

### Pattern 2: Linear's "View Modes" (Linear)

Linear's recent UI redesign introduces **multiple view modes** (list, board, timeline, split, fullscreen) for the same data. The sidebar provides structural navigation (projects, teams), but the content area is fluid — you can see the same issues in completely different layouts without changing your position in the nav.

**Why it's remarkable**: Separates "where am I" (sidebar) from "how do I want to see this" (view modes). Navigation stays stable while the presentation adapts.

**Transfer to Governada**: Governance sub-pages could offer view modes — proposals as list (current), as timeline (deadlines), as vote matrix (who voted what). Same data, different lenses, without nav disruption.

### Pattern 3: Robinhood's "One Choice at a Time" (Robinhood)

Robinhood's IA philosophy: users "expand out into the areas they care about" from a single portfolio view. No multi-tab dashboards. No category browsers. One entry point (your portfolio value) → tap to expand → one choice leads to the next.

**Why it's remarkable**: Makes complex financial architecture feel simple by eliminating the concept of "sections." Everything is accessible from a single entry point through progressive expansion.

**Transfer to Governada**: For citizens especially, the whole app could feel like expanding from one number (your delegation health) outward, rather than choosing between 4-5 sections.

### Pattern 4: Spotify's "Your Library" Sidebar + Personalized Home

Spotify's IA has 3 persistent destinations (Home, Search, Library). Home is algorithmically personalized — it changes by time of day, recent listening, and discovered content. Library is YOUR content. Search is discovery. Three modes: consume what's curated, find something new, access what's saved.

**Why it's remarkable**: Just 3 nav items cover the entire product. Complexity is managed by making Home intelligent rather than adding more sections.

**Transfer to Governada**: Could the entire IA collapse to 3 items? Hub (your governance intelligence), Explore (governance discovery), You (identity and settings)?

### Pattern 5: Notion's "Teamspaces" Sidebar

Notion's sidebar organizes content into Teamspaces (shared), then Private. Within each space, users create their own hierarchy. The sidebar reflects USAGE, not a fixed information architecture — frequently accessed pages float to the top.

**Why it's remarkable**: User-determined IA. The product provides structural primitives (pages, databases, teamspaces) but the user decides the hierarchy.

**Transfer to Governada**: The sidebar could include a "Pinned" section where users pin their most-used pages (favorite DRep profiles, tracked proposals, workspace views). User-curated navigation alongside the structural sections.

### Pattern 6: Chicago DPD's "Three-Tier Architecture" (Civic Tech)

Chicago's Department of Planning redesigned with a three-tier IA: (1) process overview → (2) timeline/status → (3) detailed documents. Organized by user type with self-service resources. Clear timelines embedded in navigation.

**Why it's remarkable**: Government processes are inherently complex. The three-tier approach (overview → status → detail) makes them navigable without dumbing them down.

**Transfer to Governada**: Each governance process (proposal lifecycle, delegation, treasury allocation) could have its own three-tier drill-down, consistent across all process types.

### Pattern 7: Context-Aware Adaptive Interfaces

Research from 2025 shows that **task-adaptive** interfaces (which adjust to what the user is doing RIGHT NOW) outperform **user-adaptive** interfaces (which adjust to who the user IS) in reducing cognitive load. The best approach combines both: know the user's persona AND their current task.

**Why it's remarkable**: Validates that Governada's current persona adaptation is necessary but not sufficient. The next leap is task-awareness — surfacing different navigation when a DRep is reviewing proposals vs. managing delegators.

**Transfer to Governada**: Nav items could show contextual badges or reorder based on current activity state, not just persona.

### Anti-Pattern: USAspending.gov's "Everything Up Front"

USAspending.gov provides extraordinary data but poor navigation — the GAO found that "data quality and user awareness impact its usefulness." The information architecture exposes internal data structures (awards, agencies, budget functions) rather than user tasks. Users need training videos to navigate.

**Lesson for Governada**: Never expose internal data models (DReps, proposals, epochs) as nav categories. Always organize around user tasks ("understand governance," "manage my delegation," "find representation").

---

## Phase 3: Data Opportunity Scan

### What data exists today (relevant to IA decisions)

| Data                          | Location                   | Currently Powers                  | Could Power (IA)                                       |
| ----------------------------- | -------------------------- | --------------------------------- | ------------------------------------------------------ |
| Persona segment               | `SegmentProvider`          | Nav adaptation, content switching | Task-aware nav priority ordering                       |
| Governance depth              | `governanceTuner`          | Item visibility filtering         | Graduated disclosure across ALL pages                  |
| DRep votes on proposals       | `lib/data.ts`              | Profile pages, workspace          | Cross-section links ("your DRep voted on this")        |
| User alignment (6D PCA)       | `user_governance_profiles` | Matching engine                   | Relevance-scored proposal ordering                     |
| Proposal classifications (6D) | `proposal_classifications` | Matching, alignment               | "Why this matters to you" on any proposal              |
| Engagement signals            | `useEngagement` hooks      | Feature-gated engagement          | Activity-aware nav (badge counts, urgency)             |
| Delegation relationship       | `user_drep_delegations`    | Hub cards, profile                | Cross-linking entity pages to citizen context          |
| Notification state            | Inbox/notifications        | Bell badge count                  | Nav urgency indicators beyond just a count             |
| Civic identity metrics        | `CivicIdentityCard`        | Identity page                     | Hub gravity — "your governance identity" as nav anchor |
| Score momentum                | `computeMomentum`          | Computed, not displayed           | Trending indicators on nav items ("Rising")            |
| GHI components                | `lib/ghi/`                 | Health page                       | Section-level health badges in nav                     |

### What data could exist (new computations for IA)

1. **User Navigation Patterns** — Track which sections/pages each persona visits most (via PostHog). Use to reorder sidebar items by actual usage, not assumed priority. NEEDS: PostHog event analysis → per-persona nav weights.

2. **Cross-Entity Relationship Graph** — Precompute connections: DRep ↔ proposals voted on ↔ citizens delegated ↔ pools in same ecosystem. NEEDS: relationship table or real-time joins. Would enable "related" navigation on every entity page.

3. **Activity-Scoped Urgency Signals** — Beyond notification count: "3 proposals expiring in 24h," "your DRep's score dropped 5 points," "treasury vote this epoch." NEEDS: urgency scoring function that maps events to priority levels.

4. **Governance Context Timeline** — Temporal view of all governance activity (proposals, votes, epoch events, treasury movements) as a unified timeline. NEEDS: event normalization across different entity types.

5. **Personal Relevance Scoring** — For any governance entity or event, compute "how relevant is this to THIS user?" based on delegation, alignment, engagement history. NEEDS: relevance scoring function combining multiple signals.

### What new data would unlock (IA implications)

| New Capability              | What It Enables for IA                            | Impact                                                  |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| Navigation pattern tracking | Evidence-based nav ordering, not assumed          | Sidebar items appear in order of actual use             |
| Cross-entity graph          | "Related" navigation on every page                | Entity pages stop being dead ends                       |
| Urgency signals             | Nav items show what needs attention NOW           | Sidebar becomes a live dashboard, not a static menu     |
| Personal relevance          | Filter/sort governance content by "matters to me" | Collapse Governance sub-pages from 6 to "most relevant" |
| Context timeline            | Unified temporal view across all entities         | New navigation paradigm: time-based, not section-based  |

---

## Phase 4: Three Alternative Concepts

### Concept A: "The Living Sidebar" — Navigation as Intelligence Surface

**Core Insight**: The sidebar isn't just a menu — it's a real-time intelligence dashboard. Every nav item carries live context about what's happening RIGHT NOW in that section.

**Inspiration Source**: Linear (structured sidebar with real-time counts) + Apple Health (hub that adapts to what matters now) + Ziggma (threshold-based alerts)

**The Experience**:

The desktop sidebar transforms from a static list of links into a **live intelligence surface** where every section and sub-page carries contextual metadata.

**What the sidebar shows:**

```
HOME                              ← Green dot (all clear) or amber pulse
                                    "2 proposals decided this epoch"

WORKSPACE                         ← Badge: "3 votes pending"
  Cockpit                           "Score: 82 ↑2"
  Voting Record                     "14 rationales published"
  Delegators                        "2 new this epoch"

GOVERNANCE                        ← "2 active proposals"
  Proposals                         "2 active · 1 expiring tomorrow"
  Representatives                   "423 active DReps"
  Pools                             "142 gov-active pools"
  Committee                         "7 members · CC health: Good"
  Treasury                          "Balance: 340M ADA"
  Health                            "GHI: 74 ↑3"

YOU                               ← Badge if unread inbox
  Identity                          "Treasury Hawk · 24-epoch streak"
  Inbox                             "3 unread"
  Settings
```

**Key design decisions:**

1. **Contextual sub-labels** — Each nav item shows ONE live metric beneath the label. Not a dashboard — a signal. Updated on page load, cached for the session.
2. **Section health indicators** — Colored dots (green/amber/red) on section headers communicate "does this need my attention?" at a glance.
3. **Urgency-aware ordering** — When a DRep has pending votes, Workspace sub-items reorder to put the most urgent first. When a proposal is expiring, Governance → Proposals gets a visual pulse.
4. **Pinned items** — Users can pin specific entity pages (a DRep they're watching, a proposal they care about) to a "Pinned" section at the bottom of the sidebar. Max 5 pins.
5. **Mobile adaptation** — Bottom bar keeps the 4-item limit but badges become richer: not just "3" but "3 votes due" as a tooltip on long-press.

**The Emotional Arc:**

- Entry: Glance at sidebar → see green dots everywhere → "governance is calm" → confidence (1 second)
- Urgency: Amber pulse on Workspace → "3 votes pending, 1 expiring tomorrow" → tap → immediately in context (3 seconds)
- Depth: "GHI: 74 ↑3" in sidebar → curious → tap Health → full breakdown (5 seconds)
- Habit: Every session starts with a sidebar scan. The sidebar IS the daily briefing.

**Data Requirements:**

- Sidebar contextual metrics: NEEDS_COMPUTATION — lightweight API endpoint returning counts/scores per section (S effort)
- Section health indicators: NEEDS_COMPUTATION — threshold rules per section (green/amber/red) (S effort)
- Urgency-aware ordering: NEEDS_COMPUTATION — priority scoring for sub-items (S effort)
- Pinned items: NEEDS_NEW — localStorage pinning + entity resolver (S effort)

**What It Removes:**

- Static sidebar labels → replaced by live contextual labels
- Nothing structural changes — all 7 sections stay, all sub-pages stay
- Hub cards that duplicate sidebar info → Hub can focus on narrative, not metrics
- Separate "check all sections" behavior → sidebar scan replaces it

**The Ceiling:** F1 (JTBD): 7/10, F2 (Emotional): 7/10, F3 (Simplicity): 8/10, F4 (Differentiation): 7/10, F5 (Feasibility): 9/10, F6 (Data): 6/10

**What It Sacrifices:** This concept improves navigation quality but doesn't fundamentally rethink the IA structure. It's an evolution, not a revolution. The 7-section structure remains, with its inherent cross-section navigation challenges. Mobile gets limited benefit (bottom bar can't carry contextual sub-labels). The sidebar becomes a dependency — if the live data is stale or wrong, trust erodes.

**Effort:** **S** — This is the least disruptive option. Add contextual sub-labels to existing `NavItem` type, build a lightweight sidebar metrics API, add pinning to localStorage. No route changes, no section restructuring.

**The Share Moment:** The sidebar itself isn't shareable, but the behavior it enables is: "I check my governance sidebar every morning. When it's all green, I know Cardano governance is healthy. When something pulses amber, I know exactly where to look." This is the Linear effect — the tool becomes the professional's daily ritual.

---

### Concept B: "Three Worlds" — Collapse from 7 Sections to 3

**Core Insight**: Seven sections is too many for most users to hold in working memory. The entire IA can collapse into three meta-sections that map to three fundamental user modes: **Act** (do your governance job), **Explore** (understand what's happening), **Reflect** (who are you in governance). Everything else is discoverable within these three worlds.

**Inspiration Source**: Spotify (Home / Search / Library = 3 universal destinations) + Robinhood (one entry point → progressive expansion) + Apple Health (hub-and-spoke with 3 primary spokes)

**No governance tool has ever attempted this.** Every competitor (GovTool, Tally, Snapshot, SubSquare) uses entity-based sections (Proposals, Delegates, etc.). Collapsing to 3 activity-based worlds would be unprecedented.

**The Experience:**

**Three bottom-bar items (all personas):**

```
[ACT]  ·  [EXPLORE]  ·  [REFLECT]
```

**Desktop sidebar:**

```
ACT                               ← "What needs my attention?"
├── Action Queue                    (pending votes, signals, alerts)
├── My Delegation                   (DRep + pool health)
├── Workspace                       (DRep/SPO work tools)
└── Match / Re-delegate             (if needed)

EXPLORE                           ← "What's happening in governance?"
├── Active Proposals                (current + recently decided)
├── Representatives                 (DReps, pools, CC)
├── Treasury                        (spending, balance, health)
├── Governance Health               (GHI, trends, epochs)
└── Leaderboard                     (rankings across entities)

REFLECT                           ← "Who am I in governance?"
├── Governance Identity             (archetype, radar, milestones)
├── My Impact                       (consequences, footprint)
├── Signal History                  (my voice, influence score)
├── Inbox                           (notifications)
└── Settings
```

**How persona adaptation works in Three Worlds:**

| Persona               | ACT contains                      | EXPLORE default             | REFLECT default     |
| --------------------- | --------------------------------- | --------------------------- | ------------------- |
| Anonymous             | "Get started" CTA, Quick Match    | Active Proposals            | (hidden until auth) |
| Citizen (undelegated) | Match funnel, "Find your DRep"    | Representatives             | Governance Identity |
| Citizen (delegated)   | Delegation health, active signals | Active Proposals            | My Impact           |
| DRep                  | Vote queue, delegator alerts      | Active Proposals (research) | Governance Identity |
| SPO                   | Gov score, pool profile alerts    | Pools (competitive)         | Governance Identity |

**How entity pages work:**

Entity pages (`/drep/[id]`, `/proposal/[tx]/[i]`) exist outside the three worlds but include a **context bar** at the top:

```
← Back to EXPLORE > Representatives        [Pin to ACT]  [Related proposals]
```

The context bar:

1. Shows breadcrumb back to the world/section that referred you
2. Offers "Pin to ACT" to add this entity to your action queue / watchlist
3. Shows "Related" links to cross-section content (a DRep's proposals, a proposal's voting DReps)

**How Match and Delegation fold in:**

- Match becomes a sub-page of ACT (for users who need it)
- Delegation becomes the default ACT landing for delegated citizens
- Help becomes a header dropdown (already implemented)

**The URL structure:**

```
/act                    → Persona-adaptive action center
/act/delegation         → Delegation health
/act/workspace          → DRep/SPO workspace
/act/workspace/votes    → Voting record
/act/match              → Matching funnel

/explore                → Persona-adaptive governance overview
/explore/proposals      → Active proposals
/explore/representatives → DRep directory
/explore/pools          → Pool directory
/explore/committee      → CC directory
/explore/treasury       → Treasury overview
/explore/health         → GHI dashboard

/reflect                → Persona-adaptive identity
/reflect/identity       → Governance personality
/reflect/impact         → Consequences & footprint
/reflect/signals        → Signal history
/reflect/inbox          → Notifications
/reflect/settings       → Preferences
```

**Redirect strategy:**

- All current `/governance/*` → `/explore/*` (301)
- All current `/workspace/*` → `/act/workspace/*` (301)
- All current `/you/*` → `/reflect/*` (301)
- `/match` → `/act/match` (301)
- `/delegation` → `/act/delegation` (301)
- Home (`/`) → `/act` for authenticated, landing page for anonymous

**The Emotional Arc:**

- Entry: "I have 3 choices: Act, Explore, Reflect" → clarity (1 second)
- Act: "2 votes pending" → handle them → done (2 minutes)
- Explore: "What's happening in governance?" → browse proposals → find something interesting → pin it (5 minutes)
- Reflect: "Who am I?" → see archetype, impact counter → share personality card (3 minutes)
- Habit: Users develop a routine — ACT first (clear the queue), EXPLORE if curious, REFLECT weekly.

**Data Requirements:**

- Action queue aggregation: NEEDS_COMPUTATION — merge pending votes + delegation alerts + expiring proposals + unread signals into one prioritized list (M effort)
- Personal relevance for Explore: EXISTS partially — alignment + depth tuning
- Impact data for Reflect: NEEDS_COMPUTATION — see citizen hub exploration (consequence engine data)
- Cross-entity "Related" links: NEEDS_COMPUTATION — relationship graph for context bar (M effort)

**What It Removes:**

- 7 top-level sections → 3 worlds
- Home as a separate section → Home IS "Act"
- Match as a standalone section → sub-page of Act
- Delegation as a standalone section → sub-page of Act
- Help from nav → header dropdown only (already done)
- Workspace as a section → sub-section of Act
- You as a section → "Reflect" world
- Governance as a section → "Explore" world

**The Ceiling:** F1 (JTBD): 9/10, F2 (Emotional): 8/10, F3 (Simplicity): 10/10, F4 (Differentiation): 10/10, F5 (Feasibility): 6/10, F6 (Data): 8/10

**What It Sacrifices:** The biggest risk is **muscle memory disruption** — every existing user knows the current nav. A complete restructure means relearning. The SEO impact is significant — dozens of URLs change, requiring careful redirect management. The "Three Worlds" metaphor may feel forced for some user tasks that don't neatly map to act/explore/reflect. DRep workspace is buried one level deeper (ACT → Workspace) which may frustrate power users. The 3-item bottom bar loses the persona-specific fourth item (Match for anonymous, Help for hands-off users).

**Effort:** **XL** — Complete route restructuring, nav config rewrite, redirect infrastructure, URL migration, SEO preservation, persona adaptation for 3 worlds instead of 7 sections, context bar component, action queue aggregation, all section layouts rebuilt.

**The Share Moment:** "Governada has three modes: Act on governance, Explore governance, Reflect on your governance identity. No other tool thinks about governance this way." The conceptual framework itself is shareable — it's a mental model, not just a product feature.

---

### Concept C: "The Connected Graph" — Entity-Relationship Navigation

**Core Insight**: The current IA treats sections as silos and entity pages as dead ends. Instead, make **relationships the primary navigation mechanism**. Every entity page is a node in a graph, and the navigation IS the graph traversal — from your DRep → to their votes → to the proposals → to other DReps who voted differently → to the citizens who signaled.

**Inspiration Source**: Wikipedia (every page is linked to related pages) + Notion (bidirectional links) + GitHub (PR → commits → issues → discussions → contributors, all cross-linked) + Knowledge graphs in enterprise software

**This is dramatically SIMPLER than it sounds.** The structural sections remain. The change is adding a **relationship layer** on top that connects every page to every related page, making the app feel like an interconnected web rather than a set of folders.

**The Experience:**

**The sidebar stays as-is** (7 sections, persona-adaptive). No structural change to navigation.

**What changes: every page gets a "Connected" panel.**

On a DRep profile (`/drep/[id]`):

```
CONNECTED
├── 4 proposals voted on this epoch          → links to proposal pages
├── 847 citizens delegated                   → links to delegation analytics
├── 3 pools in same governance cluster       → links to pool pages
├── 2 CC members who voted the same way      → links to CC profiles
├── Similar DReps (alignment within 10%)     → links to DRep comparison
└── Your alignment: 87% match               → links to your alignment radar
```

On a proposal page (`/proposal/[tx]/[i]`):

```
CONNECTED
├── Your DRep voted: Yes (with rationale)    → links to DRep profile
├── 12 DReps voted Yes, 5 voted No           → links to vote breakdown
├── 89 SPOs voted on this                    → links to pool participation
├── CC ruling: Constitutional                → links to CC analysis
├── Community signal: 73% support            → links to signal detail
├── Related: 3 similar treasury proposals    → links to related proposals
└── Treasury impact: 2.5M ADA               → links to treasury page
```

On the Governance Health page (`/governance/health`):

```
CONNECTED
├── Lowest component: SPO Participation      → links to pools page
├── Most active DRep this epoch              → links to DRep profile
├── Biggest treasury decision                → links to proposal
├── Your contribution to governance coverage → links to your delegation
└── Historical: compare to epoch 530         → links to epoch report
```

**How the Connected panel works:**

1. **Desktop**: Right-side panel (280px), collapsible. Shows on all pages with entity data. When collapsed, a small "→" icon indicates connections exist.
2. **Mobile**: "See connections" button at the bottom of page content. Opens a sheet with the relationship list.
3. **Each link is bidirectional** — if DRep A's page links to Proposal B, then Proposal B's page links back to DRep A.
4. **Personalized connections first** — "Your DRep," "Your alignment," "Your signal" always appear above generic connections.
5. **Connection count badge** — Entity cards in browse views show a small connection indicator: "12 connections" or a mini graph icon.

**The "Explore Path" feature:**

When users follow connections, the app tracks the path:

```
You → /drep/ada → /proposal/47 → /drep/bob → /governance/committee
                  [Explore Path: 4 hops]  [← Back to start]
```

This creates a breadcrumb trail that's not hierarchical (section → sub-page) but graph-based (I came from here → went here → ended up here). Users can always jump back to any point in their exploration path.

**What this unlocks for each persona:**

| Persona    | Connected graph enables...                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Citizen    | Follow the thread: "My DRep → their vote on this proposal → other DReps who voted differently → should I reconsider my delegation?" |
| DRep       | Competitive context: "This proposal → other DReps' rationales → how my position differs → what my delegators signaled"              |
| SPO        | Governance landscape: "My pool → similar pools → proposals we voted on → how our participation compares"                            |
| Researcher | Data exploration: "This proposal → all voters → voting patterns → historical trends → similar proposals"                            |

**The Emotional Arc:**

- Entry: Reading a DRep profile → notice Connected panel → "Oh, I can see what they voted on" → curiosity (3 seconds)
- During: Follow link to proposal → see community signal → follow to another DRep → "This is how governance connects" → insight (2 minutes)
- Depth: 4 hops deep → "I started at my DRep and ended up understanding the whole treasury debate" → comprehension (5 minutes)
- Return: "I want to check what changed since last time" → revisit connected paths → governance literacy deepens

**Data Requirements:**

- Cross-entity relationship computation: NEEDS_COMPUTATION — precompute entity↔entity links at sync time (M effort)
- Bidirectional link storage: NEEDS_NEW — `entity_connections` table or computed at request time (S effort if computed, M if stored)
- Personal connection prioritization: EXISTS partially — delegation data + alignment data
- Explore path tracking: NEEDS_NEW — client-side navigation history (S effort, pure frontend)
- Connection count per entity: NEEDS_COMPUTATION — count of related entities (S effort if cached during sync)

**What It Removes:**

- Nothing structural — sidebar, sections, routes all stay
- Breadcrumbs on entity pages → REPLACED by explore path (richer, bidirectional)
- The feeling that entity pages are dead ends → every page now leads somewhere

**The Ceiling:** F1 (JTBD): 8/10, F2 (Emotional): 8/10, F3 (Simplicity): 7/10, F4 (Differentiation): 9/10, F5 (Feasibility): 7/10, F6 (Data): 9/10

**What It Sacrifices:** The Connected panel adds visual complexity to every page — one more panel competing for attention. The relationship computation has performance implications (either precomputed and possibly stale, or real-time and possibly slow). The Explore Path feature could be disorienting for users who don't build mental models this way — some users prefer hierarchical navigation ("I know I'm in Governance → Proposals") over graph navigation ("I'm 4 hops from where I started"). The right panel takes screen real estate from content on narrower desktops.

**Effort:** **L** — Connected panel component, relationship computation pipeline, explore path tracking, integration on every entity page, mobile sheet adaptation, performance optimization for precomputed connections.

**The Share Moment:** "I followed a trail from my DRep through 3 proposals and ended up understanding why the treasury debate matters to me personally. Governada connects the dots that other tools leave disconnected." The explore path visualization itself could be shareable — "Here's my governance discovery path this epoch."

---

## Phase 5: Comparative Analysis

| Dimension                 | Current (7 Sections) | A: Living Sidebar          | B: Three Worlds              | C: Connected Graph                 |
| ------------------------- | -------------------- | -------------------------- | ---------------------------- | ---------------------------------- |
| **JTBD Ceiling**          | 6/10                 | 7/10                       | 9/10                         | 8/10                               |
| **Emotional Impact**      | 5/10                 | 7/10                       | 8/10                         | 8/10                               |
| **Simplicity**            | 6/10                 | 8/10                       | 10/10                        | 7/10                               |
| **Differentiation**       | 6/10                 | 7/10                       | 10/10                        | 9/10                               |
| **Feasibility**           | —                    | 9/10                       | 6/10                         | 7/10                               |
| **Data Requirements**     | All exists           | 3 lightweight computations | Action queue + relationships | Relationship graph + path tracking |
| **Effort**                | —                    | S                          | XL                           | L                                  |
| **Structural disruption** | —                    | None                       | Complete restructure         | Additive (no route changes)        |
| **SEO risk**              | —                    | None                       | High (URL migration)         | None                               |
| **Mobile benefit**        | —                    | Low (sidebar is desktop)   | High (3 bottom items)        | Medium (connection sheet)          |
| **What improves most**    | —                    | Daily wayfinding           | Conceptual clarity           | Cross-section discovery            |

**The Question**: Concept B has the highest ceiling and strongest differentiation, but XL effort and high disruption risk. Concept A is the safest bet with real but incremental improvement. Concept C solves the cross-section problem without structural disruption.

The best path: **A + C as a phased hybrid.** The Living Sidebar provides immediate wayfinding improvement (S effort), and the Connected Graph solves the deeper cross-section navigation problem (L effort) — all without the massive disruption of B's complete restructure. B's conceptual clarity ("Act / Explore / Reflect") can inform the mental model without requiring a URL migration.

---

## Phase 6: Recommendation

### Recommended: Concept A (Living Sidebar) + Concept C (Connected Graph) as a phased hybrid, with Concept B's mental model as a design principle

**Why this hybrid wins:**

1. **Zero structural disruption** — Neither A nor C changes routes, sections, or the fundamental IA. Every existing URL, redirect, and SEO ranking is preserved.
2. **Cumulative effect** — A makes the sidebar a live intelligence surface (the "glance"). C makes entity pages interconnected (the "dive"). Together they solve both the "where should I go?" and the "where can I go next?" problems.
3. **Phased delivery** — A ships in a sprint. C ships in a follow-up. No big-bang migration.
4. **B's insight without B's cost** — The "Act / Explore / Reflect" mental model is powerful. We can apply it as a DESIGN PRINCIPLE (organize the Living Sidebar sub-labels around action/exploration/reflection) without restructuring URLs.

### What to steal from Concept B

| From Concept B               | How to apply without restructuring                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Three modes" clarity        | Sidebar section headers get subtle sub-labels: Workspace = "Your actions", Governance = "What's happening", You = "Your identity"                               |
| Action queue aggregation     | Hub page becomes the unified action queue (pending votes + signals + alerts), not just status cards                                                             |
| 3-item bottom bar simplicity | Keep 4-item bottom bar but ensure the 4th item is always the most contextually useful (Match when undelegated, Workspace when DRep, etc.) — already implemented |
| Home = Act for authenticated | Hub content already adapts per persona — double down on making authenticated Hub an action center                                                               |

### Implementation Roadmap

**Layer 1: Living Sidebar (S effort, ship first)**

1. Extend `NavItem` type with optional `contextLabel?: string | (() => string)` field
2. Build lightweight `/api/sidebar-context` endpoint that returns counts/scores per section (cached 5 min)
3. Add section health indicators (green/amber/red dots) based on threshold rules
4. Implement "Pinned" section in sidebar (localStorage, max 5 items, entity quick-links)
5. Mobile: richer badge tooltips on long-press for bottom bar items

Key technical decisions:

- Context labels fetched once on initial load, not per-navigation
- Health indicators computed server-side during sync, not on-demand
- Pinned items stored in localStorage with entity type + ID + label

**Layer 2: Connected Graph (L effort, ship second)**

1. Build `getEntityConnections(entityType, entityId)` function in `lib/data.ts`
2. Add `EntityConnections` component — right panel on desktop, bottom sheet on mobile
3. Integrate on entity pages: DRep profile, proposal detail, pool profile, CC member, governance health
4. Implement Explore Path — client-side navigation history breadcrumb
5. Personal connections first: "Your DRep voted...", "Your alignment..."

Key technical decisions:

- Connections computed at request time (not precomputed) — simpler, always fresh
- Cache connections per entity for 15 minutes (matches data freshness window)
- Limit to 8-10 connections per panel (most relevant, persona-aware)
- Explore Path stored in session state, cleared on new session

**Layer 3: Living Hub (M effort, builds on citizen hub exploration)**

After Layers 1 and 2, the Hub page can evolve from status cards to an action-oriented entry point:

- Pending actions (from action queue aggregation)
- Epoch consequence story (from citizen hub exploration — Concept C: Consequence Engine)
- Connected entities (your DRep, your pool, tracked proposals — using Connected Graph data)

### What to REMOVE from current IA

1. **Static sidebar labels** — Replace with contextual sub-labels. The word "Proposals" tells you nothing; "2 active · 1 expiring" tells you everything.
2. **Breadcrumbs on entity pages** — Replace with Explore Path (richer, bidirectional, tracks your journey). Keep breadcrumbs as fallback for direct-link arrivals.
3. **"Check every section" behavior** — The Living Sidebar eliminates the need to click into each section to see if anything changed. The sidebar scan IS the check.
4. **Entity pages as dead ends** — Connected panel ensures every entity page leads to related content.

### Risk assessment

1. **Sidebar data freshness** — If context labels are stale (showing "0 active proposals" when there are actually 2), trust erodes. Mitigation: server-side cache with aggressive invalidation on sync events. Show "as of X minutes ago" tooltip.

2. **Connected panel information overload** — 10 connections per entity page adds visual weight. Mitigation: collapsed by default on desktop (icon shows connection count), user toggles open. Mobile: behind "See connections" button, never auto-open.

3. **Performance of real-time connections** — Computing entity relationships at request time could be slow for popular entities. Mitigation: limit to 10 connections, use indexed queries, cache for 15 minutes. Profile the top 20 most-viewed entities and optimize those.

4. **Pinned items stale state** — A pinned DRep who retires or a pinned proposal that expires creates confusing navigation. Mitigation: pinned items show current status badge (active/expired/retired). Expired items auto-dim after one session.

### Validation suggestion

Before building Layer 1:

1. **Sidebar scan test**: Show 5 users two screenshots — current static sidebar vs. Living Sidebar with contextual labels. Ask: "Which sidebar tells you more at a glance?"
2. **Time-to-answer test**: "How many active proposals are there?" — measure time with current sidebar (requires clicking into Governance → Proposals) vs. Living Sidebar (visible in sidebar label).

Before building Layer 2: 3. **Dead-end audit**: For 10 real DRep profile visits (PostHog), track what users do after viewing the profile. Do they navigate to related content? Do they bounce? The Connected panel should increase cross-section navigation by 30%+. 4. **Connection relevance test**: For 5 entity pages, manually curate the "Connected" list. Show to users. Ask: "Which connections would you click? Which feel irrelevant?" Use to calibrate relevance scoring.

---

## New Patterns to Add to Library

### Information Architecture & Navigation

#### Living Sidebar — Navigation as Intelligence Surface

- **Source**: This exploration (Governada), inspired by Linear + Ziggma
- **Discovered**: 2026-03-15
- **What it does**: Every sidebar nav item carries a live contextual sub-label (metric, count, or status) and a health indicator (green/amber/red). Transforms static menu into a glanceable intelligence dashboard without changing the IA structure.
- **Why it's remarkable**: Solves the "do I need to check this section?" problem without adding complexity. The sidebar becomes the daily scan, eliminating unnecessary clicks. Zero structural disruption.
- **Applicable to**: Any multi-section SaaS product where users need to monitor activity across areas.
- **Adoption difficulty**: Small — add optional metadata to existing nav items, build lightweight context API.

#### Connected Graph Navigation — Entity Relationship Traversal

- **Source**: This exploration (Governada), inspired by Wikipedia + GitHub cross-linking + Notion bidirectional links
- **Discovered**: 2026-03-15
- **What it does**: Every entity page includes a "Connected" panel showing related entities across the product. Navigation becomes graph traversal — users follow relationships naturally rather than returning to section menus to navigate between related content.
- **Why it's remarkable**: Eliminates entity pages as dead ends. Creates serendipitous discovery paths. Makes the app feel like an interconnected intelligence web rather than a set of folders.
- **Applicable to**: Any product with rich entity relationships (governance platforms, CRMs, project management, knowledge bases).
- **Adoption difficulty**: Medium — requires relationship computation, right panel component, explore path tracking.

#### Three Worlds Simplification (Act / Explore / Reflect)

- **Source**: This exploration (Governada), inspired by Spotify (Home/Search/Library) + Robinhood (progressive expansion)
- **Discovered**: 2026-03-15
- **What it does**: Collapses an entire product into 3 meta-sections mapped to user modes: Act (tasks/actions), Explore (discovery/research), Reflect (identity/history). Persona adaptation happens WITHIN worlds, not by changing which worlds are visible.
- **Why it's remarkable**: Reduces cognitive load from 7 top-level navigation decisions to 3. Maps to universal human interaction modes. No governance tool has attempted this.
- **Applicable to**: Multi-persona products with both action-oriented and information-oriented sections. Best as a mental model/design principle even if not implemented as a literal restructure.
- **Adoption difficulty**: Very hard as a literal restructure (URL migration, SEO, muscle memory). Easy as a design principle applied to existing structure.
