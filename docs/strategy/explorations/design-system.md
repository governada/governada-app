# Feature Exploration: The Governance Design System

> **Status:** Exploration complete — awaiting founder decision
> **Created:** 2026-03-16
> **Triggered by:** Founder realization that professional governance workflow tools need "more function than pretty React components"
> **Scope:** Design system architecture — how the component layer should evolve to serve governance-grade professional tools

---

## Phase 1: Current State Snapshot

### What Exists Today

**576 component files | 47,336+ LOC across components/**

The design system is built on shadcn/ui + Tailwind CSS v4 with significant Governada-specific extensions:

**Base Layer (shadcn/ui — 28 components, ~1,935 LOC):**
Standard primitives: Button (with CVA variants + `data-slot`), Card (compound pattern with `@container` queries), Dialog, Select, Tabs, Table, etc. Each customized with Governada's OKLCH token system.

**Custom Layer (12 governance-specific components, ~900 LOC):**
HexScore (SVG hexagonal score viz), GlowBar (progress with glow), ScoreExplainer, AnimatedList, GovTerm (governance terminology tooltips), AsyncContent (TanStack Query wrapper), content skeletons.

**Provider Layer (5 context providers, ~600 LOC):**
SegmentProvider (persona state), TierThemeProvider (score-to-tier CSS cascade), AccentProvider (identity colors), DepthGate (depth-adaptive rendering), LocaleProvider.

**Token System (globals.css — 683 lines):**

- OKLCH color model (perceptually consistent light/dark)
- 6-tier identity system (emerging → legendary) with CSS variable cascade
- Motion tokens (7 durations, 3 easings)
- 20+ keyframe animations with `prefers-reduced-motion` respect
- Card hover micro-interactions, button press states, skeleton shimmer

**Workspace Layer (67 files, 13,494 LOC):**
Author workflow (17 components), Review workspace (3-column layout + annotation system + multi-step voting), Cockpit dashboards (DRepCockpit: 9,245 LOC, SPOCockpit: 23,149 LOC).

### Core JTBDs Served

1. **Citizens**: Understand governance health, find/evaluate DReps, track proposals (30-second reads)
2. **DReps**: Vote on proposals, write rationales, manage delegators, track reputation (professional workflow)
3. **SPOs**: Build governance identity, participate in governance actions, attract stake (identity platform)
4. **Proposers**: Author proposals, get community review, submit on-chain (collaborative authoring)

### What's Working Well

1. **Token system is comprehensive and consistent** — OKLCH, motion, tier identity all cascade via CSS variables. No JS needed for theming.
2. **Tier/accent theming is unique** — `.tier-gold`, `.tier-diamond` etc. create per-entity visual identity. No competitor has this.
3. **Dark mode is first-class** — Noise texture, glow effects, identity-tinted everything. Not "light with dark bg."
4. **Depth-adaptive rendering** — Same components serve Hands-Off → Informed → Engaged via DepthGate. Unique architecture.
5. **HexScore visualization** — Distinctive brand element. SVG hexagon with spring animations and breathing glow.
6. **Feature flag architecture** — FeatureGate + getFeatureFlag() cleanly gates unreleased workspace features.

### What's at Its Ceiling

1. **Multi-panel layouts are hand-built** — ReviewWorkspace's 3-column layout is 612 LOC of bespoke flexbox. No reusable panel primitives for resize, collapse, dock, persist preferences.

2. **Keyboard shortcuts are ad-hoc** — `useKeyboardShortcuts()` exists but there's no shortcut registry, no help overlay (`?`), no chord support (Linear's `G+I` to go to inbox), no context-awareness (disable when in textarea).

3. **Component scope creep** — SPOCockpit is 23,149 LOC in one file. No intermediate abstraction for dashboard sections. The design system doesn't guide towards smaller composition.

4. **No density modes** — Power users (DReps processing 20 proposals) want compact information density. Citizens browsing want spacious layouts. Same components serve both, compromising for both.

5. **Form patterns fight shadcn** — Auto-save-on-blur, multi-stage lifecycle, stage-based read-only fields, text selection annotation — none of these fit shadcn's "schema → submit" form model.

6. **Repeating patterns aren't abstracted** — Status badges, section headers, empty states, character count + save status, filter tabs — all reimplemented per feature with slight variations.

7. **Data display is ad-hoc** — Scores, breakdowns, comparisons, timelines each have one-off display logic. No systematic way to show "4-pillar score breakdown" or "user-vs-DRep comparison."

8. **Mobile responsiveness is bolt-on** — Breakpoints hardcoded throughout. Dense workspaces (review, cockpit) may not adapt well. `use-mobile` hook exists but isn't systematically used.

---

## Phase 2: Inspiration Research

### Bloomberg Terminal — Panel-First Workspace Architecture

Bloomberg's Launchpad system provides the blueprint for professional information workspaces:

- **Dockable panels** with magnetic edge snapping — users compose their own workspace
- **Security groups** — changing the entity in one panel cascades to all linked panels (imagine: select a proposal, and intelligence sidebar + vote panel + annotation panel all update)
- **Keyboard-first** — custom keyboard with dedicated keys for common actions. The keyboard IS the interface
- **Elimination of the 4-panel limit** — moved to tabbed panel model where users customize freely

**Governada Application:** Proposal review workspace should be composable panels, not fixed 3-column layout. "Security groups" = proposal context cascading.

### Linear — Keyboard Chords + Command Palette

Linear's keyboard system is the gold standard for productivity apps:

- **`Cmd+K`** opens universal command palette (search + actions)
- **Chord shortcuts**: `G+I` = go to inbox, `G+V` = go to cycle, `O+F` = open favorites
- **Direct actions**: `C` = create, `X` = select, `Esc` = back
- **Philosophy**: "Your keyboard is the fastest method. Even if you don't normally use shortcuts, learn these."
- **Multiple interaction paths**: same action via button, keyboard shortcut, context menu, or command palette

**Governada Application:** `G+W` = go to workspace, `G+H` = go to hub. `Y/N/A` for vote. `Cmd+K` for universal search. Every action has keyboard + click + command palette paths.

### Superhuman — Opinionated Workflow + Split Composition

Superhuman's design philosophy centers on speed-first:

- **Split Inbox** — automatic categorization into priority sections (VIP, Team, Other)
- **Keyboard-driven triage** — process similar items in batches, never context-switch
- **AI-drafted responses** — inline, editable, with confidence indicators
- **Opinionated defaults** — the system makes decisions FOR you (archive after reply, snooze suggestions)

**Governada Application:** Review queue = split by proposal type/urgency. AI-drafted rationales are inline, not in a separate modal. System suggests snooze ("vote on this after the treasury analysis lands").

### Figma — Context-Aware Panels

Figma's workspace adapts to what you're doing:

- **Selection-driven panels** — toolbar and sidebar show only controls relevant to the selected element
- **Three-tier variables**: primitives → semantic tokens → component tokens (mode switching for themes)
- **Multiplayer presence** — see collaborators' cursors and selections in real-time

**Governada Application:** Select a proposal section → sidebar shows relevant annotations + constitutional check for THAT section. Team collaboration surfaces who's reviewing what.

### Notion — Block Architecture for Uniform Composition

Notion's "everything is a block" model:

- **Uniform storage** — heading, paragraph, database row, embed, to-do all stored the same way
- **Recursive composition** — blocks nest inside blocks, pages are blocks
- **Transform freely** — any block can become another type without data loss
- **Structural indentation** — nesting reflects meaning, not presentation

**Governada Application:** A proposal section, a score display, an AI analysis, a vote action — all could be "governance blocks" that compose uniformly.

### Cloudscape + SAP Fiori — Density Modes

Enterprise design systems solve the power-user vs. casual-user tension:

- **Two density modes**: Comfortable (default, optimized for readability) and Compact (data-dense, optimized for power users)
- **User-selectable** — users choose their preferred density level
- **Component-level adaptation** — same component, different spacing/sizing/typography per mode
- **Pattern-level guidance** — "data tables and long forms benefit from compact mode"

**Governada Application:** Citizens browse in Comfortable mode. DReps switch to Compact mode for batch proposal review. Density preference persists per user.

### Arc Browser — Contextual Spaces

Arc treats different contexts as separate spaces:

- **Spaces** = distinct browsing environments with own tabs, bookmarks, themes
- **Split View** — built-in multi-panel without extensions (2-3 columns)
- **Instant context switching** — Work ↔ Personal in 2 seconds
- **Visual identity per space** — custom colors per context

**Governada Application:** Workspace mode has its own visual identity (more structured, denser). Discovery/browse mode feels different. Not just responsive — contextually different.

### Radix UI — Headless Compound Primitives

Radix proves that design systems can separate behavior from style:

- **`asChild` composition** — compose multiple behaviors onto one element
- **Accessibility built-in** — focus management, keyboard nav, ARIA attributes are primitive-level
- **Compound patterns** — `Dialog.Trigger` + `Tooltip.Trigger` composed together

**Governada Application:** Build governance-specific compound primitives (VoteAction, AnnotatableSection, ProposalQueue) with Radix-level accessibility and composability, styled with the existing Governada token system.

---

## Phase 3: Data Opportunity Scan

### Data That Exists Today

| Category                | Shape                                   | Source                               |
| ----------------------- | --------------------------------------- | ------------------------------------ |
| DRep composite score    | Scalar 0-100                            | `lib/scoring/drepScore.ts`           |
| 4-pillar breakdown      | 4× scalar + confidence                  | `lib/scoring/`                       |
| 6-dimension alignment   | 6× scalar (nullable)                    | `lib/alignment/`                     |
| DRep-user match         | Per-proposal agreement + narrative      | `lib/matching/`                      |
| GHI (9 components)      | Score + band + breakdown                | `lib/ghi/`                           |
| Proposal classification | 6× float (0-1)                          | `lib/alignment/classifyProposals.ts` |
| AI constitutional check | Flags + severity + score                | `lib/ai/skills/`                     |
| AI research precedent   | Similar proposals + questions           | `lib/ai/skills/`                     |
| Proposal health         | Completeness percentage                 | `lib/workspace/proposalHealth.ts`    |
| Score impact estimate   | Delta prediction                        | `lib/workspace/scoreImpact.ts`       |
| Engagement events       | Views, section reads, annotation counts | `lib/workspace/engagement.ts`        |

### Distinct Data Display Shapes the Design System Must Handle

1. **Scalar scores** — 0-100 values with context (good/bad/neutral), tiers, trends
2. **Multi-pillar breakdowns** — 4-9 dimensions with weights, each scorable
3. **Timelines** — Epoch-based activity, momentum trends, reliability streaks
4. **Comparisons** — User vs. DRep, proposal vs. proposal, current vs. historical
5. **Text intelligence** — AI narratives, constitutional analysis, research findings (structured prose)
6. **Action states** — Vote direction (Y/N/A), delegation status, submission stage (draft → submitted → ratified)
7. **Confidence signals** — How reliable is this score/match/prediction? Data sparsity warnings
8. **Relationships** — DRep-to-DRep alignment clusters, proposal-to-proposal similarity, dimension-to-vote correlations

### Data That Could Exist (New Opportunities)

| Potential Data                                                                 | What It Enables                                                            | Feasibility                                                      |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Deliberation depth score (time-on-proposal + sections read + annotation count) | "This DRep spent 12 minutes on this proposal" — credibility signal         | NEEDS_COMPUTATION (events exist, aggregation needed)             |
| Cross-proposal voting coherence                                                | "This DRep is 92% consistent on treasury proposals" — reliability signal   | NEEDS_COMPUTATION (vote patterns exist, coherence metric needed) |
| Community consensus map                                                        | "73% of rationales cite Article 3.2 as relevant" — collective intelligence | NEEDS_NEW_DATA (rationale NLP extraction)                        |
| Real-time review activity                                                      | "3 DReps are currently reviewing this proposal" — collaboration signal     | NEEDS_NEW_DATA (presence/activity tracking)                      |

---

## Phase 4: Three Alternative Concepts

### Concept A: "The Governance Workbench"

**Core Insight:** The design system's primary abstraction should be the PANEL, not the page. Every governance tool is a panel composition — resizable, dockable, keyboard-navigable, context-linked.

**Inspiration Source:** Bloomberg Terminal Launchpad + Linear keyboard system + Superhuman split inbox

**The Experience:**

The design system adds a `<Workbench>` layout primitive that replaces fixed multi-column layouts. Inside a workbench:

```
┌─ Workbench ─────────────────────────────────────────────────┐
│ ┌─ Panel: Queue ─┐ ┌─ Panel: Proposal ────┐ ┌─ Panel: Intel ─┐ │
│ │ [resize handle]│ │ [resize handle]      │ │ [collapse btn] │ │
│ │                │ │                      │ │                │ │
│ │ Compact list   │ │ Full proposal brief  │ │ AI analysis    │ │
│ │ with keyboard  │ │ with annotations     │ │ Score impact   │ │
│ │ navigation     │ │                      │ │ Context chain  │ │
│ │                │ │                      │ │                │ │
│ └────────────────┘ └──────────────────────┘ └────────────────┘ │
│ ─── Command Palette (Cmd+K) ─── Shortcut Help (?) ──────────  │
└─────────────────────────────────────────────────────────────────┘
```

**New design system primitives:**

| Primitive            | Purpose                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `<Workbench>`        | Root layout with panel management, keyboard context, command palette                      |
| `<Panel>`            | Resizable, collapsible container with header + content + optional footer                  |
| `<PanelGroup>`       | Horizontal or vertical panel arrangement with resize handles                              |
| `<CommandPalette>`   | Cmd+K universal search + actions                                                          |
| `<ShortcutProvider>` | Keyboard shortcut registry with context-awareness + help overlay                          |
| `<ContextGroup>`     | Bloomberg-style "security group" — changing entity in one panel cascades to linked panels |
| `<ActionBar>`        | Sticky bottom bar for primary actions (vote, submit, save)                                |
| `<StatusBadge>`      | Governance-specific status indicator (voted/reviewing/snoozed/urgent)                     |
| `<SectionHeader>`    | Label + metadata badge + optional actions                                                 |
| `<EmptyState>`       | Icon + title + subtitle + optional CTA                                                    |

**Keyboard System:**

- `Cmd+K` → command palette
- `?` → shortcut help overlay
- `G+W` → workspace, `G+H` → hub, `G+P` → proposals
- `Y/N/A` → vote Yes/No/Abstain (when in review panel)
- `J/K` → next/prev in queue
- `Tab` → cycle between panels
- `Cmd+\` → toggle sidebar panel

**The Emotional Arc:**

- **Entry**: Professional. "This is my governance workspace." Tools feel purposeful, not decorative.
- **During**: Flow state. Keyboard-driven batch processing. Information density matches the task.
- **Completion**: Accomplishment. "I reviewed 12 proposals in 20 minutes." Share card with stats.

**Data Requirements:**

- Panel layout preferences → NEEDS_NEW_DATA (localStorage or Supabase user prefs)
- Shortcut usage analytics → NEEDS_NEW_DATA (PostHog events)
- Context cascading → EXISTS (proposal state management already built)

**What It Removes:**

- Fixed 3-column layouts in ReviewWorkspace → replaced by composable panels
- Hardcoded sidebar widths → user-resizable
- Per-component keyboard handlers → centralized ShortcutProvider
- Bespoke empty states → standardized EmptyState primitive
- Repeated section header patterns → SectionHeader primitive

**The Ceiling:**

| Dimension        | Max Score                         |
| ---------------- | --------------------------------- |
| JTBD Fulfillment | 9/10                              |
| Emotional Impact | 8/10                              |
| Simplicity       | 6/10 (panels add complexity)      |
| Differentiation  | 9/10                              |
| Feasibility      | 7/10                              |
| Mobile           | 5/10 (panels don't map to mobile) |

**What It Sacrifices:** Mobile experience. Panel workbenches are inherently desktop-first. Mobile would need a completely different layout strategy (stacked cards, swipe gestures). This is TWO design systems — workbench for desktop, something else for mobile.

**Effort:** L (4-6 weeks for panel primitives + keyboard system + migration of existing workspaces)

**The Share Moment:** "12 proposals reviewed, 8 rationales published, 45 minutes" — governance productivity card.

---

### Concept B: "Governance Modes"

**Core Insight:** The gap isn't missing components — it's that the same components try to serve citizens browsing AND DReps working AND analysts investigating. One system, three BEHAVIORAL MODES that change density, interaction patterns, and information hierarchy.

**Inspiration Source:** Cloudscape density modes + Arc Spaces + SAP Fiori cozy/compact

**The Experience:**

The design system introduces a `<ModeProvider>` that wraps the entire app. Three modes:

**Browse Mode** (default for citizens, discovery pages):

- Spacious layout — generous padding, large touch targets
- Narrative-first — conclusions before data, stories before charts
- Emotional design — celebrations, identity moments, visual delight
- Single-column with occasional 2-column on desktop
- Typography: larger body (16px), generous line-height (1.6)

**Work Mode** (default for workspace pages, opt-in elsewhere):

- Dense layout — compact spacing, smaller touch targets
- Action-first — what to DO is above the fold, context below
- Keyboard shortcuts active — shortcut hints visible on hover
- Multi-column layouts enabled
- Typography: smaller body (14px), tighter line-height (1.4)
- Data tables switch to compact rows
- Cards switch to list items

**Analyze Mode** (opt-in for data exploration):

- Maximum density — minimal chrome, maximum data
- Comparison-first — side-by-side views, overlay charts
- Export affordances visible — CSV, share, bookmark
- Full-width layouts, minimal margins
- Typography: mono for numbers (13px), tight spacing
- Hover reveals detailed breakdowns

**How It Works:**

```tsx
// Mode cascades via CSS variables — no component duplication
<ModeProvider mode="work">
  {/* Same <Card> component, different spacing/sizing */}
  <Card>...</Card>
</ModeProvider>

// globals.css
[data-mode="browse"] {
  --spacing-card: 1.5rem;
  --text-body: 1rem;
  --radius-card: 0.75rem;
}
[data-mode="work"] {
  --spacing-card: 0.75rem;
  --text-body: 0.875rem;
  --radius-card: 0.5rem;
}
[data-mode="analyze"] {
  --spacing-card: 0.5rem;
  --text-body: 0.8125rem;
  --radius-card: 0.25rem;
}
```

**Automatic Mode Selection:**

- `/hub`, `/discover/*`, `/proposal/*` → Browse mode (citizens browsing)
- `/workspace/*` → Work mode (DReps/SPOs working)
- Manual toggle via header pill or `Cmd+Shift+M`
- User preference persists (DRep might want Work mode everywhere)

**Component Adaptations by Mode:**

| Component     | Browse                           | Work                              | Analyze                        |
| ------------- | -------------------------------- | --------------------------------- | ------------------------------ |
| Card          | Padded, rounded, hover elevation | Compact, flat, border-only        | Minimal, tight, row-like       |
| Button        | Large touch target, icon + text  | Compact, text-only, shortcut hint | Icon-only with tooltip         |
| Table         | Large rows, centered text        | Compact rows, left-aligned        | Dense rows, monospace numbers  |
| Score display | HexScore hero (120px)            | HexScore card (48px) + label      | Inline number + sparkline      |
| Empty state   | Large illustration + narrative   | Icon + one-liner                  | Hidden (show data placeholder) |
| Navigation    | Spacious sidebar (240px)         | Compact sidebar (64px)            | No sidebar (command palette)   |

**The Emotional Arc:**

- **Browse**: Discovery. "Show me what's happening." Warm, inviting, narrative.
- **Work**: Focus. "Let me get this done." Professional, efficient, structured.
- **Analyze**: Deep dive. "Let me understand everything." Dense, precise, comparative.

**Data Requirements:**

- Mode preference per user → NEEDS_NEW_DATA (simple localStorage/Supabase flag)
- Route-to-mode mapping → EXISTS (route structure already persona-aware)
- Component variant tokens → NEEDS_COMPUTATION (CSS variable layer, no new data)

**What It Removes:**

- Nothing from the current codebase — this is additive. Existing components gain mode-awareness through CSS variables, not code changes.
- Over time: removes per-component density decisions ("should this card be large or small?"). The MODE decides.

**The Ceiling:**

| Dimension        | Max Score                                              |
| ---------------- | ------------------------------------------------------ |
| JTBD Fulfillment | 8/10                                                   |
| Emotional Impact | 9/10 (each mode optimized for its emotional target)    |
| Simplicity       | 9/10 (same components, different CSS)                  |
| Differentiation  | 7/10 (density modes exist elsewhere — Cloudscape, SAP) |
| Feasibility      | 9/10 (mostly CSS + one provider)                       |
| Mobile           | 8/10 (Browse mode IS the mobile experience)            |

**What It Sacrifices:** Doesn't solve the structural problem — multi-panel layouts, keyboard systems, and workspace primitives still need to be built separately. This makes existing components FEEL better for different contexts but doesn't add new component capabilities.

**Effort:** S-M (1-3 weeks for ModeProvider + CSS variable layer + auto-selection logic)

**The Share Moment:** Before/after screenshot — same page in Browse vs. Work mode. "Governada adapts to how you govern."

---

### Concept C: "The Governance Primitive Layer"

**Core Insight:** Neither new layout primitives (Concept A) nor density modes (Concept B) solve the fundamental problem: the design system has no governance VOCABULARY. A `<Button variant="destructive">` is a generic UI primitive. A `<VoteAction direction="yes" proposal={p}>` is a governance primitive — it knows what it means, what states it has, what keyboard bindings apply, what animation to play, and what data shape it needs.

**Inspiration Source:** Domain-driven design (DDD applied to UI) + Radix compound primitives + Notion blocks

**The Experience:**

Between shadcn/ui (generic) and application components (specific), add a governance primitive layer:

```
Layer 3: Application Components (ReviewWorkspace, DRepCockpit, ProposalPage)
Layer 2: Governance Primitives ← NEW (VoteAction, ScoreDisplay, ProposalQueue, AnnotatableSection)
Layer 1: UI Primitives (shadcn Button, Card, Dialog, Tabs)
Layer 0: Design Tokens (OKLCH colors, motion, tiers, density)
```

**Governance Primitives Catalog:**

**Action Primitives:**

```tsx
// Not a button with colors — a governance action with built-in semantics
<VoteAction
  direction="yes"            // yes | no | abstain
  proposal={proposal}        // typed proposal data
  keyboard="y"               // auto-registers shortcut
  onVote={handleVote}
  showImpact                 // shows score delta preview
/>
// → Renders correct color, icon, label, animation
// → Knows its keyboard shortcut and registers it
// → Shows score impact tooltip on hover
// → Plays celebration animation on submission
// → Switches to "voted" state after transaction

<DelegateAction drep={drep} />
<SnoozeAction item={item} until={epoch} />
<AnnotateAction selection={textSelection} type="concern" />
```

**Display Primitives:**

```tsx
// Not a card with numbers — a score that knows its domain
<ScoreDisplay
  value={72}
  pillars={pillarBreakdown}  // auto-renders breakdown
  trend={momentum}           // auto-renders trend arrow
  tier="gold"                // auto-applies tier theming
  size="hero"                // hero | card | inline | badge
  compare={userAlignment}    // shows user-vs-entity comparison
/>

<ProposalBrief proposal={p} depth="summary" />  // summary | full | analysis
<EpochContext epoch={currentEpoch} />            // shows epoch number, time remaining, phase
<ConfidenceIndicator value={0.73} source="votes" />
<AlignmentCompass dimensions={dims} size="card" />
```

**Container Primitives:**

```tsx
// Not a div with list items — a governance queue with built-in keyboard nav
<ProposalQueue
  items={proposals}
  onSelect={setSelected}
  keyboard={{ next: 'j', prev: 'k' }}  // auto-registers
  statusRenderer={(item) => <StatusBadge status={item.status} />}
  groupBy="type"             // auto-groups by proposal type
/>

<AnnotatableSection text={content} annotations={annotations}>
  {/* Text with overlay badges, selection toolbar, sidebar integration */}
</AnnotatableSection>

<GovernanceTimeline events={lifecycleEvents} />
<StakeComparison entities={[drepA, drepB]} dimensions={allDimensions} />
```

**Compound Primitives (compose smaller primitives):**

```tsx
<ReviewCard proposal={p} drep={currentDrep}>
  {/* Internally composes: ProposalBrief + VoteAction + ScoreDisplay + ConfidenceIndicator */}
  {/* All connected via shared proposal context */}
</ReviewCard>
```

**What Makes This Different from "Just More Components":**

1. **Typed data contracts** — Each primitive declares its data shape. `<ScoreDisplay>` accepts `DRepScoreResult`, not arbitrary numbers. TypeScript enforces governance data integrity at the component boundary.

2. **Built-in keyboard bindings** — `<VoteAction keyboard="y">` self-registers its shortcut with the ShortcutProvider. No separate keyboard configuration.

3. **Built-in state machines** — `<VoteAction>` manages its own states (idle → selected → confirming → submitting → voted → error). Application code doesn't manage vote UI state.

4. **Built-in analytics** — Every governance primitive auto-fires its PostHog event (`vote_cast`, `score_viewed`, `annotation_created`). No manual tracking.

5. **Composition protocol** — Primitives inside a `<ProposalContext>` share proposal state automatically. Select a proposal in a queue → all primitives in the same context update.

**The Emotional Arc:**

- **For users**: Same as current — they don't see the design system layer.
- **For builders**: "I can build a complete governance feature by composing 5-6 primitives instead of writing 600 lines of bespoke React." This is about VELOCITY, not aesthetics.

**Data Requirements:**

- All required data already EXISTS in `lib/data.ts`, `lib/scoring/`, `lib/alignment/`
- Primitives codify the data contracts that are currently implicit
- PostHog auto-tracking → EXISTS (event system already built)

**What It Removes:**

- 300+ lines of ReviewActionZone → composed from VoteAction + ConfidenceIndicator + ScoreDisplay
- 200+ lines of ReviewQueue → composed from ProposalQueue + StatusBadge
- Repeated empty state / section header / save status patterns → primitives
- Ad-hoc keyboard handlers → built-in to each primitive
- Manual PostHog calls → auto-tracked by primitives

**The Ceiling:**

| Dimension        | Max Score                                                          |
| ---------------- | ------------------------------------------------------------------ |
| JTBD Fulfillment | 9/10                                                               |
| Emotional Impact | 7/10 (architecture doesn't directly improve emotion)               |
| Simplicity       | 8/10 (fewer lines per feature, but more primitives to learn)       |
| Differentiation  | 10/10 (no governance tool has domain-specific primitives)          |
| Feasibility      | 7/10 (significant upfront investment to define + build primitives) |
| Mobile           | 8/10 (primitives can have size variants: hero/card/inline/badge)   |

**What It Sacrifices:** Upfront investment is significant. Need to define the governance vocabulary BEFORE building primitives. Risk of over-abstracting — creating primitives for things that are only used once. Must be disciplined about "earn your abstraction" (3+ uses before extracting).

**Effort:** L-XL (6-10 weeks for full primitive layer, but can be built incrementally — extract primitives from existing components one at a time)

**The Share Moment:** "We built the entire treasury analysis feature in 200 lines by composing governance primitives." — developer experience flex.

---

## Phase 5: Comparative Analysis

| Dimension         | Current | A: Workbench | B: Modes  | C: Primitives   |
| ----------------- | ------- | ------------ | --------- | --------------- |
| JTBD Ceiling      | 6/10    | 9/10         | 8/10      | 9/10            |
| Emotional Impact  | 7/10    | 8/10         | 9/10      | 7/10            |
| Simplicity        | 5/10    | 6/10         | 9/10      | 8/10            |
| Differentiation   | 6/10    | 9/10         | 7/10      | 10/10           |
| Feasibility       | —       | 7/10         | 9/10      | 7/10            |
| Mobile            | 6/10    | 5/10         | 8/10      | 8/10            |
| Data Requirements | —       | Low (prefs)  | Low (CSS) | None (existing) |
| Effort            | —       | L            | S-M       | L-XL            |

**The Question:** Concept A (Workbench) gives the best professional tool experience but sacrifices mobile. Concept B (Modes) is fastest to ship and improves everything but doesn't solve structural problems. Concept C (Primitives) has the highest differentiation ceiling but the longest build time.

---

## Phase 6: Recommendation

### The Hybrid: Modes + Primitives (Phased)

**Why this wins:** The concepts aren't competing — they're layers.

**Layer 0 (Week 1-2): Governance Modes** — Ship Concept B first. It's mostly CSS variables, requires no component rewrites, and immediately improves the experience for all personas. This is the highest-ROI change possible.

**Layer 1 (Week 3-6): Governance Primitives** — Extract primitives from existing workspace code. Don't build from scratch — refactor ReviewActionZone INTO `<VoteAction>`, refactor ReviewQueue INTO `<ProposalQueue>`, etc. Each extraction is a PR that reduces complexity.

**Layer 2 (Week 7+, as needed): Workbench Panels** — Only if the workspace tools justify it. The review workspace might need resizable panels. The cockpit might need dockable sections. Build panel primitives when a specific feature requires them, not speculatively.

### What to Steal from Each Concept

**From Concept A (Workbench):**

- Keyboard shortcut registry + `?` help overlay (build in Layer 1)
- `Cmd+K` command palette (build in Layer 1)
- `<ActionBar>` sticky bottom bar (build in Layer 1)
- Panel resize/collapse — defer until specific workspace needs it

**From Concept B (Modes):**

- Full ModeProvider + CSS variable layer (Layer 0)
- Route-to-mode auto-selection (Layer 0)
- User preference persistence (Layer 0)
- Component density adaptation via tokens (Layer 0)

**From Concept C (Primitives):**

- `<VoteAction>` with built-in keyboard + states + analytics (Layer 1, extract from ReviewActionZone)
- `<ScoreDisplay>` with size variants + tier theming (Layer 1, extract from HexScore + GlowBar patterns)
- `<ProposalQueue>` with keyboard nav + grouping (Layer 1, extract from ReviewQueue)
- `<StatusBadge>`, `<SectionHeader>`, `<EmptyState>` (Layer 1, extract from repeating patterns)
- `<AnnotatableSection>` (Layer 1, extract from AnnotatableText)
- `<ProposalContext>` for shared state cascading (Layer 1)
- Auto-PostHog tracking per primitive (Layer 1)

### Implementation Roadmap

**Phase 1: Modes (S effort, 1-2 weeks)**

1. Add `ModeProvider` to `components/providers/`
2. Define CSS variable overrides in `globals.css` for Browse/Work/Analyze
3. Wire auto-selection: workspace routes → Work, discovery routes → Browse
4. Add mode toggle to header (pill selector or `Cmd+Shift+M`)
5. Verify existing components respond to CSS variable changes
6. No component code changes — pure CSS cascade

**Phase 2: Foundation Primitives (M effort, 2-3 weeks)**

1. Extract `<StatusBadge>` from repeated patterns (10+ usages)
2. Extract `<SectionHeader>` from repeated patterns (15+ usages)
3. Extract `<EmptyState>` from repeated patterns (8+ usages)
4. Build `<ShortcutProvider>` + `?` help overlay
5. Build `<CommandPalette>` (Cmd+K) using cmdk library
6. Build `<ActionBar>` for workspace sticky actions

**Phase 3: Governance Primitives (M-L effort, 3-4 weeks)**

1. Extract `<VoteAction>` from ReviewActionZone (keyboard + states + analytics built-in)
2. Extract `<ProposalQueue>` from ReviewQueue (keyboard nav + grouping + status rendering)
3. Extract `<ScoreDisplay>` from HexScore/GlowBar patterns (unified size variants)
4. Extract `<AnnotatableSection>` from AnnotatableText (selection + overlay + sidebar)
5. Build `<ProposalContext>` for shared proposal state across primitives
6. Wire auto-PostHog tracking into each governance primitive

**Phase 4: Workbench (L effort, as needed)**

1. Evaluate whether review workspace needs resizable panels
2. If yes: build `<Panel>` + `<PanelGroup>` using existing react-resizable-panels or similar
3. Migrate ReviewWorkspace from fixed flexbox to panel composition
4. Add panel preference persistence to user settings

### What to REMOVE

1. **Bespoke keyboard handlers** → centralize in ShortcutProvider (after Phase 2)
2. **Per-component empty states** → replace with `<EmptyState>` (after Phase 2)
3. **Per-component status badge styling** → replace with `<StatusBadge>` (after Phase 2)
4. **ReviewActionZone monolith** → decompose into VoteAction + steps (after Phase 3)
5. **ReviewQueue bespoke rendering** → replace with ProposalQueue (after Phase 3)
6. **Hardcoded spacing/sizing decisions** → let ModeProvider CSS variables handle (after Phase 1)

### Risk Assessment

| Risk                                               | Mitigation                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Mode CSS variables don't cascade to all components | Test with 5 key components first. Gradually extend. Fallback: explicit mode prop.                                    |
| Governance primitives become too opinionated       | Follow "3 uses before extraction" rule. Keep primitives flexible via composition (Radix-style asChild).              |
| Keyboard shortcuts conflict between panels         | ShortcutProvider manages context (textarea focus disables letter shortcuts). Test conflicts matrix.                  |
| Migration breaks existing features                 | Extract-and-replace approach — old component stays until new primitive is verified. Feature flags on new primitives. |
| Over-investment before launch                      | Phase 1 (Modes) ships independently and improves everything. Other phases can pause for launch work.                 |

### Validation Suggestion

Before building Phase 2+, validate the Modes concept:

1. Ship ModeProvider with Browse/Work CSS variables only
2. Test with ReviewWorkspace (Work mode) vs. ProposalPage (Browse mode)
3. Ask 3-5 DReps: "Does the workspace feel more professional?" (qualitative)
4. Track PostHog: do Work mode users process more proposals per session? (quantitative)
5. If validated → proceed to primitive extraction. If not → investigate what's actually needed.

---

## Appendix: Pattern Library Updates

New patterns added to `docs/strategy/context/world-class-patterns.md` from this research:

1. **Bloomberg Launchpad Dockable Panels** — magnetic panel docking + security groups for context cascade
2. **Linear Keyboard Chord System** — G+\_ navigation, direct action keys, command palette
3. **Superhuman Split Inbox Triage** — batch processing by category, keyboard-driven, AI draft inline
4. **Cloudscape/SAP Density Modes** — comfortable/compact per user preference, CSS variable cascade
5. **Arc Browser Spaces** — contextual workspaces with distinct visual identity + instant switching
6. **Notion Block Architecture** — uniform composable units with recursive nesting + type transformation
