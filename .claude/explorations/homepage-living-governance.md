# Explore Feature: Homepage Hero Visualization — "The Living Governance"

> **Feature**: Homepage hero visualization
> **Trigger**: Beat IOG's koi pond with a data-driven governance visualization where the visualization IS the data
> **Date**: 2026-03-24

---

## Phase 1: Current State Snapshot

### What Exists

The homepage hero is a **55vh ConstellationScene** (Three.js/WebGL) rendering a 3D globe with:

- **800 DRep nodes** (teal, positioned by 6D alignment on globe surface)
- **400 SPO nodes** (purple diamonds, real geolocation)
- **CC members** (amber, orbital ring at r=10.5)
- **3-layer edge mesh** (proximity, infrastructure, last-mile)
- **Network pulses** (70 animated flow particles)
- **Bloom post-processing**, atmospheric fresnel shells, starfield
- **GPU-aware quality tiers** (low/mid/high)

The globe **auto-rotates at 0.012 rad/frame** (~8.7 min/revolution). It is rendered with `interactive=false` on the homepage — a beautiful but passive backdrop.

### What's Working Well

- The globe IS the brand. Dark-only, constellation aesthetic is sacred and differentiated.
- The Three.js infrastructure is sophisticated — custom shaders, GPU tiers, bloom, particles.
- The `flyToNode`, `highlightMatches`, and `flyToMatch` APIs already exist but are only used in the Quick Match flow.
- Data pipeline is production-ready: 60s cache, DRep/SPO/CC data with alignments, scores, geolocation.
- Real governance events (votes, rationales, proposals) are already fetched in the constellation API.

### What's at Its Ceiling

- **The globe is a screensaver.** Users see it, think "pretty," and scroll past. No one pauses to explore it.
- **Zero interactivity on homepage.** The matching interactions (`flyToNode`, `highlightMatches`) are locked behind the `/match` flow.
- **No data legibility.** A user looking at the globe cannot answer: "Is governance healthy right now? What's happening? Who's active?"
- **No reason to return.** The homepage hero looks identical whether governance is thriving or collapsing.

### Homepage JTBD (from ux-constraints.md)

| Persona   | JTBD                                            | Rule                                     |
| --------- | ----------------------------------------------- | ---------------------------------------- |
| Anonymous | "Understand what this is and why I should care" | Show value, not features. 5-second test. |
| Citizen   | "Check if anything needs my attention"          | Health status, not dashboard.            |
| DRep      | "See what needs my action right now"            | Action queue priority.                   |
| SPO       | "Check my governance reputation status"         | Score + trend at a glance.               |

### Current Score: 5/10

The globe is technically impressive but experientially inert. It communicates "this is a governance tool" but not "governance is alive and you're part of it."

---

## Phase 2: Technology Possibility Scan

### 2a: What We Already Have (EXISTS)

| Capability                                   | Status        | Relevance to Homepage Viz                      |
| -------------------------------------------- | ------------- | ---------------------------------------------- |
| 3D globe with 1200+ nodes                    | EXISTS        | Foundation — needs activation, not replacement |
| Node positioning by 6D alignment             | EXISTS        | Meaningful spatial layout                      |
| flyToNode / highlightMatches APIs            | EXISTS        | Interactivity infrastructure ready             |
| Network pulse particles (70)                 | EXISTS        | Can scale to represent real vote activity      |
| Atmospheric fresnel shader                   | EXISTS        | Can shift color based on governance health     |
| Bloom post-processing                        | EXISTS        | Can intensity-map to activity level            |
| GHI (10 components, 0-100)                   | EXISTS        | Drive visual state of globe                    |
| Governance urgency (0-100)                   | EXISTS        | Drive temporal animation speed                 |
| Governance temperature (0-100)               | EXISTS        | Drive color temperature                        |
| Recent events (votes, rationales, proposals) | EXISTS        | Can animate as real-time pulses                |
| DRep scores + tiers                          | EXISTS        | Node visual differentiation                    |
| Voting power per DRep                        | EXISTS        | Node size already mapped                       |
| Delegation relationships                     | BUILDABLE_NOW | Edge connections for delegation graph          |
| Semantic embeddings (pgvector)               | EXISTS        | Could cluster nodes by governance philosophy   |
| Epoch progress                               | EXISTS        | Temporal context                               |

### 2b: What's Buildable Now

1. **Make the globe react to governance state**: Atmosphere color = GHI health (blue=healthy, amber=warning, red=critical). Rotation speed = governance urgency. Pulse frequency = vote velocity. ALL data exists.

2. **Animate real governance events**: The constellation API already returns `recentEvents` with votes, rationales, and proposals from the last 7 days. These could be animated as particle trails between nodes (voter → proposal).

3. **Make nodes interactive on homepage**: The `flyToNode` API exists. Just need to enable `interactive=true` and add hover/click handlers that open the peek drawer.

4. **Delegation edge layer**: We have delegation data in `delegation_snapshots`. Could render delegation relationships as visible connections (citizen → DRep), showing the "trust network."

5. **Live stat overlays anchored to globe**: Instead of flat text badges, stats could emerge from the globe itself — proposal counts near the equator, vote tallies near active clusters.

### 2c: Cross-Feature Integration

- **Intelligence Panel**: Clicking a node on the homepage could open the right-side intelligence panel with DRep/proposal details — same panel used in Hub.
- **Quick Match**: The homepage globe could transition directly into the matching flow without a page navigation — the globe IS the match interface.
- **Governance Rings**: The three concentric rings (Participation/Deliberation/Impact) could appear around the globe as a macro health indicator.
- **Epoch Briefing**: The citizen homepage briefing could be spatially anchored — "Your DRep is HERE" with a glow on the globe.

---

## Phase 3: Inspiration Sources

### GitHub Globe (github.com)

- **What**: Live pull request data visualized as arcs on a 3D globe. Real data, real geography.
- **Why remarkable**: Data IS the visualization. Every arc is a real PR. The globe is never the same twice.
- **Limitation**: Read-only. You can't interact with individual data points. Decorative data, not explorable data.

### Stripe Globe (stripe.com/blog/globe)

- **What**: 1:40M scale Earth showing global payment flows as animated arcs.
- **Why remarkable**: Conveys "global scale" instantly. The sheer density of arcs communicates business health.
- **Limitation**: Static metaphor — payments look the same whether $1 or $1B.

### IOG Koi Pond (iog.io)

- **What**: Canvas 2D koi fish swimming on dark background. Three switchable experiences (Koi/Butterfly/Symphony).
- **Why remarkable**: Memorable brand moment. The koi are the brand.
- **Limitation**: **Purely decorative.** Zero data. Zero interactivity beyond cursor following. A screensaver with better art direction. The fish represent nothing.

### Apple Watch Activity Rings

- **What**: Three concentric rings (Move/Exercise/Stand) filling throughout the day. Celebration on completion.
- **Why remarkable**: Glanceable health at-a-glance. You KNOW your status in 0.5 seconds. Completion drives behavior change.
- **Applies to**: Our Governance Rings already use this pattern. Could wrap the globe.

### Spotify Wrapped

- **What**: Personalized year-in-review with animated data storytelling. 500M+ shares in first 24 hours.
- **Why remarkable**: Turns usage data into identity statement. "This is who I am."
- **Applies to**: Our Governance Wrapped exists but isn't connected to the homepage.

### Cosmograph (cosmograph.app)

- **What**: GPU-accelerated force-directed graph visualization for millions of nodes in-browser.
- **Why remarkable**: Proves that large-scale interactive network graphs are possible at 60fps in WebGL.
- **Applies to**: Our 1200-node constellation is well within feasible interactive range.

---

## Phase 4: Three Alternative Concepts

---

### Concept A: "The Heartbeat" — Governance as Living Organism

**Core Insight**: The globe doesn't represent a map. It represents a living organism whose vital signs are Cardano's governance health.

**Why This Is Novel**: No governance tool anywhere treats governance as a biological system with visible vital signs. Every other tool shows tables, charts, and dashboards. This shows a living thing that breathes, pulses, and can visibly sicken or thrive — and YOUR actions affect its health.

**Inspiration Source**: Apple Watch Activity Rings (glanceable health) + GitHub Globe (live data drives visuals) + medical heartbeat monitors (vital signs as emotional signal). Goes beyond all three by making the organism interactive and personally responsive.

**The Experience**:

1. **Page load**: The globe fades in with a subtle "breathing" animation — a rhythmic scale pulse (1.002x/0.998x at ~12bpm). The atmosphere glows its current health color (teal = healthy, amber = stressed, red-shifted = critical). Three Governance Rings orbit the globe at a gentle tilt, each partially filled based on the current epoch's Participation, Deliberation, and Impact scores.

2. **The Heartbeat**: Every few seconds, a visible pulse ripples outward from the globe's center — like a heartbeat. The pulse frequency IS the governance velocity (more votes being cast = faster heartbeat). Each pulse carries a faint particle trail in the direction of the most recent vote activity cluster. On a quiet governance day, the heartbeat is slow and calm. During a contentious proposal vote, it's rapid and the atmosphere shifts warmer.

3. **Stat Emergence**: Instead of flat overlay badges, three key stats exist as luminous text that orbits with the globe:
   - **₳12.8B governed** (total ADA under active governance)
   - **47 proposals being decided** (live count)
   - **Epoch 523 — Day 3 of 5** (temporal context with progress ring)

4. **Node Glow = Activity**: Nodes that have voted recently glow brighter. Inactive nodes dim. The globe literally shows you who's governing and who isn't. A cluster of bright nodes = active policy area. A dark patch = governance gap.

5. **Hover = Peek**: Mouse over any visible node and a soft tooltip shows: name, score, tier, last vote. Click opens the peek drawer with full DRep/SPO profile.

6. **Scroll down**: The globe shrinks smoothly into a compact widget in the top corner (or behind the header), remaining subtly animated as you read the rest of the page. The heartbeat continues as ambient awareness.

7. **Authenticated enhancement**: For logged-in citizens, YOUR DRep's node glows with a personal ring. For DReps, YOUR node pulses with your tier color and shows your rank. The globe becomes "where am I in this system?"

**The "Wow" Moment**: The first time a user sees the globe's heartbeat speed up during an active vote session, they realize: "This thing is alive. It's showing me governance happening RIGHT NOW." Then they hover a glowing node and discover it's a real DRep who just voted 30 seconds ago.

**The Emotional Arc**:

- Entry: "That's a beautiful globe" → curiosity
- 3 seconds: "Wait, it's breathing... and those nodes are glowing differently" → intrigue
- 10 seconds: "The bright ones just voted. The dim ones haven't. This is REAL" → revelation
- Hover: "That's drep1q... they voted Yes on Proposal #847 twelve minutes ago" → connection
- Return visit: "The heartbeat is fast today — something's happening" → ambient governance awareness

**The Technical Engine**:

- Breathing animation: sinusoidal scale on globe group (EXISTS — add to `useFrame`)
- Pulse ripple: expanding ring geometry with fade shader (BUILDABLE_NOW — ~50 LOC)
- Heartbeat frequency: driven by `governanceState.urgency` (EXISTS)
- Atmosphere color: lerp based on GHI composite (EXISTS — `atmosphereColor` already lerps during matching)
- Node brightness: `recentEvents` mapped to node glow intensity (BUILDABLE_NOW — events exist, need per-node recency map)
- Governance Rings around globe: `GovernanceRings` component adapted to 3D ring geometry (BUILDABLE_NOW)
- Stat orbit text: drei `<Text>` or HTML overlay with `useFrame` positioning (BUILDABLE_NOW)
- Hover/click: enable `interactive=true`, add raycasting hit test (EXISTS — `flyToNode` already does this)
- Scroll shrink: Framer Motion `useScroll` → scale/position tween (BUILDABLE_NOW)

**Cross-Feature Connections**: Governance Rings (macro health), Intelligence Panel (on click), Quick Match (globe transitions into match mode), Epoch Briefing (globe reflects epoch state).

**What It Removes**: Static text overlay badges, non-interactive hero, uniform node brightness.

**The Ceiling**: JTBD 9/10, Emotional 9/10, Novelty 9/10, Differentiation 10/10, Share 8/10

**What It Sacrifices**: Requires more GPU than current static render. Mobile may need 2D fallback. The "breathing" could feel gimmicky if overdone — calibration is critical.

**Effort**: **Medium** (2-3 days). Most infrastructure exists. Primary work: pulse shader, activity-based node brightness, hover handlers, scroll transition, ring integration.

**The Share Moment**: "Look at this — it's literally breathing. See that bright cluster? That's where all the voting is happening right now. And watch... there's another pulse. That's a real vote."

**The "No One Else Does This" Statement**: "Governada is the only platform where you can see governance breathing — where the homepage literally changes its heartbeat based on how actively the network is governing."

---

### Concept B: "The Emergence" — AI-Narrated Living Data Story

**Core Insight**: The globe doesn't just show data — it TELLS you what the data means, in real-time, with AI-generated narrative that changes every visit.

**Why This Is Novel**: Every data visualization requires the user to interpret. This one interprets itself. The globe is paired with a streaming AI narrator that contextualizes what you're seeing — like having a governance analyst whispering in your ear as you watch the network. No governance tool, no data visualization tool, nothing does this.

**Inspiration Source**: Spotify AI DJ (narrated curation) + Perplexity (conversational data) + GitHub Globe (live data) + ESPN ticker (ambient information). Goes beyond all by combining spatial visualization with real-time AI narrative.

**The Experience**:

1. **Page load**: The globe renders with full activity visualization (bright/dim nodes, pulses). Below the globe, a single line of text streams in letter-by-letter (like a typewriter), narrating what's happening:

   > "Right now, 47 proposals are being decided. DRep participation is at 73% — up from last epoch. The treasury has ₳8.2B and two withdrawal requests pending. The biggest debate: Proposal #847, a ₳2.4M developer fund, where DReps are split 62-38..."

2. **The narrative changes every visit.** It's generated from governance-state.ts + priority.ts + recent events. Not cached — computed fresh from current governance state. Each visit surfaces the most important thing happening NOW.

3. **The globe responds to the narrative**: As the text mentions "DRep participation," the DRep nodes glow briefly. As it mentions "Proposal #847," the globe rotates to the cluster of DReps who voted on it, and those nodes pulse. The visualization and narrative are synchronized.

4. **Scroll or interact to dismiss**: The narrative fades on scroll, and the globe transitions to interactive exploration mode. Or the user can click "Tell me more" to get a deeper briefing (opens the Intelligence Panel).

5. **Persona-aware narrative**:
   - Anonymous: "Here's what's happening in Cardano governance..."
   - Citizen: "Your DRep [name] voted on 3 proposals this week. Here's what matters to you..."
   - DRep: "You have 2 votes pending. Your score moved from 74 to 76. Here's your next priority..."
   - SPO: "Your pool's governance score is #42 of 2,847. Two proposals affect staking parameters..."

6. **Ambient intelligence ticker**: After the initial narrative, a subtle ticker at the bottom of the globe shows one-line governance events as they happen: "drep1q... voted Yes on Proposal #847 — 12 min ago" with the corresponding node pulsing on the globe.

**The "Wow" Moment**: The text streams in and names a specific proposal by number, then the globe ROTATES to show the DReps voting on it, and their nodes light up. The user realizes the narrative isn't generic — it's reading the live state of the network and pointing at it.

**The Emotional Arc**:

- Entry: "Oh, text is appearing..." → attention
- 3 seconds: "Wait, it's talking about REAL proposals happening right now" → engagement
- 8 seconds: "The globe just moved to show me what the text described!" → delight
- Subsequent visits: "What's the story today?" → habitual return

**The Technical Engine**:

- AI narrative generation: Claude via `intelligence/governance-state.ts` + `priority.ts` (EXISTS — needs composition into single-paragraph narrative prompt)
- Streaming text: Server-sent events from `/api/intelligence/governance-state` (BUILDABLE_NOW)
- Globe synchronization: Narrative includes entity IDs; client parses and calls `pulseNode(id)` / `flyToNode(id)` as text reveals (BUILDABLE_NOW)
- Event ticker: `recentEvents` from constellation API, rendered as scrolling text (BUILDABLE_NOW)
- Persona detection: `useSegment()` (EXISTS)
- Narrative caching: 5-min TTL per user segment (BUILDABLE_NOW)

**Cross-Feature Connections**: Intelligence Panel (deep dive), Epoch Briefing (narrative is the briefing), Governance State (drives narrative), Hub Insights (same AI engine).

**What It Removes**: Static hero copy ("Your ADA gives you a voice"), fixed urgency stat, glass-window preview section.

**The Ceiling**: JTBD 10/10, Emotional 9/10, Novelty 10/10, Differentiation 10/10, Share 7/10

**What It Sacrifices**: AI latency on first load (~1-2s for narrative generation). Cost per visit (Claude API call). Narrative quality depends on governance activity — during quiet epochs, may feel thin. Share moment is harder to capture in a screenshot (it's temporal).

**Effort**: **Large** (4-5 days). AI narrative prompt engineering + streaming endpoint + globe synchronization + persona variants + ticker component.

**The Share Moment**: Screen recording of the globe rotating to a controversy while the AI explains what's happening: "Look — it's literally narrating governance in real-time and pointing at the DReps involved."

**The "No One Else Does This" Statement**: "Governada is the only platform where an AI narrator explains what's happening in governance right now, while the visualization points at the action as it's described."

---

### Concept C: "The Constellation of Power" — Interactive Governance Map

**Core Insight**: The globe is not a decoration — it's a navigable MAP of governance power, where spatial position = political position, size = power, brightness = activity, and connections = trust relationships.

**Why This Is Novel**: This takes the globe from art to instrument. It's the Bloomberg Terminal of governance visualization — a tool that reveals structure, not just aesthetics. But unlike Bloomberg, it's beautiful and explorable by anyone, not just experts. Think: Google Earth but for governance topology.

**Inspiration Source**: Cosmograph (GPU graph viz at scale) + Google Earth (explorable spatial data) + Bloomberg Terminal (data density for power users) + Stripe Globe (scale communication). Goes beyond by making every data point explorable and personally relevant.

**The Experience**:

1. **Page load**: The globe renders at full viewport with all three body types visible. A subtle legend appears (bottom-left): teal = DReps, purple = SPOs, amber = CC. Node size = voting power. Brightness = recent activity.

2. **The power gradient is visible**: The largest, brightest nodes are immediately apparent — the most powerful, most active governance participants. Dim, small nodes at the periphery represent inactive or low-power participants. The user can SEE the power distribution without reading a single number.

3. **Hover = Context**: Hovering any node shows a floating card with: Name, Score, Tier badge, Voting Power (₳), Last Vote, and a "View Profile →" link. No click required — hover gives you the key info.

4. **Click = Deep Dive**: Clicking a node triggers `flyToNode` — the camera zooms in, nearby nodes become visible with their connections, and the Intelligence Panel opens with the full DRep/SPO profile.

5. **Drag to explore**: Full orbital camera controls enabled. Pinch to zoom, drag to rotate. Users can explore the governance landscape like a map. Zoom in to a cluster = see individual DReps in that policy area. Zoom out = see the macro structure.

6. **Connection lines on zoom**: As you zoom into a region, delegation edges fade in — you can see which citizens/delegators are connected to which DReps. The "trust network" becomes visible.

7. **Search integration**: A search bar (top) lets users type a DRep name, pool ticker, or proposal keyword. The globe animates to the matching node(s), highlighting them with a pulse.

8. **Legend as filter**: Clicking the legend items (DRep/SPO/CC) toggles visibility, letting users focus on one governance body at a time.

9. **Governance Health overlay**: A compact GHI badge in the corner shows the current health score with the three Governance Rings. Click it for the full health breakdown.

10. **Mobile**: On mobile, the globe renders at a higher angle (bird's eye), nodes are larger, and tap replaces hover. Swipe to rotate. The experience degrades gracefully but remains explorable.

**The "Wow" Moment**: The user zooms into a cluster of bright nodes and discovers they're all DReps who voted the same way on a controversial proposal — they can SEE political alignment as spatial clustering. They click one and discover it's a DRep they'd never heard of, with a 92% match to their own governance philosophy.

**The Emotional Arc**:

- Entry: "Wow, I can see the whole governance network" → awe at scale
- Explore: "These bright ones are the power players... and those dim ones..." → understanding power dynamics
- Zoom: "This cluster all voted the same way — they're aligned" → structural insight
- Click: "This DRep has 92% match to my priorities — I had no idea they existed" → discovery
- Return: "Let me check what changed" → habitual governance awareness

**The Technical Engine**:

- Interactive globe: Set `interactive=true`, enable CameraControls (EXISTS — currently disabled on homepage)
- Hover raycasting: Three.js raycaster with `instancedMesh` hit testing (BUILDABLE_NOW — ~100 LOC)
- Floating hover card: HTML overlay positioned via `project()` (BUILDABLE_NOW)
- Delegation edges: Query `delegation_snapshots` for citizen→DRep connections, render as edges on zoom (BUILDABLE_NOW — data exists, need edge computation)
- Search → flyTo: Text input → filter `nodeMap` → `flyToNode(id)` (BUILDABLE_NOW)
- GHI badge: Compact `GovernanceRings` + score number (EXISTS)
- Legend toggle: Filter `nodes` array by `nodeType`, re-render (BUILDABLE_NOW)
- Zoom-triggered edge reveal: `CameraControls` distance listener → show/hide edge layers (BUILDABLE_NOW)

**Cross-Feature Connections**: Peek Drawer (on click), Intelligence Panel (on deep dive), Quick Match (search = match input), Discover page (globe IS discovery).

**What It Removes**: Static hero copy, two-path entry cards (replaced by globe exploration), glass-window preview.

**The Ceiling**: JTBD 8/10, Emotional 7/10, Novelty 7/10, Differentiation 8/10, Share 9/10

**What It Sacrifices**: The 5-second comprehension test is harder — an interactive map requires more cognitive investment than a glanceable status. Anonymous users may not understand what they're looking at without guidance. The "breathing organism" emotional impact is lost in favor of utility. Less AI-native.

**Effort**: **Medium** (2-3 days). Most infrastructure exists. Primary work: hover cards, delegation edges, search bar, legend toggles, mobile adaptation.

**The Share Moment**: Screenshot of zoomed-in cluster with hover card visible: "Look at this — you can literally see the DReps who vote together clustered on the globe. And you can click any of them."

**The "No One Else Does This" Statement**: "Governada is the only platform where you can visually explore the entire governance network as an interactive 3D map, seeing power distribution, political alignment, and trust relationships at a glance."

---

## Phase 5: Comparative Analysis

| Dimension            | Current   | A: Heartbeat | B: Emergence                | C: Power Map           |
| -------------------- | --------- | ------------ | --------------------------- | ---------------------- |
| JTBD Ceiling         | 5/10      | 9/10         | 10/10                       | 8/10                   |
| Emotional Impact     | 4/10      | 9/10         | 9/10                        | 7/10                   |
| Novelty              | 3/10      | 9/10         | 10/10                       | 7/10                   |
| Technical Ambition   | 7/10      | 8/10         | 9/10                        | 7/10                   |
| Differentiation      | 5/10      | 10/10        | 10/10                       | 8/10                   |
| Viral / Share Moment | 2/10      | 8/10         | 7/10                        | 9/10                   |
| Feasibility          | 10/10     | 9/10         | 7/10                        | 9/10                   |
| 5-Second Test        | 6/10      | 8/10         | 9/10                        | 5/10                   |
| Data Requirements    | All exist | All exist    | Needs AI prompt + streaming | Needs delegation edges |
| Effort               | —         | M (2-3d)     | L (4-5d)                    | M (2-3d)               |

**The Question**: Concept B (Emergence) has the highest ceiling and the strongest "I've never seen anything like this" reaction — but it's the most expensive and has AI latency/cost concerns. Concept A (Heartbeat) has 90% of the emotional impact at 50% of the effort and zero runtime cost. Concept C (Power Map) is the most practically useful but least emotionally compelling.

**The answer is a hybrid: A + selective elements from B and C.**

---

## Phase 6: Recommendation

### Recommended: Concept A (Heartbeat) + B's Narrative + C's Hover Interactivity

**Why this hybrid wins**:

Concept A's "living organism" metaphor is the strongest emotional foundation — it's immediate, visceral, and unlike anything in governance tooling. But it's enriched by stealing two critical elements:

1. **From B**: The AI one-liner narrative (not the full streaming narrator, but a single dynamically-generated sentence that changes every visit). This gives the globe meaning without the cost/latency of full streaming AI.

2. **From C**: Hover-to-peek interactivity. The globe must be explorable, not just watchable. Making nodes hoverable/clickable transforms it from art to instrument.

### The "Wow" Walkthrough

**Anonymous user arrives at governada.io:**

The screen fills with darkness. Then, the constellation globe fades in — not static, but gently breathing. A slow, rhythmic pulse ripples outward from its center every 4 seconds. The atmosphere glows a calm teal (governance is healthy today). Three Governance Rings orbit the globe — Participation is 73% filled, Deliberation 61%, Impact 84%.

Hundreds of nodes dot the surface. Most glow softly, but a cluster near the "treasury" region burns bright — those DReps just voted on a spending proposal. The user's eye is drawn to the bright cluster.

A single line of text appears below the globe, streaming in:

> "47 proposals are being decided. DRep participation hit 73% this epoch — the highest in 3 months."

The user hovers over one of the bright nodes. A floating card appears: **"Cerberus — Score 87 — Diamond Tier — Voted on 3 proposals today — ₳42M delegated"**. They click. The globe zooms in smoothly, the Intelligence Panel slides open with the full profile.

They scroll down. The globe shrinks gracefully into a compact widget above the fold, its heartbeat still subtly visible. Below: two action paths (Match / Explore), live stats, and social proof.

**Returning citizen (delegated):**

Same globe, but now their DRep's node has a personal ring glow. The AI narrative says: **"Your DRep voted Yes on the developer fund proposal. Your delegation is 12th-largest in their constituency."** The Governance Rings show THEIR epoch engagement.

**DRep:**

Their own node pulses with tier color. The narrative: **"You have 2 pending votes. Your score moved +3 to 81 this epoch. Quick win: Treasury proposal #847 expires in 18 hours."** Click the pulsing quick-win node → flies to the proposal.

### Architecture Decision: One Globe, Two Entry Points

The homepage and `/match` render the **exact same LivingGlobe component**. The only difference is whether the match panel auto-opens:

```
Homepage:     <LivingGlobe />                    → user explores, then optionally starts match
/match:       <LivingGlobe autoStartMatch />      → match panel already open on arrival
```

`/match` exists as a deep link for marketing, social campaigns, and external referrals. The experience is identical — same globe, same interactivity, same Cerebro transition. No separate globe instances, no code duplication.

### Architecture Decision: Match Input as Prompt Panel, Not Quiz

**The match questions live in a compact, translucent side panel (bottom-left or left edge) that occupies ~20% of viewport width.** The globe keeps 80%+ of screen space at all times.

The panel feels like a **search/prompt tool** — not an onboarding flow:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              LIVING GLOBE (full viewport)            │
│              breathing, interactive, alive           │
│                                                     │
│  ┌────────────────────┐                             │
│  │ What matters to you?│                             │
│  │                    │           [nodes reacting    │
│  │  ○ Conservative    │            in real-time as   │
│  │  ● Growth-oriented │            user selects]     │
│  │  ○ Balanced        │                             │
│  │                    │                             │
│  │  ●●○○  1 of 4     │                             │
│  └────────────────────┘                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Why this is better than the current full-screen card approach:**

1. **The globe reacts WHILE you're choosing.** You see nodes light up and dim as you hover an answer option — before you even commit. The panel and globe are a unified instrument.
2. **It feels like querying a system, not filling out a form.** The mental model shifts from "answer questions to unlock results" to "tell the system what you care about and watch it respond."
3. **The globe stays visible during the entire Cerebro scan.** No overlay obscuring the dramatic progressive zoom. The panel is small enough that the full scanning animation plays out in the open.
4. **Future path to natural language.** The structured pills can eventually become a text prompt: "Show me DReps who prioritize developer funding and vote conservatively on treasury." The panel design accommodates both interaction models.

### Three Globe States

| State        | Trigger           | Visual                                                                        | Match Panel                               | Interaction                             |
| ------------ | ----------------- | ----------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------- |
| **Living**   | Page load         | Breathing, health-colored atmosphere, activity-bright nodes, Governance Rings | Hidden (CTA visible)                      | Hover = peek, click = profile           |
| **Cerebro**  | User starts match | Scanning, progressive zoom, dimming, threshold tightening                     | Open (compact side panel with questions)  | Answer questions, watch globe react     |
| **Revealed** | Match complete    | Locked on match node, pulsing, results in panel                               | Shows match results (same panel location) | Click match → profile, "Reset" → Living |

**Transitions:**

- **Living → Cerebro**: Breathing slows (like holding breath). Atmosphere begins shifting from health-color to match-amber. Governance Rings fade out. Panel slides in from left. First question appears.
- **Cerebro → Revealed**: `flyToMatch` plays. Panel transitions from questions to results. Globe stays locked. The matched node the system found might be one the user already hovered during Living mode — "Wait, that's the DRep I was looking at!"
- **Revealed → Living**: Camera pulls back smoothly. Breathing resumes. Rings fade back in. Panel slides out. But now the user's top match has a **permanent personal glow** — they went from observer to participant.

### Implementation Roadmap

**Phase 1: The Heartbeat (Day 1)**

- Add breathing animation (sinusoidal scale on globe group in `useFrame`)
- Add pulse ripple shader (expanding ring geometry from center, ~50 LOC)
- Drive pulse frequency from `governanceState.urgency`
- Drive atmosphere color from GHI composite score
- Map `recentEvents` to per-node brightness (voted recently = brighter)

**Phase 2: Interactivity (Day 1-2)**

- Enable `interactive=true` on homepage ConstellationScene
- Add raycaster for hover detection on instanced nodes
- Build floating hover card component (name, score, tier, power, last vote)
- Wire click → peek drawer / Intelligence Panel
- Feature flag: `homepage_living_globe`

**Phase 3: The Narrative (Day 2-3)**

- Build `/api/homepage/narrative` endpoint composing 1-2 sentence governance summary from existing data (governance-state.ts + priority.ts)
- Cache per segment (anonymous/citizen/drep/spo) with 5-min TTL
- Render as typewriter-animated text below globe
- Optional: `globe.pulseNode()` when narrative mentions specific entities

**Phase 4: Match Panel Fusion (Day 3-4)**

- Create `MatchPromptPanel` component — compact, translucent, anchored bottom-left
- Extract match question logic from `ConversationalMatchFlow` into reusable hook
- Wire panel answers → `globe.highlightMatches()` (same Cerebro APIs)
- Implement Living → Cerebro → Revealed state transitions on the globe
- Unify homepage and `/match` into single `LivingGlobe` component with `autoStartMatch` prop
- Add match CTA button that opens the panel (visible during Living state)
- Panel shows results in-place after `flyToMatch` completes

**Phase 5: Governance Rings Integration (Day 4)**

- Adapt `GovernanceRings` to render as 3D ring geometry orbiting globe
- Drive fill from current epoch's macro participation/deliberation/impact metrics
- Fade out during Cerebro mode, fade back in on return to Living

**Phase 6: Polish & Mobile (Day 4-5)**

- Mobile: simplified 3D (no hover, tap-to-peek, match panel as bottom sheet)
- Reduced motion: disable breathing/pulses, keep static glow
- Performance: ensure < 16ms frame time on mid-tier GPU
- `/match` deep link: same component with `autoStartMatch`, full-screen layout

### What to REMOVE

- Static text overlay badges (replaced by narrative + orbiting stats)
- `interactive={false}` prop on homepage (enable interaction)
- Glass-window dashboard preview section (the globe IS the preview)
- Fixed "Your ADA gives you a voice" copy (replaced by dynamic narrative)
- Separate `/match` globe instance (unified into LivingGlobe)
- Full-screen match card overlay (replaced by compact side panel)

### Risk Assessment

- **GPU performance**: Breathing + pulse + activity brightness adds minimal GPU cost (simple uniforms, no new geometry). Tested via existing GPU tier system.
- **AI narrative cost**: One Claude call per 5 min per segment = ~288 calls/day at peak. Minimal cost. Falls back to template text if API fails.
- **Mobile**: Biggest risk. Three.js on low-end mobile is inconsistent. Fallback: static screenshot of globe + narrative text only. Match panel becomes bottom sheet.
- **Match panel discoverability**: The compact panel might not be obvious enough for first-time users. Mitigation: prominent floating CTA ("Find Your Match") that pulses gently.
- **Rollback**: Feature-flagged. If `homepage_living_globe` is off, current static globe + separate `/match` page renders unchanged.

### Validation Suggestion

1. **Phase 1-2 ship first**: Living Globe with breathing + hover. Measure time-on-page and hover engagement.
2. **Phase 4 ship second**: Match panel fusion. A/B test against current `/match` flow for completion rate.
3. **If panel completion < current**: Increase panel size or add guided tooltip on first visit.

### New Patterns to Add to Library

#### IOG Koi Pond — Switchable Hero Experiences

- **Source**: iog.io — 2026-03-24
- **What**: Three full-screen Canvas 2D visualizations (Koi/Butterfly/Symphony) switchable via bottom-right menu. Each is a branded generative art piece.
- **Why remarkable**: Creates memorable brand identity through ambient art. The koi swimming is genuinely beautiful.
- **Limitation**: Purely decorative — zero data, zero interactivity beyond cursor. A screensaver.
- **How Governada goes beyond**: Our globe is data-driven. Every node is a real entity, every pulse is a real event. We don't need decorative art — we need living data.

#### GitHub Globe — Live Data as Visualization

- **Source**: github.blog/engineering — 2020 (still live 2026)
- **What**: 3D globe with arcs representing real-time pull requests. Data refreshed throughout the day.
- **Why remarkable**: The visualization IS the data. Every arc is a real contribution. The globe is never the same twice.
- **How Governada goes beyond**: We add interactivity (hover/click any node), health state (atmosphere color), and personal relevance (your DRep glows).

#### Apple Activity Rings — Glanceable Epoch Health

- **Source**: Apple Watch — developer.apple.com/design/human-interface-guidelines/activity-rings
- **What**: Three concentric rings showing daily progress. Celebration on completion.
- **Why remarkable**: You know your status in 0.5 seconds. Completion drives behavior.
- **How Governada uses it**: Governance Rings already exist. Wrapping them around the globe makes the homepage both beautiful AND informative at a glance.
