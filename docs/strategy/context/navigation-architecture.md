# Navigation Architecture Spec

> **Purpose:** Definitive reference for all navigation, routing, and information architecture decisions. Every page, section, and nav element must conform to this spec. Agents MUST read this before building any page, layout, or navigation component.
> **Status:** Approved architecture. Implementation pending.
> **Companion docs:** `ux-constraints.md` (page-level JTBD), `persona-quick-ref.md` (persona JTBDs)

---

## Core Principles

1. **JTBD-driven, not entity-driven.** Sections are organized around what users DO, not what data types exist. There is no "browse entities" section.
2. **Hub-first.** The Home page (`/`) is every persona's control center. Most navigation starts from Hub cards that link deeper. The nav bar is a safety net, not the primary navigation surface.
3. **Aggressive persona adaptation.** Different personas see different nav items, different Hub content, different defaults. This is not one product with conditional elements — it's different products sharing an engine.
4. **Additive layers.** Personas stack. Everyone has the citizen layer. DReps add a workspace. SPOs add a workspace. DRep+SPO gets both. Nobody loses the citizen layer.
5. **Three navigation tiers.** Global nav (top bar / bottom bar), section nav (sidebar / pill bar), and contextual nav (tabs within entity pages). Each tier uses the right pattern for its job.

---

## Sections

### Hub (Home)

| Attribute        | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| **Route**        | `/`                                                         |
| **Purpose**      | Persona-adaptive control center. What needs your attention? |
| **Who sees it**  | Everyone (content adapts per persona + state)               |
| **Nav position** | Always first in global nav                                  |

The Hub is NOT a landing page for authenticated users. It is an intelligent briefing surface that composites cards from all active persona layers, sorted by urgency.

**Hub card types:**

- **Action cards** — time-sensitive items requiring user response (DRep votes, delegation alerts)
- **Status cards** — health indicators and summaries (delegation status, governance health, score trends)
- **Engagement cards** — polls, sentiment votes, discussion prompts (the engagement layer)
- **Discovery cards** — contextual suggestions (find a pool, explore a proposal)

Cards are sorted by urgency: action > status > engagement > discovery. Within each tier, personalization determines order.

**Anonymous Home** is a landing/conversion page — value prop, social proof, two CTAs ("Find Your Representative" + "Explore Governance").

See `ux-constraints.md` for per-persona Hub constraints.

### Workspace

| Attribute        | Value                                    |
| ---------------- | ---------------------------------------- |
| **Route**        | `/workspace`                             |
| **Purpose**      | Tools for doing your governance job      |
| **Who sees it**  | DRep, SPO (not citizens, not anonymous)  |
| **Nav position** | Second item in global nav (when visible) |

Workspace is where governance actors DO WORK — vote, write rationales, manage delegators, improve scores. It is action-oriented, not informational.

**Workspace adapts per persona:**

DRep sub-pages:

- `/workspace` — Action Queue (default: proposals needing votes, sorted by deadline)
- `/workspace/votes` — Your voting record with rationales
- `/workspace/rationales` — Your published rationales and their reception
- `/workspace/delegators` — Who trusts you, delegator communication, growth trends
- `/workspace/performance` — Your score breakdown, competitive position, improvement suggestions

SPO sub-pages:

- `/workspace` — Governance Score dashboard (default: score + trend + improvement tips)
- `/workspace/pool-profile` — Your pool's public governance identity (edit)
- `/workspace/delegators` — Who stakes with you, delegator communication
- `/workspace/position` — Competitive landscape, peer comparison, governance rankings

DRep+SPO: Both sets of sub-pages appear in the sidebar, grouped by role with clear headers ("DRep" / "Pool"). Action Queue remains the default landing.

### Governance

| Attribute        | Value                                                            |
| ---------------- | ---------------------------------------------------------------- |
| **Route**        | `/governance`                                                    |
| **Purpose**      | Understand what's happening in Cardano governance                |
| **Who sees it**  | Everyone                                                         |
| **Nav position** | Third item in global nav (second for personas without Workspace) |

Governance is the universal section where users explore governance activity. It is NOT an entity browser — it's organized around governance activity with entity directories as sub-pages.

Sub-pages:

- `/governance` — Overview (redirects to persona-default sub-page, or shows a governance summary)
- `/governance/proposals` — What's being decided. Active proposals with status, voting deadlines, stake impact.
- `/governance/representatives` — Who represents ADA holders. DRep directory with governance framing (delegation concentration, participation rates, then individual DReps).
- `/governance/pools` — Infrastructure operators and their governance participation. Pool directory with governance scores.
- `/governance/committee` — Constitutional Committee. CC member directory, transparency index, voting records.
- `/governance/treasury` — How community funds are being spent. Treasury activity, fund tracking, spending transparency.
- `/governance/health` — Governance Health Index. GHI score, participation trends, epoch history. (Absorbs the current `/pulse` section.)

**Persona-aware default landing:**

| Persona               | Default sub-page              | Why                                                    |
| --------------------- | ----------------------------- | ------------------------------------------------------ |
| Anonymous             | `/governance/proposals`       | "See what's being decided" — most tangible entry point |
| Citizen (undelegated) | `/governance/representatives` | Finding a DRep is their primary need                   |
| Citizen (delegated)   | `/governance/proposals`       | Understanding what's happening is their ongoing need   |
| DRep                  | `/governance/proposals`       | Research beyond their action queue                     |
| SPO                   | `/governance/pools`           | Competitive landscape                                  |

### You (Account)

| Attribute        | Value                                      |
| ---------------- | ------------------------------------------ |
| **Route**        | `/you`                                     |
| **Purpose**      | Your identity, settings, and notifications |
| **Who sees it**  | Authenticated users                        |
| **Nav position** | Last item in global nav                    |

"You" is account management — who you are, not what you do. Governance activity lives on the Hub and in the Workspace. "You" is for identity, settings, and notification history.

Sub-pages:

- `/you` — Governance ID summary (your shareable governance identity card)
- `/you/identity` — Connected wallets, credentials, verification status
- `/you/inbox` — Full notification history (also accessible via notification bell icon in top bar)
- `/you/settings` — Preferences, display, notification controls

DRep additions:

- `/you/public-profile` — How delegators see you (edit your public-facing profile)

SPO additions:

- `/you/pool-profile` — Your pool's public governance page (view as others see it)

### Match (Funnel Tool)

| Attribute        | Value                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| **Route**        | `/match`                                                                    |
| **Purpose**      | Find your governance team (DRep + governance-active pool)                   |
| **Who sees it**  | Primarily anonymous and undelegated citizens                                |
| **Nav position** | In bottom bar for anonymous/undelegated; accessible via Hub card for others |

Match is a conversion funnel, not a permanent section. It is prominent for users who need to find representation and secondary for users who already have it.

**Expanded scope:** Match covers both DRep matching (governance values alignment) and Pool matching (governance-active pool discovery). The flow guides users to assemble their "governance team."

### Delegation

| Attribute        | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| **Route**        | `/delegation`                                                 |
| **Purpose**      | Monitor both governance relationships (DRep + Pool)           |
| **Who sees it**  | Authenticated citizens with at least one delegation           |
| **Nav position** | In bottom bar for delegated citizens; accessible via Hub card |

The Delegation page shows both governance relationships — your DRep AND your stake pool operator — with health indicators, alignment scores, and governance coverage analysis.

**Key concept: Governance Coverage.** Citizens need both a good DRep AND a governance-active pool to be fully represented. DReps vote on most governance actions (treasury, parameters, constitution). SPOs vote on hard forks and certain parameter changes. Together, they cover 100% of governance action types.

Page content:

- DRep card: status, voting record, alignment score, activity
- Pool card: governance score, voting participation, governance activity
- Coverage analysis: what percentage of governance action types your representatives cover
- Conflict detection: alerts when your DRep and pool vote opposite ways
- Gap detection: alerts when either representative stops participating
- Improvement suggestions: better alternatives when gaps exist

### Help

| Attribute        | Value                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| **Route**        | `/help`                                                                  |
| **Purpose**      | FAQ, glossary, methodology, support                                      |
| **Who sees it**  | Everyone                                                                 |
| **Nav position** | In bottom bar for anonymous; accessible from user menu for authenticated |

Help absorbs `/methodology` and replaces `/learn`. Education is delivered inline (contextual tooltips, first-time banners, empty state guidance), with Help as the reference destination for users who want to go deeper.

Sub-pages:

- `/help` — FAQ + search
- `/help/glossary` — Governance terminology
- `/help/methodology` — Scoring methodology (absorbs current `/methodology`)
- `/help/support` — Contact, feedback, status

---

## Entity Pages (Standalone Detail Views)

Entity pages are accessed via Hub cards, Governance sub-pages, search, or direct links. They are NOT part of a section — they stand alone.

| Route                | Purpose                                          | Breadcrumb                            |
| -------------------- | ------------------------------------------------ | ------------------------------------- |
| `/drep/[id]`         | DRep profile — decide if I should delegate       | Governance > Representatives > [Name] |
| `/pool/[id]`         | Pool profile — evaluate governance participation | Governance > Pools > [Name]           |
| `/committee/[id]`    | CC member profile — check accountability         | Governance > Committee > [Name]       |
| `/proposal/[tx]/[i]` | Proposal detail — understand and decide          | Governance > Proposals > [Title]      |
| `/compare`           | Side-by-side comparison                          | (contextual — depends on entry point) |

**Entity page navigation rules:**

1. Show breadcrumbs linking back to the parent Governance sub-page
2. Use horizontal tabs for facets of the entity (voting record, score, community = tabs on a DRep profile)
3. Include "Related" navigation: DRep profile links to proposals they voted on, proposal links to DReps who voted
4. Include persona-aware CTAs: citizen sees "Delegate to this DRep", DRep sees "Compare to my record"

---

## Mobile Bottom Bar (4 items, persona-adaptive)

The bottom bar is the primary navigation surface on mobile. It adapts per persona to show the 4 most important sections.

| Persona                   | Item 1 | Item 2     | Item 3     | Item 4 |
| ------------------------- | ------ | ---------- | ---------- | ------ |
| **Anonymous**             | Home   | Governance | Match      | Help   |
| **Citizen (undelegated)** | Home   | Governance | Match      | You    |
| **Citizen (delegated)**   | Home   | Governance | Delegation | You    |
| **DRep**                  | Home   | Workspace  | Governance | You    |
| **SPO**                   | Home   | Workspace  | Governance | You    |
| **DRep + SPO**            | Home   | Workspace  | Governance | You    |
| **CC Member**             | Home   | Governance | Delegation | You    |

**Bottom bar rules:**

1. Always exactly 4 items
2. Home is always first
3. Items not in the bottom bar are accessible via the Hub, sidebar (desktop), or user menu
4. Notification badge on You when unread inbox items exist
5. Workspace shows a badge when action items are pending (DRep: votes due)
6. Delegation shows a badge when governance health changes (DRep inactive, pool stopped voting)

### Mobile Section Nav: Contextual Pill Bar

When inside a section with sub-pages, a sticky horizontal pill bar appears below the page header. Pills are route links, not tabs.

Example — entering Governance on mobile:

```
[Proposals] [Representatives] [Pools] [Committee] [Treasury] [Health]
```

**Pill bar rules:**

1. Only appears in sections with 2+ sub-pages
2. Scrollable horizontally if items exceed screen width
3. Active pill is visually distinct (filled vs. outlined)
4. Scroll-aware: hides on scroll-down, reappears on scroll-up (like Safari's address bar)
5. Links to real routes, not client-side tab state
6. Default selected pill matches persona-aware default sub-page

---

## Desktop Sidebar

On desktop (≥1024px), the left sidebar provides persistent navigation for all sections. It is collapsible to icons only.

```
HOME                          ← Always visible

WORKSPACE                     ← DRep/SPO only
├── Action Queue              ← DRep
├── Voting Record             ← DRep
├── Rationales                ← DRep
├── Gov Score                 ← SPO
├── Pool Profile              ← SPO
├── Delegators                ← DRep, SPO (grouped if both)
└── Performance / Position    ← DRep, SPO

GOVERNANCE                    ← Everyone
├── Proposals
├── Representatives
├── Pools
├── Committee
├── Treasury
└── Health

──────────────────
DELEGATION                    ← Authenticated w/ delegation
YOU                           ← Authenticated
HELP                          ← Everyone
```

**Sidebar rules:**

1. Collapsible to icon-only mode (user preference, persisted)
2. Sections without sub-pages (Home, Delegation) are single links, not expandable groups
3. Workspace section only renders for DRep/SPO personas
4. Sub-pages within each section are always visible (not collapsed by default) — the sidebar is the wayfinding surface, hiding items defeats its purpose
5. Active page highlighted with distinct background + left border accent
6. Width: 240px expanded, 64px collapsed
7. On screens < 1024px, sidebar is hidden (mobile pill bar + bottom bar take over)

---

## Desktop Top Bar

The top bar is minimal on desktop — the sidebar handles navigation.

```
[Logo/Home]                                    [Search ⌘K] [Notification Bell] [Theme] [User Menu]
```

**Top bar elements:**

- Logo: links to `/` (Home)
- Search: opens command palette (⌘K). Universal access to any page, entity, or action.
- Notification bell: unread count badge, opens inbox dropdown or links to `/you/inbox`
- Theme toggle: light/dark
- User menu: profile pic → dropdown with: View Profile, Settings, Help, Admin (if admin), Disconnect Wallet

**No navigation links in the top bar.** The sidebar handles all navigation on desktop.

---

## Engagement Layer (Not a Section)

Engagement is a behavior layer, not a navigation destination. It surfaces across the product:

1. **Hub action cards** — polls, sentiment votes, discussion prompts. Sorted by relevance and timeliness.
2. **Entity page prompts** — "How do you feel about this proposal?" on proposal detail, "Rate your DRep" on DRep profiles.
3. **Workspace feedback** — "Your rationale got 94% agreement" on DRep workspace.
4. **Browsable feed** — All active engagement opportunities at `/governance/community` (optional sub-page, low priority). Most users encounter engagement through Hub cards, not by browsing.

Every engagement action generates data (sentiment, satisfaction, governance temperature) that feeds back into intelligence (Pulse scores, DRep ratings, coverage analysis).

---

## Governance Coverage (New Concept)

Governance Coverage is the idea that citizens need BOTH a good DRep AND a governance-active pool to be fully represented. This is a key differentiator for Governada.

**How it works:**

- DReps vote on: treasury withdrawals, parameter changes, hard forks, constitution changes, committee elections, info actions
- SPOs vote on: hard fork initiation, certain parameter changes, no-confidence motions
- Together, they cover all governance action types
- Governance Coverage % = (action types where at least one representative voted) / (total action types with votes this epoch)

**Where it surfaces:**

- Hub status card: "Your governance coverage: 85%"
- Delegation page: detailed breakdown by action type
- Match flow: "Complete your governance team" when only DRep or only pool is delegated
- Alerts: "Your pool hasn't voted on any governance action this epoch — your coverage dropped to 60%"

**Intelligence opportunities:**

- Conflict detection: DRep and pool voted opposite ways
- Gap detection: one representative stopped participating
- Trend analysis: coverage over time
- Improvement suggestions: pools/DReps that would increase coverage

---

## Route Migration Map

Current routes → new routes. Redirects must be maintained for SEO and existing links.

| Current Route             | New Route                                   | Redirect                                       |
| ------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `/`                       | `/`                                         | No change (content adapts per persona)         |
| `/discover`               | `/governance`                               | 301 redirect                                   |
| `/discover?tab=dreps`     | `/governance/representatives`               | 301 redirect                                   |
| `/discover?tab=spos`      | `/governance/pools`                         | 301 redirect                                   |
| `/discover?tab=proposals` | `/governance/proposals`                     | 301 redirect                                   |
| `/discover?tab=committee` | `/governance/committee`                     | 301 redirect                                   |
| `/discover?tab=rankings`  | `/governance/representatives?view=rankings` | 301 redirect                                   |
| `/pulse`                  | `/governance/health`                        | 301 redirect                                   |
| `/pulse/history`          | `/governance/health?period=history`         | 301 redirect                                   |
| `/pulse/report/[epoch]`   | `/governance/health/epoch/[epoch]`          | 301 redirect                                   |
| `/my-gov`                 | `/` (Hub)                                   | 301 redirect (authenticated users land on Hub) |
| `/my-gov/identity`        | `/you/identity`                             | 301 redirect                                   |
| `/my-gov/inbox`           | `/you/inbox`                                | 301 redirect                                   |
| `/my-gov/profile`         | `/you/settings`                             | 301 redirect                                   |
| `/engage`                 | `/` (Hub engagement cards)                  | 301 redirect                                   |
| `/learn`                  | `/help`                                     | 301 redirect                                   |
| `/methodology`            | `/help/methodology`                         | 301 redirect                                   |
| `/match`                  | `/match`                                    | No change                                      |
| `/drep/[id]`              | `/drep/[id]`                                | No change                                      |
| `/pool/[id]`              | `/pool/[id]`                                | No change                                      |
| `/proposal/[tx]/[i]`      | `/proposal/[tx]/[i]`                        | No change                                      |
| `/committee/[id]`         | `/committee/[id]`                           | No change                                      |
| `/compare`                | `/compare`                                  | No change                                      |
| `/developers`             | `/developers`                               | No change (B2B, separate audience)             |

**Redirect implementation:** Next.js `next.config.ts` redirects for simple routes. Middleware for query-param-based redirects (discover tabs, pulse tabs).

---

## Navigation State Management

### URL Strategy

- Section sub-pages use real routes (`/governance/proposals`), not query params or tabs
- Entity page facets use hash (`/drep/[id]#voting`) for tab state within a profile
- Filters and view options use query params (`/governance/representatives?sort=score&tier=rising`)
- Persona-aware defaults are server-side redirects, not client-side

### Sidebar State

- Collapsed/expanded state persisted to `localStorage`
- Active section auto-expands in sidebar
- No "sticky last page" — entering a section always goes to the persona-default sub-page (unless user navigated directly via URL)

### Bottom Bar State

- Active item determined by current route prefix (`/workspace/*` → Workspace active)
- Badge counts fetched via TanStack Query with polling interval
- Persona detection via `useSegment()` hook — bottom bar items render from a config array, not hardcoded

---

## Admin Section (Unchanged)

Admin (`/admin`) retains its existing sidebar layout. It is a separate product surface for operators, not subject to persona adaptation.

---

## Anti-Patterns

Agents MUST NOT:

1. **Use tabs for what should be separate routes.** Tabs are for facets of ONE entity (DRep profile tabs). Different pages that happen to share a section are separate routes with sidebar/pill navigation.
2. **Put entity directories in the top-level nav.** DReps, Pools, Proposals are sub-pages of Governance, not top-level sections. The nav reflects user intent (understand governance), not data type (browse DReps).
3. **Show the same nav to all personas.** The bottom bar, sidebar items, and Hub content MUST adapt. If a citizen and a DRep see identical navigation, the implementation is wrong.
4. **Hide depth behind the command palette.** ⌘K is a power-user shortcut, not a substitute for visible navigation. Every important page must be reachable via the sidebar or bottom bar within 2 taps.
5. **Create new top-level sections without updating this spec.** The section inventory (Hub, Workspace, Governance, You, Match, Delegation, Help) is closed. New features go inside existing sections or this spec is updated first.
6. **Use query params for persistent navigation state.** `?tab=dreps` is a smell. If it deserves a tab, it deserves a route.
7. **Build engagement as a destination.** Engagement is a layer that surfaces through Hub cards and contextual prompts. There is no `/engage` section.

---

## Implementation Notes

### Component Architecture

```
app/
├── layout.tsx              ← Root layout: providers + shell
├── page.tsx                ← Hub (persona-adaptive)
├── delegation/
│   └── page.tsx            ← Delegation health (both reps)
├── workspace/
│   ├── layout.tsx          ← Workspace layout (sidebar aware)
│   ├── page.tsx            ← Default: Action Queue (DRep) or Gov Score (SPO)
│   ├── votes/page.tsx
│   ├── rationales/page.tsx
│   ├── delegators/page.tsx
│   ├── performance/page.tsx
│   ├── pool-profile/page.tsx    ← SPO only
│   └── position/page.tsx        ← SPO only
├── governance/
│   ├── layout.tsx          ← Governance layout (sidebar/pill bar aware)
│   ├── page.tsx            ← Redirects to persona-default sub-page
│   ├── proposals/page.tsx
│   ├── representatives/page.tsx
│   ├── pools/page.tsx
│   ├── committee/
│   │   └── page.tsx
│   ├── treasury/page.tsx
│   └── health/
│       ├── page.tsx        ← GHI + current epoch
│       └── epoch/[epoch]/page.tsx
├── you/
│   ├── layout.tsx
│   ├── page.tsx            ← Governance ID card
│   ├── identity/page.tsx
│   ├── inbox/page.tsx
│   ├── settings/page.tsx
│   └── public-profile/page.tsx  ← DRep/SPO only
├── match/page.tsx
├── help/
│   ├── page.tsx
│   ├── glossary/page.tsx
│   ├── methodology/page.tsx
│   └── support/page.tsx
├── drep/[drepId]/page.tsx
├── pool/[poolId]/page.tsx
├── committee/[ccHotId]/page.tsx
├── proposal/[txHash]/[index]/page.tsx
├── compare/page.tsx
├── developers/page.tsx
└── admin/                  ← Unchanged
```

### Shell Component Update

The `GovernadaShell` (or its replacement) must:

1. Render the sidebar on desktop (≥1024px) and bottom bar on mobile (<1024px)
2. Read persona from `useSegment()` to determine which nav items to show
3. Render the pill bar inside section layouts, not in the shell
4. Handle sidebar collapse state via localStorage
5. Show notification bell in top bar with unread count

### View As Registry Update

The admin View As system must be updated to:

1. Preview each persona's bottom bar configuration
2. Preview each persona's sidebar items
3. Preview each persona's Hub card composition
4. Test delegation states: undelegated, DRep only, pool only, both, neither active

---

## How Agents Use This Document

### Before building ANY page:

1. Check which section the page belongs to
2. Verify the route matches this spec
3. Confirm the page appears in the correct sidebar/pill bar position
4. Check that persona adaptation is implemented (different personas may see different content on the same route)

### Before modifying navigation:

1. Re-read this spec
2. Verify the change doesn't violate anti-patterns
3. If adding a new page, specify which section it belongs to and what pill bar / sidebar position it gets
4. If the change affects the bottom bar or sidebar structure, update this spec in the same PR

### Before auditing navigation:

1. Use this spec as the reference architecture
2. Score against: does the implementation match the spec?
3. Do NOT recommend adding new top-level sections without proposing an update to this spec first
