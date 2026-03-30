# Epic: The Living Republic — Governance Discovery Through Seneca + Globe

## Vision

The Governada constellation globe becomes the **primary discovery surface** for all of Cardano governance, while every governance entity — DReps, SPOs, CC Members, Proposals, Treasury, GHI — gets a world-class investigation experience that elegantly presents blockchain-derived data in ways that make governance intuitive, powerful, and deeply explorable.

This Epic has two complementary halves:

1. **The Globe as Living Republic** — spatial discovery where governance philosophy is geography and Seneca is your guide
2. **Entity Investigation Architecture** — how users find, browse, filter, drill into, and cross-reference governance artifacts regardless of entry point

**What this replaces:** The current patchwork of DiscoveryHub (sheet with progress ring + tour checklists), CompassPanel (Seneca advisor in a separate sheet), QuickMatchFlow (standalone page), incomplete entity detail pages (CC members, Treasury, GHI), and entity directory pages as primary discovery paths.

**What this preserves and elevates:** The Match Flow theatrical choreography (already excellent), Seneca's conversational personality (strong), the globe command bus + behavior registry architecture (clean and agent-friendly), DRep and Proposal detail pages (strongest current entity surfaces — elevate further).

**The bar:**

- An anonymous visitor sees a living 3D constellation, asks Seneca "show me what's happening," and within 60 seconds understands the governance landscape better than any dashboard
- A citizen looking up a specific DRep gets a profile page that's as elegant and informative as a Bloomberg equity page — every piece of on-chain data presented with context and narrative
- A user investigating a treasury proposal can trace the money: who proposed it, who voted for/against, what the treasury balance would look like, and what similar proposals have done historically — all from one surface
- Any governance entity is reachable in 2 clicks max from the globe, from search, or from cross-entity links

## Strategic Context

- **Advances:** Steps 4 (Citizen Experience) + 7 (Viral Growth) + 10 (Advanced Intelligence)
- **Citizen test:** Citizens get spatial intuition for governance structure, not data tables
- **Flywheel:** Every globe interaction generates engagement signals that feed scoring, matching, and GHI

## Architectural Constraints

### Agent-Friendly Globe Development Rules

Previous agent attempts at globe interaction work produced vicious cycles of trial-and-error. The new architecture was designed to prevent this, but only if agents follow these patterns:

**1. Never touch the rendering layer.**
Agents MUST NOT modify `GlobeConstellation.tsx`, `NodePoints.tsx`, `GlobeCamera.tsx`, or any component inside `<Canvas>`. All visual changes flow through: **data → FocusState → shader reads in `useFrame`**. The rendering components already know how to render any FocusState.

If a chunk needs a new visual capability, it adds:

- A **new shader uniform** to `lib/globe/shaders.ts`
- A **new field to FocusState** in `lib/globe/types.ts`
- NodePoints (which already reads FocusState via `getSharedFocus()`) picks it up automatically

**2. Every new feature = one new behavior file.**
New globe capabilities are added via `lib/globe/behaviors/<name>Behavior.ts`. A behavior is a pure function: `(command, context) → void`. It reads command data and calls existing globe ref methods or dispatches other commands. Behaviors are registered in `useSenecaGlobeBridge.ts` — add one line. This pattern is isolated, testable, and can't break other behaviors.

**3. New data computations live in `lib/`, never in components.**

- Cluster detection → `lib/globe/clusterDetection.ts`
- Alignment layout → `lib/globe/alignmentLayout.ts`
- Region energy → `lib/globe/regionEnergy.ts`
  Components consume computed data. They don't compute it.

**4. Choreographies are sequences of existing commands.**
The choreographer (`lib/globe/choreographer.ts`) handles timing, cancellation, and sequencing. New animations are built by composing existing commands into new `Choreography` objects. Only add new command types if existing ones genuinely can't express the behavior.

**5. Debug overlay for verification.**
Each chunk should include a `__DEV__` mode overlay rendering FocusState, active behaviors, and pending choreographies as JSON in a fixed panel. Agents verify globe state by reading this data, not by interpreting screenshots.

### Visual Quality Standard: "Holographic Data Energy"

NOT weather/nature metaphors. The visual language is:

- **Holographic data visualization** — thermal imaging, energy signatures, data fields
- **Subtle atmospheric shifts** — the atmosphere shader already lerps colors; extend with smooth gradients
- **Light as information** — brighter = more active/aligned, dimmer = less relevant, color = category/stance
- **Slow, organic motion** — 21 min/revolution baseline tempo. Effects match this contemplative pace
- **Additive blending** — all glow effects use additive blending on dark backgrounds (inherently premium)

What looks **sci-fi real** with our stack:

- Per-node color gradients driven by shader uniforms (existing)
- Atmosphere color lerp across regions (atmosphere shader supports this)
- Edge energy flows with varying intensity (NetworkPulses does this)
- Bloom post-processing making emissive nodes glow (existing)
- Smooth transitions via FocusState intensity interpolation (existing)
- Simplex noise-based gradients in shaders for organic regional glow (add one GLSL utility)

What would look **cheesy** (avoid at all costs):

- Literal cloud/rain/snow particle effects
- Sharp-edged zones or borders
- Fast-moving animated textures
- Over-saturated neon colors
- Particle explosions or fireworks

### Tech Stack

No additions needed. Current stack is sufficient:

- **Three.js via R3F** — 3D rendering, GPU instancing, custom shaders
- **Custom GLSL shaders** — per-node color, glow, dimming, shape
- **Bloom post-processing** — emissive glow
- **Choreographer** — cancelable timed sequences
- **Command bus** — event-driven globe control
- **Behavior registry** — modular command handlers
- **FocusState bridge** — R3F ↔ React state sync via window globals

Only potential addition: **simplex noise GLSL function** for smooth regional gradients (single utility function, not a library).

---

## Current State (What Exists)

### Match Flow (Preserve + Elevate)

- **SenecaMatch.tsx**: 4-question quiz with conversational framing, globe choreography per answer, theatrical reveal
- **matchChoreography.ts**: `buildMatchStartSequence()`, `buildAnswerSequence()`, `buildRevealSequence()` — progressive narrowing + dramatic reveal
- **MatchResultOverlay.tsx**: Centered overlay showing #1 match with score, tier, dimensions
- **QuickMatchFlow.tsx**: Standalone page component with full results list, GovernanceRadar, DelegateButton
- **Status:** The choreography is excellent. The quiz conversation is strong. But Match lives on a standalone `/match` page disconnected from the globe. The result is a list, not a spatial revelation.

### Entity Discovery (Replace)

- **DiscoveryHub.tsx**: Sheet wrapper with open/close tracking. Just orchestration.
- **DiscoveryPanel.tsx**: Progress ring, tour launchers, feature checklist organized by JTBD categories. **This is an onboarding tool, not a discovery experience.** Replace entirely.
- **CompassPanel.tsx**: Seneca advisor in a sheet with contextual greetings, suggestion chips, conversation thread, daily message quota. **Good personality, wrong container.** Merge into the globe-integrated Seneca thread.
- **Globe entity panels**: DRepGlobePanel, PoolGlobePanel, ProposalGlobePanel, CCMemberGlobePanel — functional entity detail sheets in PanelOverlay. **Keep and elevate.**
- **Peek system**: PeekDrawerProvider + entity-specific peeks (DRep, Pool, Proposal, CC). **Keep for quick glances.**
- **ListOverlay**: Left panel with filtered entity list + sort. **Keep as a secondary discovery path.**

### Globe Layout (Foundation — Keep)

- **GlobeLayout.tsx**: Full-viewport globe with z-layered overlays, URL state, command listener, Seneca integration
- **ConstellationScene.tsx**: Thin wrapper for the R3F globe
- **GlobeControls.tsx**: Floating top-left controls
- **Status:** Solid orchestration. The URL state system, overlay management, and command listener are well-structured.

### Seneca Thread (Keep + Extend)

- **SenecaThread.tsx**: Unified panel for all Seneca modes (idle/conversation/research/matching/search)
- **useSenecaThread.ts**: Route detection, persona selection, mode management
- **Status:** Strong architecture. Modes are extensible. Session-persisted. The key gap: Seneca's idle mode shows briefing panels, but doesn't proactively show users what's interesting on the globe.

---

## Epic Structure: 6 Chunks

Each chunk is independently plannable, buildable, and deployable behind feature flags. Chunks build on each other but each delivers standalone value.

---

### Chunk 1: Semantic Spatial Layout — "The Geography"

**JTBD:** Make the globe reveal governance structure through spatial organization. DReps who think alike are neighbors. Governance factions are visible as clusters.

**Why this is foundational:** Every subsequent chunk depends on governance entities being spatially organized by alignment rather than arbitrary type clusters. Without this, regional energy, faction narratives, and spatial match reveals are meaningless.

**Scope:**

1. Compute PCA-2D projection of 6D alignment vectors → node x,y positions on globe surface
2. K-means cluster detection (k=5-8) on alignment vectors → faction boundaries
3. Cluster naming via Claude (one-shot per epoch, cached)
4. Smooth animated transition between current type-based layout and alignment layout
5. Layout toggle in GlobeControls (type clusters vs. alignment geography)
6. Cluster labels rendered as floating text near cluster centroids
7. URL state: `?layout=alignment` (default for authenticated) or `?layout=type` (default for anon first visit)
8. Feature flag: `globe_alignment_layout`

**Files to create:**

- `lib/globe/alignmentLayout.ts` — PCA projection + sphere surface mapping
- `lib/globe/clusterDetection.ts` — K-means + cluster metadata + Claude naming
- `lib/globe/behaviors/layoutBehavior.ts` — handles `setLayout` command type
- `app/api/governance/constellation/clusters/route.ts` — cluster data endpoint (cached)
- Inngest function step in existing sync: pre-compute layout + clusters at epoch boundary

**Files to modify (minimal, no rendering layer):**

- `lib/globe/types.ts` — add `setLayout` command type, add `layoutMode` to GlobeCommand union
- `useSenecaGlobeBridge.ts` — register layoutBehavior

**Data computation (server-side, pure math):**

- PCA already exists in `lib/alignment/pca.ts` — reuse for dimensionality reduction
- New: `computeAlignmentPositions(dreps[], spos[])` → `{ nodeId, x, y, z }[]` using PCA first 2 components projected onto sphere surface
- New: `detectClusters(positions[])` → `{ clusterId, centroid, memberCount, name, dominantDimension }[]`
- SPOs positioned by their alignment vectors too (same 6D space via `spo_alignment_snapshots`)
- Proposals positioned near the cluster centroid of their most-relevant dimension
- CC members positioned near the governance center (they span all dimensions)
- Cache: Redis or `alignment_layout_cache` Supabase table, TTL = 1 epoch

**How the layout transition works (no rendering changes needed):**

- Node positions are already per-instance attributes in NodePoints
- The layout behavior computes new positions and dispatches a `setNodePositions` command
- GlobeConstellation already interpolates (lerps) positions in `useFrame` when positions change
- Transition duration: 2 seconds (configurable)

**How cluster labels work:**

- Rendered as Three.js `<Html>` elements (R3F's HTML-in-3D bridge) at cluster centroid positions
- These follow the camera naturally and fade by distance
- Low complexity — same pattern as existing node tooltips

**Agent guidance:**

- Start by reading `lib/alignment/pca.ts` and `lib/alignment/dimensions.ts`
- Position computation is pure math — no Three.js knowledge needed
- The layout behavior dispatches position updates. NodePoints already handles position interpolation.
- Test: compute positions for 10 DReps, verify that DReps with similar alignment vectors get nearby positions
- Cluster detection is standard K-means — use a simple TS implementation (no library needed for k=5-8, n=700)

**Pre-build validation:**
Before building, compute PCA explained variance on current production data. If first 2 components explain <50% of variance, the spatial layout won't create meaningful clusters. Check this with a simple SQL query + PCA computation.

**Acceptance criteria:**

- [ ] Toggle to alignment layout → nodes smoothly reposition over 2s
- [ ] Visible clusters form (DReps with similar voting patterns are spatially grouped)
- [ ] 5-8 clusters detected with AI-generated names (e.g., "Innovation Quarter," "Treasury Conservatives")
- [ ] Cluster labels visible near centroids, fade appropriately with zoom
- [ ] SPOs, proposals, CC members positioned meaningfully (not random)
- [ ] URL state preserved → shareable alignment view
- [ ] Performance: layout computation <500ms, transition animation 60fps
- [ ] No regressions in existing match flow, vote split, or other behaviors
- [ ] Feature flag `globe_alignment_layout` controls the toggle

**Effort:** M (5-7 days)

---

### Chunk 2: Entity Discovery Through Globe + Seneca — "The Guide"

**JTBD:** Replace the DiscoveryPanel/DiscoveryHub/CompassPanel patchwork with a unified globe-first discovery experience where Seneca guides users to entities through spatial context, not lists and checklists.

**Why this matters:** Current discovery is fragmented: lists on `/governance/representatives`, a checklist in DiscoveryPanel, advisor in CompassPanel, globe nodes as a separate thing. Users should discover governance entities by exploring the globe with Seneca as their guide. "Show me the most active DReps" → globe highlights a cluster. "What proposals are controversial?" → globe shows vote-split regions.

**Scope:**

1. **Seneca idle mode reimagined:** When Seneca panel is in idle mode (no active conversation), instead of a static briefing card, show a **"What's alive right now"** digest that highlights 2-3 notable things on the globe with corresponding node highlights
2. **Seneca-driven entity discovery:** New advisor tools that highlight entities spatially:
   - `highlight_cluster` — highlights a faction cluster by name or dimension
   - `show_entity_neighborhood` — highlights an entity + its N nearest neighbors
   - `show_controversy` — highlights entities with divergent votes on a proposal
   - `show_active_region` — highlights the most recently-active governance region
3. **Globe as primary entity discovery:** Entity filter controls in GlobeControls (already exist) become the primary browse mechanism. List overlay stays as secondary. Remove DiscoveryPanel entirely.
4. **Seneca contextual suggestions:** Replace CompassPanel's suggestion chips with globe-aware suggestions:
   - Anonymous: "Find your place" (→ match), "What's being voted on?" (→ highlight proposals), "Who are the most active representatives?" (→ highlight top DReps)
   - Citizen: "What did my DRep do?" (→ fly to DRep, highlight recent votes), "What's controversial?" (→ vote split), "Where do I fit?" (→ highlight user's cluster)
5. **Remove DiscoveryPanel/DiscoveryHub:** Replace with Seneca thread's idle mode + globe-aware suggestions
6. **Feature flag:** `seneca_globe_discovery` (controls the new idle mode and tools)

**Files to create:**

- `lib/intelligence/advisor-discovery-tools.ts` — new tool implementations for spatial discovery
- `lib/intelligence/idleSynthesis.ts` — compute "what's alive right now" for idle mode
- `lib/globe/behaviors/discoveryBehavior.ts` — handles `highlightCluster`, `showNeighborhood`, `showControversy`, `showActiveRegion` commands

**Files to modify:**

- `lib/intelligence/advisor-tools.ts` — register new discovery tools
- `components/governada/panel/HubPanel.tsx` — replace static briefing with "what's alive" digest
- `components/governada/SenecaThread.tsx` — update idle mode rendering
- `lib/globe/types.ts` — add new command types
- `useSenecaGlobeBridge.ts` — register discoveryBehavior

**Files to remove/deprecate:**

- `components/discovery/DiscoveryPanel.tsx` — replace entirely
- `components/discovery/DiscoveryHub.tsx` — replace (keep DiscoveryHubContext if other components use `openHub`)
- `hooks/useDiscovery.ts` — deprecate (exploration progress tracking can be replaced with PostHog events)

**How "What's alive right now" works:**

- On globe load, a lightweight API call fetches: 3 most notable recent events (new proposal, large delegation shift, score milestone, GHI change)
- Each event has a `globeCommand` — the globe command to highlight the relevant entities
- Idle panel shows these as cards. Hovering/tapping a card executes the globe command.
- This replaces both the static briefing AND the discovery checklist.

**How new advisor tools work:**

- Each tool is a function in `advisor-discovery-tools.ts` following the existing pattern in `advisor-tools.ts`
- Tool executor returns `{ result: string, globeCommands: GlobeCommand[], displayStatus: string }`
- The advisor already emits globe commands from tool results — no streaming changes needed
- Example: `highlight_cluster` tool → queries cluster data → returns `[{ type: 'highlight', alignment, threshold }]` + descriptive text

**Agent guidance:**

- Read existing `lib/intelligence/advisor-tools.ts` to understand the tool pattern
- New tools follow the exact same interface — input schema, executor, globe commands
- The discoveryBehavior handles commands by calling existing globe ref methods (highlight, flyTo, dim, pulse)
- The idle synthesis is a lightweight computation — it doesn't need Claude, just recent event queries from Supabase
- Test: ask Seneca "show me active DReps" → verify globe highlights the right nodes

**Acceptance criteria:**

- [ ] Seneca idle mode shows "What's alive right now" with 2-3 globe-linked event cards
- [ ] Tapping an event card highlights corresponding entities on globe
- [ ] Seneca responds to "show me [entity type]" by highlighting on globe + providing context
- [ ] Seneca responds to "what's controversial?" by showing vote-split highlights
- [ ] Anonymous users get globe-aware suggestion chips (not a checklist)
- [ ] DiscoveryPanel removed. CompassPanel functionality merged into Seneca thread.
- [ ] Entity filter controls remain in GlobeControls as secondary browse path
- [ ] All discovery interactions tracked via PostHog events

**Effort:** L (8-10 days)

---

### Chunk 3: Spatial Match Flow — "Your Place in the Republic"

**JTBD:** Transform the match experience from "answer quiz → get ranked list" to "answer questions → the globe reveals where you belong → you see your place in the governance universe."

**Why this matters:** The current match flow has great choreography but ends with a list of DRep cards. In the Living Republic, match results aren't rankings — they're **locations**. Your match result is where your node appears in the constellation. Your top match isn't "DRep #1 on a list" — it's "your closest neighbor in governance space."

**Scope:**

1. **Match on the globe:** The match flow runs inside the globe view, not on a standalone `/match` page. Seneca's match mode uses the globe as its stage (already partially true — choreography exists, but results show as overlay cards, not spatial positions).
2. **User node placement:** After match computation, a "user node" appears at the position in the alignment layout that corresponds to the user's answer vector. The user literally sees themselves placed in the constellation.
3. **Spatial reveal:** Instead of a ranked list reveal, the camera zooms to the user's computed position, and nearby DRep nodes glow with match intensity (brighter = closer match). The user's neighborhood is visible.
4. **Cluster context:** Seneca narrates: "You belong in the Innovation Quarter — 47 DReps who share your priorities. Your closest match is DRep Athena, just 3 points of alignment away."
5. **Post-match exploration:** After the reveal, users can explore their neighborhood spatially — click nearby nodes to see peeks, fly to other clusters for comparison, ask Seneca "who else is near me?"
6. **Progressive deepening:** The existing CuratedVoteFlow (vote on proposals to improve confidence) updates the user's position in real-time — each vote nudges the user node to a more precise location.
7. **Standalone `/match` page becomes a redirect:** `/?match=true` triggers the globe-integrated flow
8. **Feature flag:** `globe_spatial_match` (falls back to current match flow if off)

**Files to create:**

- `lib/globe/userNodePlacement.ts` — compute user position from answer vector using same PCA projection
- `lib/globe/matchRevealChoreography.ts` — new reveal choreography that places user node + highlights neighborhood
- `lib/globe/behaviors/spatialMatchBehavior.ts` — handles user node placement + neighborhood highlight

**Files to modify:**

- `components/governada/panel/SenecaMatch.tsx` — replace list-based results with spatial reveal + neighborhood exploration
- `components/governada/MatchResultOverlay.tsx` — adapt to show spatial context (cluster name, neighborhood size) instead of just rank
- `lib/globe/matchChoreography.ts` — extend `buildRevealSequence()` with user node placement step
- `lib/globe/types.ts` — add `placeUserNode` command, add user node to FocusState
- `app/match/page.tsx` — redirect to `/?match=true` (globe view)

**How user node placement works:**

- Take user's answer vector (already computed by `buildAlignmentFromAnswers()`)
- Project through same PCA as layout computation → x,y position on globe surface
- Dispatch `placeUserNode` command → globe renders a special "user" node at that position
- User node has distinct visual: warm gold color, slightly larger, subtle pulse
- User node data stored in `UserNodeRings` component (already exists for authenticated users)

**How spatial reveal works (replaces ranked list):**

1. Match quiz completes → alignment vector computed
2. Globe dims all nodes (existing `dim` command)
3. Camera flies to computed user position (new `flyToPosition` command)
4. User node appears with expansion animation
5. Nearest N DRep nodes un-dim and glow with match intensity
6. Camera pulls back slightly to show the neighborhood
7. Seneca narrates the cluster context
8. Tapping any glowing node opens PanelOverlay with DRep detail + match-specific data (% match, dimension agreement)

**How this changes the anonymous experience:**

- Anonymous visitor → globe view → "Find your place" chip → Seneca match mode
- Quiz plays out on the globe (existing choreography)
- At reveal: "This is where you belong in Cardano's governance" — user sees their node
- "Connect your wallet to save your position" — incentive to authenticate
- This is dramatically more compelling than the current "Connect to delegate" CTA

**Agent guidance:**

- The user node placement is pure math (same PCA projection as Chunk 1)
- The reveal choreography builds on the existing `buildRevealSequence()` — add steps at the end
- The spatial match behavior registers alongside the existing match behavior
- Test: run match with known answers, verify user node appears in the correct region
- The biggest change is in `SenecaMatch.tsx` — the result step needs to show spatial context instead of a ranked list

**Acceptance criteria:**

- [ ] Match flow runs on globe view (not standalone `/match` page)
- [ ] After match, user node appears at correct alignment position on globe
- [ ] Nearby DReps glow with match intensity (brighter = closer)
- [ ] Seneca narrates cluster context: name, size, top match identity
- [ ] Tapping glowing nodes opens DRep detail with match-specific info
- [ ] Camera smoothly transitions from quiz → user placement → neighborhood view
- [ ] "Find your place" CTA replaces "Find your match" (language shift)
- [ ] Existing match choreography (quiz rounds, scanning animation) still works
- [ ] `/match` page redirects to `/?match=true`
- [ ] Feature flag `globe_spatial_match` falls back to current flow if off

**Effort:** L (8-10 days)

---

### Chunk 4: Regional Energy Fields — "The Atmosphere"

**JTBD:** Make governance activity visible as ambient energy on the globe — active regions glow, contested regions pulse, quiet regions dim. The globe _feels_ alive with governance.

**Why this matters:** Without ambient energy, the globe is static nodes on a sphere. With it, the globe communicates governance dynamics at a glance — before you read any text or ask Seneca anything, you can _see_ where governance is active.

**Scope:**

1. Per-cluster activity intensity computed from: recent votes cast, active proposals in dimension, engagement signals
2. Vote split energy: when viewing a proposal's context, regions color by aggregate stance (warm=Yes, cool=No)
3. Smooth gradient transitions using noise-based blending in the atmosphere shader
4. GHI health signal: overall atmosphere intensity/hue reflects governance health score
5. Feature flag: `globe_region_energy`

**Files to create:**

- `lib/globe/regionEnergy.ts` — compute per-cluster activity intensity + color
- `lib/globe/behaviors/regionEnergyBehavior.ts` — handles `setRegionEnergy` command
- `lib/globe/noise.ts` — simplex noise GLSL function string (pure data, ~30 lines)

**Files to modify (shader changes only):**

- `lib/globe/shaders.ts` — add `uRegionData` uniform (vec4 array) to `ATMOSPHERE_FRAG`. Add noise-based Gaussian blending from region centroids. This is the ONE place agents modify rendering — and it's a pure string, not a React component.
- `lib/globe/types.ts` — add `setRegionEnergy` command type
- `components/globe/GlobeAtmosphere.tsx` — pass regionData uniform to shader material

**How regional energy works (shader-only approach):**

- `regionEnergy.ts` computes: `{ centroid: [x,y,z], intensity: number, color: [r,g,b] }[]` for each cluster
- This is passed as a uniform array to the atmosphere shader
- The shader samples each fragment against all centroids using Gaussian falloff
- Multiple regions blend smoothly where they overlap
- Result: soft, holographic glow regions on the globe surface
- Looks like: thermal imaging on a military HUD. NOT like weather forecast regions.

**How vote split energy works:**

- When a proposal is focused, each cluster's aggregate vote (Yes/No/Abstain ratio) determines its color
- Warm (amber/gold) = majority Yes, Cool (blue/cyan) = majority No, Neutral (dim white) = split
- Same shader mechanism — just different color input to the uniform array
- Transition: smooth 1s lerp between normal energy and vote-split energy

**How GHI health signal works:**

- The existing `matchProgress` prop on `GlobeAtmosphere` already lerps the atmosphere color
- Map GHI score → atmosphere base color: healthy (teal/green tint) → stressed (amber tint) → critical (red tint)
- This is a 5-line change in the component that passes the atmosphere color

**Agent guidance:**

- The main work is the atmosphere shader modification — adding a uniform array and Gaussian sampling
- Read `lib/globe/shaders.ts` `ATMOSPHERE_FRAG` first — understand the existing fresnel setup
- Add the region sampling AFTER the fresnel calculation — additive blending
- Test: set 3 known centroids with known colors, verify smooth gradients appear
- `regionEnergy.ts` is pure math — given cluster data + recent activity → produce uniform array
- Performance budget: max 8 region sources. The shader loops over them per fragment.

**Acceptance criteria:**

- [ ] Alignment layout shows visible regional energy differences (active clusters glow brighter)
- [ ] Vote split mode shows warm/cool regional gradients (not per-node, per-region)
- [ ] GHI score reflects in overall atmosphere tint
- [ ] Transitions between normal/vote-split/GHI modes are smooth (1s lerp)
- [ ] Gradients are smooth (no hard edges) — Gaussian falloff from centroids
- [ ] Performance: 60fps with 8 region sources on mid-tier GPU
- [ ] Low-tier GPU: region energy disabled (graceful degradation via `estimateGPUTier()`)
- [ ] Feature flag `globe_region_energy` controls the feature

**Effort:** M (5-7 days)

---

### Chunk 5: Ambient Intelligence — "The Pulse"

**JTBD:** Make the globe feel alive — governance breathes, recent activity glows, significant events ripple through the constellation. Users feel they're looking at a living system, not a static snapshot.

**Scope:**

1. Activity recency: nodes that were recently active (voted, received votes, had delegation changes) are subtly brighter. Time-decays over hours.
2. Governance heartbeat: globe atmosphere subtly pulses with a slow rhythm (10s cycle) tied to epoch progress
3. New vote notifications: when a DRep votes during the user's session, their node briefly pulses
4. Delegation flow: when delegation changes happen, a subtle energy pulse flows along the affected edge
5. Proactive Seneca whispers tied to live events: "DRep Athena just voted on the Developer Fund proposal"
6. Feature flag: `globe_ambient_intelligence`

**Files to create:**

- `lib/globe/ambientState.ts` — compute recency-based brightness per node from last activity timestamps
- `lib/globe/behaviors/ambientBehavior.ts` — handles ambient state updates + event-driven pulses
- Event polling: lightweight endpoint that returns recent governance events (last N minutes)

**Files to modify:**

- `lib/globe/types.ts` — add ambient intensity field to FocusState
- `useSenecaGlobeBridge.ts` — register ambientBehavior, set up event polling interval (every 60s)

**How ambient recency works:**

- Each node gets a `recency` value (0-1) based on `updated_at` timestamp vs. current time
- Half-life: 6 hours. Recent activity = bright. 24+ hours = baseline.
- This feeds into FocusState as `ambientIntensities: Map<string, number>`
- NodePoints already supports per-node intensity via the `aDimmed` attribute — ambient is the inverse

**How governance heartbeat works:**

- A sinusoidal modulation (period: 10 seconds) of the atmosphere `uIntensity` uniform
- Amplitude: ±5% of base intensity. Subtle. Barely noticeable consciously but creates a "living" feel.
- Driven by: `useFrame` in GlobeAtmosphere, reading a simple `Date.now() % 10000` calculation

**How live event notifications work:**

- Poll endpoint every 60 seconds: `GET /api/governance/activity?since=<timestamp>`
- Returns: `{ type: 'vote' | 'delegation' | 'proposal', entityId, timestamp }[]`
- For each event: dispatch `pulse` command to the relevant node
- Seneca whisper hook (`useSenecaProactiveWhispers`) already exists — extend with live event triggers

**Agent guidance:**

- Ambient state computation is pure data: timestamps → brightness values
- The heartbeat is a 3-line addition to GlobeAtmosphere — sinusoidal modulation of existing uniform
- Event polling is a simple React interval + fetch. No WebSockets needed (yet).
- The `pulse` command already exists and works. Just dispatch it when events arrive.
- Most of this chunk is wiring, not invention — connecting existing pieces.

**Acceptance criteria:**

- [ ] Recently-active nodes are visibly brighter than dormant ones
- [ ] Globe atmosphere has a subtle, slow pulse (barely noticeable — "alive" not "flashy")
- [ ] New votes during session cause visible node pulses
- [ ] Seneca whispers proactively about significant events
- [ ] Performance: polling + ambient computation adds <5ms per frame
- [ ] Feature flag controls the feature; off = no ambient effects

**Effort:** S-M (4-6 days)

---

### Chunk 6: Entity Experience Elevation — "The Details"

**JTBD:** Ensure every entity type (DReps, SPOs, CC Members, Proposals, Treasury, GHI) has a polished, spatially-aware discovery experience through the globe panels and Seneca.

**Why this chunk exists:** Chunks 1-5 transform the globe into a living, navigable world. But the entity-level experience (what happens when you focus on a specific DRep, proposal, etc.) also needs to be elevated to match. Current globe panels are functional but basic.

**Scope:**

1. **DRep in spatial context:** When focusing a DRep, show their cluster membership, nearest neighbors, alignment position relative to cluster centroid, recent trajectory (are they drifting?)
2. **Proposal in spatial context:** When focusing a proposal, show which clusters support/oppose, predicted outcome based on current vote state, related proposals in the same governance dimension
3. **SPO in spatial context:** When focusing an SPO, show their governance alignment relative to DRep clusters, their delegator base alignment, competitive context
4. **CC Member in spatial context:** Show constitutional fidelity in context of recent votes, inter-body alignment with DRep/SPO clusters
5. **Treasury in spatial context:** Treasury proposals shown as energy flows from clusters toward the treasury node. Spending categories mapped to governance dimensions.
6. **GHI in spatial context:** GHI components mapped to cluster activity + atmosphere health signal. Each component highlights the relevant region when inspected.
7. **Seneca entity-aware tools:** When focused on any entity, Seneca automatically has that entity's context. "Tell me about this DRep" works without specifying which one.
8. Feature flag: `globe_entity_elevation` (controls spatial context additions; basic panels still work without)

**Files to modify:**

- `components/globe/DRepGlobePanel.tsx` — add cluster context, neighbor list, trajectory indicator
- `components/globe/ProposalGlobePanel.tsx` — add cluster stance visualization, outcome prediction
- `components/globe/PoolGlobePanel.tsx` — add alignment context, competitive positioning
- `components/globe/CCMemberGlobePanel.tsx` — add fidelity context, inter-body alignment
- `components/governada/panel/TreasuryPanel.tsx` — add spatial treasury flow visualization
- `lib/intelligence/advisor-tools.ts` — extend existing tools with spatial context from cluster data

**Files to create:**

- `lib/globe/entitySpatialContext.ts` — compute spatial context for any entity (cluster membership, neighbors, trajectory)
- `app/api/governance/constellation/entity-context/route.ts` — entity spatial context endpoint

**Agent guidance:**

- This chunk is primarily UI enrichment of existing panels — no globe rendering changes
- The spatial context data comes from Chunk 1's cluster detection + alignment layout
- Each panel gets 1-2 additional sections showing spatial context
- Seneca already knows the focused entity (via `entityId` in useSenecaThread) — tools just need cluster data injected into their context
- Keep panels concise — spatial context is one collapsible section, not a redesign

**Acceptance criteria:**

- [ ] DRep panel shows cluster name, top 3 neighbors, alignment trajectory arrow
- [ ] Proposal panel shows cluster support/oppose breakdown, predicted outcome
- [ ] SPO panel shows alignment position relative to DRep clusters
- [ ] CC panel shows fidelity context in inter-body alignment terms
- [ ] Treasury panel shows relevant governance dimension energy flows
- [ ] GHI inspection highlights relevant globe regions per component
- [ ] Seneca context-aware: asking about focused entity works seamlessly
- [ ] All additions are in collapsible sections (don't bloat panels)

**Effort:** M (5-7 days)

---

### Chunk 7: Entity Investigation Architecture — "The Library"

**JTBD:** Every governance entity (DRep, SPO, CC Member, Proposal, Treasury, GHI) has a world-class investigation experience — intuitive browsing, elegant blockchain data presentation, deep cross-entity linking, and Seneca-powered investigation. Users can find, filter, drill into, compare, and understand governance artifacts as naturally as browsing a Bloomberg terminal or a Wikipedia-quality reference.

**Why this chunk is critical:** The globe is one entry point. But many users will arrive via search, direct link, or navigation — and they need to find specific entities, compare options, and investigate deeply. This is the "library" of the republic — where all governance knowledge is organized, cross-referenced, and accessible. Without this, the globe is a beautiful entrance to a building with empty rooms.

**Current state assessment:**

| Entity    | Browse                            | Detail Page                                   | Cross-links                                     | Investigation Depth                                 | Grade |
| --------- | --------------------------------- | --------------------------------------------- | ----------------------------------------------- | --------------------------------------------------- | ----- |
| DRep      | Good (list + sort + filter)       | Strong (hero + 4 tabs + alignment + trust)    | Good (votes → proposals)                        | Deep (score analysis, trajectory, simulator)        | B+    |
| Proposal  | Good (list + status filter)       | Strong (hero + tri-body votes + intelligence) | Moderate (voters shown, related proposals weak) | Moderate (depth-gated sections exist)               | B     |
| SPO       | Basic (list + sort)               | Moderate (hero + 3 tabs + identity)           | Weak (inter-body shown, cross-links thin)       | Light (governance identity minimal)                 | C+    |
| CC Member | Basic (list + grade)              | Thin (fidelity grade, basic vote record)      | Weak (inter-body backend exists, not surfaced)  | Missing (no constitutional intelligence)            | D     |
| Treasury  | None (no browse)                  | None (panel view only)                        | Weak (proposals show amounts, no treasury page) | Missing (no spending analysis, trends, runway)      | D-    |
| GHI       | None (gauge exists, no discovery) | None (no health detail page)                  | None                                            | Missing (no component breakdown, trends, narrative) | F     |

**This chunk addresses the bottom half of that table while elevating the top half.**

**Scope — organized by entity type:**

#### 7a. Treasury Surface (NEW — currently doesn't exist)

**What to build:** A proper treasury discovery + investigation surface at `/governance/treasury`.

**What users should be able to do:**

- See the current treasury balance with historical trend (how has it grown/shrunk over epochs?)
- See NCL (Net Change Limit) utilization — how much of the epoch's spending budget is used/remaining
- Browse treasury proposals (active + historical) sorted by amount, status, category
- See spending by governance dimension/category over time (where does the money go?)
- See treasury effectiveness — what % of funded proposals delivered on milestones?
- Investigate individual treasury proposals: who proposed, who voted yes/no/abstain, what similar proposals have been funded before, what the treasury balance would look like if this passes
- Seneca narrates treasury state: "The treasury is healthy. 23% of this epoch's budget has been allocated. The largest pending request is X ADA for Y."

**Data sources (all exist in backend):**

- `treasury_snapshots` — per-epoch balance + spending
- `proposals` filtered by type (treasury withdrawal, info action, etc.)
- `proposal_voting_summary` — aggregate vote data
- `proposal_outcomes` — outcome tracking
- Treasury computation in `lib/data.ts` — `getTreasuryCurrent()`, `getTreasuryNcl()`

**Key components to create:**

- `app/governance/treasury/page.tsx` — treasury discovery page (force-dynamic)
- `components/governada/treasury/TreasuryOverview.tsx` — balance, trend, NCL bar, spending chart
- `components/governada/treasury/TreasuryProposalList.tsx` — browsable treasury proposals
- `components/governada/treasury/TreasurySpendingChart.tsx` — spending by category over epochs
- `components/governada/treasury/TreasuryEffectiveness.tsx` — outcome tracking visualization

**Inspiration:** USAspending.gov for government spending transparency. Robinhood for making financial data feel approachable. Apple Health for "one number + drill down."

#### 7b. CC Accountability Surface (ELEVATE — currently thin)

**What to build:** Elevate `/governance/committee` from a basic list to a constitutional accountability dashboard.

**What users should be able to do:**

- See overall CC health: aggregate fidelity score, average participation, constitutional alignment
- Browse CC members with fidelity grades (A-F), vote counts, participation rates
- Investigate individual CC members: full voting record, constitutional reasoning, inter-body alignment
- See CC agreement matrix: which members vote together? Are there voting blocs?
- Understand CC archetypes: what governance philosophy does each member represent?
- Compare CC members: side-by-side fidelity, participation, constitutional alignment
- See inter-body dynamics: how does CC voting correlate with DRep/SPO voting on the same proposals?
- Seneca narrates: "The CC is functioning well. Member X has the highest fidelity score. Two voting blocs have emerged — Bloc A (strict constructionists) and Bloc B (pragmatic interpreters)."

**Data sources (all exist in backend):**

- `cc_members` — roster with fidelity grades
- `cc_votes` — voting records
- `inter_body_alignment` — CC-DRep-SPO voting agreement matrix
- CC blocs/archetypes computed by `useCommitteeMembers()` — exists but not surfaced
- CC transparency index in `lib/scoring/ccTransparency.ts`

**Key components to create/elevate:**

- `components/governada/committee/CCHealthOverview.tsx` — aggregate health dashboard
- `components/governada/committee/CCAgreementMatrix.tsx` — inter-member agreement heatmap
- `components/governada/committee/CCBlocVisualization.tsx` — voting bloc detection + labels
- `components/governada/committee/CCMemberDetail.tsx` — enhanced member profile with fidelity breakdown
- `components/governada/committee/CCInterBodyDynamics.tsx` — CC vs DRep vs SPO voting patterns

**Inspiration:** Supreme Court vote tracker (SCOTUSblog). Congressional accountability sites.

#### 7c. GHI Discovery Surface (NEW — currently a gauge with no context)

**What to build:** A proper governance health discovery experience at `/governance/health`.

**What users should be able to do:**

- See the headline GHI score with health band and one-sentence narrative
- Drill into each of the 10 GHI components: what drives the score?
- See GHI trend over epochs: is governance getting healthier or sicker?
- Understand component contributions: which components are strong, which are dragging the score down?
- See EDI (Edinburgh Decentralization Index) metrics: Nakamoto coefficient, HHI, Gini
- Investigate a weak component: "DRep participation is low" → show which DReps are inactive → link to their profiles
- Seneca narrates: "Governance health has improved 4 points this epoch. The biggest driver was increased SPO participation — 12 new pools voted for the first time."

**Data sources (all exist):**

- `ghi_snapshots` — per-epoch GHI + 10 components + EDI
- `lib/ghi/components.ts` — component computation + weights
- Historical backfill covers epochs 530-621
- `decentralization_snapshots` — EDI metrics

**Key components to create:**

- `app/governance/health/page.tsx` — health discovery page (force-dynamic)
- `components/governada/health/GHIOverview.tsx` — headline score + band + narrative + trend arrow
- `components/governada/health/GHIComponentBreakdown.tsx` — 10 components with weights + contributions
- `components/governada/health/GHITrendChart.tsx` — historical GHI scores per epoch
- `components/governada/health/EDIMetrics.tsx` — decentralization metrics visualization
- `components/governada/health/GHIComponentDetail.tsx` — drill into one component → see what entities drive it

**Inspiration:** Apple Health summary → component detail. Credit Karma score breakdown.

#### 7d. Cross-Entity Investigation (ELEVATE everywhere)

**What to build:** Make every entity page a node in a richly linked investigation graph. Users can trace connections: DRep → their votes → proposals → treasury impact → other voters → similar DReps.

**Specific cross-links to add:**

**On DRep profiles:**

- "Similar DReps" section: DReps with closest alignment vectors (semantic similarity via embeddings)
- "How this DRep compares to your current delegation" (authenticated citizens)
- "Proposals this DRep is most aligned/misaligned with" (based on dimension matching)
- "Delegator sentiment" — what this DRep's delegators care about (from engagement signals)

**On Proposal pages:**

- "Related proposals" section elevated: semantic similarity via proposal embeddings (currently weak)
- "Faction breakdown" — how each governance cluster voted (requires Chunk 1 cluster data)
- "Historical precedent" — similar proposals from past epochs and their outcomes
- "If this passes" — treasury impact projection, governance dimension impact estimate

**On SPO profiles:**

- "Governance alignment comparison" — where this SPO sits relative to DRep clusters
- "How your pool's governance compares" — competitive context for SPO operators
- "Delegators who also care about governance" — intersection of staking + governance engagement

**On CC Member profiles:**

- "Constitutional precedent" — past CC decisions on similar proposal types
- "How this member's votes differ from the CC majority"
- "DRep alignment" — which DReps most often agree with this CC member

**Implementation approach:**

- Each cross-link is a collapsible section on the entity detail page
- Data computation happens in `lib/` (e.g., `lib/matching/similarEntities.ts`)
- Leverages existing embedding infrastructure for "similar X" features
- New API endpoints where needed: `app/api/governance/related/route.ts`

#### 7e. Universal Entity Search (ELEVATE)

**What to build:** A unified search experience that works across all entity types with semantic understanding.

**Current state:** ConstellationSearch exists but is basic full-text. HeaderSenecaInput connects to advisor but is conversational, not search-oriented. Neither provides structured, filterable search results.

**What users should be able to do:**

- Type a natural language query: "DReps who care about developer funding" → semantic search returns relevant DReps ranked by embedding similarity
- Type an entity name or ID: "Xerces" → instant lookup across all entity types
- Filter search results by type: DReps only, Proposals only, etc.
- See search results as cards with key metrics (score, tier, status)
- Click a result → navigate to entity detail (or open on globe with `?entity=`)
- Seneca understands search context: if you search from a DRep page, results are biased toward related entities

**Data sources:**

- `lib/embeddings/query.ts` — semanticSearch, hybridSearch already exist
- Enrichment metadata on each embedding for card display

**Key components to create/elevate:**

- `components/governada/search/UniversalSearch.tsx` — modal search overlay (cmd+K / ⌘K)
- `components/governada/search/SearchResultCard.tsx` — entity-type-aware result cards
- `components/governada/search/SearchFilters.tsx` — type filter chips

**Feature flag:** `universal_entity_search`

**Agent guidance for all of Chunk 7:**

- This chunk is primarily page/component work — no globe rendering changes
- Each sub-chunk (7a-7e) can be built independently
- Prioritize 7a (Treasury) and 7c (GHI) first — these are currently missing entirely
- 7b (CC) and 7d (Cross-links) elevate existing surfaces
- 7e (Search) is a horizontal improvement that benefits all entity types
- Use existing data hooks (`lib/data.ts`) — don't create new API endpoints unless the data query doesn't exist
- Follow existing page patterns: `force-dynamic`, Supabase reads, TanStack Query
- All new pages need entries in `ux-constraints.md` with JTBD constraints before building

**Acceptance criteria for Chunk 7 overall:**

- [ ] Treasury has a proper discovery page with balance, trends, spending analysis, proposal list
- [ ] CC has an elevated accountability dashboard with agreement matrix, blocs, inter-body dynamics
- [ ] GHI has a discovery page with headline score, component breakdown, trend chart, EDI metrics
- [ ] All entity detail pages have cross-entity links (similar entities, related proposals, faction context)
- [ ] Universal search returns semantically relevant results across all entity types
- [ ] Every surface works for anonymous users (read-only) and adds personalization for authenticated users
- [ ] Seneca provides contextual intelligence on every entity surface

**Effort:** XL (12-18 days — split across sub-chunks that can run in parallel)

---

### Chunk 8: The Anonymous Journey — "The Welcome"

**JTBD:** An anonymous visitor's first 2 minutes on Governada should be so compelling that they either start a match or start exploring entities — and both paths should feel natural, not forced.

**Why this chunk exists:** The anonymous experience is currently: globe + hover tooltips + match CTA. But with the Living Republic spatial layout (Chunk 1), rich entity surfaces (Chunk 7), and Seneca-guided discovery (Chunk 2), the anonymous entry experience needs to be redesigned to weave all of these together.

**The anonymous journey design:**

**Second 0-5: The Impression**

- Full-viewport constellation globe in alignment layout (Chunk 1)
- Subtle regional energy (Chunk 4) shows governance is alive
- Seneca orb pulses gently in the corner
- No text overlays cluttering the globe — let the visual speak

**Second 5-15: The Invitation**

- Seneca whisper appears: "This is Cardano's governance. Every light is a decision-maker."
- A subtle text overlay fades in at bottom center: two paths
  - "Where do I belong?" → starts match flow (Chunk 3)
  - "What's happening?" → Seneca opens with governance overview

**Second 15-60: The Exploration (if they chose "What's happening?")**

- Seneca streams a 30-second governance snapshot: active proposals, recent votes, treasury state
- As Seneca mentions entities, they highlight on the globe
- Suggestion chips appear: "Show me the most active DReps" / "What proposals are being voted on?" / "How healthy is governance?"
- Clicking any chip → Seneca responds with context + globe highlights relevant entities
- Clicking any highlighted node → entity peek opens (Chunk 7 entity surfaces)

**Second 15-90: The Match (if they chose "Where do I belong?")**

- Spatial match flow (Chunk 3) plays out on the globe
- At reveal: user sees their position in the republic
- "Save your position — connect your wallet" CTA

**Both paths converge:** User has seen governance structure, investigated at least one entity, and has context for why connecting a wallet matters.

**Key changes from current anonymous landing:**

- Replace "Find your DRep match" CTA with "Where do I belong?" (spatial language)
- Add "What's happening?" path for users who want to explore before matching
- Seneca available to anonymous users (currently blocked — CompassPanel is auth-only)
- Entity peeks work for anonymous users (currently feature-flagged off)
- Globe tooltips link to entity detail pages (currently hover-only with no deep link)

**Files to modify:**

- `components/hub/AnonymousLanding.tsx` — redesign entry experience
- `components/governada/SenecaThread.tsx` — enable limited anonymous access
- Feature flags: `anonymous_seneca_access`, `peek_drawer` (enable for anon)

**Agent guidance:**

- This chunk is a UX design + component modification task
- The key constraint: don't overwhelm anonymous users. Two clear paths. Progressive disclosure.
- Seneca's anonymous mode should have a limited scope (governance overview, match, entity lookup) — not the full advisor
- Reference `docs/strategy/context/ux-constraints.md` for anonymous landing constraints
- Test: have someone who knows nothing about Cardano governance use the anonymous experience. Can they understand what they're looking at within 60 seconds?

**Acceptance criteria:**

- [ ] Anonymous visitor sees living globe with alignment layout (if Chunk 1 shipped)
- [ ] Two clear paths presented within 5 seconds: "Where do I belong?" + "What's happening?"
- [ ] "What's happening?" opens Seneca with governance overview + globe highlights
- [ ] Anonymous users can peek at entities, search entities, and explore via Seneca
- [ ] Match flow leads to spatial reveal + wallet connect CTA
- [ ] No information overload — anonymous user can understand the page in 5 seconds

**Effort:** M (5-7 days)

---

## Dependency Graph

```
Chunk 1 (Semantic Layout) ← FOUNDATION — ships first
    ├── Chunk 2 (Entity Discovery via Globe) ← needs cluster data
    ├── Chunk 3 (Spatial Match) ← needs PCA projection
    ├── Chunk 4 (Regional Energy) ← needs cluster centroids
    └── Chunk 6 (Globe Entity Elevation) ← needs spatial context

Chunk 5 (Ambient Intelligence) ← independent, ship any time

Chunk 7 (Entity Investigation Architecture) ← independent of globe chunks
    ├── 7a (Treasury) ← can start immediately
    ├── 7b (CC Accountability) ← can start immediately
    ├── 7c (GHI Discovery) ← can start immediately
    ├── 7d (Cross-Entity Links) ← benefits from Chunk 1 clusters but not required
    └── 7e (Universal Search) ← benefits from all entity surfaces being built

Chunk 8 (Anonymous Journey) ← requires Chunks 1 + 2 + 3 + 7 to be meaningful
```

**Recommended build order:**

**Wave 1 (parallel):**

- Chunk 1 (Semantic Layout) — globe foundation
- Chunk 7a (Treasury Surface) — missing entity surface
- Chunk 7c (GHI Discovery) — missing entity surface

**Wave 2 (parallel, after Wave 1):**

- Chunk 3 (Spatial Match) — transformative UX, needs Chunk 1
- Chunk 7b (CC Accountability) — elevate weak surface
- Chunk 5 (Ambient Intelligence) — independent polish

**Wave 3 (parallel, after Wave 2):**

- Chunk 2 (Entity Discovery via Globe) — replaces old discovery
- Chunk 4 (Regional Energy) — visual polish
- Chunk 7d (Cross-Entity Links) — investigation depth

**Wave 4 (after Waves 1-3):**

- Chunk 6 (Globe Entity Elevation) — spatial context in panels
- Chunk 7e (Universal Search) — horizontal improvement
- Chunk 8 (Anonymous Journey) — ties everything together

## Validation Plan

**After Wave 1 ships:**

- Does the alignment layout produce meaningful clusters? (gate for globe chunks)
- Does the Treasury page have enough data to be useful? (gate for treasury depth)
- Does the GHI page tell a coherent story? (gate for health narrative features)

**After Wave 2 ships:**

- Does the spatial match change conversion rates vs. list-based match?
- Do CC accountability features surface meaningful patterns?

**After Wave 3 ships:**

- Do cross-entity links increase entity page engagement (page views per session)?
- Does globe-first discovery reduce time-to-entity-detail?

**After Wave 4 ships:**

- Full journey test: anonymous → explore/match → investigate entities → understand governance
- PostHog funnel: landing → match → entity_viewed → wallet_connected → delegated

## Feature Flag Strategy

| Flag                          | Chunk | Default | Rollout                  |
| ----------------------------- | ----- | ------- | ------------------------ |
| `globe_alignment_layout`      | 1     | off     | internal → preview → all |
| `seneca_globe_discovery`      | 2     | off     | internal → all           |
| `globe_spatial_match`         | 3     | off     | internal → preview → all |
| `globe_region_energy`         | 4     | off     | internal → all           |
| `globe_ambient_intelligence`  | 5     | off     | internal → all           |
| `globe_entity_elevation`      | 6     | off     | internal → all           |
| `treasury_discovery_page`     | 7a    | off     | internal → all           |
| `cc_accountability_dashboard` | 7b    | off     | internal → all           |
| `ghi_discovery_page`          | 7c    | off     | internal → all           |
| `cross_entity_links`          | 7d    | off     | internal → all           |
| `universal_entity_search`     | 7e    | off     | internal → all           |
| `anonymous_journey_v2`        | 8     | off     | internal → preview → all |

## Total Effort Estimate

| Chunk                           | Effort          | Wave                         |
| ------------------------------- | --------------- | ---------------------------- |
| 1. Semantic Layout              | M (5-7d)        | 1                            |
| 7a. Treasury Surface            | M (5-7d)        | 1                            |
| 7c. GHI Discovery               | M (5-7d)        | 1                            |
| 3. Spatial Match                | L (8-10d)       | 2                            |
| 7b. CC Accountability           | M (5-7d)        | 2                            |
| 5. Ambient Intelligence         | S-M (4-6d)      | 2                            |
| 2. Entity Discovery             | L (8-10d)       | 3                            |
| 4. Regional Energy              | M (5-7d)        | 3                            |
| 7d. Cross-Entity Links          | M (5-7d)        | 3                            |
| 6. Globe Entity Elevation       | M (5-7d)        | 4                            |
| 7e. Universal Search            | M (5-7d)        | 4                            |
| 8. Anonymous Journey            | M (5-7d)        | 4                            |
| **Total (serial)**              | **~70-90 days** |                              |
| **Total (3-agent parallelism)** | **~30-40 days** | 4 waves, 3 parallel per wave |

## Risk Register

| Risk                                                      | Likelihood | Impact | Mitigation                                                                                                                              |
| --------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| PCA doesn't produce meaningful 2D separation              | Medium     | High   | Pre-validate: compute explained variance on prod data before building. If <50% in 2 components, investigate alternatives (t-SNE, UMAP). |
| Regional energy shader kills mobile performance           | Medium     | Medium | GPU tier detection exists. Disable on low-tier. Max 8 regions.                                                                          |
| Spatial match reveal feels less "useful" than ranked list | Low        | Medium | Keep ranked list accessible as secondary view. Spatial reveal is the primary, list is the fallback.                                     |
| Cluster names feel generic or wrong                       | Low        | Low    | Claude naming with few-shot examples of good governance cluster names. Manual override via admin.                                       |
| Old discovery removal breaks flows for existing users     | Medium     | Medium | Feature flag gates new discovery. Old discovery stays until new is validated. Remove old only after 2 weeks of new in production.       |
| Treasury/GHI data too sparse for compelling pages         | Low        | Medium | Both datasets exist with historical backfill. Verify data richness before building UI.                                                  |
| CC accountability surfaces incomplete data                | Medium     | Low    | CC member set is small (7-10). Even partial data tells a story. Surface what exists, note gaps.                                         |
| Entity investigation pages bloat load times               | Low        | Medium | All new sections are collapsible (lazy-loaded). Heavy components use dynamic imports.                                                   |
| Anonymous Seneca costs too high                           | Medium     | Medium | Rate limit anonymous advisor to 5 messages/session. Cache common governance overview responses.                                         |
