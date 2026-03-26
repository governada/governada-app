# Exploration: Seneca End-to-End App Experience

> **Feature:** Unified Seneca AI companion presence across ALL pages
> **Date:** 2026-03-25
> **Status:** Exploration complete — ready for founder review
> **Trigger:** Current Seneca appears as 3 different surfaces with 3 different personalities. The founder wants ONE cohesive Seneca that "follows" users throughout navigation.

---

## Phase 1: Current State Audit

### What Exists Today

Seneca currently manifests as **three distinct surfaces** with different form factors, positions, content strategies, and personalities:

#### Surface 1: SenecaDock (Homepage Only)

- **File:** `components/governada/home/SenecaDock.tsx`
- **Position:** Fixed bottom-left (`fixed bottom-4 left-4`)
- **Form factor:** Floating card (22rem width), rounded, glassmorphic
- **Content:** Warm conversational greeting with 3 visit states (first-visit, returning, post-match)
- **Interaction model:** Pre-computed guided options (no AI API calls). Click-through navigation ("What's being decided?", "How does governance work?", "Who are the representatives?")
- **Personality:** Warm, welcoming, Seneca-as-greeter. Uses Fraunces display font. Shows Compass Sigil.
- **Only appears for:** Anonymous users on the homepage

#### Surface 2: IntelligencePanel (Desktop, All Governance Pages)

- **File:** `components/governada/IntelligencePanel.tsx`
- **Position:** Fixed right-side panel (`fixed top-10 bottom-0 right-0`), 280-320px wide
- **Form factor:** Full-height sidebar with route-based content switching via `PanelRouter`
- **Content:** Data-heavy briefings per page context (HubPanel, ProposalPanel, DRepPanel, TreasuryPanel, GovernancePanel). ReadinessSignal at top. SenecaInput at bottom.
- **Interaction model:** Toggle with `]` key or Compass icon. Four modes: briefing, conversation, research, matching.
- **Personality:** Four personas (Navigator, Analyst, Partner, Guide) with different accent colors, ghost prompts, and system prompt modifiers. Persona switches automatically based on route.
- **Only appears when:** `governance_copilot` flag is on, viewport >= 1280px, not in Studio mode

#### Surface 3: MobileIntelSheet + PeekBar (Mobile, All Pages)

- **Files:** `components/governada/panel/MobileIntelSheet.tsx`, `components/governada/panel/PeekBar.tsx`
- **Position:** PeekBar fixed at bottom (above bottom nav). Sheet rises from bottom (50% or 85% height).
- **Form factor:** Bottom sheet with drag handle, gesture-driven. Three states: closed, half, full.
- **Content:** Same briefing content as desktop panel (via children), plus conversation/match/research modes.
- **Personality:** Inherits from desktop panel personas.
- **Only appears when:** `governance_copilot` flag on, viewport < 1280px

#### Orphaned Surface: IntelligencePreview

- **File:** `components/hub/IntelligencePreview.tsx`
- **Form factor:** Inline card component showing one AI headline from the epoch briefing
- **Not currently used in main page flows** but exists as a standalone card

### The Consistency Problem

| Dimension           | SenecaDock              | IntelligencePanel              | MobileIntelSheet     |
| ------------------- | ----------------------- | ------------------------------ | -------------------- |
| **Position**        | Bottom-left             | Right sidebar                  | Bottom sheet         |
| **Trigger**         | Always visible          | Toggle (`]` key / icon)        | Tap PeekBar          |
| **Tone**            | Warm, personal          | Data-driven, analytical        | Varies (inherits)    |
| **AI calls**        | None (pre-computed)     | Full streaming AI              | Full streaming AI    |
| **Visual identity** | CompassSigil + Fraunces | CompassSigil + persona accents | No sigil in PeekBar  |
| **Auth state**      | Anonymous only          | Authenticated only             | Authenticated only   |
| **Pages**           | Homepage only           | All governance pages           | All governance pages |

**Core issues:**

1. **Identity fracture.** A user who meets Seneca on the homepage as a warm guide, then navigates to `/governance/proposals` and opens the panel, encounters a completely different surface — different position, different form factor, different content strategy. It does not feel like the same character.

2. **The anonymous-to-authenticated cliff.** SenecaDock disappears entirely when the user logs in. There is no transition. The warm guide they met on the homepage simply vanishes, replaced by a data panel they must discover via a keyboard shortcut or tiny icon.

3. **Data dumps masquerading as Seneca.** The panel briefing mode (PanelRouter) renders route-specific data panels (HubPanel, ProposalPanel, etc.) that are essentially structured data readouts. They are not conversational. They do not feel like Seneca speaking. They feel like dashboard widgets inside a sidebar.

4. **Position inconsistency.** Bottom-left (dock) vs right-side (panel) vs bottom (mobile). Users build spatial memory. Seneca has no stable spatial anchor.

5. **No Seneca on non-governance pages.** If a user is on `/workspace/review` (Studio mode) or `/you`, Seneca is completely absent. The copilot flag hides it in Studio mode.

---

## Phase 2: Three Alternative Concepts

### Concept A: "The Compass Corner" — Persistent Lower-Left Dock Everywhere

**Core idea:** Seneca always lives in the lower-left corner of the screen, on every page, in every auth state. Same position, same form factor, same character. The dock is the universal Seneca surface. It expands upward into a conversational panel when opened.

**How it works:**

- **Collapsed state (always visible):** A compact pill/orb in the lower-left showing the Compass Sigil + a one-line contextual whisper. On the homepage: "Find your representative." On proposals: "3 proposals need attention." On a DRep profile: "Aligned 78% with your values." On workspace: "2 reviews in your queue."
- **Expanded state (on click/tap):** The dock expands upward into a 400px-tall conversational panel anchored to the bottom-left. Contains: Seneca greeting, contextual briefing (conversational, not data dump), ghost prompts, input field. Full conversation happens here.
- **Full-panel state:** Further expansion to near-full-height panel for deep conversations, match flow, or research mode.
- **Anonymous vs authenticated:** Same surface, different depth. Anonymous gets pre-computed guided options. Authenticated gets full AI streaming. The transition is invisible — same dock, richer responses.
- **Mobile:** Same lower-left position. Collapsed = small floating orb above the bottom nav. Expanded = bottom sheet (reuses existing MobileIntelSheet mechanics but anchored from the orb).

**What gets deprecated:**

- IntelligencePanel (right-side sidebar) — gone entirely
- PanelRouter and route-specific data panels — replaced by conversational briefings
- SenecaDock — merged into the universal Compass Corner

**Strengths:** Maximum position consistency. Users always know where Seneca lives. The lower-left is warm and approachable (research shows bottom-left is associated with "helper" roles — Intercom, Zendesk). Does not compete with main content for right-side real estate.

**Weaknesses:** Lower-left competes with page content on narrow viewports. Expanding upward is unusual (most panels expand rightward or downward). Desktop users lose the always-visible briefing sidebar — all intelligence requires opening Seneca.

**Inspiration:** Intercom Fin (persistent bottom corner, expands to conversation), Google Gemini floating overlay (floating orb that expands to panel).

---

### Concept B: "The Living Sidebar" — Persistent Right Panel, Conversational Redesign

**Core idea:** Keep the right-side panel position but fundamentally redesign it to feel like Seneca speaking, not a data dashboard. The panel is conversational-first on every page. Data becomes Seneca's words, not widget cards.

**How it works:**

- **Panel always present (when opened):** Right-side panel at 280-320px, toggleable via `]` key or header icon. Same as today's position.
- **Conversational-first content:** Instead of HubPanel/ProposalPanel data dumps, every route shows a Seneca monologue: a paragraph or two of narrated intelligence. "Three proposals are active this epoch. The most contested one is about treasury spending — 52% yes, but momentum is shifting. Want me to break it down?" This replaces the structured data cards.
- **Warm greeting persists:** The panel always opens with a Seneca greeting (using the warmth system — first visit, returning, post-match) before the page-specific briefing.
- **Anonymous experience:** On the homepage, the panel replaces the SenecaDock. It shows the same warm greeting and guided options but inside the panel position. Anonymous users see a "Ask Seneca" prompt that leads to pre-computed responses.
- **Mobile:** Bottom sheet (no change in position), but content is conversational rather than data cards.
- **SenecaDock becomes a teaser:** On the homepage only, a small lower-left "nudge" says "Meet Seneca →" and opens the right panel when clicked. After first interaction, the nudge hides and users use the Compass icon.

**What gets deprecated:**

- PanelRouter route-specific data panels — replaced by conversational briefings
- SenecaDock as a standalone surface — becomes a one-time teaser

**Strengths:** Minimal architectural disruption (right-side panel already exists and works). Clear precedent (Cursor, GitHub Copilot, VS Code). Does not compete with left-side navigation. Desktop users can keep the panel open while browsing.

**Weaknesses:** Right-side panels feel more "tool" than "companion." The panel is hidden by default — users who never discover the `]` shortcut or Compass icon may never meet Seneca. Anonymous users on the homepage must discover the panel via a teaser or icon.

**Inspiration:** Cursor AI sidebar (persistent, context-aware, right-side), GitHub Copilot Chat panel.

---

### Concept C: "The Seneca Thread" — Unified Floating Companion with Page Whispers

**Core idea:** Seneca is a single floating presence that moves WITH the user — like a thread of conversation that never ends. The visual form is a persistent floating orb (Compass Sigil) that whispers context-aware one-liners into the page, and expands into a full conversational panel when engaged.

**How it works:**

- **The Orb (always visible):** A 40px Compass Sigil orb floating in the lower-right corner, always visible on every page, every auth state. The orb has a subtle animation state: idle (breathing), attention (pulsing — something noteworthy on this page), speaking (when a whisper is active), thinking (when processing).
- **Whispers (proactive, ambient):** When a user lands on a page where Seneca has something contextually relevant, a small speech bubble appears next to the orb for 4-5 seconds and fades. "This DRep missed 3 votes last epoch." "Treasury spending is up 40%." "Your delegation health is strong." These are pre-computed (no AI API call) — generated during data sync. User can dismiss or tap to expand.
- **The Thread (on tap/click):** Tapping the orb opens a conversation panel (overlaid, not a sidebar) anchored from the orb position. 360px wide, up to 600px tall, floating above page content. The conversation is persistent — messages from previous pages remain in the thread, creating continuity. "Earlier you asked about treasury proposals. Now you're looking at DRep X — they voted Yes on that proposal."
- **Cross-page memory:** The thread carries conversation context across navigation. When a user moves from `/governance/proposals` to `/drep/xyz`, Seneca acknowledges the transition: "Looking at a specific DRep now? This one voted on 2 of the proposals we discussed."
- **Anonymous vs authenticated:** Anonymous: orb + whispers (pre-computed) + guided conversation (no AI). Authenticated: orb + whispers + full AI conversation with memory.
- **Mobile:** Orb in lower-right, above bottom nav. Tap opens a full-screen conversation sheet (not half-sheet — conversational mode deserves full attention). Whispers appear as a toast notification above the orb.

**What gets deprecated:**

- IntelligencePanel (right sidebar) — replaced by floating Thread
- SenecaDock — replaced by the universal Orb
- MobileIntelSheet half-sheet briefing mode — replaced by full-screen Thread
- PanelRouter data panels — replaced by conversational intelligence and whispers
- ReadinessSignal — becomes a whisper

**Strengths:** Most character-consistent. Seneca feels like ONE entity that follows you. Cross-page memory creates a relationship that deepens over a session. Whispers are the highest-ceiling innovation — ambient intelligence that does not require user initiation. The orb is the most compact possible persistent presence.

**Weaknesses:** Floating panels are harder to make feel stable than docked sidebars. Cross-page memory requires client-side conversation state management (currently conversations reset on route change). Whispers need a content pipeline — pre-computed insights per page context. Most ambitious to build.

**Inspiration:** Spotify AI DJ (narrated curation, proactive context), Apple Intelligence (system-wide consistent presence, proactive suggestions), Google Gemini floating overlay (persistent orb with expandable panel).

---

## Phase 3: External Research & Inspiration

### Industry Patterns for Persistent AI Companions (2025-2026)

**Seven dominant AI placement patterns** have emerged in product design, mapped by a UX Collective analysis:

1. **Bottom-right float** (Intercom, Zendesk) — discoverable without being intrusive, serves as "the helper" archetype
2. **Right-side panel** (Cursor, GitHub Copilot, Microsoft Copilot) — on-demand assistant for complex primary tasks
3. **Left-side panel** (ChatGPT Canvas, Lovable) — "strategic partner" positioning for co-creation
4. **Inline within objects** (Notion AI, Google Docs) — AI lives inside the content, activated contextually
5. **Full-screen conversation** (ChatGPT, Claude) — dedicated AI interface
6. **Command palette overlay** (Linear, Raycast) — invoked on demand, disappears after use
7. **Ambient/generative UI** (emerging) — AI determines what UI to show based on context

**Key insight:** Spatial placement defines the mental model users form about the AI's role. A right-side panel says "tool assistant." A bottom-right float says "helpful companion." Inline says "co-author." The placement IS the personality.

### Intercom Fin: The Benchmark for Consistent Multi-Surface AI

Intercom's Fin runs on a unified AI foundation that powers chat, email, voice, and social — same knowledge base, same behavior, across every channel. When Fin improves in one channel, all channels benefit. The design principle: **one brain, many mouths.** The customer never feels like they are talking to a different agent when switching channels.

**Applicable learning:** Seneca should have one intelligence layer that powers all surfaces. The persona system (`senecaPersonas.ts`) is a good foundation — but today it only changes system prompts. The visual form factor change (dock vs panel vs sheet) undermines the persona consistency.

### Cursor: Context-Aware Persistent Sidebar

Cursor 2.0 made agents first-class objects in a persistent sidebar. The sidebar understands the ENTIRE codebase context — not just the current file. Multiple agents can work in parallel. The user hops between agent conversations.

**Applicable learning:** Seneca's conversation should be persistent across page navigation, not reset on route change (as it does today via `useIntelligencePanel`). The panel should understand the user's navigation journey, not just the current page.

### Spotify AI DJ: Narrated Curation as Companion

Spotify's AI DJ combines personalization data, generative AI, and editorial curation into a narrated experience. The DJ does not just play music — it explains WHY it chose each track, tells artist stories, and contextualizes selections. The voice creates a relationship.

**Applicable learning:** Seneca's briefings should be NARRATED, not listed. Instead of "Active proposals: 3. DReps voting: 127. Treasury balance: 1.2B ADA" — Seneca should say: "Three proposals are live right now. The treasury one is the most contested I've seen in five epochs. 127 DReps have voted so far, but the outcome is still uncertain." This is the difference between a dashboard and a companion.

### Google Gemini: The Floating Overlay Pattern

Google's Gemini on Android introduced a floating overlay pattern: a persistent orb that can be moved, expanded into a conversation panel, and used alongside any app. The orb serves as a visual anchor — users always know where Gemini is.

**Applicable learning:** The floating orb with expansion is the most space-efficient persistent presence pattern. It works at all viewport sizes and does not compete with app chrome.

### The "Companion Era" Trend (2026)

Industry analysis identifies 2026 as the "Companion Era" in AI design — where AI systems shift from transactional assistants to persistent companions with memory, personality consistency, and proactive behavior. Key traits:

- **Cross-session memory:** Remembering previous interactions
- **Proactive check-ins:** Not waiting for the user to ask
- **Consistent personality:** Same character across all touchpoints
- **Emotional awareness:** Adapting tone to user state

---

## Phase 4: Data Opportunity Scan

### Pre-Computed Contextual Intelligence (Whisper Pipeline)

The existing data infrastructure already generates per-page intelligence that could power ambient whispers:

| Page Context    | Available Data                                   | Potential Whisper                                                                 |
| --------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Proposals list  | Active count, voting deadlines, treasury amounts | "The treasury proposal closing tomorrow has the tightest vote I've seen — 51/49." |
| DRep profile    | Alignment score, voting streak, missed votes     | "This DRep is 82% aligned with you but missed 3 votes last epoch."                |
| Treasury        | Balance, NCL utilization, spending trends        | "Treasury spending is up 40% this epoch. Most of it is infrastructure."           |
| Health          | GHI score, EDI metrics, participation trends     | "Governance health is strong at 72, but participation dipped this week."          |
| Workspace       | Review queue count, pending actions, deadlines   | "You have 2 reviews due before epoch end."                                        |
| Homepage (auth) | Delegation health, action items, epoch progress  | "Your delegation is healthy. Epoch 500 is 60% through."                           |

**The whisper pipeline** would run during Inngest sync jobs: as data is processed, generate one-line contextual insights per page context and cache them in Redis (or Supabase). No AI API call needed at page load — just read the pre-computed whisper for the current route.

### Session Continuity State

Today, `useIntelligencePanel` resets mode and pendingQuery on route change (line 170-173). A session-scoped conversation store (Zustand or React context) could maintain:

- Conversation messages across page navigations
- Previously viewed entities (for cross-referencing)
- User's expressed interests/questions this session
- Which pages received whispers (avoid repeating)

### Engagement Signal: Seneca Interaction Depth

Every Seneca interaction is an engagement signal:

- Whisper seen (passive) → lowest signal
- Orb tapped → medium signal
- Question asked → strong signal
- Follow-up question → very strong signal
- Cross-page conversation → power user signal

These signals could feed into the engagement system and credibility framework.

---

## Phase 5: Recommended Direction

### Recommendation: Concept C — "The Seneca Thread" (with phased rollout)

**Why Concept C wins:**

1. **Highest character consistency.** The orb IS Seneca everywhere. No form factor switching. No position switching. Users build a relationship with a single visual entity.

2. **Whispers are the killer feature.** No competitor in the governance space (or Web3 broadly) offers ambient proactive intelligence. Whispers make Seneca feel alive — it notices things on each page without the user asking. This is the Spotify DJ model applied to governance.

3. **Cross-page memory creates compound value.** A conversation that carries across pages is qualitatively different from a conversation that resets. It transforms Seneca from a per-page FAQ into a session-long governance companion. "We were talking about treasury proposals — this DRep you're looking at voted Yes on the one you were concerned about."

4. **Smoothest anonymous-to-authenticated transition.** The orb is the same for anonymous and authenticated users. Anonymous users get pre-computed whispers and guided conversation. Authenticated users get the same plus AI streaming and memory. The transition is an upgrade, not a replacement.

5. **Most space-efficient.** A 40px orb has near-zero footprint when collapsed. The floating panel does not consume permanent screen real estate like a sidebar. On mobile, the orb is the most compact possible persistent presence.

**Why not Concept A (Lower-Left Dock):** Expanding upward from the bottom-left is spatially awkward. It also puts Seneca in conflict with any future lower-left UI (like navigation tooltips or the existing SenecaDock layout).

**Why not Concept B (Conversational Sidebar):** The right-side sidebar is a proven pattern but inherently feels like a "tool panel" rather than a "companion." It also requires explicit toggling — users who never discover the shortcut never meet Seneca. The sidebar consumes permanent real estate when open, pushing main content left.

### Detailed Architecture: The Seneca Thread

#### The Universal Orb

```
Position: fixed, lower-right corner
  Desktop: bottom-6, right-6 (24px from edges)
  Mobile: bottom-20 (above bottom nav), right-4
Size: 40px (resting), 44px (attention pulse)
Visual: Compass Sigil with animation states
Z-index: 40 (above content, below modals)
```

**Orb states:**

- `idle` — subtle breathing animation (existing CompassSigil "greeting" state)
- `attention` — gentle pulse with persona accent color when a whisper is queued
- `speaking` — Sigil animation (existing "speaking" state) during whisper display
- `thinking` — rotation animation (existing "thinking"/"searching" states) during AI processing
- `minimized` — smaller (32px) after user dismisses the thread, until next page navigation

**Orb interaction:**

- Click/tap → open the Thread panel
- Long-press/hover → show a tooltip: "Ask Seneca anything" or the current whisper text
- Drag → reposition (optional, for power users who want it elsewhere)

#### Whisper System

```
Lifecycle:
  1. User navigates to a page
  2. After 1.5s settle time, check for a queued whisper for this route context
  3. Animate a speech bubble from the orb (max 80 chars, one sentence)
  4. Bubble visible for 5 seconds, then fades
  5. If user taps the whisper, open the Thread with that context pre-loaded
  6. If user ignores, the whisper is "spent" — not shown again this session
```

**Whisper sources:**

- **Pre-computed (sync pipeline):** Generated during Inngest jobs. One whisper per page context per epoch. Cached in Redis or Supabase `seneca_whispers` table.
- **Reactive (client-side):** Based on user's session behavior. "You've been looking at treasury proposals — the NCL is 60% utilized this epoch." Generated by client-side rules, no API call.
- **Proactive (AI-generated, authenticated only):** For high-engagement users, an AI-generated contextual insight. Rate-limited to 1 per session to control API costs.

**Whisper content guidelines:**

- Always in Seneca's voice (conversational, not data-readout)
- Always actionable or insightful (not just restating what the user can see)
- Never alarming — governance companion, not a notification system
- Maximum one whisper per page visit
- No whisper on pages the user has visited < 2 seconds ago (prevent spam during rapid navigation)

#### The Thread Panel

```
Position: floating, anchored from the orb
  Desktop: 380px wide, max 70vh tall, lower-right origin
  Mobile: full-screen sheet from bottom (100% width, 90vh)
Visual: glassmorphic (bg-black/75 backdrop-blur-2xl), rounded-2xl
  Compass Sigil at top-left of panel header
  Persona accent color as subtle top border
```

**Thread panel structure:**

1. **Header:** Compass Sigil + "Seneca" + persona label (if not Navigator) + close button
2. **Conversation area:** Scrollable message thread. Messages persist across page navigations.
3. **Context indicator:** A subtle strip showing current page context: "Proposals" / "DRep: Alice" / "Treasury". Updates on navigation without interrupting the conversation.
4. **Input area:** Text input with ghost prompts (from persona system). "Ask Seneca" placeholder.
5. **Quick actions:** Below the input, 2-3 contextual action chips. "Summarize this page" / "Compare with..." / "Find my match"

**Conversation continuity:**

- Messages are stored in a session-scoped Zustand store (not React state that resets on route change)
- When user navigates, a subtle system message appears in the thread: "--- Now viewing: Proposals ---"
- Seneca can reference previous messages: "Earlier you asked about X..."
- On page reload, the conversation store rehydrates from sessionStorage
- Conversation clears on logout or explicit "Start fresh" action

#### Anonymous vs Authenticated Behavior

| Capability    | Anonymous                        | Authenticated                              |
| ------------- | -------------------------------- | ------------------------------------------ |
| Orb visible   | Yes, all pages                   | Yes, all pages                             |
| Whispers      | Pre-computed only, generic       | Pre-computed + personalized + AI-generated |
| Conversation  | Guided options (no free-text AI) | Full streaming AI                          |
| Memory        | Session only, no cross-session   | Session + server-side history (future)     |
| Match flow    | Full (already works pre-auth)    | Full + saved results                       |
| Ghost prompts | Navigation-oriented              | Persona + context-aware                    |
| Input field   | Shows guided options grid        | Full text input + guided options           |

**The transition moment:** When an anonymous user connects their wallet or logs in, the thread shows: "Welcome back — now I can give you personalized insights. Your delegation to [DRep X] is healthy." The orb pulses with the persona accent color. Same surface, upgraded intelligence.

#### What Gets Deprecated

| Current Surface              | Disposition                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `SenecaDock`                 | **Deprecated.** Replaced by the universal Orb + whisper on homepage.                     |
| `IntelligencePanel`          | **Deprecated.** Replaced by the floating Thread panel.                                   |
| `MobileIntelSheet`           | **Deprecated.** Replaced by mobile Thread (full-screen sheet).                           |
| `PeekBar`                    | **Deprecated.** Replaced by the universal Orb.                                           |
| `PanelRouter` + route panels | **Deprecated.** Briefing data becomes conversational whispers and narrated responses.    |
| `ReadinessSignal`            | **Deprecated as standalone.** Becomes a whisper source.                                  |
| `IntelligencePreview`        | **Deprecated.** Becomes a whisper source.                                                |
| `useIntelligencePanel`       | **Refactored** into `useSenecaThread` with session-scoped state.                         |
| `senecaPersonas.ts`          | **Kept and enhanced.** Persona system drives whisper tone, ghost prompts, accent colors. |
| `CompassSigil`               | **Kept and promoted.** Becomes the universal Seneca identity.                            |

### Implementation Phases

#### Phase 1: The Universal Orb (Small, foundational)

- Create `SenecaOrb` component — persistent lower-right floating Compass Sigil
- Wire into `GovernadaShell` so it appears on every page, every auth state
- Clicking opens the existing conversation system (temporarily) in a floating panel
- Deprecate `SenecaDock` — orb takes its place on the homepage
- Feature-flagged: `seneca_thread`

#### Phase 2: Floating Thread Panel (Medium, replaces sidebar)

- Create `SenecaThread` floating panel component
- Migrate conversation UI from `IntelligencePanel` into the floating panel
- Add session-scoped Zustand store for conversation persistence
- Page navigation markers in the conversation thread
- Deprecate `IntelligencePanel` and `MobileIntelSheet`

#### Phase 3: Whisper System (Medium, the differentiator)

- Create whisper content pipeline in Inngest sync jobs
- Create `seneca_whispers` cache (Redis or Supabase)
- Build `useWhisper` hook — reads context, displays speech bubble from orb
- Client-side reactive whispers based on session behavior
- Rate limiting and deduplication logic

#### Phase 4: Conversational Briefings (Medium, content quality)

- Replace PanelRouter data panels with narrated conversational briefings
- Each page context gets a "Seneca narration" — one paragraph of interpreted intelligence
- Shown as the first message in the Thread when user opens it on a new page
- Pre-computed (like whispers) for speed, AI-enhanced for authenticated users

#### Phase 5: Cross-Page Memory (Small-medium, compound value)

- Session context tracking: which pages visited, which entities viewed
- Seneca references previous conversation in new contexts
- "Earlier you asked about X" cross-referencing
- Session-scoped only (no server persistence in v1)

#### Phase 6: Mobile Excellence (Medium, parallel with above)

- Mobile orb positioning and interaction
- Full-screen Thread sheet with gesture support
- Whisper-as-toast on mobile
- Safe area handling

---

## Phase 6: Risk Assessment & Open Questions

### Technical Risks

| Risk                                                             | Severity | Mitigation                                                                          |
| ---------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| Floating panel z-index conflicts with modals, tooltips, sheets   | Medium   | Strict z-index layering system. Thread at z-40, modals at z-50.                     |
| Session Zustand store grows unbounded in long sessions           | Low      | Cap at 50 messages. Older messages archived but retrievable.                        |
| Whisper pipeline adds complexity to Inngest sync                 | Low      | Whispers are optional enrichment — sync works without them.                         |
| Pre-computed whispers become stale mid-epoch                     | Low      | TTL-based cache. Whispers refresh on next sync.                                     |
| Floating panel overlaps important page content on small desktops | Medium   | Dismiss/minimize behavior. Panel repositions if overlapping key UI.                 |
| Anonymous guided conversation feels limited vs full AI           | Low      | Make the guided options genuinely useful. The match flow already proves this works. |

### UX Risks

| Risk                                                 | Severity | Mitigation                                                                                                    |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Whispers feel annoying/interruptive                  | High     | Strict rate limiting (1 per page, 5-second max). Fade gracefully. "Mute whispers" setting.                    |
| Users miss the orb entirely                          | Medium   | First-visit attention animation. Whisper on homepage draws eye to orb.                                        |
| Floating panel feels less stable than docked sidebar | Medium   | Spring physics, glassmorphic design, consistent anchor position.                                              |
| Cross-page memory feels "creepy"                     | Low      | Only reference things the user explicitly asked about. Never reference browsing patterns without being asked. |

### Open Questions for Founder

1. **Orb position: lower-right or lower-left?** Lower-right is industry standard (Intercom, Zendesk, etc.) and does not conflict with navigation rail. Lower-left has the warmth of the current SenecaDock. Recommendation: lower-right.

2. **Should whispers be opt-in or opt-out?** Recommendation: opt-out (on by default, with "Mute Seneca" in settings). The first whisper experience is the hook.

3. **Thread conversation persistence: session only or cross-session?** Recommendation: session-only for v1. Cross-session (server-side history) is a premium feature for later.

4. **Should the Thread panel be resizable/repositionable?** Recommendation: no for v1. Fixed size and position. Simplicity over flexibility.

5. **Whisper frequency: how often is too often?** Recommendation: maximum 1 whisper per page visit, maximum 5 whispers per session. First-time visitors get more, returning users get fewer (they know the data).

6. **What happens to the `]` keyboard shortcut?** Recommendation: repurpose to toggle the Thread panel (same muscle memory, new surface).

7. **Studio mode (workspace/review, workspace/author): should Seneca be present?** The current system hides the copilot in Studio mode. Recommendation: keep the orb visible even in Studio mode — it becomes the Partner persona, offering drafting help and constitutional checks. But no whispers in Studio (focus mode).

---

## Summary

Seneca today is three different surfaces pretending to be one character. The Seneca Thread concept unifies them into a single persistent floating companion — an orb that follows users everywhere, whispers contextual intelligence, and expands into a continuous conversation that carries across pages.

The key innovations are:

1. **The Orb** — a universal 40px Compass Sigil that IS Seneca on every page
2. **Whispers** — ambient proactive intelligence (no competitor has this in governance)
3. **The Thread** — a floating conversation panel with cross-page memory
4. **Narrated briefings** — data interpreted as Seneca's voice, not widget cards
5. **Seamless auth transition** — same surface, upgraded intelligence

The phased rollout (Orb → Thread → Whispers → Briefings → Memory → Mobile) lets each piece ship independently while building toward the full vision. Phase 1 (the Orb) is the smallest possible change with the largest identity impact — it immediately gives Seneca a consistent home.
