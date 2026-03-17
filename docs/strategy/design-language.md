# The Governada Design Language

> **Status:** Specification — ready for Hub proof of concept
> **Created:** 2026-03-17
> **Metaphor:** The Compass
> **Signature:** Governance Rings

---

## 1. Identity: The Compass

Governada is a compass for navigating governance. Not a dashboard. Not a voting booth. A precision instrument that helps you find your direction in a complex landscape.

This metaphor shapes every design decision:

- **Colors** evoke cartographic maps and brass instruments
- **Typography** carries institutional authority (serif display) with modern readability (geometric body)
- **Interactions** feel like orienting a compass — deliberate, precise, revealing
- **Data visualizations** show position and direction, not just magnitude
- **Empty states** are invitations to explore, not dead ends

The compass is warm in your hand but precise in its reading. That duality — warm accessibility, cool precision — defines the three modes.

---

## 2. Color System: The Compass Palette

### Philosophy

Color in Governada serves three purposes: **brand identity**, **governance semantics**, and **emotional temperature**. No color is arbitrary — each earns its place.

OKLCH throughout for perceptual consistency across light and dark modes.

### Primary: Compass Teal

Deep, warm teal. The color of a compass rose on a cartographic chart. Authoritative but not cold. Replaces the placeholder cyan.

```
Light: oklch(0.50 0.12 192)   — deep, institutional
Dark:  oklch(0.72 0.12 192)   — brighter for dark backgrounds
```

Used for: primary buttons, active states, links, focus rings, navigation accents, Participation governance ring.

### Secondary: Wayfinder Amber

The brass of a compass instrument. Warmth, illumination, guidance.

```
Light: oklch(0.68 0.14 75)    — warm, golden
Dark:  oklch(0.78 0.12 75)    — softer glow on dark
```

Used for: secondary accents, highlights, hover warmth, Deliberation governance ring, callout borders.

### Tertiary: Meridian Violet

The third point of the compass triangle. Significance, depth, influence.

```
Light: oklch(0.55 0.15 295)   — deep, purposeful
Dark:  oklch(0.70 0.14 295)   — vibrant on dark
```

Used for: Impact governance ring, premium/notable indicators, alignment dimension accents.

### Vote Colors (Morally Neutral)

Governance decisions are not right or wrong. The colors must feel **deliberate and considered**, not **correct or incorrect**.

| Action                | Color Name | OKLCH                  | Emotional Register                                |
| --------------------- | ---------- | ---------------------- | ------------------------------------------------- |
| **Affirm** (Yes)      | Cerulean   | `oklch(0.62 0.12 245)` | Calm conviction. "I've considered and I proceed." |
| **Oppose** (No)       | Copper     | `oklch(0.62 0.10 50)`  | Firm resolve. "I've considered and I decline."    |
| **Reserve** (Abstain) | Slate      | `oklch(0.55 0.02 260)` | Deliberate pause. "I choose to observe."          |

Design rule: Vote buttons at rest are ALL the same neutral style (outline). Color activates only on selection. This prevents visual bias toward any direction.

### Semantic Colors

| Purpose | OKLCH                       | Usage                                  |
| ------- | --------------------------- | -------------------------------------- |
| Success | `oklch(0.68 0.16 162)`      | Transactions confirmed, syncs complete |
| Warning | `oklch(0.72 0.14 80)`       | Approaching deadlines, data staleness  |
| Error   | `oklch(0.58 0.20 25)`       | Failed operations, critical alerts     |
| Info    | Primary teal at 60% opacity | Informational banners, tips            |

### Tier Colors

The existing 6-tier identity system is retained. Tiers appear on entity-level surfaces (cards, borders, badges) and don't conflict with vote or semantic colors because they occupy different visual contexts.

```
Emerging:   oklch(0.55 0.03 260)   — subtle, neutral
Bronze:     oklch(0.60 0.12 55)    — warm earth
Silver:     oklch(0.72 0.02 260)   — cool metal
Gold:       oklch(0.76 0.15 85)    — rich warmth
Diamond:    oklch(0.76 0.12 200)   — clear, bright
Legendary:  oklch(0.62 0.20 310)   — vivid, rare
```

### Surface Colors

| Surface    | Light Mode                          | Dark Mode                            |
| ---------- | ----------------------------------- | ------------------------------------ |
| Background | `oklch(0.97 0.005 90)` — warm paper | `oklch(0.12 0.015 260)` — deep space |
| Card       | `oklch(0.99 0.003 90)` — clean      | `oklch(0.16 0.012 260)` — elevated   |
| Elevated   | `oklch(1.0 0 0)` — white            | `oklch(0.20 0.010 260)` — raised     |
| Border     | `oklch(0.90 0.01 90)` — subtle      | `oklch(0.25 0.01 260)` — subtle      |
| Muted text | `oklch(0.55 0.01 260)`              | `oklch(0.60 0.01 260)`               |
| Foreground | `oklch(0.15 0.02 260)` — near black | `oklch(0.95 0.005 260)` — near white |

Note the warm hue shift in light mode backgrounds (hue 90 = warm paper) vs. cool in dark mode (hue 260 = deep blue-space). This creates the context-adaptive temperature: Browse/light feels warm, Work/dark feels cool.

---

## 3. Typography: Authority + Readability

### Three-Font Architecture

| Role        | Font          | Weights            | Purpose                                                                          |
| ----------- | ------------- | ------------------ | -------------------------------------------------------------------------------- |
| **Display** | Fraunces      | 400, 600, 800      | Scores, page titles, hero numbers, share cards. The "verdict" font.              |
| **Body**    | Space Grotesk | 400, 500, 600, 700 | Everything else. Proposals, descriptions, UI labels, navigation. Already loaded. |
| **Data**    | Geist Mono    | 400, 500           | On-chain hashes, ADA amounts, epoch numbers, addresses. Already loaded.          |

### Why Fraunces for Display

Fraunces is a variable "soft serif" inspired by early 20th century typefaces. It has:

- **Optical sizing** — automatically adjusts stroke contrast for different sizes
- **Soft axis** — can range from sharp to rounded, letting us tune warmth
- **Excellent numerals** — the number "72" in Fraunces feels like a _verdict_, not a statistic
- **Distinctive** — not overused (unlike Playfair Display). No other governance tool uses it.
- **Warm authority** — it signals "institution" without being cold or stuffy

When a DRep sees their score in Fraunces at 48px, it should feel like receiving a judgment from a body that matters — not reading a dashboard metric.

### Type Scale

Base size adapts per mode. Scale ratio: 1.25 (Major Third).

| Token            | Browse (16px base)  | Work (14px base)    | Analyze (13px base) |
| ---------------- | ------------------- | ------------------- | ------------------- |
| `--text-hero`    | 48px / Fraunces 800 | 36px / Fraunces 800 | 32px / Fraunces 800 |
| `--text-h1`      | 32px / Fraunces 600 | 24px / Fraunces 600 | 22px / Fraunces 600 |
| `--text-h2`      | 24px / Space 600    | 20px / Space 600    | 18px / Space 600    |
| `--text-h3`      | 20px / Space 600    | 16px / Space 600    | 15px / Space 600    |
| `--text-body`    | 16px / Space 400    | 14px / Space 400    | 13px / Space 400    |
| `--text-small`   | 14px / Space 400    | 12px / Space 400    | 12px / Space 400    |
| `--text-caption` | 12px / Space 400    | 11px / Space 400    | 11px / Space 400    |
| `--text-data`    | 14px / Mono 400     | 13px / Mono 400     | 12px / Mono 400     |

### Line Heights

| Context             | Value           | Rationale                                                 |
| ------------------- | --------------- | --------------------------------------------------------- |
| Display / headings  | 1.1–1.2         | Tight — scores and titles should feel dense and impactful |
| Body text           | 1.5–1.6         | Comfortable — proposals and descriptions need readability |
| Data / mono         | 1.4             | Functional — enough to read, no wasted vertical space     |
| Compact (Work mode) | -0.1 from above | Slightly tighter across the board                         |

### Font Pairing Rationale

Fraunces and Space Grotesk share geometric DNA — Fraunces' letterforms have underlying geometric structure softened by serif terminals. This creates visual harmony despite the serif/sans contrast. They work together because they agree on proportions but disagree on details.

### Number Rendering

| Context                    | Font             | Feature                             |
| -------------------------- | ---------------- | ----------------------------------- |
| Governance scores (72, 85) | Fraunces Display | Proportional, high-contrast         |
| ADA amounts (₳1,234,567)   | Geist Mono       | Tabular figures, fixed-width digits |
| Epoch numbers (Epoch 142)  | Geist Mono       | Tabular, clear differentiation      |
| Percentages in body text   | Space Grotesk    | Matches surrounding text            |
| Table data                 | Geist Mono       | Tabular for column alignment        |

---

## 4. Spacing & Density: Three Modes

### Mode Definitions

Each mode has a distinct emotional register, density level, and interaction model.

#### Browse Mode

> "Show me what's happening." Warm, inviting, narrative-first.

- **Default for**: Citizens, discovery pages, proposal detail, profile pages, mobile
- **Theme**: Light (warm paper backgrounds)
- **Emotional register**: Warm-professional
- **Base unit**: 16px
- **Card padding**: 1.5rem (24px)
- **Card gap**: 1rem (16px)
- **Card radius**: 0.75rem (12px)
- **Max content width**: 42rem (672px) — single column focus
- **Information philosophy**: Conclusions first, data on demand
- **Interaction model**: Touch-friendly, spacious tap targets (44px minimum)
- **Typography emphasis**: Narrative (body text prominent, scores contextual)
- **Animations**: Fluid spring entrances, celebration moments

#### Work Mode

> "Let me get this done." Cool, focused, action-first.

- **Default for**: Workspace pages, DRep/SPO tools, admin
- **Theme**: Dark (deep space backgrounds)
- **Emotional register**: Cool-professional
- **Base unit**: 14px
- **Card padding**: 0.75rem (12px)
- **Card gap**: 0.5rem (8px)
- **Card radius**: 0.5rem (8px)
- **Max content width**: Full viewport with multi-panel layout
- **Information philosophy**: Actions first, context available
- **Interaction model**: Keyboard-first, shortcut hints visible, compact click targets (32px)
- **Typography emphasis**: Labels and data (body text secondary)
- **Animations**: Snappy transitions (150ms ease-out), minimal decoration

#### Analyze Mode

> "Let me understand everything." Neutral, dense, data-first.

- **Default for**: Opt-in only — governance health deep dive, score analysis, comparative views
- **Theme**: User preference (inherits current)
- **Emotional register**: Neutral-clinical
- **Base unit**: 13px
- **Card padding**: 0.5rem (8px)
- **Card gap**: 0.375rem (6px)
- **Card radius**: 0.25rem (4px)
- **Max content width**: Full viewport, side-by-side panels
- **Information philosophy**: All data visible, comparisons prominent
- **Interaction model**: Keyboard + mouse, export affordances visible
- **Typography emphasis**: Data (mono numbers prominent, minimal prose)
- **Animations**: Minimal — instant state changes, no decorative motion

### Spacing Scale (per mode)

| Token             | Browse | Work | Analyze |
| ----------------- | ------ | ---- | ------- |
| `--space-xs`      | 4px    | 2px  | 2px     |
| `--space-sm`      | 8px    | 4px  | 3px     |
| `--space-md`      | 16px   | 8px  | 6px     |
| `--space-lg`      | 24px   | 16px | 12px    |
| `--space-xl`      | 32px   | 24px | 16px    |
| `--space-2xl`     | 48px   | 32px | 24px    |
| `--space-section` | 64px   | 40px | 32px    |

### Mode Selection Logic

```
Route-based defaults:
  /hub, /discover/*, /proposal/*, /match/*  → Browse
  /workspace/*                               → Work
  /governance/health (deep analysis view)    → Analyze

Overrides:
  User preference (persisted in localStorage)
  Manual toggle: Cmd+Shift+M cycles modes
  Header pill: [Browse] [Work] [Analyze]

Mobile:
  Always Browse mode (Work/Analyze not available on mobile)
```

### Context-Adaptive Theme

| Mode    | Default Theme    | Rationale                                                         |
| ------- | ---------------- | ----------------------------------------------------------------- |
| Browse  | Light (warm)     | Citizens browsing should feel invited, not intimidated by dark UI |
| Work    | Dark (cool)      | DReps working long sessions benefit from reduced eye strain       |
| Analyze | Inherits current | User preference — some prefer dark data views, others light       |

Users can override any mode's default theme. The recommendation is opinionated but not mandatory.

---

## 5. Motion Language: Fluid Precision

### Philosophy

Every animation serves a purpose and belongs to one of four categories. No orphaned keyframes.

### Motion Categories

| Category        | Duration  | Easing                            | When Used                                                            |
| --------------- | --------- | --------------------------------- | -------------------------------------------------------------------- |
| **Enter**       | 300–400ms | `spring(1, 80, 10)` — underdamped | Element appears: page load, panel open, card reveal                  |
| **Feedback**    | 100–150ms | `ease-out`                        | User action confirmed: button press, checkbox toggle, selection      |
| **Transition**  | 200–250ms | `ease-in-out`                     | State changes: mode switch, tab change, panel resize                 |
| **Celebration** | 500–700ms | `spring(1, 60, 8)` — bouncy       | Milestone moments: vote published, ring closed, delegation confirmed |

### Spring Presets

```ts
export const springs = {
  enter: { type: 'spring', stiffness: 80, damping: 10 }, // Fluid arrival
  feedback: { type: 'spring', stiffness: 300, damping: 25 }, // Snappy response
  transition: { type: 'spring', stiffness: 120, damping: 15 }, // Smooth shift
  celebrate: { type: 'spring', stiffness: 60, damping: 8 }, // Joyful bounce
} as const;
```

### Mode-Specific Motion

| Category    | Browse                    | Work                    | Analyze                |
| ----------- | ------------------------- | ----------------------- | ---------------------- |
| Enter       | Full spring (300ms)       | Fast fade (150ms)       | Instant (0ms)          |
| Feedback    | Spring scale + glow       | Opacity flash           | Background color pulse |
| Transition  | Slide + fade              | Cut (instant)           | Cut                    |
| Celebration | Full animation + confetti | Subtle glow + checkmark | Score update highlight |

### Governance-Specific Animations

| Animation            | Category    | Description                                                            |
| -------------------- | ----------- | ---------------------------------------------------------------------- |
| Ring fill            | Enter       | Governance ring segment fills clockwise with spring physics            |
| Score reveal         | Enter       | Number counts up from 0 to value over 400ms in Fraunces display        |
| Vote cast            | Celebration | Selected vote color pulses outward, button scales to 1.05 then settles |
| Rationale published  | Celebration | Brief aurora glow on card border, checkmark pop                        |
| Delegation confirmed | Celebration | Connection line draws between citizen and DRep nodes                   |
| Ring closed          | Celebration | Ring completes 360 degrees, brief golden pulse on full circle          |
| Proposal queued      | Feedback    | Card slides right into "reviewed" stack                                |
| Mode switch          | Transition  | Cross-fade between density levels, 200ms                               |

### Reduced Motion

When `prefers-reduced-motion: reduce`:

- All Enter animations → instant (opacity: 0 → 1, no spring)
- All Feedback → opacity change only (no scale, no spring)
- All Transition → instant cut
- All Celebration → static final state (no animation, still show the visual result)

---

## 6. Signature Elements

### Governance Rings

The primary signature element. Inspired by Apple Health activity rings but purpose-built for civic participation.

**Three rings, three dimensions of governance health:**

| Ring       | Dimension     | Color           | What It Measures                                                                             |
| ---------- | ------------- | --------------- | -------------------------------------------------------------------------------------------- |
| **Outer**  | Participation | Compass Teal    | Are you showing up? Votes cast, proposals reviewed, sessions active                          |
| **Middle** | Deliberation  | Wayfinder Amber | Are you thinking deeply? Time spent on proposals, annotations made, rationales published     |
| **Inner**  | Impact        | Meridian Violet | Is your governance making a difference? Delegation count, vote influence, alignment accuracy |

**Visual Design:**

- Three concentric circular arcs, each filling 0–360 degrees
- Gap between rings: 4px (Browse), 3px (Work), 2px (Analyze)
- Ring stroke width: 12px (hero), 8px (card), 4px (badge)
- Background track: 8% opacity of ring color (shows unfilled portion)
- Fill animation: clockwise spring, staggered start (outer → middle → inner, 100ms delay)
- Completion: when a ring reaches 100%, brief golden pulse on the filled arc

**Size Variants:**

| Variant  | Diameter | Use Case                               |
| -------- | -------- | -------------------------------------- |
| `hero`   | 200px    | Hub page hero, profile hero            |
| `card`   | 80px     | Dashboard cards, sidebar               |
| `badge`  | 32px     | Navigation indicator, inline reference |
| `inline` | 20px     | Next to text, table cells              |

**Interaction:**

- Hover on a ring → tooltip shows dimension name + current value + what would improve it
- Click → navigates to the relevant section (Participation → vote history, Deliberation → review activity, Impact → delegation stats)

**Epoch Reset:**

Rings reset each epoch (5 days). Previous epoch rings are shown as faded ghosts behind current epoch rings, creating a "progress trail" visual history.

**The Share Moment:**

"Close your governance rings" — when all three rings hit 100% in an epoch, trigger a celebration animation and offer a share card: "I closed my governance rings for Epoch 142."

### HexScore (Retained, Refined)

HexScore remains as the entity-level score visualization. Refinements for the new design language:

- Score number rendered in **Fraunces Display** (serif) instead of Geist Mono
- Breathing glow tinted with the entity's tier color (unchanged)
- Edge shimmer slightly warmer in Browse mode, cooler in Work mode
- Size variants maintained: hero-lg (172px), hero (120px), card (48px), badge (24px)

### Alignment Compass (Future)

A 6-axis radar visualization showing a user's governance identity across the alignment dimensions. Not for the initial proof of concept, but designed into the system for later:

- Each axis: treasury-conservative, treasury-growth, decentralization, security, innovation, transparency
- Rendered as a filled polygon on a hexagonal grid
- Color: gradient from primary to secondary based on dominant dimension
- Planned for: profile pages, match comparison, "your governance fingerprint"

---

## 7. Component Philosophy

### Layer Architecture

```
Layer 4: Page Compositions      (Hub, ReviewWorkspace, DRepProfile)
Layer 3: Governance Primitives  (VoteAction, ScoreDisplay, ProposalQueue, GovernanceRings)
Layer 2: Foundation Primitives  (Button, Card, Input, Dialog — built on Radix)
Layer 1: Providers              (ModeProvider, ShortcutProvider, ProposalContext, TierThemeProvider)
Layer 0: Design Tokens          (CSS variables — colors, typography, spacing, motion)
```

### Foundation Primitives (Layer 2) — Built on Radix

Replace shadcn with governance-native Radix implementations. Same components, Governada identity baked in.

Every foundation primitive:

- Uses `data-slot` for global CSS targeting (retain existing pattern)
- Responds to mode CSS variables (spacing, radius, typography adapt automatically)
- Has accessible labels, focus management, keyboard nav via Radix
- Supports `asChild` for composition

### Governance Primitives (Layer 3) — Domain-Specific

Each governance primitive:

1. **Declares its data contract** — typed props matching `lib/` data shapes
2. **Self-registers keyboard shortcuts** — via ShortcutProvider context
3. **Auto-fires analytics** — PostHog events on meaningful interactions
4. **Has built-in states** — documented state machine (idle → active → loading → success → error)
5. **Adapts to mode** — Browse/Work/Analyze variants designed in, not bolted on
6. **Composes via context** — primitives inside `<ProposalContext>` share state automatically

### The Composition Protocol

```tsx
// ProposalContext provides shared state to all governance primitives within it
<ProposalContext proposal={currentProposal}>
  {/* All children share proposal state — select in queue, everything updates */}
  <ProposalQueue items={proposals} />
  <ProposalBrief />
  <VoteAction />
  <ScoreDisplay />
  <IntelligenceStrip />
</ProposalContext>
```

Changing the selected proposal in `ProposalQueue` cascades to all siblings. Bloomberg's "security groups" pattern, applied to governance.

---

## 8. Keyboard & Command System

### Command Palette (Cmd+K)

Universal search + actions + navigation. Every keyboard chord, page, and action accessible through one interface.

- **Search**: proposals by title, DReps by name, governance actions
- **Navigate**: type a page name to go there
- **Act**: "Vote Yes on..." "Delegate to..." "Create draft..."
- **Recent**: last 5 actions for quick replay

### Chord Navigation

| Chord | Action             | Context |
| ----- | ------------------ | ------- |
| `G W` | Go to Workspace    | Global  |
| `G H` | Go to Hub          | Global  |
| `G P` | Go to Proposals    | Global  |
| `G M` | Go to Match        | Global  |
| `G S` | Go to Settings     | Global  |
| `?`   | Show shortcut help | Global  |

### Direct Actions (Work Mode)

| Key         | Action                   | Context        |
| ----------- | ------------------------ | -------------- |
| `Y`         | Vote Yes / Affirm        | Review panel   |
| `N`         | Vote No / Oppose         | Review panel   |
| `A`         | Vote Abstain / Reserve   | Review panel   |
| `J` / `K`   | Next / Previous in queue | Queue panel    |
| `Enter`     | Open selected item       | Queue panel    |
| `S`         | Snooze proposal          | Review panel   |
| `R`         | Start rationale          | Review panel   |
| `Escape`    | Back / Close / Deselect  | Global         |
| `Cmd+Enter` | Submit / Confirm         | Forms, dialogs |

### Context Awareness

- Letter shortcuts (Y/N/A/J/K/S/R) are **disabled** when focus is in a text input or textarea
- Chord shortcuts (G+W) work everywhere except when a modal is open
- Cmd+K works everywhere, always
- ShortcutProvider manages all registration, context, and conflict resolution

---

## 9. Implementation: Hub Proof of Concept

The Hub page is the proof of concept for the design language. It proves Browse mode, Governance Rings, the new typography, and context-adaptive theming.

### What Changes

| Element       | Current                 | New                                   |
| ------------- | ----------------------- | ------------------------------------- |
| Theme         | Dark (constellation bg) | Light (warm paper) in Browse mode     |
| Typography    | Geist Sans              | Space Grotesk body + Fraunces display |
| Hero element  | Card grid               | Governance Rings (hero size, 200px)   |
| Color accent  | Electric cyan           | Compass Teal                          |
| Card spacing  | Dense (space-y-3)       | Generous (space-y-4, larger padding)  |
| Score numbers | Geist Mono              | Fraunces Display                      |
| Info style    | Cards with links        | Narrative summary + cards             |

### Hub Layout (Browse Mode)

```
┌─────────────────────────────────────────┐
│  [Logo]  Governada  [Mode] [Settings]   │  ← Header
├─────────────────────────────────────────┤
│                                         │
│         [Governance Rings: hero]        │  ← Hero: 200px rings
│      Participation · Deliberation       │     with ring labels
│              · Impact                   │
│                                         │
│   "Your governance is healthy."         │  ← One-line verdict (Fraunces)
│   "3 proposals need your attention      │     Contextual subtitle (Space)
│    before Epoch 143 ends."              │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│   ┌─ Action Card ─────────────────┐     │  ← Priority actions (if any)
│   │  3 proposals awaiting vote     │     │     Compass teal accent
│   │  [Review Now →]               │     │
│   └───────────────────────────────┘     │
│                                         │
│   ┌─ Governance Pulse ───────────┐     │  ← Health summary
│   │  GHI: 74 (Strong)            │     │     Score in Fraunces
│   │  Treasury: ₳1.2B             │     │     Amount in Geist Mono
│   │  Active DReps: 847           │     │
│   └───────────────────────────────┘     │
│                                         │
│   ┌─ Your Delegation ────────────┐     │  ← Persona-specific
│   │  Delegated to: DRepName      │     │
│   │  Score: 72  Alignment: 85%   │     │
│   └───────────────────────────────┘     │
│                                         │
│   ┌─ Discovery ──────────────────┐     │  ← Engagement
│   │  Find your governance team   │     │
│   │  [Explore →]                 │     │
│   └───────────────────────────────┘     │
│                                         │
└─────────────────────────────────────────┘
```

### What Stays

- Persona-adaptive card selection (HubCardConfig.ts)
- SSR governance pulse data
- TanStack Query for client-side personalization
- SegmentProvider persona routing
- Feature flag architecture
- Constellation background (moved to Work mode only, or as a subtle element)

### Implementation Steps

1. **Add Fraunces font** to `app/layout.tsx` via `next/font/google`
2. **Create ModeProvider** in `components/providers/ModeProvider.tsx`
3. **Update globals.css** — new color tokens, mode-scoped spacing/typography variables
4. **Build GovernanceRings** component with hero/card/badge/inline variants
5. **Rebuild Hub page** with Browse mode layout, Governance Rings hero, new typography
6. **Wire mode auto-selection** — Hub → Browse mode
7. **Feature-flag the new design** — `design_language_v2` flag, existing Hub as fallback

### What NOT to Do Yet

- Don't rebuild workspace pages (Work mode proof comes after Hub validation)
- Don't build command palette or keyboard system (that's Work mode)
- Don't replace shadcn components globally (do that after Hub validates the language)
- Don't build Alignment Compass (future signature element)
- Don't build Analyze mode (lowest priority, prove Browse and Work first)

---

## 10. Validation Criteria

The Hub proof of concept succeeds if:

1. **First impression test**: A new visitor can identify Governada's purpose in <5 seconds without reading text (rings + typography + color = "governance health")
2. **Screenshot test**: The Governance Rings hero is immediately recognizable — someone seeing a screenshot says "what app is that?"
3. **Typography test**: Score numbers in Fraunces feel like verdicts, not statistics. Body text in Space Grotesk reads comfortably at proposal length.
4. **Temperature test**: Browse mode feels warm and inviting. Not cold, not sterile, not startup-generic.
5. **Mode contrast test**: Switching to Work mode (when built) feels like a genuine context shift — not just smaller text.
6. **Founder test**: You look at the Hub and think "this was designed for governance" — not "this is a nice React app."
