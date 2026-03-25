# Seneca: The AI Governance Companion

## The Concept

Seneca is not a chatbot. Seneca is not a feature. Seneca is the intelligence layer that makes Governada feel alive — a context-aware AI companion that shifts roles depending on where you are and what you need, from navigation guide to governance analyst to authoring partner. The globe is the body; Seneca is the mind.

The name matters: Seneca the Younger was a Stoic philosopher and political advisor — someone who helped leaders think more clearly about governance, not someone who made decisions for them. That's the role. Seneca illuminates; the user decides.

## Design Principles

### 1. User-Invoked, Never Proactive-by-Default

The #1 lesson from 30 years of AI assistants (Clippy → Cortana → Siri → Rabbit R1): the user controls when AI appears. Seneca is AVAILABLE when you want, INVISIBLE when you don't. Exception: subtle ambient signals (globe glow, badge pulse) that hint intelligence is available without interrupting.

### 2. Progressive Disclosure Across Three Tiers

Inspired by Cursor's Tab → Chat → Agent model:

- **Tier 1 — Ambient Intelligence**: Annotations, smart badges, and narrative blocks embedded directly in the UI. Always visible, always sourced. Not a separate "AI surface."
- **Tier 2 — The Companion Panel**: Conversational side panel, invoked via keyboard shortcut (⌘K / Ctrl+K) or globe interaction. Context-aware, citable, deep.
- **Tier 3 — Full Research Mode**: Autonomous briefing/analysis that shows reasoning steps, sources, and confidence. The "agent" surface.

### 3. Show Your Work — Always

Every AI-generated insight must link to its source: on-chain votes, proposal text, treasury movements, constitutional articles. Governance is high-stakes. Black-box AI is unacceptable. Follow the Perplexity model: citations inline, reasoning visible, sources first-class UI elements.

### 4. Augment the Interface, Never Replace It

The globe, the cards, the proposal pages, the score rings — these ARE the product. Seneca makes these surfaces smarter, not redundant. The Rabbit R1 and Humane Pin proved that "just talk to the AI" fails. Users need visual structure, direct manipulation, and spatial memory.

### 5. Reliability Over Breadth

Better to have Seneca work perfectly in 5 contexts than unreliably across 20. One hallucinated governance fact destroys trust permanently (Apple Intelligence's BBC headline debacle). Launch narrow, expand with proven reliability.

---

## The Three Tiers In Detail

### Tier 1: Ambient Intelligence (The Annotations Layer)

This is the "Tab completions" equivalent — intelligence embedded directly into existing UI, requiring zero user action. It's what makes the app feel alive even before anyone opens the companion panel.

**What this looks like:**

- **Globe narrative pulse**: The 1-2 sentence AI-generated summary below the globe that changes per visit ("Treasury withdrawals hit a 3-epoch high. 4 new proposals are competing for 12M ADA.")
- **Smart badges on cards**: A proposal card shows a small "Constitutional Risk" badge with a 1-line tooltip. A DRep card shows an "Alignment Drift" indicator. These are NOT separate AI features — they're metadata that makes existing UI elements smarter.
- **Contextual annotations on profiles**: On a DRep profile, inline annotations like "Voted against 80% of treasury proposals this epoch — significant shift from historical pattern" appear as part of the profile content, sourced to specific votes.
- **Governance Rings intelligence**: The three rings on the globe aren't just data viz — they carry one-line AI interpretations. "Participation: 67% — highest since epoch 480, driven by treasury proposals."

**Key constraint**: Ambient intelligence must be pre-computed, not real-time. These are generated during sync jobs and cached. No LLM calls on page load. Latency budget: 0ms additional (it's already in the data).

**Trust mechanism**: Every ambient annotation includes a tiny source indicator (a linked footnote or hover-to-reveal citation). "Based on 14 votes in epochs 498-502" — not "AI thinks."

---

### Tier 2: The Companion Panel (Seneca's Primary Surface)

This is the core innovation. A persistent but non-intrusive side panel that is always one gesture away, knows exactly where you are, and adapts its personality and capabilities to the current context.

#### Invocation

- **Keyboard**: ⌘K / Ctrl+K (matches Cursor, Linear, Notion convention)
- **Globe interaction**: Click the Seneca sigil at the globe's south pole (a small, elegant compass-rose icon)
- **Persistent trigger**: A subtle floating compass icon in the bottom-right that pulses gently when contextual intelligence is available
- **Voice** (future): "Hey Seneca" in supported browsers

#### Visual Treatment

The panel slides in from the right edge, occupying ~35% of the viewport on desktop. The main content area compresses (doesn't overlay) so no information is lost. On mobile, it's a bottom sheet that can expand to full screen.

**Visual identity**: The panel has a subtle glass-morphism treatment — slightly translucent, with the globe's light bleeding through. The border uses the Compass Teal gradient. Typography matches the app but at a slightly smaller scale (the panel is a companion to the main content, not competing with it).

**Input area**: Clean, minimal input with a mode indicator showing Seneca's current context. Auto-suggested prompts appear as ghost text based on context.

#### Context Awareness

Seneca always knows:

- **What page you're on** (homepage, proposal detail, DRep profile, workspace)
- **What entity you're viewing** (specific proposal, DRep, pool, epoch)
- **Your persona** (anonymous, citizen, DRep, SPO, CC member)
- **Your governance state** (delegated/undelegated, voting power, recent activity)
- **Time context** (epoch phase, upcoming deadlines, governance calendar)

This context is passed as system context to every interaction — the user never has to explain where they are.

#### Explicit Context Pulling (The @ System)

Inspired by GitHub Copilot's # references:

- `@proposal:treasury-withdrawal-487` — Pull a specific proposal into the conversation
- `@drep:ShelleyGov` — Reference a specific DRep
- `@epoch:502` — Pull epoch context
- `@my-delegation` — Reference your current delegation
- `@constitution:article-4` — Pull a constitutional article
- `@compare:DRep1,DRep2` — Set up a comparison context

Auto-complete triggers after `@`, showing relevant entities based on the current page context.

#### Ghost Prompts (The Cold-Start Solution)

This is critical. The blank input problem ("How can I help?") is solved with contextual ghost prompts — 2-3 suggested starting points that change based on where you are. They appear as faded, clickable text in the input area:

**Homepage (anonymous):**

- "Who should represent my ADA?"
- "What's happening in Cardano governance right now?"
- "Explain how governance works in 30 seconds"

**Homepage (citizen, delegated):**

- "How is my DRep performing this epoch?"
- "Are there proposals I should know about?"
- "Show me what changed since my last visit"

**Proposal detail page:**

- "Explain this proposal's impact on treasury"
- "How does my DRep usually vote on proposals like this?"
- "What does the constitution say about this?"

**DRep profile page:**

- "How aligned is this DRep with my values?"
- "Compare this DRep with my current representative"
- "What's their track record on treasury proposals?"

**Workspace (authoring):**

- "Help me draft the rationale section"
- "Check this against the constitution"
- "What similar proposals have been submitted before?"

Ghost prompts are NOT the only entry point — they're a suggestion layer on top of free-form input. Power users ignore them entirely and type whatever they want.

#### Response Format

Seneca's responses are NOT walls of text. They follow a strict format:

1. **Headline answer** (1 sentence, bold) — The conclusion first
2. **Evidence block** (2-4 bullet points) — Sourced facts supporting the headline
3. **Source citations** (linked to on-chain data or app pages) — Every claim traceable
4. **Follow-up suggestions** (2-3 clickable prompts) — Conversational threading

Example:

> **Your DRep has voted against community consensus on 3 of the last 5 treasury proposals.**
>
> - Voted No on Prop #487 (Treasury Withdrawal 12M ADA) — community voted 72% Yes [↗]
> - Voted No on Prop #491 (Catalyst Fund Extension) — community voted 65% Yes [↗]
> - Voted No on Prop #495 (Infrastructure Grant) — community voted 58% Yes [↗]
>
> Sources: On-chain votes, epochs 498-502 · DRep alignment: 0.42 (↓0.15 from epoch 495)
>
> → "Should I find DReps more aligned with community consensus?"
> → "Why might a DRep vote against community consensus?"
> → "Show me the full voting comparison"

#### Deep Actions (Beyond Conversation)

Seneca can trigger app actions from within the conversation:

- "Navigate me to the treasury overview" → App navigates, panel stays open
- "Start a comparison between these two DReps" → Opens comparison view
- "Begin a new proposal draft" → Opens workspace authoring
- "Delegate to this DRep" → Opens delegation ceremony flow
- "Set up an alert for this proposal's vote deadline" → Creates notification

This blurs the line between conversation and navigation without replacing navigation. The user can always just... click things. But Seneca offers a faster path for complex multi-step journeys.

---

### Tier 3: Full Research Mode (Seneca Deep Dive)

For complex governance analysis that goes beyond quick Q&A. This is the "Agent" tier — autonomous, multi-step, showing its work.

**Invocation**: From the companion panel, "Go deeper" on any topic, or explicit commands like "Research the full impact of this treasury proposal" or "Prepare my epoch briefing."

**Visual treatment**: The panel expands to ~60% of the viewport (or full-screen on mobile). The main content area dims but remains visible. The research process is shown step-by-step (Perplexity-style progress indicators):

```
Analyzing Proposal #487...
├── Reading proposal text and metadata ✓
├── Checking constitutional alignment ✓
├── Reviewing proposer track record ✓
├── Analyzing similar historical proposals ✓
├── Computing treasury impact... ⟳
└── Generating analysis...
```

**Output**: A structured briefing document with sections, citations, confidence levels, and actionable recommendations. Can be saved to the user's governance journal or shared.

**Use cases**:

- Epoch briefings ("What happened this epoch and what's coming")
- Delegation analysis ("Compare my top 5 DRep matches across all dimensions")
- Proposal deep dive ("Full constitutional and treasury analysis of this proposal")
- Governance state ("How healthy is Cardano governance right now, and what concerns should I have?")

---

## Context-Specific Personas

Seneca adapts not just its knowledge but its personality and interaction style based on context. This is NOT different AI models — it's the same intelligence with different system prompts and UI treatments.

### Navigator (Default — Homepage, Governance, Discovery)

**Personality**: Warm, educational, slightly Socratic. Asks clarifying questions to understand what the user cares about. Never condescending.

**Capabilities**: Explain governance concepts, recommend DReps/SPOs, summarize proposals, provide epoch briefings, guide navigation.

**Tone**: "The treasury currently holds 1.2B ADA. There are 4 active withdrawal proposals — the largest requesting 12M ADA for infrastructure. Would you like me to explain what that means for your stake?"

**Visual accent**: Compass Teal (#0E8585) — the primary navigation color

### Analyst (Governance pages, DRep/SPO profiles, Pulse)

**Personality**: Precise, data-driven, comparative. Leads with numbers, follows with context. Comfortable with complexity.

**Capabilities**: Score analysis, alignment comparison, voting pattern detection, trend identification, anomaly flagging.

**Tone**: "This DRep's deliberation score dropped 0.15 this epoch — the sharpest decline in their history. The driver: 3 late votes on treasury proposals (submitted within 2 hours of deadline). Their engagement quality remains high."

**Visual accent**: Wayfinder Amber (#C89B3C) — the analytical/insight color

### Partner (Workspace — Authoring & Review)

**Personality**: Collaborative, direct, professional. Like a senior colleague reviewing your work. Offers concrete suggestions, not vague feedback.

**Capabilities**: Draft assistance, constitutional checking, precedent research, impact analysis, rationale strengthening, review intelligence.

**Tone**: "Your rationale addresses the fiscal impact but doesn't engage with Article 4, Section 3 of the constitution — which three DReps cited when opposing a similar proposal last epoch. Want me to draft a paragraph addressing that?"

**Visual accent**: Meridian Violet (#8B5CF6) — the workspace/impact color

### Guide (You/Identity pages, Settings)

**Personality**: Reflective, personal, empowering. Helps users understand their own governance journey. Celebrates growth.

**Capabilities**: Identity narrative, milestone explanation, governance DNA interpretation, delegation health assessment, settings optimization.

**Tone**: "You've participated in 12 governance actions this epoch — that puts you in the top 8% of active citizens. Your biggest influence was endorsing the infrastructure proposal that passed with 67% support."

**Visual accent**: Gradient (Teal → Amber) — the personal/identity treatment

---

## The Match Flow Inside Seneca (Cerebro Experience)

The existing match infrastructure — 6D alignment vectors, conversational engine state machine, semantic embedding fast-track, quality gates, bridge match logic, GovernanceIdentityCard, MatchResultCard — all stays. Nothing is thrown away. What changes is where it lives and how it connects to the globe.

### How It Works (Desktop)

**Initiation**: User types "Who should represent my ADA?" or clicks the ghost prompt. Seneca recognizes match intent and enters match mode.

**Globe enters Cerebro state** (already implemented in GlobeConstellation):

- All 800 nodes dim to 15% opacity
- Scanning ring animation sweeps the globe surface
- Atmosphere shifts from ambient teal to focused amber
- Rotation slows, camera adjusts for dramatic framing

**Round 1**: Seneca presents the first question in the companion panel. Quick-tap pill buttons (treasury conservative vs. growth vs. balanced) — same ConversationalRound component, reformatted for panel width (~35vw). User taps.

**Globe reacts instantly**: `highlightMatches(userAlignment, threshold: 160)` — ~50-80 nodes light up amber. The convergence begins. The ConfidenceBar renders in the panel showing ~25% confidence.

**Round 2-4**: Each answer tightens the threshold (160 → 100 → 60 → 35). Fewer nodes survive each round. The globe visually narrows from a scattered glow to a concentrated cluster. This is the Cerebro scanning effect — the globe is "thinking," eliminating candidates in real-time. Confidence rises to 40% → 65% → 85%.

**Semantic Fast-Track (Optional)**: At any point, the user can type a freeform governance philosophy instead of answering pills. "I believe in minimal treasury spending and maximum decentralization." Seneca routes this through SemanticFastTrack — the text gets embedded via OpenAI, matched against DRep embeddings in pgvector, and the globe immediately highlights the semantic matches. This skips remaining questions and jumps to results.

**The Reveal**: After the final answer (or semantic fast-track):

1. `flyToMatch(topDrepId)` — dramatic 3-second camera zoom to the top match node
2. The node pulses and enlarges, connection lines appear showing governance neighbors
3. **GovernanceIdentityCard renders in the panel** — the user's governance archetype (e.g., "Treasury Guardian" or "Innovation Advocate") with a mini radar showing their 6D profile
4. Below the identity card: **MatchResultCard** for the top match — alignment %, score, key agree/differ positions, delegation CTA
5. "See more matches" expands to show 3-5 ranked results with horizontal scroll
6. Bridge match (a DRep who bridges the user's views with the broader community) highlighted separately

**Post-Match Actions in Seneca**:

- "Compare my top 3 matches" → Comparison view with globe highlighting all three
- "Why is this DRep my top match?" → Seneca explains the dimensional alignment in plain language, citing specific positions
- "What about SPO matches?" → PoolMatchEnhancement kicks in, globe switches to SPO node highlighting
- "Show me their voting history" → Navigates to DRep profile, Seneca stays open with context
- "Delegate to this DRep" → Delegation ceremony flow (wallet required)

### How the Match Flow Improves vs. Current

| Aspect                 | Current (ImmersiveMatchPage)       | Seneca Match                                |
| ---------------------- | ---------------------------------- | ------------------------------------------- |
| Globe space            | Shares viewport with overlay cards | Full viewport (65-70%), panel is separate   |
| Cerebro effect         | Same                               | Same infrastructure, bigger visual canvas   |
| Conversation threading | Disconnected pages                 | Natural conversational flow with follow-ups |
| Post-match exploration | Navigate away to profiles          | Explore within Seneca, globe responds       |
| Semantic fast-track    | Feature-flagged, separate UI       | Natural freeform input in conversation      |
| SPO matching           | Separate section                   | "What about SPOs?" as a follow-up           |
| Re-matching            | Start over                         | "My priorities changed — re-match me"       |

### Technical Integration

The match flow inside Seneca reuses existing components:

- `conversationalMatch.ts` — state machine drives the question sequence
- `answerVectors.ts` — maps pill selections to 6D alignment
- `GlobeConstellation` imperative API — `highlightMatches()`, `flyToMatch()`, `clearMatches()`
- `ConversationalRound` — renders pills (reformatted for panel width)
- `ConfidenceBar` — renders confidence arc
- `GovernanceIdentityCard` — identity reveal
- `MatchResultCard` — individual result cards
- `SemanticFastTrack` — freeform text embedding match
- `PoolMatchEnhancement` — SPO match recommendations

New code needed:

- **SenecaMatchMode** — orchestrator component that wires Seneca panel to match engine + globe APIs
- **Panel-width responsive variants** of ConversationalRound and MatchResultCard (they currently assume full-width)
- **Globe command bus** — a pub/sub or ref-forwarding system so Seneca can send commands to the globe (`highlightMatches`, `flyToMatch`, `enterCerebro`, `exitCerebro`) without tight coupling

---

## The Homepage Experience (Anonymous)

This is the make-or-break moment. Here's how the globe + Seneca work together:

### Removing the Hero Text

**Current state**: "Your ADA gives you a voice." as an H1 + a NarrativeLine (AI-generated sentence), absolute-positioned at the bottom-center of the hero, fading on scroll.

**Decision: Remove the H1 entirely. Move the narrative to an ambient position.**

Why:

- The H1 is a traditional landing page pattern. It competes with the globe for attention.
- Its CTA ("Find Your Match" cards below) is exactly what Seneca's ghost prompts handle.
- The narrative line ("Treasury proposals surge...") is valuable but doesn't need to be overlaid on the globe — it belongs near Seneca as contextual flavor.
- Removing text from the globe canvas lets the visualization be the statement. The globe IS the hero text. It says "this is alive, this is real, this matters" more powerfully than words.

**What replaces it**: Nothing overlays the globe except:

1. The transparent header (logo + connect wallet)
2. Subtle orbit stats (floating near the globe's equator, part of the 3D scene)
3. The Seneca panel (bottom-left, not overlaying the globe center)

The narrative pulse moves to just above the Seneca input — contextualizing the conversation, not the visualization.

### Globe Placement: Full Immersion

**Current state**: `h-[65vh]`, `min-h-[500px]`, camera at `[0, 3, 14]`, globe center at `[0, 0, 0]`. The globe sits too high, gets clipped at top and bottom, and below-the-fold content (cards, stats, social proof, CTA) dilutes the impact.

**New approach: The globe IS the page.**

```css
/* The hero section becomes the entire viewport */
.homepage-hero {
  height: 100dvh; /* Full viewport, including mobile safe areas */
  width: 100vw;
  position: relative;
  overflow: hidden;
}
```

The globe canvas fills 100% of this container. Camera position adjusts so the globe is centered in the viewport with comfortable breathing room — no clipping at any edge.

**Camera adjustment**: Move from `[0, 3, 14]` to approximately `[0, 1.5, 16]` — pulling back slightly and lowering the camera so the globe sits centered rather than high. The globe radius is 8 units, and at distance 16 with FOV 60, it fills ~55% of the viewport height — large enough to be immersive, small enough to not clip. Governance Rings orbit at radius ~9-10, fully visible.

**Below-the-fold content: Gone for anonymous users.** The homepage is a single screen: globe + Seneca. No scrolling needed. This is a bold decision — it means:

- Stats (DReps, proposals, ADA governed) move into the globe scene as orbit text or into the Seneca panel
- Social proof ("X DReps scored, Y profiles claimed") moves into Seneca's ambient awareness ("There are 487 active DReps governing 1.2B ADA")
- The "Why does this matter?" explainer becomes a Seneca conversation path ("How does this all work?")
- The final CTA ("Ready to use your voice?") is redundant — Seneca IS the CTA

If the user scrolls anyway, a subtle bounce-back or a single "Learn more" link at the very bottom anchors them. But the design says: you don't need to scroll. Everything starts here.

### Desktop Layout (Revised)

```
┌─────────────────────────────────────────────────────────────┐
│  [⊕ Governada]                              [Connect] [⌘K] │
│  ─ ─ ─ ─ ─ transparent header, z-50  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                             │
│                                                             │
│                    ╭─── Governance Rings ───╮               │
│                   ╱                         ╲               │
│                  │    ◉◉◉  ◉◉  ◉◉◉◉        │              │
│                  │  ◉◉  LIVING GLOBE  ◉◉    │              │
│                  │    ◉◉◉  ◉◉  ◉◉◉          │              │
│                   ╲         ◉◉◉            ╱               │
│                    ╰───────────────────────╯                │
│                                                             │
│                  ₳1.2B governed · 487 DReps                 │
│                  Epoch 503 · 2.4 days left                  │
│                                                             │
│  ┌─────────────────────────┐                                │
│  │  "Treasury proposals    │                                │
│  │   surge this epoch"     │                                │
│  │                         │                                │
│  │  ⊕ Seneca               │                                │
│  │                         │                                │
│  │  Who should represent   │                                │
│  │  my ADA?                │                                │
│  │                         │                                │
│  │  What's happening in    │                                │
│  │  governance right now?  │                                │
│  │                         │                                │
│  │  How does this work?    │                                │
│  │                         │                                │
│  │  [___________________]  │                                │
│  └─────────────────────────┘                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Key details:

- **100dvh, no scroll** — the entire anonymous homepage is this single viewport
- **Globe centered** in the upper 60% of the viewport, breathing room on all sides
- **Orbit stats** float near the globe as part of the 3D scene (or as subtle HTML overlays at the globe's equator level) — not a separate section
- **Narrative pulse** ("Treasury proposals surge...") sits just above the Seneca panel as ambient context
- **Seneca panel** docked bottom-left, ~320px wide, glass-morphism with the globe bleeding through
- **Ghost prompts** are the only CTAs. They replace every card and button that existed below the fold.
- **Header** is fully transparent, floating over the globe. Logo left, Connect Wallet right, ⌘K hint far right.

### Globe Interaction Design (Desktop)

The globe is not a static decoration. It's an interactive data visualization that responds to touch, mouse, and keyboard. Here's the complete interaction model:

#### Hover States

**Current problem**: The NodeHoverCard is `fixed bottom-20 left-1/2` — it appears at the center-bottom of the screen regardless of where the node is. This is spatially disconnected. You hover a node in the top-right and the tooltip appears at the center-bottom.

**New approach: Cursor-following tooltip with spatial attachment.**

The hover card tracks the cursor position, offset 16px right and 16px below the pointer. It stays within viewport bounds (flip to left/above if near edges). This makes the tooltip feel attached to the node you're exploring.

```
Hover card positioning:
- Default: 16px right, 16px below cursor
- Near right edge: flip to 16px left of cursor
- Near bottom edge: flip to 16px above cursor
- Smooth transition when flipping (150ms ease-out)
- Appears with scale(0.95) → scale(1) + opacity fade (150ms)
```

**Hover card content (enriched)**:

```
┌──────────────────────────────┐
│  DRep · ◆ LEGENDARY          │
│  ShelleyGov                  │
│                              │
│  Score 8.4  ·  ₳4.2M power  │
│                              │
│  Last vote: 2 days ago       │
│  "Voted Yes on Treasury      │
│   Withdrawal #487"           │
│                              │
│  ▸ 87% aligned with you *    │
│                              │
│  Click to explore            │
└──────────────────────────────┘
  * only shown if user has alignment data
```

Additions vs. current:

- **Last vote context** — what they actually did recently (humanizes the node)
- **Alignment indicator** — if the user has done a match or has alignment data, show how aligned this node is with them. This turns casual browsing into personalized discovery.
- **Tier badge** with the Compass color system (diamond=cyan, legendary=purple, gold=amber, etc.)

**Hover visual on the globe**:

- The hovered node enlarges 1.5x and brightens
- A subtle glow ring appears around it (Compass Teal for DReps, Violet for SPOs, Amber for CC)
- Immediately adjacent nodes (connected by edges) brighten slightly — showing the governance neighborhood
- The rest of the globe dims to ~60% (not fully dimmed — enough to maintain spatial context)

#### Click Interactions

**Single click on a node**:

1. Camera smoothly zooms to the node (`flyToNode` — already implemented)
2. The node enlarges and its connection edges become fully visible
3. **Seneca panel opens** (if not already open) with that entity's context:
   "You selected DRep ShelleyGov. Score 8.4, Legendary tier, 4.2M ADA voting power. They voted on 12 of the last 15 proposals."
4. Ghost prompts update to entity-specific options:
   - "How aligned are they with my values?"
   - "Show me their voting history"
   - "Compare with my current DRep"
5. The peek drawer does NOT open — Seneca replaces the peek drawer for nodes accessed from the globe

**Single click on empty space (not a node)**:

- If zoomed in, reset camera to default position (smooth 800ms transition)
- If at default position, no action
- This provides a natural "escape" from zoomed states

**Click on a Governance Ring**:

1. The ring brightens and pulses once
2. Seneca panel opens with that dimension's context:
   "Participation is at 67% this epoch — the highest since epoch 480. 312 of 487 DReps voted at least once. The surge is driven by 4 treasury proposals."
3. Nodes filter by their contribution to that dimension (e.g., clicking Participation dims nodes that haven't voted recently)

#### Drag Interactions (Globe Rotation)

**Current state**: All camera controls disabled (`mouseButtons` and `touches` all set to 0).

**New approach: Enable orbital rotation with constraints.**

- **Left-click drag**: Rotates the globe around its center. Smooth inertia — the globe keeps spinning briefly after release, then decelerates.
- **Rotation constraints**: Azimuthal unlimited (full 360°), polar limited to ±45° from equator (prevents flipping upside down, keeps the globe legible)
- **Auto-rotation**: Default slow rotation (current `0.012 rad/frame`) pauses when user grabs the globe, resumes 5 seconds after release
- **Drag vs. click disambiguation**: Movement > 5px within 200ms = drag. Less = click. This prevents accidental rotation when trying to click a node.

**Right-click drag**: Disabled (prevents context menu confusion).

#### Zoom Interactions

**Scroll wheel zoom**:

- Scroll up = zoom in (camera moves toward globe center)
- Scroll down = zoom out (camera moves away)
- **Zoom range**: min distance 8 (surface level, nodes fill screen), max distance 22 (full globe with generous margins)
- **Scroll speed**: 0.5 units per scroll tick (smooth, not jarring)
- **Scroll zoom only active when cursor is over the globe canvas** — when cursor is over Seneca panel or other UI, page scrolls normally (this is critical to prevent scroll hijacking)

**Pinch zoom (trackpad/touch)**:

- Same behavior as scroll wheel
- Two-finger pinch on trackpad zooms smoothly
- Same distance constraints

**Zoom levels reveal detail progressively**:

| Distance         | What's Visible                                                  | Interaction                                   |
| ---------------- | --------------------------------------------------------------- | --------------------------------------------- |
| 22 (max out)     | Full globe, all nodes as dots, Rings visible, macro patterns    | Overview mode — see the whole ecosystem       |
| 16 (default)     | Globe with individually distinguishable nodes, hover cards work | Standard exploration                          |
| 12 (medium zoom) | Node names start appearing as tiny labels on larger nodes       | Named exploration — start identifying DReps   |
| 8 (close zoom)   | Delegation edges become visible, node details rich              | Network exploration — see trust relationships |

**Double-click to zoom**: Double-clicking a node zooms to close range (distance 10) centered on that node. Double-clicking empty space resets to default (distance 16).

#### Keyboard Interactions (Power Users)

- **Arrow keys**: Rotate globe (left/right = azimuthal, up/down = polar)
- **+/-**: Zoom in/out
- **Escape**: Reset camera to default position
- **Tab**: Cycle through highlighted/matched nodes (accessibility)
- **Enter** (when a node is focused via Tab): Opens Seneca with that entity's context
- **⌘K**: Opens Seneca panel (regardless of globe state)

### The Seneca Panel (Revised Positioning)

The panel is NOT a fixed overlay in the HTML layer — it's positioned to feel like part of the globe experience.

**Desktop positioning**:

```
Position: fixed
Bottom: 24px
Left: 24px
Width: 340px
Max-height: calc(100dvh - 120px)  /* Room for header + bottom margin */
Border-radius: 20px
Background: rgba(10, 11, 20, 0.85)  /* Globe background color, 85% opacity */
Backdrop-filter: blur(20px)
Border: 1px solid rgba(255, 255, 255, 0.08)
Box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4)
```

The panel has the globe's starfield bleeding through — it feels like a viewport INTO the same space, not a separate UI element slapped on top.

**Panel states**:

1. **Collapsed** (default for returning visitors who dismissed it): Just the compass trigger icon (bottom-left, 48px circle)
2. **Prompt mode** (default for first visit): Input field + ghost prompts visible. ~200px tall.
3. **Conversational** (after first interaction): Full panel with scrollable conversation + input. ~60% viewport height.
4. **Match mode** (during Cerebro): Panel expands slightly, confidence bar appears, pill buttons for quick answers.
5. **Research mode** (Tier 3): Panel expands to ~50% viewport width, main content (globe) compresses.

### The Zero-Scroll Philosophy

The anonymous homepage has NOTHING below the fold. This is radical and intentional.

**What this communicates**: "We're not a landing page. We're a living governance experience. Start exploring."

**What previously lived below the fold and where it goes**:

| Old Element                                     | New Home                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Two-path entry cards (Govern / Stake)           | Seneca ghost prompts ("Who should represent my ADA?" / "Show me stake pools") |
| "Why does this matter?" info box                | Seneca conversation path ("How does governance work?")                        |
| Live stats grid (proposals, DReps, SPOs, votes) | Orbit stats in globe scene + Seneca ambient knowledge                         |
| Social proof strip                              | Removed — the globe with 800+ live nodes IS the social proof                  |
| "Ready to use your voice?" CTA                  | The entire homepage is the CTA                                                |

**Risk and mitigation**: Some anonymous users scroll reflexively and expect content below. Two options:

1. **Subtle scroll indicator**: A barely-visible "↓ Explore governance" text at the very bottom that navigates to `/governance` (the universal explore section)
2. **Scroll-to-Seneca**: If the user scrolls down, the globe shrinks into the header area and Seneca panel expands to fill the viewport — effectively scroll triggers Seneca's expanded mode. This is a delightful discovery moment.

Option 2 is more ambitious and more Governada. The scroll gesture REVEALS Seneca rather than revealing more content. The globe becomes a compact header element, and the full conversation surface opens up.

---

## The Persistent Experience (Authenticated)

Once logged in, Seneca persists across the entire app via:

### The Compass Trigger

A small compass-rose icon (24px, Compass Teal, subtle glow animation when intelligence is available) fixed in the bottom-right corner. Clicking it opens the companion panel.

**State indicators**:

- **Steady glow**: Intelligence available for current context
- **Pulse**: Something time-sensitive (vote deadline, new proposal affecting your delegation)
- **Badge number**: Unread governance updates since last visit

The trigger is NEVER obtrusive. It's more like a notification badge than Clippy. Users who never click it lose nothing — the app is fully functional without Seneca. Users who discover it unlock a superpower.

### The ⌘K Shortcut

For power users, ⌘K opens the companion panel from anywhere. If the panel is already open, ⌘K focuses the input field. This matches the command palette convention from Cursor, Linear, VS Code, and Raycast.

### Panel Persistence

The companion panel maintains conversation context within a session. If you ask about a proposal on the proposal page, navigate to a DRep profile, then reopen the panel, your previous conversation is still there with a context-switch indicator: "You moved to DRep ShelleyGov's profile. Want to continue our proposal discussion, or explore this DRep?"

Between sessions, Seneca retains a lightweight memory of your governance interests, previous questions, and delegation decisions. Not full conversation history — key takeaways and preferences.

---

## Studio Integration (The Partner Transformation)

This is where Seneca's ambition reaches its peak. When users enter Workspace (authoring or reviewing), Seneca transforms from a navigation companion into a professional governance partner.

### Visual Transformation

The companion panel shifts:

- **Border color**: Teal → Violet (Meridian Violet = workspace)
- **Avatar/sigil**: Subtle shift — the compass rose gains a pen stroke (authoring) or a magnifying glass (reviewing)
- **Ghost prompts**: Shift to workflow-specific suggestions
- **Input area**: Gains formatting tools for structured output (bullet lists, constitutional references)

### Authoring Partner

While drafting a proposal:

**Ghost prompts**:

- "Check this against the constitution"
- "What similar proposals have been submitted?"
- "Help me strengthen the fiscal impact section"
- "Draft a rationale for my voting position"

**Active capabilities**:

- **Constitutional checkpoint**: Seneca flags constitutional conflicts in real-time as you draft. "Section 3 of your proposal may conflict with Article 4.2 — the spending threshold. Want me to suggest compliant language?"
- **Precedent research**: "Two similar proposals were submitted in epoch 498. One passed (with community support for the milestone-based disbursement structure) and one failed (the lump-sum approach was cited as the concern). Your proposal uses a milestone approach — that's the pattern that succeeded."
- **Impact projection**: "Based on current treasury reserves and pending proposals, this withdrawal would bring the balance to X ADA — still above the safety threshold."
- **Audience preview**: "Here's how a fiscal conservative DRep might read this section" / "Here's how a community development advocate might respond"

### Reviewing Partner

While reviewing proposals before voting:

**Ghost prompts**:

- "Summarize this proposal in 30 seconds"
- "What are the strongest arguments for and against?"
- "How does this affect my delegators?"
- "What's the proposer's track record?"

**Active capabilities**:

- **Impact-on-delegators analysis**: "Your 127 delegators collectively hold 4.2M ADA. This proposal would affect their staking rewards by approximately..."
- **Cross-body context**: "The Constitutional Committee has signaled they consider this type of proposal constitutional. 4 of 7 members voted Yes on a similar action in epoch 500."
- **Smart rationale drafting**: "Based on your voting history and stated positions, here's a draft rationale that's consistent with your governance philosophy: [draft]. Edit it, or want me to try a different angle?"
- **Dissent analysis**: "You're considering voting No, but 68% of DReps with similar governance profiles voted Yes. Here's why they might disagree with your position — and here's where your reasoning may be stronger."

---

## The Conversation-to-Globe Bridge

This is the novel interaction that could make Governada iconic. The companion panel and the globe are not independent surfaces — they're connected.

### Globe Reactions

| Seneca Action                   | Globe Response                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Shows match results             | Matched DReps glow, others dim. Connection lines show relationships.                        |
| Discusses a proposal            | Nodes that voted on it illuminate. Vote color (cerulean/copper/slate) shows their position. |
| Analyzes governance health      | Rings pulse with current metrics. Underperforming ring glows amber.                         |
| Compares two DReps              | Both nodes enlarge and center. A visual comparison arc connects them.                       |
| Describes community sentiment   | Node clusters organize by sentiment — visual "factions" emerge.                             |
| Explains a constitutional issue | Relevant CC member nodes glow amber. Their vote positions visualize.                        |

### Globe-to-Seneca

The bridge works in reverse too:

- **Click a node on the globe** → Seneca panel opens with that entity's context. "You selected DRep ShelleyGov. They're ranked #12, with an 8.4 composite score. What would you like to know?"
- **Click a governance ring** → Seneca explains that dimension. "Participation is at 67% this epoch. Here's what's driving it..."
- **Hover a cluster** → Seneca's ghost prompts update to reflect that cluster's context

This bidirectional connection is what makes the experience feel like a living organism rather than two features next to each other.

---

## Mobile Experience (Detailed)

Mobile is where most governance apps die — and where Governada can win hardest. 80%+ of Cardano ADA holders access governance from phones. This is not a "responsive downgrade." It's a first-class experience designed for touch, for vertical space, and for moments of governance attention that last 30-90 seconds.

### The Mobile Globe

**Not a fallback. A different visualization.**

The desktop globe is a full Three.js 3D sphere. On mobile, we don't degrade it — we reimagine it as a **2D constellation map** rendered on Canvas 2D (or lightweight WebGL with a fixed orthographic camera). Think: a star chart, not a globe.

Why this is better than "small 3D globe":

- Touch interaction on a 375px 3D sphere is terrible — fat fingers can't select 4px nodes
- 3D rotation on mobile is disorienting (no hover, no precision)
- Battery and thermal impact of full WebGL on mobile is real
- A 2D constellation is legible, beautiful, and touchable

**What the mobile constellation looks like:**

- Nodes arranged in a flat radial layout (6D alignment projected to 2D via the existing PCA)
- DReps as teal dots, SPOs as purple diamonds, CC as amber stars — same visual language
- Node size = voting power (but minimum 8px for touch targets)
- Activity brightness still works (recent voters glow brighter)
- Governance Rings render as concentric circles around the constellation
- Gentle floating/drifting animation (nodes shift slowly, like stars)
- Tap a node → peek card slides up from bottom (name, score, tier, 1-tap to open profile)

**The breathing animation still works** — the entire constellation gently pulses. The narrative text floats above it. The atmosphere is preserved.

**Performance budget**: Canvas 2D with 200-400 visible nodes (LOD reduction from 800), requestAnimationFrame at 30fps cap. Target: <10% CPU on a 2-year-old phone. No WebGL required.

### Mobile Homepage Layout

```
┌───────────────────────────┐
│ [≡]  Governada    [Connect]│
├───────────────────────────┤
│                           │
│   ┌───────────────────┐   │
│   │                   │   │
│   │  2D CONSTELLATION │   │
│   │   (45vh, touch)   │   │
│   │                   │   │
│   │  ◎ Rings overlay  │   │
│   └───────────────────┘   │
│                           │
│  "Treasury proposals surge │
│   — 4 competing for 12M   │
│   ADA this epoch"         │
│                           │
│  487 DReps · 7 proposals  │
│  1.2B ADA · Epoch 503     │
│                           │
├───────────────────────────┤
│  ⊕ Ask Seneca...          │
│  ┌─────────────────────┐  │
│  │ "Who should         │  │
│  │  represent my ADA?" │  │
│  │ "What's happening   │  │
│  │  in governance?"    │  │
│  └─────────────────────┘  │
└───────────────────────────┘
```

Key decisions:

- **Seneca input is docked at the bottom** — not a floating trigger you have to find. It's RIGHT THERE, part of the page, like iMessage at the bottom of a conversation. Ghost prompts visible immediately.
- **No bottom sheet by default** — Seneca's input area is inline on the homepage. Tapping it or a ghost prompt expands the bottom sheet upward (60vh), pushing the constellation up and shrinking it.
- **The constellation shrinks but doesn't disappear** when Seneca expands — it compresses to ~20vh at the top, still visible, still reactive to the conversation.

### Mobile Match Flow (The Cerebro Moment)

This is where mobile can actually be MORE dramatic than desktop because the constellation fills the viewport and the match convergence plays out right in front of you.

**The flow:**

1. User taps "Who should represent my ADA?" ghost prompt
2. **Seneca sheet rises to 40vh** — constellation compresses to top 40vh but enters Cerebro state:
   - Nodes dim except matched ones
   - Scanning ring animation sweeps across the constellation
   - Subtle haptic feedback (the phone buzzes gently with the scan pulse)
3. **Question pills appear in the sheet** — same ConversationalRound component, reformatted for full-width. 2-3 pill options, large touch targets (48px height)
4. User taps an answer → **constellation updates live**:
   - Matched nodes brighten with amber glow
   - Non-matched nodes fade further
   - Haptic tick on each answer
   - ConfidenceBar renders as a thin progress arc at the top of the sheet
5. After 3-4 questions: **The reveal**
   - Constellation zooms/pans to center on the top match
   - The matched node pulses large (20px → 40px)
   - Connection lines appear linking your match to their governance neighbors
   - **The sheet shows the GovernanceIdentityCard** — your governance archetype + top match
   - Haptic celebration pattern (like iOS confetti)
6. **Swipe through results** — horizontal card carousel in the sheet showing top 3-5 matches
7. **Actions**: "View profile" / "Compare matches" / "Delegate" as bottom-fixed buttons

**Why this works on mobile**: The vertical split (constellation top, Seneca bottom) is natural for phones. The convergence animation is MESMERIZING on a handheld screen — it feels like the phone is thinking. Haptic feedback makes it physical.

### Mobile Seneca on Interior Pages

**The Compass Pill**

On interior pages (not homepage), Seneca is invoked via a **floating pill** at the bottom of the screen, centered, just above the bottom nav:

```
                    ┌──────────────┐
                    │ ⊕ Ask Seneca │
                    └──────────────┘
        [Home] [Governance] [Workspace] [You]
```

Not a circle icon in the corner (easy to miss, hard to tap). A visible text pill that clearly communicates what it does. Users who don't want it can swipe it away — it docks to the right edge as a small compass icon.

**Tapping the pill** opens the bottom sheet (60vh default):

- Ghost prompts appear immediately, contextual to the current page
- Input field with keyboard ready
- Previous conversation visible (scrollable)
- "Full screen" handle at the top of the sheet — drag up to go 95vh

**The sheet is interruptible** — user can drag it down to peek (30vh, just the last response visible), or dismiss entirely. The pill reappears at the bottom.

### Mobile Seneca in Workspace (Studio)

This is the hardest mobile surface. Authoring and reviewing proposals on a phone is already challenging. Adding an AI partner could help or hurt.

**The approach: Seneca as a mode, not a sheet.**

In workspace on mobile, Seneca doesn't overlay the content — it REPLACES the content temporarily:

```
┌───────────────────────────┐
│ [← Draft]  Seneca  [Done] │
├───────────────────────────┤
│                           │
│  Seneca: "Your rationale  │
│  addresses the fiscal     │
│  impact but doesn't       │
│  engage with Article 4.   │
│  Here's a suggested       │
│  paragraph..."            │
│                           │
│  ┌─────────────────────┐  │
│  │ [Suggested text      │  │
│  │  block with          │  │
│  │  constitutional ref] │  │
│  └─────────────────────┘  │
│                           │
│  [Insert into draft]      │
│  [Edit suggestion]        │
│  [Try different angle]    │
│                           │
├───────────────────────────┤
│  [________________] [Send]│
└───────────────────────────┘
```

- **[← Draft]** returns to the document editor with one tap
- Seneca's suggestions include **"Insert into draft"** buttons that place text at the cursor position when the user returns
- The back-and-forth between draft and Seneca is fluid — like switching between a document and a chat with a colleague
- Voice input is prominently featured (microphone icon in the input field) — dictating governance rationale while commuting is a real use case

### Mobile Tier 1 (Ambient Intelligence)

All ambient intelligence renders inline on mobile, same as desktop but reformatted:

- Smart badges on cards (same position, slightly larger touch targets)
- Narrative annotations on profiles (collapsible — tap to expand, vs. always-visible on desktop)
- Governance Rings intelligence as tap-to-reveal tooltips (not hover)
- The homepage narrative pulse as a single line of scrolling text above the constellation

### Mobile Performance Budget

| Component          | Target                       | Fallback                        |
| ------------------ | ---------------------------- | ------------------------------- |
| 2D constellation   | 200 nodes, 30fps, Canvas 2D  | Static SVG constellation image  |
| Seneca responses   | Streamed, first token <500ms | Skeleton loading state          |
| Cerebro scanning   | Canvas animation + haptics   | CSS pulse animation             |
| Match convergence  | Progressive node filtering   | Instant result (skip animation) |
| Tier 1 annotations | Pre-rendered, 0ms            | Same (no fallback needed)       |

**Device floor**: iPhone 12 / Samsung Galaxy S21 equivalent (2020-era). Below this, the constellation renders as a static SVG with tap-to-explore overlays. Seneca still works fully — only the visual spectacle degrades.

### Gesture System

| Gesture                       | Action                                               |
| ----------------------------- | ---------------------------------------------------- |
| Tap node (constellation)      | Peek card slides up                                  |
| Long-press node               | Opens full Seneca context for that entity            |
| Pinch constellation           | Zoom in/out (reveals more detail / shows macro view) |
| Swipe Seneca sheet down       | Minimize to pill                                     |
| Swipe Seneca sheet up         | Expand to full screen                                |
| Swipe left on Seneca response | Dismiss / mark as not helpful                        |
| Swipe right on match card     | Add to comparison                                    |
| Pull down from top            | Refresh governance data + new narrative              |

---

## Technical Architecture (Feasibility)

### Model Strategy

- **Tier 1 (Ambient)**: Pre-computed during sync jobs. Claude Haiku for bulk annotation generation. Cached in Supabase. Zero runtime LLM cost.
- **Tier 2 (Companion)**: Claude Sonnet for conversational responses. RAG over governance data (proposals, votes, constitutional text, DRep profiles). Streamed responses for perceived speed.
- **Tier 3 (Research)**: Claude Opus for deep analysis. Agentic pipeline with tool use (query Supabase, cross-reference constitutional articles, compute alignment scores). Progress streamed to UI.

### Cost Management

- **Anonymous users**: Tier 1 only (zero incremental cost). Tier 2 limited to 5 interactions before wallet connect prompt. Tier 3 requires authentication.
- **Authenticated users**: Tier 2 unlimited. Tier 3 rate-limited (5 deep dives per day on free tier).
- **Pro tier** (future): Unlimited Tier 3, priority processing, personalized Seneca memory

### Latency Budget

- Tier 1: 0ms (pre-rendered)
- Tier 2: First token < 500ms (streamed). Full response 2-5s.
- Tier 3: Progress indicators within 1s. Full research 15-60s.

### Context Window Management

- Page context (what entity is being viewed) injected as system prompt
- User profile (persona, delegation state, preferences) as persistent context
- Conversation history: last 10 turns in-context, older turns summarized
- RAG retrieval: top 5 relevant documents per query, sourced from governance knowledge base

### Data Pipeline

- Sync jobs (Inngest) generate Tier 1 annotations alongside existing score computations
- Governance knowledge base (proposals, constitutional text, vote history) indexed in Supabase with pgvector embeddings (already partially built — Phase 1-6 of semantic embedding layer shipped)
- Real-time context: Current epoch data, recent votes, active proposals pulled from existing API routes

---

## What Makes This World-Class

1. **The Conversation-Globe Bridge**: No other product has a conversational AI that controls a 3D visualization in real-time. This isn't gimmicky — it makes abstract governance data spatially legible through conversation.

2. **The Context Shift**: Moving from Navigator → Analyst → Partner depending on where you are is what makes Seneca feel like a being, not a feature. No other governance tool (or most products in any category) has this.

3. **The Zero-Card Homepage**: A living 3D globe + AI companion as the entire homepage is breathtakingly ambitious and visually unlike anything in crypto. It's a statement: we trust our product enough to let the data speak.

4. **Show Your Work, Always**: In a space rife with black-box "AI scores," every Seneca output being fully sourced and traceable builds trust that compounds over time.

5. **Three-Tier Progressive Disclosure**: Ambient intelligence for everyone. Conversational depth for the curious. Full research for the serious. Every user gets value at their engagement level.

---

## What Could Go Wrong (Honest Risks)

1. **Globe performance on lower-end devices**: WebGL + 800 nodes + real-time updates from Seneca = potential performance issues. Mitigation: aggressive LOD (level of detail), 2D fallback, requestIdleCallback for non-critical updates.

2. **Anonymous conversion**: The zero-card homepage is a bet that the globe + Seneca are compelling enough to retain visitors. If they're not, there's no fallback CTA. Mitigation: A/B test against a minimal-card variant during preview mode.

3. **Seneca reliability**: One wrong governance fact damages trust permanently. Mitigation: All Seneca responses pass through a fact-checking layer that verifies claims against on-chain data before rendering. Confidence indicators on every response.

4. **LLM cost at scale**: If Seneca becomes popular, Tier 2/3 costs scale linearly with users. Mitigation: Aggressive caching (same question patterns across users get cached responses), Tier 2 rate limits for free users, Tier 1 is zero-cost.

5. **Mobile 3D rendering**: Even simplified, a constellation visualization on mobile is demanding. Mitigation: Canvas 2D fallback for devices below a GPU benchmark threshold. Static image for very low-end.

---

## Build Sequence (If Approved)

### Phase 1: Foundation (Ship first)

- Companion panel component (slide-in, keyboard shortcut, mobile bottom sheet)
- Context awareness system (knows page, entity, persona)
- Ghost prompts system (contextual suggestions)
- Basic Seneca responses via Claude Sonnet + RAG over existing data
- Compass trigger with state indicators

### Phase 2: Globe Bridge

- Bidirectional communication between panel and globe
- Globe highlights responding to Seneca outputs
- Globe clicks feeding Seneca context
- Match flow as a Seneca conversation

### Phase 3: Ambient Intelligence

- Tier 1 annotations pipeline (sync job → annotation generation → cache)
- Smart badges on cards and profiles
- Narrative pulse on homepage
- Ring intelligence tooltips

### Phase 4: Studio Partner

- Authoring mode (constitutional checking, precedent research, rationale drafting)
- Reviewing mode (impact analysis, dissent analysis, smart rationale generation)
- Visual persona shift (Teal → Violet transition)

### Phase 5: Deep Research

- Tier 3 agentic pipeline
- Progress visualization (step-by-step research display)
- Epoch briefing generator
- Delegation analysis engine

### Phase 6: Memory & Personalization

- Seneca remembers your governance interests across sessions
- Personalized ghost prompts based on history
- Governance style profiling ("You tend to prioritize fiscal conservatism — here's how this proposal aligns")
- Pro tier with unlimited research

---

## The Vision in One Sentence

Seneca transforms Governada from a governance dashboard into a governance companion — an AI that knows your governance context, adapts to your role, shows its work, and makes a living 3D constellation of democratic participation respond to your curiosity.
