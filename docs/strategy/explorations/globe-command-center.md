# Exploration: Authenticated Homepage Globe Command Center

> **Feature**: Inhabited Constellation — Globe-centric authenticated homepage
> **Date**: 2026-03-26
> **Status**: Exploration complete, ready for concept selection
> **Trigger**: Founder request — evolve proof-of-concept into world-class immersive homepage

---

## Phase 1: Current State Snapshot

### Architecture

- **Route**: `app/page.tsx` → `HubHomePage` → `InhabitedConstellation` (feature-gated: `globe_homepage_v2`)
- **3D Engine**: React Three Fiber + drei + custom shaders (1800+ lines in GlobeConstellation.tsx)
- **Data**: User node from alignment API, proposal nodes from proposals API, atmosphere from narrative API
- **AI Integration**: Seneca auto-opens after 2.5s, triggers daily briefing via `shouldShowBriefing()`

### What's Working Well

- Globe fills viewport — immersive, brand-defining
- User placed at their alignment position among DReps — spatial meaning, not decoration
- Delegation bond visualization with drift-aware color
- Seneca ↔ globe bridge (click node → AI context)
- GPU-tiered rendering (200/500/800 nodes)
- Atmosphere breathing tied to governance health

### What's at Its Ceiling

- **CC Members**: 7 golden nodes evenly spaced on an equatorial ring at r=10.5. Looks arbitrary — no spatial meaning. Too prominent for their actual role. Feels like placeholder.
- **No actionable information on the globe itself**: User lands in a beautiful constellation but can't DO anything without the Seneca panel. The globe is visual-only.
- **No urgency/action surface**: Pending votes, expiring proposals, delegation alerts — all require navigating away. Nothing emerges from the globe experience.
- **Flat interaction model**: Click node → Seneca opens. No radial menus, no contextual actions, no progressive disclosure FROM the globe.
- **No temporal awareness**: Epoch progress, vote deadlines, governance cycles — none visible in the spatial experience.
- **Static after fly-in**: Once the camera lands on the user node, the globe becomes a screensaver. No reason to stay.

### Core JTBDs

- **Citizen**: "Check if anything needs my attention" → delegation health + epoch status
- **DRep**: "See what needs my action right now" → pending votes + delegator changes
- **SPO**: "Check my governance reputation" → score + citizen briefing
- **All**: "Understand my position in the governance universe"

---

## Phase 2: Technology Possibility Scan

### 2a: AI/ML Capabilities (all EXISTS or BUILDABLE_NOW)

| Capability                                         | Status | Relevance                                               |
| -------------------------------------------------- | ------ | ------------------------------------------------------- |
| 6D alignment → sphere position                     | EXISTS | User + DRep positioning                                 |
| Semantic embeddings (3072D, pgvector)              | EXISTS | Could power "show me similar entities" clusters         |
| Conversational matching (multi-round)              | EXISTS | Could run INSIDE the globe experience                   |
| Seneca streaming advisor                           | EXISTS | Already bridged to globe                                |
| Governance state computation (urgency 0-100)       | EXISTS | Drives atmosphere, could drive HUD elements             |
| Briefing generation                                | EXISTS | Daily briefing already auto-triggered                   |
| Score narratives                                   | EXISTS | Could be spatial — scores float near entities           |
| Priority computation (urgent proposals)            | EXISTS | Could materialize as glowing nodes                      |
| Hub insights (perplexity-style cited intelligence) | EXISTS | Could stream as floating text near relevant nodes       |
| Drift detection                                    | EXISTS | Delegation bond already shows this                      |
| Proposal similarity (embedding-based)              | EXISTS | Could cluster similar proposals spatially               |
| Cross-body alignment                               | EXISTS | CC + DRep + Citizen alignment could create visual bonds |

### 2b: Spatial/Visual Computation Opportunities

- **Concentric information shells** (Territory Studio pattern): Urgent → near user. Ambient → far. The globe's radius dimension is underused.
- **Radial action menus**: Entity click → directional actions fan out. 6-8 items max. Direction = action type.
- **Floating panels** (visionOS): DRep cards, proposal briefs, score breakdowns as glass-morphic panels hovering at specific globe positions.
- **Particle streams**: Real-time governance activity (votes flowing, delegations forming) as luminous particle trails.
- **Ring segments**: Governance Rings as interactive arcs around the user node — clickable, animated, encoding participation/deliberation/impact.
- **Temporal arc**: Epoch progress as a visible arc or ring around the globe, filling as the epoch progresses.

### 2c: Cross-Feature Integration

- **Match flow IN the globe**: Instead of a separate /match page, the matching quiz runs while the globe responds — highlighting, dimming, clustering in real time.
- **Workspace preview**: Clicking a proposal could show a mini workspace panel floating near the node, not just a profile link.
- **Score simulator**: "What if I delegate to this DRep?" as a real-time visual — delegation bond animates, score rings shift.
- **For-You proposals**: The API already computes personalized proposal relevance. These could float toward the user from the constellation.

---

## Phase 3: Inspiration Synthesis

### Key Patterns Discovered

1. **JARVIS/Territory Studio — Concentric Information Shells**: Most urgent data closest to center, context radiates outward. The interface adapts to context (flying vs. designing vs. briefing).

2. **Elite Dangerous 3D Radar — Triple Encoding**: Color = disposition, shape = type, animation = urgency. Vertical stalks encode a third spatial dimension. The user sits at the center of the scanner.

3. **visionOS Progressive Immersion — Window/Volume/Space**: Start ambient (window), focus on entity (volume), deep research (full space). Progressive escalation controlled by the user.

4. **Perplexity — Show the Process**: Before delivering answers, show the research happening. "Scanning 47 DReps... Found 3 alignment clusters..." Intermediate progress transforms waiting into engagement.

5. **HUD Four-Layer System**: Diegetic (entities IN the world), non-diegetic (overlay for user only), spatial (floating labels in 3D), meta (screen effects conveying state). Use ALL FOUR simultaneously.

6. **Radial Menus — Direction as Action**: 6-8 actions fanning from a center point. Muscle memory after 3 uses. The globe's polar coordinates naturally support radial interaction.

7. **Ambient Orb — Preattentive State**: Color temperature, particle density, rotation speed encode system state BEFORE conscious reading. The 2-second glanceability test.

8. **Superhuman Split Inbox — AI-Sorted Attention**: Notifications pre-triaged by AI into Urgent/Governance/Social/Intelligence. Only Urgent triggers visual interrupts.

---

## Phase 4: Three Alternative Concepts

---

### Concept A: "The Observatory" — Spatial Intelligence Command Center

**Core Insight**: The globe is not a decoration — it's a radar. Everything the user needs to know and do should materialize AS SPATIAL OBJECTS in the constellation, not in flat panels beside it.

**Why This Is Novel**: No governance platform — and no dashboard product of any kind — places the user at the center of a 3D data universe where actionable items physically approach them from the relevant direction. Bloomberg puts data in grids. Linear puts it in lists. This puts data in space, where proximity = urgency and direction = category.

**Inspiration Source**: Elite Dangerous 3D radar (center-of-universe scanner) + Territory Studio concentric shells (urgent = close) + NASA Open MCT (role-based compositions). Goes beyond all of them by making the spatial layout MEANINGFUL (alignment-driven positioning, not arbitrary).

**The Experience**:

1. **Entry (0-2s)**: Camera zooms through the constellation and settles at the user's alignment position. The globe surrounds them — DReps as teal points, SPOs as purple diamonds, proposals as warm octahedra. Stars in the deep background. The atmosphere pulses gently with governance health.

2. **The Command Ring (2-4s)**: Three concentric rings materialize around the user's position, like a sci-fi targeting HUD:
   - **Inner Ring (r=1.5 from user)**: URGENT — items needing action NOW. Proposals expiring within 2 epochs float here as glowing cards with countdown timers. Delegation health alerts appear as amber pulses. Each item is a small floating card (glassmorphic, 80% opacity) showing title + deadline + one-line context.
   - **Middle Ring (r=3 from user)**: ACTIVE — governance in motion. New proposals, recent votes by your DRep, score changes. Dimmer than urgent, but present. Animated — items drift slowly in their orbital path.
   - **Outer Ring (r=5 from user)**: CONTEXT — epoch progress arc, treasury balance, GHI score, participation stats. Ambient, glanceable, nearly static. These are the "instrument gauges" of the command center.

3. **CC Members — The Constitutional Firmament**: Instead of 7 large nodes on the equator, CC members become a subtle golden lattice that stretches across the "sky" above the globe — like a constellation pattern. Their interconnecting lines form a mesh that represents the constitutional framework. When a proposal has constitutional implications, the relevant portion of the lattice glows brighter. CC members are not individual nodes competing for attention with DReps — they are the FRAMEWORK within which governance operates. Clicking any point on the lattice shows the relevant CC member's stance. The lattice is always present but at low opacity — a constant reminder that governance operates within constitutional bounds.

4. **Radial Action Menu**: Long-press or right-click any entity → a ring of 6 actions fans out: [Delegate] [Compare] [Ask Seneca] [Watch] [Profile] [Share]. Direction = action. Top = primary (Delegate for DReps, Vote for proposals). Muscle memory by visit 3.

5. **Seneca Emergence**: Instead of a side panel, Seneca's responses materialize as floating text near the relevant entities. Ask "tell me about this DRep" → the narrative appears as a translucent card next to the DRep's node, with citation links to specific votes. The conversation thread stays in a minimal bottom bar, but the ANSWERS live in space.

6. **Temporal Arc**: A thin arc along the bottom edge of the viewport shows epoch progress — a luminous line that fills left-to-right as the epoch advances. When a vote deadline approaches, the relevant portion of the arc pulses amber.

**The Emotional Arc**:

- Entry: Awe — "I'm inside the governance universe"
- During: Control — "Everything I need is right here, organized by urgency"
- Completion: Confidence — "I know exactly where I stand and what needs attention"
- Telling a friend: "Governada puts you INSIDE the governance constellation — your pending actions literally float toward you"

**The Technical Engine**:

- Concentric ring layout: BUILDABLE_NOW — extend `computeGlobeLayout` with user-relative positioning
- Floating card rendering: BUILDABLE_NOW — R3F Html component for 3D-positioned DOM elements
- CC lattice: BUILDABLE_NOW — Three.js LineSegments with vertex colors + opacity animation
- Radial menu: BUILDABLE_NOW — react-pie-menu or custom SVG overlay positioned at screen coords
- Spatial Seneca: BUILDABLE_NOW — position Html elements at node's screen coordinates
- Temporal arc: BUILDABLE_NOW — SVG overlay with epoch data from governance state API

**Cross-Feature Connections**: Match flow runs IN the rings (matched DReps float to the inner ring). Workspace proposals appear as YOUR octahedra in the constellation. Score changes animate the Governance Rings around your node.

**What It Removes**: The static post-fly-in state. The notion that the globe is "just visual." Card-based hub surfaces below the globe.

**The Ceiling**: JTBD 9/10, Emotional Impact 9/10, Novelty 10/10, Differentiation 10/10

**What It Sacrifices**: Information density of traditional dashboards. Users who want a flat list of actions won't get one above the fold. Mobile is harder (2D fallback required).

**Effort**: L (3-4 weeks) — mostly new 3D positioning logic + floating card rendering + CC lattice

**The Share Moment**: "Look at what Governada does when you have pending votes — they literally float toward you from the constellation with countdown timers."

**The "No One Else Does This" Statement**: "Governada is the only platform where your governance actions materialize as spatial objects that orbit around you, organized by urgency, inside a living 3D constellation of every governance participant."

---

### Concept B: "The Cockpit" — HUD-Layered Globe with AI Heads-Up Display

**Core Insight**: The globe stays ambient in the background — but the user's viewport becomes a transparent cockpit HUD where governance intelligence is overlaid on the constellation, like a fighter pilot's heads-up display combined with JARVIS.

**Why This Is Novel**: HUD overlays on 3D scenes exist in gaming but have never been applied to governance or any data-intelligence product. The combination of a living 3D constellation visible through a transparent HUD creates an experience that feels like you're piloting governance — not just reading about it.

**Inspiration Source**: Fighter pilot HUDs (information on glass without blocking the view) + Iron Man's JARVIS (AI narrates and highlights through the transparent display) + Bloomberg Launchpad (peripheral monitoring). Goes beyond by making the HUD PERSONALIZED — every user sees different instruments based on their role and what needs attention.

**The Experience**:

1. **Entry**: Camera settles at user position. The globe rotates gently behind transparent HUD elements. The HUD fades in over 1.5 seconds — thin luminous lines, scan-line aesthetic, compass-teal accent color.

2. **The HUD Layers** (all transparent, all on top of the globe):

   **Top-Left — Status Instruments**:
   - Governance Rings (3 concentric arcs) — your participation/deliberation/impact scores, animated
   - Epoch countdown (thin bar, filling right-to-left)
   - Delegation status pill: "Delegated to [DRep Name] | Drift: 12%" with color coding

   **Top-Right — Seneca Whisper**:
   - One-line AI insight that updates every 30s: "3 proposals align with your priorities" or "Your DRep voted against community consensus on Prop #847"
   - Clicking expands to full Seneca thread

   **Bottom-Center — Action Queue**:
   - A sleek horizontal strip (like a dock) showing 3-5 action cards:
     - "Vote on Prop #901 — Treasury withdrawal — 2 epochs left"
     - "Review your DRep's latest rationale"
     - "Your governance score rose +3 this epoch"
   - Cards slide in from the right as new items appear. Completed items fade left.
   - Each card is glassmorphic — the globe shows through.

   **Bottom-Left — Context Gauges**:
   - Treasury: current balance + burn rate, single compact meter
   - GHI: one number, color-coded
   - Active proposals: count + "N need your attention"

   **Center — Crosshair + Targeting**:
   - When hovering over a globe entity, a targeting reticle locks on
   - Entity card appears: name, score, key stat, [Explore] button
   - The crosshair connects via a thin line to the entity's position

3. **CC Members — Sigil Constellation**: CC members are represented not as globe nodes but as SIGILS — small golden geometric symbols (each unique to the member) arranged in a subtle pattern across the top of the viewport, like constellations in the sky. They're part of the HUD, not the globe. When a constitutional question is active, the relevant sigil glows and a thin line connects it to the relevant proposal on the globe. This positions CC members as OVERSEERS — above the fray, watching, not competing with DReps for globe space.

4. **Keyboard-Driven Navigation**:
   - `J/K` = cycle through action queue items
   - `Enter` = open focused item
   - `S` = Seneca focus
   - Arrow keys = rotate globe
   - `Esc` = reset view
   - `?` = show all shortcuts

5. **Adaptive Density**: The HUD instruments adjust based on what's happening:
   - **Calm epoch**: Minimal HUD — just rings + one insight. Globe dominates.
   - **Active epoch**: Full HUD — action queue populated, multiple insights cycling.
   - **Critical**: HUD elements pulse, amber/red tints, Seneca proactively surfaces a warning.

**The Emotional Arc**:

- Entry: Power — "I have a command center for governance"
- During: Efficiency — "Everything is at a glance, nothing requires drilling down"
- Completion: Mastery — "I'm the kind of person who pilots governance"
- Telling a friend: "Governada gives you a heads-up display for Cardano governance — like a fighter pilot's cockpit but for democracy"

**The Technical Engine**:

- HUD overlay: BUILDABLE_NOW — absolute-positioned DOM elements over the canvas, glassmorphic CSS
- Crosshair targeting: BUILDABLE_NOW — track mouse position, raycast to globe entities, render CSS reticle
- CC sigils: BUILDABLE_NOW — SVG symbols in fixed viewport positions + line-to-globe via screen projection
- Action queue dock: BUILDABLE_NOW — TanStack Query from `/dashboard/urgent` + Framer Motion
- Adaptive density: BUILDABLE_NOW — governance state urgency score drives which HUD elements render
- Seneca whisper: BUILDABLE_NOW — periodic `/intelligence/hub-insights` fetch, one-line display

**Cross-Feature Connections**: Action queue IS the workspace entry point. Clicking a proposal action → workspace opens. Match flow could appear as a special HUD mode where the crosshair becomes a scanner sweeping across the globe.

**What It Removes**: The flat card-based hub entirely. The need to scroll. The notion of the homepage as a "page" — it's a cockpit.

**The Ceiling**: JTBD 10/10, Emotional Impact 9/10, Novelty 9/10, Differentiation 9/10

**What It Sacrifices**: Some spatial meaning — HUD elements are 2D overlays, not truly spatial. The "inside the constellation" feeling is weaker because HUD elements occlude the globe slightly. More complex to make accessible.

**Effort**: M-L (2-3 weeks) — mostly CSS/DOM overlay work + action queue API integration

**The Share Moment**: "Look at this — Governada turns Cardano governance into a cockpit. Your delegation drift, pending votes, and AI briefings are all on a heads-up display over a 3D constellation."

**The "No One Else Does This" Statement**: "Governada is the only platform where governance intelligence appears as a transparent heads-up display over a living constellation, adapting its instruments to what needs your attention right now."

---

### Concept C: "The Gravity Well" — AI-Driven Spatial Narrative Homepage

**Core Insight**: What if the homepage wasn't a dashboard at all — but a STORY? Every visit, the globe arranges itself to tell YOU a personalized governance narrative. Entities that matter to you are gravitationally pulled closer. Things you've seen recede. The AI doesn't just brief you — it choreographs the entire spatial experience.

**Why This Is Novel**: Every dashboard — even the most beautiful ones — presents data and waits for you to interpret it. This concept inverts the model: the AI interprets the data FIRST, then choreographs a spatial narrative that walks you through what matters. The globe is not a static map — it's a stage, and Seneca is the director.

**Inspiration Source**: Spotify AI DJ (narrated, curated experience that feels personal) + Perplexity (show the research process) + Apple Health summary (one number → one insight → drill down). Goes beyond by making the SPATIAL ARRANGEMENT itself a narrative device — entities move to support the story being told.

**The Experience**:

1. **Entry — "The Gravity Pull" (0-3s)**: Camera descends into the constellation. As it approaches, nodes begin to rearrange based on YOUR data. Entities relevant to you are gravitationally pulled closer — your delegated DRep moves to foreground, proposals matching your alignment drift inward, your score-peer cohort forms a visible cluster nearby. Irrelevant entities dim and recede. The globe literally reshapes itself around your perspective.

2. **The Narrative Sequence (3-15s)**: Seneca begins narrating — not in a panel, but as text that materializes in the space between entities:

   "Since your last visit, 3 proposals were submitted that align with your treasury priorities."
   → Three proposal octahedra glow and drift closer, pulsing gently

   "Your DRep voted YES on Prop #847 — 78% of the community agreed."
   → The delegation bond briefly brightens, a "78%" label floats near it

   "Governance health improved this epoch — participation is up 12%."
   → The globe's atmosphere shifts slightly more teal

   The narrative is 3-5 sentences, personalized, and each sentence triggers a spatial response in the globe. It takes 10-15 seconds total — like a Spotify AI DJ intro.

3. **Post-Narrative — Interactive Mode**: After the narrative, the globe settles into a state where:
   - Items mentioned in the narrative are still highlighted and clickable
   - A minimal floating card shows "3 actions waiting" with expand affordance
   - The globe is freely navigable (rotate, zoom, click entities)
   - Seneca input appears at bottom: "Ask me anything about governance"

4. **CC Members — The Constitution as Terrain**: CC members are not nodes at all. Instead, the globe's surface has subtle glowing MERIDIAN LINES that represent constitutional principles. Each meridian is associated with a CC member's interpretive stance. When proposals cross a constitutional line, the relevant meridian brightens and the CC member's name appears along it. The constitution is literally the terrain — the ground rules upon which all governance plays out. You can click any meridian to see the CC member's voting record on that principle.

5. **Return Visits**: The gravity well remembers what you've seen. Previously-briefed items recede further. New items are pulled closer with more energy. The narrative always leads with "what changed since you were last here" — never repeats old news.

6. **"Show Me" Commands**: Natural language commands that choreograph the globe:
   - "Show me DReps who care about treasury" → globe rotates to treasury dimension, relevant DReps glow
   - "What's controversial right now?" → proposals with high vote divergence pulse and drift to foreground
   - "How am I doing?" → Governance Rings expand, score breakdown appears spatially

**The Emotional Arc**:

- Entry: Surprise — "The universe is reshaping itself around me"
- During: Understanding — "I now understand what happened since my last visit without reading a single dashboard"
- Completion: Delight — "That was... effortless? And beautiful?"
- Telling a friend: "Governada tells you a story about governance — but the story happens INSIDE a constellation that rearranges itself around you"

**The Technical Engine**:

- Gravity-based repositioning: BUILDABLE_NOW — compute user-relevance score per entity, override position with lerp toward user, using existing alignment + urgency data
- Narrative choreography: BUILDABLE_NOW — extend briefing API to return structured narrative steps, each tagged with entity IDs. Client sequences globe commands per step.
- Spatial text rendering: BUILDABLE_NOW — R3F Html component positioned at midpoints between entities
- CC meridians: BUILDABLE_NOW — Three.js great-circle arcs on globe surface with dynamic opacity
- "Show me" commands: EXISTS — Seneca advisor + globe bridge already handles entity references → globe commands
- Return visit memory: BUILDABLE_NOW — store last-visit briefing items in localStorage, diff on next visit

**Cross-Feature Connections**: The narrative sequence IS the briefing (replaces the separate briefing page). "Show me" commands are a natural-language governance search engine built into the homepage. The gravity well makes match flow visceral — matched DReps physically pull toward you.

**What It Removes**: The static globe entirely. The idea that the homepage is the same every visit. The separation between "briefing" and "globe."

**The Ceiling**: JTBD 9/10, Emotional Impact 10/10, Novelty 10/10, Differentiation 10/10

**What It Sacrifices**: Predictability — the globe looks different every time, which can be disorienting. Users who want a consistent dashboard layout won't get one. The narrative sequence adds 10-15s before full interactivity. Power users may find it slow.

**Effort**: XL (4-6 weeks) — gravity repositioning, narrative choreography engine, spatial text, CC meridians, return-visit diffing

**The Share Moment**: Screen-record the narrative sequence — the globe reshaping, entities glowing in sync with AI narration, the whole experience feeling alive and personal. "Every time I open Governada, it tells me what happened in Cardano governance since I was last here — and the 3D constellation rearranges itself to show me."

**The "No One Else Does This" Statement**: "Governada is the only platform where an AI choreographs a personalized governance narrative by spatially rearranging a 3D constellation of every governance participant around you, making entities that matter to you gravitate closer while the universe reshapes to tell your story."

---

## Phase 5: Comparative Analysis

| Dimension            | Current    | A: Observatory    | B: Cockpit        | C: Gravity Well                   |
| -------------------- | ---------- | ----------------- | ----------------- | --------------------------------- |
| JTBD Ceiling         | 5/10       | 9/10              | 10/10             | 9/10                              |
| Emotional Impact     | 7/10       | 9/10              | 9/10              | 10/10                             |
| Novelty              | 8/10       | 10/10             | 9/10              | 10/10                             |
| Technical Ambition   | 7/10       | 9/10              | 7/10              | 10/10                             |
| Differentiation      | 8/10       | 10/10             | 9/10              | 10/10                             |
| Viral / Share Moment | 6/10       | 9/10              | 8/10              | 10/10                             |
| Feasibility          | 10/10      | 7/10              | 9/10              | 5/10                              |
| Information Density  | 3/10       | 7/10              | 9/10              | 6/10                              |
| Learnability         | 8/10       | 6/10              | 8/10              | 7/10                              |
| Data Requirements    | Globe data | Same + urgent API | Same + urgent API | Same + narrative choreography API |
| Effort               | —          | L (3-4 weeks)     | M-L (2-3 weeks)   | XL (4-6 weeks)                    |

---

## Phase 6: Recommendation

### The Hybrid: "Observatory Cockpit" (A + B)

**Why this wins**: Take the SPATIAL INTELLIGENCE of Concept A (entities that float at urgency-appropriate distances, CC lattice, radial menus) and combine it with the HUD OVERLAY of Concept B (glassmorphic instruments, action queue dock, Seneca whisper, keyboard navigation). Cherry-pick from Concept C: the GRAVITY PULL on entry (entities relevant to you move closer) and the AI NARRATIVE INTRO (3-5 sentence briefing with globe choreography on first daily visit).

This hybrid hits:

- **JTBD 10/10**: Every persona gets their primary action surface (urgent proposals for DReps, delegation health for citizens, score for SPOs) — but it lives IN the spatial experience, not beside it.
- **Emotional Impact 10/10**: The gravity pull + narrative intro creates the "wow" moment. The HUD creates the "power" feeling. The radial menus create "mastery."
- **Novelty 10/10**: No product in any domain combines a 3D constellation with a transparent HUD and AI-choreographed spatial narrative.
- **Feasibility 7/10**: Each piece is BUILDABLE_NOW. The total is M-L effort because most elements are DOM overlays on the existing globe, not new 3D rendering.

### The "Wow" Walkthrough (Investor Demo)

> You open Governada. The camera descends into a constellation of 500+ governance participants — DReps as teal stars, stake pools as purple diamonds, proposals as glowing octahedra. The globe is alive — it breathes with governance health, its atmosphere shifting from teal to amber as urgency rises.
>
> As you arrive at YOUR position in the constellation, entities that matter to you gravitationally drift closer. Your delegated DRep floats in the foreground, connected to you by a luminous bond. Three proposals that match your priorities glow brighter and orbit nearby.
>
> A transparent heads-up display materializes. Top-left: your Governance Rings — three arcs showing your participation, deliberation, and impact. Top-right: a one-line AI whisper — "Your DRep voted YES on the treasury proposal — 78% agreement." Bottom-center: a sleek action dock — "Vote on Prop #901 (2 epochs)", "Review DRep rationale", "Score +3 this epoch."
>
> Above, a golden lattice of constitutional principles stretches across the sky — the Constitutional Committee's framework, always present, subtly glowing when proposals test constitutional boundaries.
>
> You hover over a DRep node. A targeting reticle locks on. A glassmorphic card appears: name, score 72, 1.2M ADA delegated, 45 delegators. You right-click — a radial menu fans out: Delegate, Compare, Ask Seneca, Watch, Profile, Share. You choose "Compare" — instantly, your alignment dimensions appear next to theirs in a spatial overlay.
>
> You type into Seneca: "What should I pay attention to this epoch?" Seneca's response doesn't appear in a chat window — it materializes as floating text near the relevant entities. "Two treasury proposals are approaching deadline. Your DRep hasn't voted on either yet. The constitutional committee flagged Prop #903 for review." Each sentence highlights the relevant entity on the globe.
>
> The epoch progress arc at the bottom edge fills slowly. You glance at the treasury gauge — green, healthy. The GHI number — 74, steady. Everything you need, at a glance, through the glass of a cockpit looking out at the governance universe.

### CC Member Redesign: The Constitutional Lattice

The 7 large equatorial nodes are replaced with a **golden lattice of great-circle arcs** across the sky above the globe:

- Each CC member is associated with 2-3 great-circle arcs representing their interpretive principles
- The lattice is always present at ~15% opacity — the constitutional firmament
- When a proposal has constitutional implications, the relevant arcs glow to 80% opacity
- Clicking any arc opens a minimal card showing the CC member's stance, voting record, and fidelity grade
- The lattice creates a "framework within which governance operates" feeling
- Visually: golden (#fbbf24) lines with soft glow, subtle animated shimmer

This is better than individual nodes because:

1. CC members ARE the framework, not competitors in the governance marketplace
2. The lattice metaphor communicates "rules" rather than "participants"
3. It uses the sky space (above the globe) that's currently empty
4. It responds contextually to proposal activity, creating visual cause-and-effect

### Implementation Roadmap

**Phase 1: HUD Foundation (1 week)**

- Glassmorphic overlay layer on existing globe canvas
- Governance Rings (3 arcs) — top-left
- Epoch progress arc — bottom edge
- Seneca whisper — top-right (one-line, cycling)
- Context gauges — bottom-left (treasury, GHI, proposal count)
- Keyboard navigation scaffolding

**Phase 2: Action Surface (1 week)**

- Action queue dock — bottom-center
- Integrate `/dashboard/urgent` + `/governance/for-you` APIs
- Card slide-in/out animations (Framer Motion spring-based)
- Click-through to workspace/proposals
- Adaptive density (calm/active/critical modes based on urgency score)

**Phase 3: CC Lattice + Gravity Pull (1 week)**

- Replace CC equatorial nodes with great-circle arc lattice
- Constitutional glow triggered by proposal flags
- Gravity pull on entry — lerp relevant entities toward user
- Narrative intro sequence (3-5 sentences, first daily visit only, from briefing API)
- Return-visit diffing via localStorage

**Phase 4: Spatial Interaction (1 week)**

- Radial action menu on entity click/long-press
- Crosshair targeting on hover
- Spatial Seneca responses (Html components positioned at entity screen coords)
- "Show me" commands → globe choreography

**Phase 5: Polish + Mobile (3-5 days)**

- Mobile 2D fallback with same HUD information architecture
- Performance optimization (lazy HUD element rendering)
- Reduced-motion compliance
- A11y: screen reader descriptions for all HUD elements

### What to REMOVE

- CC equatorial nodes (replaced by lattice)
- Static post-fly-in state (replaced by gravity pull + HUD)
- Card-based hub surface below globe (replaced by HUD elements)
- Separate briefing trigger (replaced by narrative intro)

### Risk Assessment

- **Performance**: HUD DOM elements over WebGL canvas could cause jank. Mitigation: use `will-change: transform`, minimize DOM nodes, lazy-render off-screen elements.
- **Learnability**: New interaction model (radial menus, keyboard shortcuts). Mitigation: subtle onboarding overlay on first visit, progressive disclosure.
- **Mobile**: 3D + HUD is too much for mobile. Mitigation: 2D fallback with same information hierarchy (already planned).
- **Accessibility**: Spatial information is inherently visual. Mitigation: screen reader mode that narrates the HUD content sequentially.

### Validation Suggestion

Before building the full hybrid, ship Phase 1 (HUD Foundation) as a feature-flagged experiment. Measure:

1. Time-on-homepage (should increase from current ~5s to 15-30s)
2. Click-through rate from homepage to governance actions (should increase)
3. Daily active return rate (the narrative intro should drive daily visits)
4. Qualitative: show 3 Cardano community members, capture reactions

If Phase 1 validates, proceed with Phases 2-5. If not, the HUD overlay is easily removable without affecting the underlying globe.
