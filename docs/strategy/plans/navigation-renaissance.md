# Navigation Renaissance: World-Class Information Architecture

> **Status:** Phase 1 COMPLETE. Phase 2 COMPLETE (PRs #475, #476, #478). Phases 3+6 executing in parallel.
> **Created:** 2026-03-19
> **Last revised:** 2026-03-19 — Elevation-driven revision: surface-specific benchmarks, D6 guardrails, reordered execution
> **Origin:** `/explore-feature` + `/elevate-feature` craft lens applied to remaining phases
> **Estimated effort:** 10 phases across multiple sessions
> **Prerequisites:** None — each phase is independently shippable

---

## Why This Exists

Governada's navigation architecture is structurally sound — the Three Worlds model (Home/Governance/You), persona adaptation, and density modes are best-in-class in governance tooling. But the navigation _shell_ is passive: a static sidebar, a navigational-only header, and full-page jump cuts between views. The shell doesn't encode governance state, doesn't reveal entity connections, and doesn't reward power users.

The thesis of Governada is that "every data point feeds every other data point." The intelligence engine connects proposals, DReps, citizens, voting patterns, and constitutional alignment into a living network. But the navigation **hides** those connections behind separate pages. Users must assemble the picture in their head by navigating to each page independently.

This plan transforms the navigation shell from a passive link collection into an active intelligence surface — one that reveals connections, encodes governance state, rewards expertise, and makes the engine's power tangible to users.

### AI-First Thesis (Added 2026-03-19)

After building Phases 1-2 (structural canvas), a deep `/explore-feature` through an AI-first lens revealed: **18 intelligence signals are already computed in Governada's backend but never flow into navigation.** Alignment vectors, scoring momentum, GHI components, action queues, temporal context, embeddings — all computed, none surfaced in the shell.

The original plan (Phases 4-9) conceived the later phases as algorithmically-driven (sort entities, compute similarity, tint colors). Through an AI-first lens, they should be **intelligence-powered**:

- **Phase 5 (Intelligence Panel)** → **Governance Co-Pilot Panel** — AI-synthesized contextual briefings, not entity link lists
- **Phase 7 (Living Shell)** → **AI-Composed Hub + Living Shell** — Hub dynamically recomposed by AI, ambient AI annotations inline
- **New Phase 9** → **Conversational Navigation** — Command palette evolves into governance advisor
- **New Phase 10** → **Predictive Navigation** — task-stage detection, next-action prediction, generative UI

Inspiration (surface-specific): Perplexity/WHOOP/Arc (intelligence & briefing), Harvey AI/Elicit (domain trust + citations), Cursor/Linear (workspace), Robinhood/Duolingo (citizen-facing), Spotify/Apple Intelligence (identity).

Anti-patterns to avoid: AI must never be the ONLY way to navigate (Rabbit R1/Humane lesson). Never push AI suggestions uninvited into task-focused views (Windows Copilot lesson). High-stakes actions like voting need predictable, muscle-memory UI (Google "Predictably Smart" framework). Always show AI reasoning on demand (Linear transparency pattern).

**The structural canvas (Phases 1-3) is prerequisite for all AI layers.** The canvas creates the physical space and interaction patterns. What goes ON the canvas — the co-pilot panel, the composed hub, the conversational layer — is now AI-powered.

### The End State Vision

```
┌──────────────────────────────────────────────────────────────────────┐
│ 32px Header: Logo | Breadcrumbs | Epoch Strip | ⌘K | Pulse | Avatar │
├────┬────────────────────────────────────────┬────────────────────────┤
│ 48 │                                        │  320px Intelligence    │
│ px │       Main Content Area                │  Panel (collapsible)   │
│    │       (~1000px on 1440 screen)         │                        │
│ I  │                                        │  Contextual content    │
│ C  │       Content fills the viewport       │  based on current page │
│ O  │       with generous space              │                        │
│ N  │                                        │  [Related entities]    │
│    │       View Transitions between         │  [Quick stats]         │
│ R  │       pages for spatial continuity     │  [Connected insights]  │
│ A  │                                        │  [Entity preview]      │
│ I  │       Ambient governance color         │                        │
│ L  │       tinting the constellation        │  Toggle: ] key         │
│    │                                        │                        │
└────┴────────────────────────────────────────┴────────────────────────┘
  Mobile: 3-item bottom bar + swipe-up intelligence sheet
```

**Surface-specific craft benchmarks:**

- **Cursor/Linear/Notion** (Workspace): Minimal chrome, command-palette-first, keyboard mastery, AI-first workflows
- **Perplexity/WHOOP/Arc** (Intelligence & Briefing): Answer-first, single readiness number, compress/expand
- **Harvey AI/Elicit** (Domain Trust): Cited intelligence, provenance trails, sentence-level citations
- **Spotify/Apple Intelligence** (Identity): Behavioral inference, ambient intelligence at the right moment
- **Robinhood/Duolingo** (Citizen-Facing): Complex domain made comprehensible, adaptive learning

---

## What's Strong (Do NOT Change)

1. **Three Worlds model** — Home/Governance/You is instantly graspable. Keep it.
2. **Persona adaptation** — Different personas see genuinely different products. Keep the nav config centralization.
3. **Studio mode** — Full-screen immersion for workspace review/authoring. Keep.
4. **Density modes** — Browse/Work/Analyze with route-based defaults. Keep.
5. **Constellation globe** — Brand identity. Keep as ambient background, enhance with temporal tinting.
6. **Command palette (cmdk)** — Foundation exists. Enhance significantly but don't replace.
7. **Admin View As** — Testing any persona combination. Keep.
8. **Accessibility** — aria-current, focus rings, semantic HTML. Preserve and extend.

---

## Architecture

### Phase 1: "The Polish Foundation"

**Goal:** Compress the header, add governance state encoding, upgrade the command palette, add micro-interactions. Every pixel of chrome must earn its place.

**Scope:**

#### 1.1 Header Compression (56px → 40px)

Current header is 56px (`h-14`) with generous padding. Compress to 40px (`h-10`):

```
Before: [Logo]  ...spacer...  [⌘K] [Depth] [Bell] [Help] [Lang] [Avatar]
After:  [Logo] [Breadcrumbs ›] ...spacer... [Epoch Strip] [⌘K] [Pulse●] [Bell] [Avatar]
```

**Changes:**

- Height: `h-14` → `h-10`
- Remove Help dropdown from header (move to command palette)
- Remove Depth picker from header (move to command palette as action)
- Remove Language picker from header (move to user menu or command palette)
- Add breadcrumb trail (contextual: `Governance › Proposals › Treasury #42`)
- Add epoch progress strip (thin bar segment showing epoch %, active proposals count, time remaining)
- Add governance pulse dot (single colored circle: green = healthy, amber = active voting, red = urgent deadline)
- Breadcrumbs collapse to `← Back` on mobile

**Key files:**

- `components/governada/GovernadaHeader.tsx` — restructure layout, remove items
- New: `components/governada/EpochStrip.tsx` — thin inline epoch progress
- New: `components/governada/GovernancePulse.tsx` — colored pulse dot
- New: `components/governada/Breadcrumbs.tsx` — contextual breadcrumb trail
- `components/governada/DepthPickerDropdown.tsx` — move to command palette action

#### 1.2 Command Palette Upgrade

Transform from search box to primary navigation + training system:

- **Pre-index at app load** — Fetch DRep/proposal data on mount, not on palette open. Keep in memory (or IndexedDB for large datasets). Target <50ms open-to-interactive.
- **Keyboard shortcut display** — Every result shows its shortcut next to it (Superhuman pattern): `Proposals  G P`, `My Delegation  G D`, `Vote Yes  V Y`
- **Recent destinations** — Top section shows last 5 visited pages
- **Governance context header** — Palette shows `Epoch 542 · 3d 12h · 4 active proposals` at top
- **Persona-aware sections** — DRep palette shows "Cast Vote", "Write Rationale" as top actions. Citizen shows "Check Delegation", "Find DRep".
- **Fuzzy entity search** — Typing "treasury" finds treasury proposals AND DReps who vote on treasury AND the treasury page AND glossary entries
- **Action commands** — "Set governance depth", "Toggle density mode", "Open help" as palette actions

**Key files:**

- `components/CommandPalette.tsx` — major upgrade
- `lib/commandIndex.ts` — expand command registry with shortcuts + persona awareness
- New: `lib/shortcuts.ts` — keyboard shortcut registry and handler

#### 1.3 Micro-interactions & Animation Layer

Small details that separate "good" from "incredible":

- **Hub card stagger** — Cards animate in with 50ms staggered delays (opacity 0→1, translateY 8→0)
- **Number count-up** — Score displays, metric values, and counts animate from 0 to final value on load (300ms ease-out)
- **Score delta indicators** — Show +/- since last visit with green/red color: `72 ↑3`
- **Sidebar item glow** — When new data arrives (notification, pending vote), item glows briefly (1s pulse)
- **Active indicator animation** — Sidebar/bottom bar active indicator slides to new position rather than teleporting (spring animation)
- **Scroll-linked header** — Header background opacity transitions from transparent → glassmorphic (already exists, polish the timing)

**Key files:**

- New: `components/ui/AnimatedNumber.tsx` — count-up number display
- New: `components/ui/StaggeredList.tsx` — stagger animation wrapper
- New: `lib/hooks/useLastVisit.ts` — track last visit timestamp per page for delta computation
- `components/governada/GovernadaSidebar.tsx` — active indicator animation
- `components/governada/GovernadaBottomNav.tsx` — active indicator animation

**Deliverables:**

- [ ] Header compressed to 40px with epoch strip, pulse dot, breadcrumbs
- [ ] Help/Depth/Language removed from header, accessible via palette
- [ ] Command palette pre-indexes data, shows shortcuts, recent destinations, governance context
- [ ] Hub cards stagger-animate on load
- [ ] Score/metric numbers count up on load
- [ ] Active nav indicator slides between items

---

### Phase 2: "The Canvas" ✅ COMPLETE

> **Shipped:** 2026-03-19 (PRs #475, #476, #478)

**Goal:** Replace the 240px sidebar with a 48px icon rail, reclaiming ~192px of content width. The content IS the product — give it maximum space.

**Scope:**

#### 2.1 Icon Rail (replaces sidebar)

```
┌──────────┐
│  [Home]  │  ← Icon only, tooltip on hover
│  [Gov]   │  ← Active: primary dot indicator
│  [You]   │  ← Hover: label slides out (200ms)
│          │
│          │  ← Spacer
│  [Pin1]  │  ← Pinned entities (existing SidebarPinnedItems)
│  [Pin2]  │
│          │
│  ── ──   │  ← Divider
│  [Rail]  │  ← Toggle intelligence panel (Phase 5)
└──────────┘
```

**Behavior:**

- Always visible on desktop (≥1024px), hidden on mobile (bottom bar handles it)
- Icons only, no text. Tooltip on hover shows section name + shortcut (`Home (G H)`)
- Active section: primary-colored dot below icon
- Hover: no expand — keep minimal. Users who want labels use the command palette.
- For dual-role (DRep+SPO): Home icon shows a small "2" badge indicating two workspaces. Clicking opens workspace via palette sub-section.
- Pinned entities section at bottom (compact, icon-only with first letter)
- Rail width: 48px. Content padding-left: 48px.

**Sub-page navigation (replaces sidebar sub-items):**

- Desktop: section pages show a horizontal tab bar below the page header (like current pill bar but for desktop too)
- This tab bar shows sub-pages within the current section with subtle count badges
- Mobile: existing pill bar pattern (already exists, extend to desktop as section tab bar)

**Content width gain:**
| Screen | Before (sidebar expanded) | After (icon rail) | Gain |
|--------|--------------------------|-------------------|------|
| 1440px | ~1136px | ~1344px | +208px |
| 1280px | ~996px | ~1184px | +188px |
| 1024px | ~740px | ~928px | +188px |

**Key files:**

- `components/governada/GovernadaSidebar.tsx` — replace entirely with `NavigationRail.tsx`
- New: `components/governada/NavigationRail.tsx` — 48px icon rail
- New: `components/governada/SectionTabBar.tsx` — horizontal sub-page tabs (desktop+mobile unified)
- `components/governada/GovernadaShell.tsx` — update padding-left from `lg:pl-60`/`lg:pl-16` to `lg:pl-12`
- `components/governada/SectionPillBar.tsx` — evolve into SectionTabBar (show on desktop too)
- `lib/nav/config.ts` — simplify: no collapse state, no expanded/collapsed variants

#### 2.2 Bottom Bar Reduction (4 → 3 items)

Mobile bottom bar reduced from 4 to 3 items, gaining vertical content density:

| Persona               | Item 1 | Item 2     | Item 3 |
| --------------------- | ------ | ---------- | ------ |
| Anonymous             | Home   | Governance | Match  |
| Citizen (undelegated) | Home   | Governance | Match  |
| Citizen (delegated)   | Home   | Governance | You    |
| DRep                  | Home   | Governance | You    |
| SPO                   | Home   | Governance | You    |
| CC                    | Home   | Governance | You    |

Help moves to command palette. Match moves to command palette for authenticated users who've completed matching. The 3-item bar feels cleaner and gives each item more touch target width.

**Deliverables:**

- [ ] 240px sidebar replaced with 48px icon rail
- [ ] SectionTabBar renders sub-pages horizontally on desktop and mobile
- [ ] Content area gains ~190px width on all screen sizes
- [ ] Mobile bottom bar reduced to 3 items
- [ ] Sidebar collapse toggle removed (no collapse state — rail is permanent)
- [ ] Pinned entities display in icon rail

---

### Phase 3: "Peek & Browse"

**Goal:** Eliminate pogo-stick navigation. On any list page, users can inspect entities without leaving the list.

**Scope:**

#### 3.1 Entity Peek Drawer

A slide-in panel from the right (400px) that shows entity details while the list remains visible and interactive:

```
┌────┬────────────────────┬───────────────────┐
│Rail│  Proposal List     │  Peek Drawer      │
│    │                    │  400px, slide-in   │
│    │  [Proposal A]      │                    │
│    │  [Proposal B] ←    │  Title: Prop B     │
│    │  [Proposal C]      │  Status: Voting    │
│    │  [Proposal D]      │  Yes: 62% | No: 38%│
│    │                    │  Your DRep: Yes    │
│    │                    │  [Open full →]     │
│    │                    │  [Close ✕]         │
└────┴────────────────────┴───────────────────┘
```

**Trigger:** Space key on focused list item, or click a peek icon (eye icon on hover)
**Close:** Escape, click outside, or Space on a different item (replaces content)
**Navigate:** Arrow keys move through list, drawer updates to show hovered/focused item (like email clients)

**Entity peek variants:**

- **Proposal peek:** Title, status, vote power bars (Yes/No/Abstain), time remaining, your DRep's vote, constitutional alignment score, "Open full →"
- **DRep peek:** Name, tier badge, score (4 pillars mini), alignment match %, delegation count, recent 3 votes summary, "Open full →"
- **Pool peek:** Name, governance score, operator identity status, delegator count, voting participation rate, "Open full →"
- **CC Member peek:** Name, fidelity score, vote record summary, constitutional compliance rate, "Open full →"

**Key files:**

- New: `components/governada/PeekDrawer.tsx` — slide-in drawer shell with animation
- New: `components/governada/peeks/ProposalPeek.tsx` — proposal peek content
- New: `components/governada/peeks/DRepPeek.tsx` — DRep peek content
- New: `components/governada/peeks/PoolPeek.tsx` — pool peek content
- New: `components/governada/peeks/CCMemberPeek.tsx` — CC member peek content
- `lib/shortcuts.ts` — Space key handler for peek
- Existing list pages: add peek trigger to list items

**Mobile behavior:**

- Peek triggered by long-press or swipe-left on list item
- Opens as bottom sheet (half-screen), not side drawer
- Swipe down to close

**Deliverables:**

- [ ] PeekDrawer component with slide-in animation (400px from right)
- [ ] Proposal, DRep, Pool, CC Member peek content variants
- [ ] Space key + peek icon trigger on all list pages
- [ ] Arrow key navigation updates peek content
- [ ] Mobile: bottom sheet variant with long-press trigger
- [ ] Escape to close, outside click to close

---

### Phase 4: "AI Navigation Data Layer"

**Goal:** Build the backend intelligence pipeline that powers AI-first navigation. This phase is pure backend — no UI changes. It wires 18 existing intelligence signals into navigation-consumable APIs AND adds new AI synthesis capabilities.

**AI-First Rationale:** The codebase already computes 6D alignment vectors, scoring momentum, GHI components, action queues, temporal context, and semantic embeddings — but none of these flow into navigation decisions. This phase creates the intelligence-to-navigation pipeline.

**Scope:**

#### 4.1 Entity Similarity Network (EXISTS → WIRE)

DRep and proposal similarity using existing infrastructure:

- **DRep similarity**: Cosine distance in 6D alignment space (alignment vectors already computed)
  - Store top-10 most similar DReps per DRep in `drep_similarity` table
  - Recompute after each epoch sync via Inngest
  - API: `GET /api/dreps/[drepId]/similar`
- **Proposal similarity**: Leverage existing pgvector embeddings (already deployed)
  - API: `GET /api/proposals/[key]/related`
  - Filter by governance action type, treasury tier, constitutional articles

#### 4.2 Constitutional Article Mapping (NEEDS_COMPUTATION)

AI-powered proposal-to-constitution mapping:

- For each proposal, AI identifies relevant constitutional articles using existing skills engine
- Store in `proposal_constitutional_refs` table
- API: `GET /api/proposals/[key]/constitutional`

#### 4.3 Governance State Composite (EXISTS → AGGREGATE)

Single endpoint aggregating ALL governance + user state for shell and Co-Pilot:

- **Urgency** (0-100): proposals expiring within 48h + uncast DRep votes + epoch proximity + GHI trend
- **Temperature** (0-100): proposal volume vs. rolling average + participation rate + rationale rate + sentiment activity
- **User state** (when authenticated): delegation status, DRep health, pending actions, alignment alerts, score changes
- **Epoch context**: epoch progress, time remaining, active proposal count
- API: `GET /api/intelligence/governance-state?stakeAddress=[addr]` (cached 5min, user-specific when authenticated)
- Powers: Governance Pulse dot, temporal mode, Co-Pilot readiness signal, Hub card ordering

#### 4.4 Contextual AI Synthesis Endpoint (NEW — powers Co-Pilot)

A new API route that orchestrates existing AI skills + data to produce contextual intelligence for any page:

- **Input**: `{ pathname, userStakeAddress, entityId? }`
- **Output**: AI-synthesized contextual briefing tailored to the current page + user
- **Orchestration**: Calls existing `assemblePersonalContext()`, queries relevant data (scores, alignment, votes, proposals), invokes appropriate AI skill for synthesis
- **Route-specific synthesis**:
  - Proposal page: constitutional concerns + community sentiment + user's DRep position + precedent analysis
  - DRep page: alignment match + score trajectory + delegation impact + key divergences
  - Hub: personalized governance briefing + priority actions + governance state narrative
  - List pages: trending signals + personalized highlights
- **Caching**: Redis-cached per user+route for 5min (Upstash already deployed)
- **Latency target**: < 3s for first load, < 500ms cached
- API: `GET /api/intelligence/context?path=[pathname]`

#### 4.5 Alignment-Driven Priority API (EXISTS → WIRE)

Compute navigation priority scores using existing alignment data:

- Take user's 6D alignment vector + current governance state
- Score each active proposal by relevance to user's alignment profile
- Return sorted priority queue: "most relevant to you" ordering
- API: `GET /api/intelligence/priority?stakeAddress=[addr]`
- **Why this matters**: This is the first time Governada's alignment engine drives what users SEE, not just what they search for

#### 4.6 ~~User Governance State Composite~~ (ABSORBED INTO 4.3)

> Consolidated into section 4.3 Governance State Composite. Single API endpoint now returns user state alongside urgency, temperature, and epoch context.

**Key files:**

- New: `lib/intelligence/` — intelligence pipeline module
- New: `lib/intelligence/context.ts` — contextual AI synthesis
- New: `lib/intelligence/priority.ts` — alignment-driven priority scoring
- New: `lib/intelligence/governance-state.ts` — consolidated governance + user state
- New: `lib/similarity.ts` — DRep similarity computation
- New API routes: similarity, constitutional, intelligence/governance-state, intelligence/context, intelligence/priority
- New Inngest function: `compute-similarity-network`, `compute-navigation-priority`
- New migration: `drep_similarity`, `proposal_constitutional_refs` tables

**Deliverables:**

- [ ] DRep similarity network + API
- [ ] Proposal similarity API (leveraging existing embeddings)
- [ ] Constitutional article mapping + API
- [ ] Consolidated governance state API (urgency + temperature + user state + epoch context)
- [ ] Contextual AI synthesis endpoint (the Co-Pilot brain)
- [ ] Alignment-driven navigation priority API
- [ ] Inngest functions for recomputation
- [ ] Database migrations

---

### Phase 5: "The Governance Co-Pilot"

**Goal:** The crown jewel. A contextual right-side panel powered by AI-synthesized intelligence — not entity link lists, but briefings that tell you what this means for YOUR governance position, with reasoning and citations. This is what makes Governada feel like a governance advisor, not a data browser.

**Scope:**

#### 5.1 Panel Shell

```
┌──────────────────────────────────────┐
│ [Title: Related] [Collapse ▸] [×]   │  ← Panel header (sticky)
├──────────────────────────────────────┤
│                                      │
│  Panel content (scrollable)          │  ← Route-based content
│  Changes based on current page       │
│                                      │
│  Sections with collapsible headers   │
│  Entity cards are clickable          │
│  (open inline preview OR navigate)   │
│                                      │
└──────────────────────────────────────┘
```

- Width: 320px on screens ≥1440px, 280px on 1280-1439px, hidden below 1280px (available via toggle)
- Toggle: `]` key, or rail icon at bottom of NavigationRail
- State persisted in localStorage
- Animate: slide in/out from right (200ms ease-out)
- Panel respects density modes (spacing, type size)
- `bg-background/60 backdrop-blur-xl` to match existing glassmorphic language

#### 5.2 AI-Powered Panel Content Router

**Craft benchmarks:** Perplexity (cited intelligence), WHOOP (single readiness number), Arc Browser (compress/expand).

The panel leads with a **Governance Readiness Signal** — a single compressed number/visual (WHOOP pattern) summarizing the user's governance position (delegation health + pending actions + alignment drift + epoch urgency). Below it, route-specific sections default to **compressed state** (Arc pattern) — one-line summaries that expand on interest.

The panel calls the Phase 4 contextual AI synthesis endpoint (`/api/intelligence/context`) and renders the response. Each route gets a unique AI-synthesized briefing:

| Current Route                 | AI Briefing Content                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/` (Hub)                     | **Personalized governance briefing**: "3 proposals need attention. Your DRep voted Yes on treasury withdrawal — aligned with your preferences. GHI stable at 72. _Next action: review proposal X expiring in 48h._"                              |
| `/proposal/[hash]/[i]`        | **Proposal intelligence**: Constitutional concerns with article citations · Community sentiment synthesis · Your DRep's position + reasoning · Precedent analysis ("2 similar proposals were rejected in Epoch 520") · Impact on your delegation |
| `/drep/[id]`                  | **DRep intelligence**: Alignment match with YOUR values (6D radar) · Score trajectory + reasoning ("improving because rationale quality up 15%") · Key divergences from your preferences · Similar DReps · Delegation impact if you switched     |
| `/governance/proposals`       | **Governance briefing**: Temperature + urgency · "3 proposals match your alignment profile" · Most debated proposal with sentiment summary · Trending governance themes                                                                          |
| `/governance/representatives` | **Landscape intelligence**: Your delegation health · DReps gaining/losing momentum with reasoning · Alignment distribution shifts · "DReps most aligned with your values"                                                                        |
| `/governance/health`          | **GHI narrative**: "Governance health declined 3 points this epoch because deliberation quality dropped — fewer DReps writing rationales" · Component trends with explanations                                                                   |
| `/workspace/*`                | **Action intelligence**: Priority-ranked action queue with reasoning · Score projection · "If you vote on these 3 proposals, your engagement pillar improves ~8 points"                                                                          |
| Any entity page               | **Connection intelligence**: Related entities with REASONING for why they're related, not just similarity scores                                                                                                                                 |

**Key difference from original plan**: The panel shows AI-synthesized narrative intelligence, not static data lists. Every claim includes **inline source citations** (Perplexity pattern) — linked to source data, not just hover-to-verify. Users see the provenance chain: data → reasoning → conclusion. Sections default to compressed state (Arc pattern) and expand on user interest.

#### 5.3 Panel Entity Preview

When the panel shows entity links (e.g., "Related Proposals" on a DRep page), clicking one shows an inline preview within the panel:

- Panel content slides left, preview slides in from right (breadcrumb style)
- Preview shows entity summary (same content as peek drawer, but within panel dimensions)
- "← Back to Related" at top returns to previous panel content
- "Open full page →" navigates to the entity page

This creates a mini-browsing experience within the panel — users can explore 3-4 connected entities without ever leaving their current page.

#### 5.4 Mobile: Intelligence Bottom Sheet

On mobile (<1024px), the intelligence panel becomes a bottom sheet:

- **Peek bar** (always visible, 40px): thin bar at bottom showing 1-line context hint ("3 related proposals · Your DRep voted Yes"). Tapping or swiping up opens the sheet.
- **Half-sheet** (default): opens to 50% screen height with scrollable panel content
- **Full-sheet**: drag up to 85% height for longer content
- **Close**: drag down past 30% threshold or tap outside
- Sheet respects `safe-area-inset-bottom`

**Key files:**

- New: `components/governada/IntelligencePanel.tsx` — panel shell + toggle
- New: `components/governada/panel/PanelRouter.tsx` — route-based content switcher
- New: `components/governada/panel/HubPanel.tsx` — Hub context panel
- New: `components/governada/panel/ProposalPanel.tsx` — Proposal context panel
- New: `components/governada/panel/DRepPanel.tsx` — DRep context panel
- New: `components/governada/panel/GovernancePanel.tsx` — Governance section panel
- New: `components/governada/panel/ListPanel.tsx` — Generic list page panel
- New: `components/governada/panel/EntityPreview.tsx` — inline entity preview within panel
- New: `components/governada/panel/MobileIntelSheet.tsx` — mobile bottom sheet
- New: `components/governada/panel/PeekBar.tsx` — mobile peek hint bar
- New: `hooks/useIntelligencePanel.ts` — panel state management (open/closed, width, route)
- `components/governada/GovernadaShell.tsx` — integrate panel into layout
- `components/governada/NavigationRail.tsx` — add panel toggle icon

**Deliverables:**

- [ ] IntelligencePanel shell with toggle (] key), glassmorphic styling, resize handle
- [ ] PanelRouter with content for all major routes (Hub, Governance sub-pages, entity detail pages, You, Workspace)
- [ ] EntityPreview for inline entity browsing within panel
- [ ] Mobile bottom sheet with peek bar hint
- [ ] Panel state persisted in localStorage
- [ ] Panel respects density modes
- [ ] Connected to Phase 4 APIs (similarity, constitutional, urgency, temperature)

---

### Phase 6: "Spatial Continuity"

**Goal:** Eliminate the jarring "page disappears, new page appears" feeling. Pages slide, morph, and transition with spatial logic.

**Scope:**

#### 6.1 View Transitions API

- Wrap all route changes with View Transitions API (`document.startViewTransition()`)
- **Direction logic**: navigating deeper (list → detail) slides content left. Navigating back (detail → list) slides content right. Sibling navigation (tab to tab) crossfades.
- **Shared elements**: entity cards on list pages share a `view-transition-name` with the page header on detail pages. The card header morphs into the page title during transition.
- **Constellation persistence**: the background globe maintains position through all transitions (it's already fixed-position — ensure it's excluded from transition animation)
- **Progressive enhancement**: feature-detect `document.startViewTransition`. Browsers without support get instant navigation (current behavior). No degradation, just no animation.

#### 6.2 Navigation Indicator Animations

- **Icon rail active dot**: slides vertically to the active section with spring physics (not teleport)
- **Bottom bar active indicator**: slides horizontally between items
- **Section tab bar**: active tab underline slides to new position
- **Breadcrumb transitions**: new breadcrumb segments slide in from right, removed segments slide out left

#### 6.3 Content Entry Animations

- Pages animate in with subtle translateY(8px → 0) + opacity(0 → 1) on mount
- Stagger children within pages (cards, list items, sections) with 30-50ms delays
- Keep animations short (200-300ms) — they should be felt, not watched
- Respect `prefers-reduced-motion` — disable all animations when user prefers

#### 6.4 Temporal Mode Detection (moved from Phase 7)

Compute current governance temporal mode from the Phase 4 governance state API:

- **Urgent** (urgency score ≥70): Multiple proposals expiring within 48h, or epoch ending with uncast DRep votes
- **Active** (urgency 40-69): Active proposals in voting, normal governance activity
- **Calm** (urgency <40): No urgent proposals, analysis/research period

Mode affects:

- Hub card ordering (urgent: action cards first, calm: insight cards first)
- Governance pulse dot color (red/amber/green — already in Phase 1)
- Constellation globe ambient tint (see 6.5)
- Bottom bar adaptive slot (Phase 7)

#### 6.5 Ambient Governance Color (moved from Phase 7)

The constellation globe background subtly shifts color based on governance temperature:

- **Cool blue** (temperature <30): quiet governance period. Globe feels calm, serene.
- **Neutral** (temperature 30-60): normal activity. Current default appearance.
- **Warm amber** (temperature 60-80): active governance. Increased proposal volume, voting activity.
- **Urgent red tint** (temperature >80): intense governance moment. Major proposals, contested votes, high participation.

Implementation: CSS custom property `--governance-tint` applied as a very subtle (10-15% opacity) color overlay on the constellation container. Transitions smoothly (2s ease) when temperature changes.

**Key files:**

- New: `lib/viewTransitions.ts` — View Transitions wrapper with direction logic
- New: `components/ui/ViewTransitionLink.tsx` — Link component that triggers transitions
- New: `components/ui/PageTransition.tsx` — page entry animation wrapper
- `components/governada/NavigationRail.tsx` — active indicator spring animation
- `components/governada/GovernadaBottomNav.tsx` — active indicator slide animation
- `components/governada/SectionTabBar.tsx` — active underline slide
- `components/governada/Breadcrumbs.tsx` — segment transition animations
- `app/globals.css` — `@view-transition` CSS rules, `::view-transition-*` pseudo-element styling, `--governance-tint` overlay
- New: `hooks/useGovernanceMode.ts` — temporal mode detection from governance state API
- New: `hooks/useGovernanceTemperature.ts` — temperature-to-color mapping

**Deliverables:**

- [ ] View Transitions API integration with direction logic
- [ ] Shared element transitions for entity cards → detail pages
- [ ] Navigation indicator animations (rail, bottom bar, tab bar)
- [ ] Content entry animations with stagger
- [ ] `prefers-reduced-motion` respected globally
- [ ] Progressive enhancement (graceful fallback)
- [ ] Temporal mode detection (urgent/active/calm) from governance state API
- [ ] Constellation globe ambient tinting based on governance temperature

---

### Phase 7: "AI-Composed Hub + Ambient Intelligence"

**Goal:** Hub cards gain AI-generated one-line insights (Perplexity cited intelligence pattern), and ambient AI annotations appear inline on content pages with provenance trails (Harvey/Elicit pattern). Temporal mode detection and ambient governance color are now in Phase 6.

**Craft benchmarks:** WHOOP (readiness dashboard, not entertainment feed), Perplexity (cited intelligence), Harvey AI/Elicit (domain-grounded annotations with sentence-level citations).

> **Note:** Temporal mode detection and ambient governance color from the original plan are now in Phase 6 (sections 6.4 and 6.5).

**Scope:**

#### 7.1 AI-Enhanced Hub Cards

Hub cards gain AI-generated intelligence, making the Hub feel like a governance readiness dashboard (WHOOP pattern):

- **Card ordering**: Temporal mode (Phase 6) drives card priority — urgent cards first during voting periods, insight cards during calm periods. This is algorithmic, not AI.
- **AI-generated card insights**: Each card includes a Perplexity-style one-line insight with source citation: "Your DRep voted against a proposal you signaled support for [↗ Vote record]" instead of static "Delegation Status: Active."
- **Predictable card set**: Cards do NOT appear/disappear based on AI decisions — users need dashboard predictability. The SAME cards are always present; only their content and order adapt.
- **Animated reordering**: Cards slide to new positions with spring transitions (300ms) when temporal mode changes.

#### 7.2 Ambient AI Annotations

AI-generated intelligence appears inline on content pages — woven INTO the content, with Harvey AI/Elicit-grade provenance:

- **Proposal text**: Constitutional risk indicators per section with article citations and AI reasoning on demand ("⚠ May conflict with Article 3.2 — [Show reasoning]")
- **DRep profiles**: Alignment drift badge with data trail ("↗ Drift: 15% since you delegated [↗ Show divergence history]")
- **Score displays**: AI-generated "why" tooltips with source data ("Score improved because rationale quality increased [↗ 3 new rationales]")
- **List pages**: "Relevant to you" badges on items matching alignment profile, with reasoning link

Each annotation includes a **provenance chain**: source data → AI reasoning → conclusion. Users can trace any annotation back to its evidence (Elicit sentence-level citation pattern). Annotations are computed server-side and appear as subtle visual markers — always available, never intrusive.

#### 7.3 Context-Adaptive Bottom Bar

One bottom bar slot becomes context-adaptive:

| Persona                    | Fixed Slot 1 | Fixed Slot 2 | Adaptive Slot 3             |
| -------------------------- | ------------ | ------------ | --------------------------- |
| DRep (voting period)       | Home         | Governance   | **Vote** (with count badge) |
| DRep (calm period)         | Home         | Governance   | You                         |
| Citizen (undelegated)      | Home         | Governance   | **Match**                   |
| Citizen (delegated, alert) | Home         | Governance   | **You** (with alert badge)  |
| Citizen (delegated, calm)  | Home         | Governance   | You                         |

The adaptive slot transitions with a subtle crossfade when context changes.

**Key files:**

- Hub page components — add AI-generated insight lines to cards
- New: `lib/intelligence/hub-insights.ts` — AI insight generation for hub cards
- New: `components/governada/annotations/` — ambient annotation components
- New: `components/governada/annotations/ConstitutionalRisk.tsx` — proposal annotation
- New: `components/governada/annotations/AlignmentDrift.tsx` — DRep annotation
- New: `components/governada/annotations/ScoreExplainer.tsx` — score annotation
- `components/governada/GovernadaBottomNav.tsx` — adaptive slot logic
- `lib/nav/config.ts` — temporal mode for bottom bar item selection

**Deliverables:**

- [ ] AI-generated one-line insights on Hub cards with Perplexity-style source citations
- [ ] Hub card ordering driven by temporal mode (from Phase 6)
- [ ] Ambient AI annotations on proposal, DRep, and score pages with provenance chains
- [ ] Context-adaptive bottom bar slot
- [ ] All annotations traceable to source data (Harvey/Elicit standard)

---

### Phase 8: "Keyboard Mastery"

**Goal:** Power users never touch the mouse. Every action has a discoverable keyboard shortcut.

**Scope:**

#### 8.1 Keyboard Shortcut System

Global keyboard shortcuts registered via the `CommandRegistry` (from workspace foundation):

**Navigation shortcuts (G + key):**

```
G H = Go Home              G P = Go Proposals
G R = Go Representatives   G T = Go Treasury
G C = Go Committee          G E = Go Health (GHI)
G Y = Go You               G M = Go Match
G W = Go Workspace         G S = Go Settings
```

**Action shortcuts (single key, context-dependent):**

```
V Y = Vote Yes             V N = Vote No
V A = Vote Abstain         R   = Write Rationale (proposal page)
N   = Next item            P   = Previous item
Space = Peek entity        Escape = Close drawer/panel
]   = Toggle intelligence panel
/   = Focus search (within lists)
?   = Show shortcut help overlay
```

**Density/Mode shortcuts:**

```
Cmd+Shift+M = Cycle density mode
Cmd+Shift+] = Toggle intelligence panel
```

#### 8.2 Shortcut Hints

In Work and Analyze density modes, interactive elements show subtle shortcut hints:

- Vote buttons show tiny key labels: `[Y]` on Vote Yes, `[N]` on Vote No
- Navigation items show shortcut in tooltip: "Proposals (G P)"
- Command palette results show shortcuts (already in Phase 1)
- Hide hints in Browse mode (keep it clean for casual users)

#### 8.3 Shortcut Help Overlay

Pressing `?` opens a full-screen overlay showing all available shortcuts:

- Grouped by category (Navigation, Actions, Panels, Modes)
- Shows context-dependent shortcuts (current page highlighted)
- Dismisses with Escape or another `?`
- Beautiful dark glassmorphic card layout

**Key files:**

- `lib/shortcuts.ts` — expand from Phase 1 with full shortcut registry
- New: `components/governada/ShortcutHints.tsx` — subtle key labels on interactive elements
- New: `components/governada/ShortcutOverlay.tsx` — full-screen help overlay
- `components/CommandPalette.tsx` — shortcut display (from Phase 1)
- `components/providers/ModeProvider.tsx` — hint visibility based on density mode

**Deliverables:**

- [ ] Full keyboard shortcut system (navigation + actions + panels + modes)
- [ ] Shortcut hints on interactive elements (Work/Analyze modes only)
- [ ] Shortcut help overlay (`?` key)
- [ ] Context-dependent shortcuts (e.g., vote shortcuts only on proposal pages)
- [ ] All shortcuts discoverable via command palette

---

### Phase 9: "Conversational Navigation"

**Goal:** The command palette's conversational mode — users express governance intent and receive AI-synthesized answers with embedded entity cards and action components. Scoped to conversational core only; natural language filters and proactive suggestions evaluated separately for ROI.

**Craft benchmarks:** Perplexity (answer-first with citations), Harvey AI (domain-grounded governance intelligence).

**D6 Guardrail:** Each conversational feature must prove it's higher-impact than the best non-AI alternative. Well-designed structured filters beat NL for simple queries; NL wins only for complex multi-attribute governance queries.

**Scope:**

#### 9.1 Governance Advisor in Command Palette

The command palette (⌘K, already built) adds a conversational mode:

- **Detection**: If user input is a question or intent statement (not a command/search), route to AI
- **Examples**:
  - "Which proposals affect treasury reserves?" → synthesized answer with proposal links
  - "How is my DRep performing?" → personalized accountability briefing
  - "Prepare me for voting this epoch" → prioritized action queue with constitutional analysis
  - "Find DReps aligned with my values" → matching results with alignment reasoning
  - "What happened in governance this week?" → epoch briefing
- **Response format**: AI response rendered as rich content within palette — text with embedded entity cards, action buttons, and data visualizations (Vercel generative UI pattern)
- **Follow-up**: Users can ask follow-up questions without re-opening palette
- **Latency**: First token < 1s (streaming). Full response < 5s.

#### 9.2 Natural Language Filters (EVALUATE SEPARATELY)

> **D6 check:** Only for complex multi-attribute queries where structured filters genuinely can't serve. Simple filters with good copy (D3) beat NL for most use cases. Evaluate ROI independently before building.

On list pages, the search/filter bar could accept natural language for complex governance queries:

- "DReps who voted against the last 3 treasury withdrawals" → filtered + sorted (NL wins)
- "Proposals my DRep hasn't voted on yet" → filtered (simple filter may suffice)
- The AI translates intent to existing filter/sort parameters — no new data queries needed

#### 9.3 Proactive Suggestions (EVALUATE SEPARATELY)

> **D6 check:** Tension with anti-pattern "never push AI suggestions uninvited." Must pass the "would users feel this within 3 sessions?" test. High discoverability bar. Evaluate ROI independently.

If implemented, suggestions appear as a subtle prompt below the palette input — never blocking, always dismissible:

- After voting: "Write a rationale for this vote? (AI draft ready)"
- After delegating: "Set up alerts for your new DRep?"
- On Hub during epoch boundary: "Review your governance Wrapped for this epoch?"

**Key files:**

- `components/CommandPalette.tsx` → major upgrade with AI routing
- New: `lib/intelligence/advisor.ts` — conversational AI orchestration
- New: `components/commandpalette/AIResponse.tsx` — rich AI response renderer
- New: `components/commandpalette/NaturalLanguageFilter.tsx` — intent-to-filter translator
- Existing: `lib/ai/skills/` — extend with navigation-oriented skills

**Deliverables:**

- [ ] Conversational mode in command palette (question detection → AI routing)
- [ ] Rich response rendering with embedded entity cards and actions
- [ ] Follow-up conversation support
- [ ] Natural language filters on list pages
- [ ] Proactive suggestions based on governance state
- [ ] Streaming responses with < 1s first token

---

### Phase 10: "Mobile Brilliance"

**Goal:** Mobile isn't a compromise — it's a first-class experience with touch-native interactions.

**Craft benchmarks:** Robinhood (complex domain made instantly comprehensible on mobile), Duolingo (adaptive progressive learning).

**Discoverability check:** Every gesture must pass the "would users discover and feel this within 3 sessions?" test. Hidden gestures (edge swipe) are lower priority than visible interactions.

**Scope:**

#### 10.1 Gesture Navigation

- **Swipe between sections**: Horizontal swipe on main content area switches between Home/Governance/You. Subtle haptic feedback (if available via navigator.vibrate).
- **Edge swipe**: Swipe from left edge (20px) reveals full navigation menu (sheet-style, like iOS apps). Shows all section links + sub-pages for current section.
- **Pull to refresh**: On Hub and list pages, pull-to-refresh triggers data refetch. Custom animation using governance-themed spinner.

#### 10.2 Touch-Optimized Peek

- Long-press (300ms) on any entity in a list → bottom sheet preview (50% height)
- Swipe up on bottom sheet → expand to 85%
- Swipe down → dismiss
- Tap "Open full" → navigate to entity page with sheet-to-page transition animation

#### 10.3 Compact Bottom Bar

3-item bottom bar with larger touch targets (each item gets 33% width instead of 25%):

- Taller icons (24px instead of 20px)
- Active indicator: filled background pill instead of underline (more visible on small screens)
- Badge counts positioned clearly

#### 10.4 Intelligence Sheet Polish

- The peek bar at bottom (from Phase 5) shows context-relevant 1-liner
- Tapping opens intelligence sheet to 50% height
- Content scrollable within sheet
- Entity links within sheet open entity peek (sheet-within-sheet, max 2 levels)
- Smooth spring animations on all sheet interactions

**Key files:**

- New: `hooks/useSwipeNavigation.ts` — horizontal swipe detection for section switching
- New: `components/governada/EdgeSwipeMenu.tsx` — left-edge swipe navigation sheet
- `components/governada/GovernadaBottomNav.tsx` — 3-item layout, larger targets, pill indicator
- `components/governada/panel/MobileIntelSheet.tsx` — polish from Phase 5
- `components/governada/PeekDrawer.tsx` — long-press trigger + bottom sheet variant

**Deliverables:**

- [ ] Horizontal swipe navigation between sections
- [ ] Edge swipe menu for full navigation access
- [ ] Long-press entity peek as bottom sheet
- [ ] 3-item bottom bar with larger touch targets
- [ ] Intelligence bottom sheet polish with spring animations
- [ ] Pull-to-refresh on Hub and list pages

---

## Dependency Graph

```
Phase 1 (Polish Foundation) ✅ COMPLETE
   ↓
Phase 2 (Canvas / Icon Rail) ✅ COMPLETE
   ↓
Phase 3 (Peek & Browse)     Phase 6 (Spatial + Temporal) ← PARALLEL, independent
   ↓                              ↓
Phase 4 (AI Data Layer)     Phase 8 (Keyboard Mastery) ← PARALLEL, independent
   ↓
Phase 5 (Governance Co-Pilot) ← needs Phase 4
   ↓
Phase 7 (AI Hub + Ambient Intelligence) ← needs Phase 4 + 5 APIs
   ↓
Phase 9 (Conversational Core) ← needs Phase 4 + 5
   ↓
Phase 10 (Mobile Brilliance) ← needs Phase 3 + 5

Revised execution order (elevation-optimized for craft-per-effort):
1 ✅ → 2 ✅ → [3 + 6 in parallel] → [4 + 8 in parallel] → 5 → 7 → 9 → 10
```

## Parallelization Opportunities

- **Phase 3 + Phase 6**: Peek drawers (frontend) and Spatial Continuity + Temporal Mode (animations + governance state) are fully independent
- **Phase 4 + Phase 8**: AI Data Layer (backend) and Keyboard Mastery (frontend) are fully independent
- **Phase 9 + Phase 10**: Conversational (AI) and Mobile (touch) can parallel after Phase 5

## Migration Strategy

Each phase is independently shippable and backwards-compatible:

- **Phase 1**: Additive — header changes are non-breaking. Command palette upgrade is backwards-compatible.
- **Phase 2**: Breaking change to sidebar. Ship as feature-flagged toggle first (`navigation_rail` flag). Users can switch between sidebar and rail during preview period.
- **Phase 3**: Additive — peek drawers don't replace existing navigation, they supplement it.
- **Phase 4**: Backend only — no UI impact until Phase 5.
- **Phase 5**: Additive — panel is collapsible, defaults to closed on first visit. Users discover it naturally.
- **Phase 6**: Progressive enhancement — no degradation for browsers without View Transitions support. Temporal mode + ambient color are subtle enhancements.
- **Phase 7**: Additive — AI card insights and annotations are subtle enhancements to existing content.
- **Phase 8**: Additive — shortcuts are discoverable but not required. All actions remain clickable.
- **Phase 9**: Conversational core only — NL filters and proactive suggestions evaluated separately for ROI.
- **Phase 10**: Mobile-only — no impact on desktop experience.

## Success Metrics

After full rollout, the navigation renaissance should achieve:

- **Content viewport ratio**: ≥90% of screen width dedicated to content (from ~79% with expanded sidebar)
- **Navigation efficiency**: ≤2 interactions to reach any page from any other page (via ⌘K or shortcuts)
- **Pogo-stick reduction**: ≥50% reduction in list→detail→back→list navigation patterns (measured via PostHog)
- **Power user velocity**: DRep workspace users complete vote+rationale in ≤3 keyboard-only interactions
- **Mobile engagement**: intelligence sheet opened by ≥30% of mobile users within first 3 sessions
- **Emotional response**: "This feels like a premium product" in user feedback (qualitative)

## Feature Flags

| Flag                  | Phase | Purpose                                       |
| --------------------- | ----- | --------------------------------------------- |
| `navigation_rail`     | 2 ✅  | Toggle between sidebar and icon rail          |
| `peek_drawer`         | 3     | Enable entity peek on list pages              |
| `governance_copilot`  | 5     | Enable AI-powered Co-Pilot panel              |
| `view_transitions`    | 6     | Enable View Transitions API                   |
| `ai_composed_hub`     | 7     | Enable AI-driven Hub card composition         |
| `ambient_annotations` | 7     | Enable inline AI annotations on content pages |
| `temporal_adaptation` | 7     | Enable governance temporal mode               |
| `keyboard_shortcuts`  | 8     | Enable full keyboard shortcut system          |
| `conversational_nav`  | 9     | Enable conversational AI in command palette   |
| `mobile_gestures`     | 10    | Enable gesture navigation on mobile           |
