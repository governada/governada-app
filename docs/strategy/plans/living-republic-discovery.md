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

**6. CRITICAL: Read all existing infrastructure before building anything.**
Before proposing any new files in `lib/globe/` or `lib/constellation/`, the agent MUST read ALL existing files in those directories and document what each one does:

```
lib/constellation/*.ts
lib/globe/**/*.ts
components/globe/*.tsx
hooks/useSenecaGlobeBridge.ts
```

Building a parallel system that duplicates existing functionality will be rejected. The codebase was recently refactored (50% code reduction) to be clean and maintainable. The goal is always to **extend and refine**, never to build a second version alongside the first.

**7. Pure functions stay pure. Never inject window globals into computation functions.**
Functions in `lib/constellation/globe-layout.ts` (`computeGlobeLayout`, `computeSpherePosition`) are pure layout computations — they take input data and return position data with **no side effects**. Never add `window.*` reads, `getSharedFocus()`, React state reads, or any environmental dependencies inside these functions. If runtime configuration is needed (e.g., layout mode selector), pass it as an **explicit parameter** to the function. Violation example: adding `if (getLayoutState() === 'alignment') {...}` inside `computeGlobeLayout()` is forbidden.

**8. No `key` prop re-mounting as a proxy for animation.**
Never use React `key` prop changes to force re-mounting components as a substitute for animated transitions. Re-mounting `ConstellationScene` destroys and recreates the entire Three.js scene (GPU resources, textures, geometries, all actor state). State transitions must flow through the behavior → FocusState → `useFrame` pattern. If a smooth animated transition to a new state is not yet possible, that is a gap to document and address, not a reason to use `key`.

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

### Globe Layout (Foundation — Keep and Extend, Never Replace)

- **`lib/constellation/globe-layout.ts`**: The layout engine. `computeGlobeLayout()` is a pure function that already positions nodes by governance alignment. `computeSpherePosition()` maps each node's 6D alignment vector to lon/lat using weighted directional accumulation across 6 dimension sectors (60° longitude bands each). **This is the alignment layout. It already works. Do not duplicate it.**
- **`lib/constellation/types.ts`**: `LayoutInput`, `ConstellationNode3D`, `LayoutResult`, `GovernanceNodeType`
- **GlobeLayout.tsx**: Full-viewport globe with z-layered overlays, URL state, command listener, Seneca integration
- **ConstellationScene.tsx**: Thin wrapper for the R3F globe
- **GlobeControls.tsx**: Floating top-left controls
- **Status:** Solid orchestration. The URL state system, overlay management, and command listener are well-structured. The spatial layout is alignment-based and correct — what's missing is cluster detection (naming the factions), cluster labels, and cross-feature metadata.

### Seneca Thread (Keep + Extend)

- **SenecaThread.tsx**: Unified panel for all Seneca modes (idle/conversation/research/matching/search)
- **useSenecaThread.ts**: Route detection, persona selection, mode management
- **Status:** Strong architecture. Modes are extensible. Session-persisted. The key gap: Seneca's idle mode shows briefing panels, but doesn't proactively show users what's interesting on the globe.

---

## Epic Structure: 6 Chunks

Each chunk is independently plannable, buildable, and deployable behind feature flags. Chunks build on each other but each delivers standalone value.

---

### Chunk 1: Semantic Spatial Layout — "The Geography"

**JTBD:** Make the governance factions that already exist in the spatial layout _visible_ — named, labelled, and Seneca-accessible — so users can understand what the clusters mean, not just see that nodes are grouped.

**CRITICAL: What already exists — read this before touching any code.**

`lib/constellation/globe-layout.ts` contains two critical functions that ALREADY implement alignment-based positioning. Do NOT duplicate or replace them:

- **`computeSpherePosition(input: LayoutInput): [lon, lat]`** — maps a node's 6D alignment vector to a sphere position via weighted directional accumulation. Each of the 6 governance dimensions (`alignment_treasury_conservative`, `alignment_treasury_growth`, `alignment_decentralization`, `alignment_security`, `alignment_innovation`, `alignment_transparency`) maps to a longitude sector (60° apart). The weighted directional vector of all dimension scores determines the final longitude + ±30° jitter. Specialization strength (how opinionated the node is) drives latitude toward the poles.

- **`computeGlobeLayout(inputs, nodeLimit)`** — the full layout engine. Calls `computeSpherePosition()` for every DRep/CC, uses geo coordinates for SPOs. Returns `{ nodes, edges, nodeMap }`. This is a **pure function** — no window globals, no React state.

The globe IS already alignment-aware. DReps who align with the same governance dimension ARE already spatial neighbors. What's missing is:

1. No explicit cluster detection (we can't name the factions or show their centroids)
2. No cluster labels visible on the globe
3. No API endpoint serving cluster metadata to Seneca or other features
4. No way for Seneca to reference "the Innovation Quarter" or "Treasury Conservatives" as named places

**Why this is foundational:** Chunks 2-6 reference named factions (Seneca says "You're in the Innovation Quarter"), regional energy needs cluster centroids, and spatial match needs cluster context. Chunk 1 provides the faction metadata that everything else points to.

**What Chunk 1 is NOT:**

- NOT a new layout engine (the layout works and should not be replaced)
- NOT a PCA rewrite (the existing weighted-direction approach outperforms PCA for this use case: PCA explained variance in the first 2 components was measured at only ~22%, well below the 50% threshold — the current sectored-longitude approach already captures governance-relevant structure better)
- NOT a smooth transition animation between "old" and "new" layouts (there is one layout; the animation question only arises if a toggle is later added, which is deferred)

**Scope:**

1. **Cluster detection on existing positions:** Run K-means (k=5-8) on the existing alignment vectors (the same 6D space `computeSpherePosition()` uses) to identify governance factions. Output: `{ clusterId, centroid6D, centroidSphere[lon,lat], memberIds, dominantDimension, memberCount }[]`
2. **Cluster naming via Claude:** One-shot prompt per detected cluster, cached per epoch. Input: cluster centroid's dimension weights + top member alignment patterns. Output: faction name (e.g., "Treasury Conservatives", "Infrastructure Advocates") + 1-sentence description.
3. **Clusters API endpoint:** `GET /api/governance/constellation/clusters` — returns cluster metadata (name, centroid, member count, dominant dimension). Cached in Redis, TTL = 1 epoch.
4. **Cluster labels on the globe:** Floating text labels at cluster centroids, visible at medium-low zoom, fade at close zoom. Rendered as R3F `<Html>` elements (same pattern as existing node tooltips). Labels are the faction name in `font-mono text-xs text-muted-foreground/60`.
5. **Cluster highlight command:** New command `highlightCluster` that dims non-member nodes and pulses member nodes. Used by Seneca in Chunk 2.
6. **Pre-compute in Inngest:** Add a step to the existing epoch sync function to pre-compute + cache cluster data at each epoch boundary.
7. Feature flag: `globe_alignment_layout`

**Files to create:**

- `lib/globe/clusterDetection.ts` — pure K-means on 6D alignment vectors: `detectClusters(inputs: LayoutInput[]) → Cluster[]`. Uses K-means++ initialization for stability. No external library needed (k=5-8, n≤700 is fast in pure TS).
- `lib/globe/behaviors/clusterBehavior.ts` — handles `highlightCluster` command: dims non-members, highlights cluster members, pulses centroid
- `app/api/governance/constellation/clusters/route.ts` — serve cached cluster data (force-dynamic)

**Files to modify (minimal, no rendering layer):**

- `lib/globe/types.ts` — add `highlightCluster` command type with `{ clusterId: string }` payload
- `hooks/useSenecaGlobeBridge.ts` — register clusterBehavior (one line)
- Existing Inngest epoch sync function — add cluster pre-computation step

**Files to NOT modify:**

- `lib/constellation/globe-layout.ts` — DO NOT touch. The layout is correct and pure. If you believe it needs changing, stop and document the justification before proceeding.
- `GlobeConstellation.tsx`, `NodePoints.tsx`, `GlobeCamera.tsx` — rendering layer, NEVER modify.

**How cluster detection works:**

- Input: `LayoutInput[]` — each has `alignments: number[]` (6D, 0-100 percentile each)
- Run K-means on raw 6D alignment vectors (not projected positions — work in native alignment space)
- k-selection: try k=5 through k=8, pick k that maximizes silhouette score
- `centroidSphere` is computed by calling `computeSpherePosition()` on a synthetic `LayoutInput` whose `alignments` = cluster centroid6D (import the function from `globe-layout.ts`)

**How cluster labels work:**

- One `<Html>` element per cluster, positioned at the `centroidSphere` coordinates projected to 3D via `sphereToCartesian()` (exported from `globe-layout.ts`)
- Labels fade when camera is very close (< r=4 from centroid) to avoid clutter during node inspection

**Agent guidance:**

- **Step 1 (REQUIRED before writing code):** Read `lib/constellation/globe-layout.ts` in full. Understand `computeSpherePosition()`, `computeGlobeLayout()`, `LayoutInput`, and `sphereToCartesian`. These are the source of truth for how nodes are positioned.
- **Step 2:** Read `lib/globe/behaviors/` to understand the behavior pattern
- **Step 3:** Read `hooks/useSenecaGlobeBridge.ts` to understand behavior registration
- **Step 4:** Write and test `clusterDetection.ts` in isolation — pure function, no globe imports needed
- **Step 5:** The behavior is minimal: receive `highlightCluster { clusterId }`, look up member IDs from cached cluster data, dispatch `dim` for non-members and `highlight` for members

**Validation gate (run before writing any UI code):**

After writing `clusterDetection.ts`, run it against real DRep alignment data (query `drep_alignment_snapshots` for the latest epoch). Verify:

- Silhouette score > 0.25 (indicates meaningful separation)
- Cluster centroids map to visually distinct sphere positions (different lon/lat bands)
- Each cluster has ≥5 members (no singleton clusters)

If silhouette < 0.15 for all k values, stop and document. Do not proceed with cluster labels until the clusters are meaningful.

**Acceptance criteria:**

- [ ] `clusterDetection.ts` is a pure function, fully testable without Three.js
- [ ] Cluster data API returns ≥5 named clusters with centroids, member counts, and dominant dimensions
- [ ] Cluster labels appear on the globe at correct spatial positions, fade at close zoom
- [ ] `highlightCluster` command dims non-members, highlights members with cluster-color glow
- [ ] Clusters pre-computed in Inngest at epoch boundary (not on every page load)
- [ ] `computeGlobeLayout()` in `globe-layout.ts` remains unchanged — pure function, no side effects added
- [ ] No regressions in existing match flow, vote split, or other behaviors
- [ ] Feature flag `globe_alignment_layout` controls cluster label visibility and highlight behavior

**Effort:** S-M (3-5 days — smaller than originally estimated because the layout already exists)

---

### Chunk 2: Entity Discovery Through Globe + Seneca — "The Guide"

**JTBD:** Make the globe the primary surface for discovering Cardano's governance entities — active proposals, DReps, SPOs, CC members, treasury — where Seneca acts as an intelligent spatial guide. A user should be able to say "show me who's voting on the developer fund proposal" and watch the globe respond, rather than navigating to a flat table at `/governance/proposals`.

**What "discovery" means here:** Users finding, browsing, and understanding governance entities. Not an onboarding checklist. Not a progress ring. The experience of a curious person who wants to understand who the major DReps are, what proposals are active, or what's happening in governance right now — delivered through conversation + spatial visualization, not a table with filters.

**What this replaces:**

- `HubPanel.tsx` static AI briefing → replaced by globe-linked "What's alive" digest
- `CompassPanel.tsx` suggestion chips → absorbed into `SenecaThread` `world === 'home'` idle mode
- `DiscoveryPanel.tsx` + `DiscoveryHub.tsx` → deleted (onboarding artifact, not a discovery experience)
- Globe as a passive background → globe as an active, responsive entity browser

**What this does NOT replace (explicitly leave untouched):**

- `/governance/*` flat listing pages — they coexist; they're just no longer promoted as the primary discovery path. Deprecation is a future step.
- `ListOverlay` — stays as a secondary table-style browse option
- Anything in `components/workspace/` or `components/studio/` — workspace is strictly out of scope. `StudioActionBar.tsx` imports from `components/discovery/` — do not delete discovery files that workspace depends on without a workspace-scoped cleanup pass first.
- Globe rendering layer (`GlobeConstellation.tsx`, `NodePoints.tsx`, `GlobeCamera.tsx`)

---

### Step 0: Establish `world` context in SenecaThread (foundational, ~20 lines)

**Do this before any other work in this chunk.** It's small, low-risk, and ensures everything built in Chunk 2 is explicitly scoped to `world === 'home'` rather than hardcoded as the global default.

**In `hooks/useSenecaThread.ts`:**

```typescript
export type World = 'home' | 'workspace' | 'you';

function getWorldForRoute(route: PanelRoute): World {
  if (route === 'hub') return 'home';
  if (route === 'workspace') return 'workspace';
  return 'home'; // default; 'you' introduced in a future chunk
}
```

Expose `world` from `useSenecaThread()` and pass it as a prop into `SenecaThread`. Pass it through to `readAdvisorStream()` options. Every feature built in this chunk checks `world === 'home'` before activating.

---

### Scope

**1. Seneca idle mode — "What's alive right now" (replaces HubPanel)**

When Seneca is idle (no active conversation) and `world === 'home'`, show a live digest of 2-3 notable governance events, each wired to a globe command.

**What cards look like:**

- "Treasury proposal [name] now accepting votes" → `highlightCluster` on relevant dimension + fly to proposal node
- "DRep [name] just crossed the 80-point threshold" → `flyTo` + pulse that DRep node
- "Governance health up 4 points this epoch" → atmosphere intensity update
- "[Proposal] is 6% from passing threshold" → highlight proposal voters (DReps who haven't voted)
- "[N] ADA re-delegated to DRep [name] this epoch" → flyTo + pulse

Each card has: a short headline, a sub-label (entity name + type), and an icon. Tapping/hovering executes the globe command. This requires **no LLM call** — it's a lightweight data fetch ranked by recency and magnitude of change.

**API:** `GET /api/governance/activity/recent` — returns `ActivityEvent[]`:

```typescript
interface ActivityEvent {
  type:
    | 'proposal_vote'
    | 'delegation_shift'
    | 'score_milestone'
    | 'ghi_change'
    | 'threshold_approach';
  headline: string;
  entityId: string;
  entityType: 'drep' | 'proposal' | 'spo' | 'cc';
  globeCommand: GlobeCommand;
  timestamp: string;
}
```

Cached in Redis, TTL = 5 minutes. No Claude needed for this endpoint.

**2. Globe-aware Seneca suggestion chips (replaces CompassPanel chips)**

In `SenecaThread`, when idle and `world === 'home'`, show context-appropriate chips instead of CompassPanel's static list:

- **Anonymous:** "Find my place" → triggers match flow, "What's being voted on?" → highlights proposal nodes, "Who's most active?" → highlights top-scoring DReps
- **Citizen (wallet connected):** "What did my DRep vote?" → fly to delegated DRep + highlight their recent votes, "What's controversial?" → show vote-split entities, "Where do I fit?" → highlight user's nearest cluster (requires Chunk 1)

These are hardcoded chip definitions — no AI needed. Each chip maps directly to a Seneca pre-prompt or a globe command.

**3. New Seneca advisor discovery tools**

New file: `lib/intelligence/advisor-discovery-tools.ts`. Follow the exact interface in `lib/intelligence/advisor-tools.ts` — same `ToolResult` type, same Anthropic tool definition format.

Tools to add:

- **`highlight_cluster`** — takes `cluster_name` or `dimension`, calls `/api/governance/constellation/clusters` (Chunk 1 endpoint), returns globe command to highlight faction members + a narrative about the faction
- **`show_neighborhood`** — takes `entity_id` + `entity_type`, returns the N spatially nearest entities with alignment similarity scores + globe command to highlight them
- **`show_controversy`** — finds active proposals with the most divergent tri-body voting (DRep yes, SPO no, or vice versa), returns top 3 + globe command to highlight the split
- **`show_active_entities`** — takes `entity_type` (drep/proposal/spo), returns the most recently active entities by vote/delegation/score activity + globe command to highlight them

Register all 4 in `ADVISOR_TOOLS` array in `advisor-tools.ts`.

**4. Globe discovery behavior**

New file: `lib/globe/behaviors/discoveryBehavior.ts`. Handles:

- `showNeighborhood { entityId, entityType, count }` — dims non-neighbors, highlights N nearest nodes
- `showControversy { proposalId }` — dims non-voters, highlights entities with divergent votes, colors by stance
- `showActiveEntities { entityType, entityIds }` — highlights the provided node IDs with pulse

Note: `highlightCluster` is already handled by `clusterBehavior` from Chunk 1. `discoveryBehavior` handles the remaining three. Register in `useSenecaGlobeBridge.ts` (one line).

**5. Discovery component cleanup**

Before deleting anything, audit all imports of each file. Safe to delete:

- `components/discovery/DiscoveryPanel.tsx` — if no non-discovery consumers
- `hooks/useDiscovery.ts` — if only consumed by DiscoveryPanel

**Defer to workspace cleanup pass:**

- `components/discovery/DiscoveryHub.tsx` + `DiscoveryHubContext.tsx` — `StudioActionBar.tsx` imports these; don't delete until workspace unification
- `components/discovery/CompassPanel.tsx` — audit first; if workspace-referenced, defer
- `components/discovery/SpotlightProvider.tsx` + `SectionSpotlightTrigger.tsx` — defer until usage is audited

The goal is to stop _rendering_ the old discovery components in Home world contexts, not necessarily to delete every file in the same PR.

---

**Files to create:**

- `lib/intelligence/advisor-discovery-tools.ts` — 4 discovery tools
- `lib/intelligence/idleActivity.ts` — `fetchRecentActivity(): ActivityEvent[]` (server-side, cached)
- `lib/globe/behaviors/discoveryBehavior.ts` — handles showNeighborhood, showControversy, showActiveEntities
- `app/api/governance/activity/recent/route.ts` — serves activity events (force-dynamic, Redis-cached)

**Files to modify:**

- `hooks/useSenecaThread.ts` — add `World` type + `getWorldForRoute()` + expose `world`
- `components/governada/SenecaThread.tsx` — accept `world` prop; scope idle mode cards + suggestion chips to `world === 'home'`
- `components/governada/panel/HubPanel.tsx` — replace AI briefing with globe-linked activity cards
- `lib/intelligence/advisor-tools.ts` — register 4 new discovery tools
- `lib/globe/types.ts` — add `showNeighborhood`, `showControversy`, `showActiveEntities` command types
- `hooks/useSenecaGlobeBridge.ts` — register discoveryBehavior (one line)

**Files to NOT modify:**

- `GlobeConstellation.tsx`, `NodePoints.tsx`, `GlobeCamera.tsx` — rendering layer
- `hooks/useSenecaGlobeBridge.ts` — only the one-line registration addition
- `components/workspace/` or `components/studio/` — workspace is hands-off
- `lib/constellation/globe-layout.ts` — pure function, do not touch

**Feature flag:** `seneca_globe_discovery` — gates the new idle mode cards, suggestion chips, and discovery tools. When off, `HubPanel` shows its existing AI briefing.

---

**Mandatory pre-build reading list:**

1. `hooks/useSenecaThread.ts` — understand `PanelRoute`, mode system, persona selection
2. `components/governada/SenecaThread.tsx` — understand idle mode, how globe commands are dispatched, how suggestion chips currently work
3. `hooks/useSenecaGlobeBridge.ts` — read only; understand globe command dispatch + behavior registration
4. `lib/intelligence/advisor-tools.ts` — read the full file; understand `ToolResult`, `ADVISOR_TOOLS`, executor pattern before writing any new tools
5. `components/governada/panel/HubPanel.tsx` — understand what's being replaced
6. `lib/globe/behaviors/` — read all existing behaviors before writing discoveryBehavior
7. `components/discovery/` — read all files + grep for their imports before deleting anything

---

**Acceptance criteria:**

- [ ] `world` type exists in `useSenecaThread.ts`; all Chunk 2 features check `world === 'home'` before activating
- [ ] Seneca idle mode shows 2-3 live governance event cards with globe commands; cards execute on tap
- [ ] HubPanel static briefing is replaced; no regression in feature-flag-off state (existing briefing still renders)
- [ ] Seneca responds to "show me active DReps" → globe highlights relevant nodes
- [ ] Seneca responds to "what's controversial?" → globe shows vote-split entities
- [ ] Seneca responds to "show me [faction name]" → globe highlights that cluster (requires Chunk 1)
- [ ] Anonymous users see globe-aware suggestion chips; citizen users see personalized chips
- [ ] Activity API returns events in <200ms (Redis-cached)
- [ ] No workspace regressions — `StudioActionBar` and workspace Seneca unaffected
- [ ] Feature flag `seneca_globe_discovery` correctly gates all new behavior
- [ ] `npm run preflight` passes clean

**Effort:** M-L (6-9 days — Step 0 is small; idle mode + tools is the bulk; cleanup is bounded)

---

### Chunk 3: Spatial Match Flow — "Your Place in the Republic"

**JTBD:** Transform the match experience from "answer quiz → get ranked list" to "answer questions → the globe reveals where you belong → you are placed into the governance constellation as a citizen of this republic."

**What this replaces:**

- `QuickMatchFlow.tsx` — full-page match UI with no globe integration → delete entirely (audit imports first)
- The ranked-list result paradigm — match results are no longer "DRep #1 on a list" but "your closest neighbor in governance space"
- The overlay-centric reveal — `MatchResultOverlay` gets extended to show spatial context (cluster name, neighborhood), not replaced

**What this preserves (already excellent):**

- `SenecaMatch.tsx` quiz flow — 4 questions, Seneca's conversational personality, per-answer choreography with progressive narrowing (200→50→10→5)
- `matchChoreography.ts` — `buildMatchStartSequence()`, `buildAnswerSequence()`, the camera weaving and dive angles. All of this stays. The reveal sequence gets _extended_, not replaced.
- `buildAlignmentFromAnswers()` — produces the 6D alignment vector from quiz answers. Already exists. Do not duplicate.

**What already exists that makes this smaller than it looks:**

- `app/match/page.tsx` already redirects to `/?match=true` — no change needed
- `nodeType === 'user'` is already handled in `NodePoints.tsx` (user nodes are grouped separately)
- `UserNodeRings.tsx` already renders a Three.js element at a 3D position (bloom-integrated rings for authenticated users)
- `USER_COLOR = '#f0e6d0'` (warm white-gold) already defined
- `alignmentsToArray()` in `lib/drepIdentity.ts` converts `AlignmentScores` → `number[]` for `computeSpherePosition()`
- `computeSpherePosition()` in `lib/constellation/globe-layout.ts` maps 6D alignment → `[lon, lat]` on the globe. **This is how user node position is computed. Not PCA.**
- `sphereToCartesian()` (also in `globe-layout.ts`) converts `[lat, lon, r]` → `[x, y, z]`

---

### CRITICAL: Globe interaction model

**The globe is NOT directly manipulable by users.** Users do not rotate, zoom, click, or drag the globe. All globe interaction is Seneca-driven. Seneca choreographs the globe; users interact through the Seneca panel (typing or tapping suggestion chips).

This means: post-reveal exploration is NOT "click nearby nodes." It IS "ask Seneca about nearby nodes via suggestion chips that trigger Chunk 2's discovery tools."

---

### Scope

**1. User node placement function** (`lib/globe/userNodePlacement.ts`)

Pure function. Takes `AlignmentScores` from quiz answers, returns `[x, y, z]`:

```typescript
function computeUserNodePosition(answers: AlignmentScores): [number, number, number] {
  const alignments = alignmentsToArray(answers);
  const syntheticInput: LayoutInput = {
    id: 'user',
    fullId: 'user',
    name: 'You',
    power: 0.5,
    score: 50,
    dominant: getDominantDimension(alignments),
    alignments,
    nodeType: 'drep', // use drep positioning logic for citizens
  };
  const [lon, lat] = computeSpherePosition(syntheticInput);
  const r = 5.0; // inner-mid shell — prominent but not center
  return sphereToCartesian(lat, lon, r);
}
```

Import `computeSpherePosition`, `sphereToCartesian` from `lib/constellation/globe-layout.ts`. Import `alignmentsToArray` from `lib/drepIdentity.ts`. This is ~20 lines of code.

**2. `placeUserNode` command + FocusState extension**

Add to `lib/globe/types.ts`:

- New command: `placeUserNode { position: [x,y,z], intensity: number }`
- New FocusState field: `userNode?: { position: [x,y,z], intensity: number } | null`

The command sets `userNode` in FocusState via `setSharedFocus()`. The rendering layer already handles user-type nodes — the agent must verify WHERE `UserNodeRings` is mounted in the component tree and follow the same pattern to render the match-derived user node.

**Important:** Before writing any rendering code, the agent MUST read `GlobeConstellation.tsx` to understand where `UserNodeRings` is rendered. If it's inside `GlobeConstellation`, a small targeted addition (conditionally rendering a match user node when `focusState.userNode` is set) is the right approach. This is an EXCEPTION to the "never modify rendering layer" rule — but it must be minimal and additive only. Document the exact change in the PR description.

**3. Extended reveal sequence**

Extend `buildRevealSequence()` in `matchChoreography.ts`. The current sequence ends with camera flying to the #1 DRep. The new sequence adds steps AFTER the existing ones:

Current flow (preserve all of this):

1. Globe dims, orbits slowly (cinematic state)
2. Flashes top 5 matches in reverse (5→4→3→2→1)
3. Escalating delays (500ms runners-up → 900ms #1)
4. Camera locks on, flies to #1 DRep node

New steps appended: 5. `placeUserNode` — user's warm gold node appears at their computed position with expansion animation 6. Camera pulls to the USER's position (not the DRep's) — reframes from "here's your match" to "here's where YOU belong" 7. Nearby N DRep nodes un-dim and glow with match intensity (brighter = closer alignment) 8. Camera pulls back slightly to show the neighborhood 9. Seneca narrates cluster context: "You belong in the [cluster name] — [N] DReps share your priorities. Your closest match is [name], [score]% aligned."

The key philosophical shift: **the user's position is the destination.** The top DRep is just the closest neighbor, not the main event.

**4. MatchResultOverlay spatial context**

Extend (not replace) `MatchResultOverlay.tsx`:

- Add above the DRep card: cluster name + neighborhood size ("Innovation Quarter — 47 nearby DReps")
- Keep: DRep name, match %, dimension agreement bars, delegate CTA, view profile link
- Remove/de-emphasize: rank framing ("#1 match" → "Closest match")
- Graceful fallback: if cluster data (Chunk 1) is not available, show "Your neighborhood — [N] nearby DReps" without faction name

**5. Post-reveal Seneca suggestion chips**

After the reveal lands and overlay appears, Seneca shows context-appropriate chips:

- "Tell me about [top match name]" → opens DRep peek via Seneca
- "Who else is near me?" → triggers Chunk 2's `show_neighborhood` tool
- "Show me a different cluster" → triggers Chunk 2's `highlight_cluster` tool
- "Connect wallet to save my place" (anonymous only) → wallet prompt

This is NOT new code — it's Chunk 2's discovery tools triggered from the post-match state. The only new work is the chip definitions and the state transition that activates them.

**6. SenecaMatch.tsx result step update**

The `'results'` step in `SenecaMatch.tsx` currently shows `MatchResultOverlay` (portal) + compact match cards scrollable in the panel. Update:

- Still show `MatchResultOverlay` (now with spatial context)
- Replace compact match card list with the Seneca suggestion chips
- The panel becomes the guide, not a list — "Explore your neighborhood" heading + chips

**7. QuickMatchFlow cleanup**

Delete `components/governada/match/QuickMatchFlow.tsx` and all its sub-components. Audit all imports first — grep for `QuickMatchFlow`, `ResultsScreen`, `useQuickMatch`. Remove any dead imports. The `/match` redirect is already in place.

**8. Anonymous experience**

- Anonymous visitor → globe view → "Find your place" idle chip → Seneca match mode
- Quiz plays out on the globe (existing choreography, no changes)
- Reveal: user node appears → "This is where you belong in Cardano's governance"
- Post-reveal: suggestion chips for exploration
- Seneca says: "Connect your wallet to save your place and start delegating" — incentive to authenticate
- This replaces the generic "Connect to delegate" CTA with a spatially grounded reason to connect

**9. Authenticated user returning to homepage**

If a citizen has previously completed the match quiz:

- Their user node persists at their match-derived alignment position (stored in local state or Supabase user profile)
- On homepage load, globe subtly highlights their position (not a full reveal, just a warm glow)
- Seneca greeting: "Welcome back. You're in the [cluster name]." (if cluster data available)

If they haven't matched yet: no user node, "Find your place" chip available.

DReps/SPOs/CC members: they ARE real nodes already. No user node needed. Globe can fly to their position on homepage load.

---

**Files to create:**

- `lib/globe/userNodePlacement.ts` — compute user position from answer vector via `computeSpherePosition()`
- `lib/globe/behaviors/spatialMatchBehavior.ts` — handles `placeUserNode` command, updates FocusState

**Files to modify:**

- `lib/globe/types.ts` — add `placeUserNode` command, add `userNode` to FocusState
- `lib/globe/matchChoreography.ts` — extend `buildRevealSequence()` with steps 5-9 above
- `components/governada/panel/SenecaMatch.tsx` — update `'results'` step: spatial context + Seneca chips instead of ranked list
- `components/governada/MatchResultOverlay.tsx` — add cluster/neighborhood context above DRep card
- `hooks/useSenecaGlobeBridge.ts` — register spatialMatchBehavior (one line)
- `GlobeConstellation.tsx` — EXCEPTION: small, targeted addition to render user node when `focusState.userNode` is set (follow `UserNodeRings` pattern exactly)

**Files to delete:**

- `components/governada/match/QuickMatchFlow.tsx` + sub-components (audit imports first)

**Files to NOT modify:**

- `lib/constellation/globe-layout.ts` — pure function, import only
- `NodePoints.tsx`, `GlobeCamera.tsx` — rendering layer (GlobeConstellation exception above is the ONLY rendering change)
- `lib/globe/matchChoreography.ts` — extend only (do NOT replace `buildRevealSequence`, append to it)

**Feature flag:** `globe_spatial_match` — gates user node placement, extended reveal, spatial overlay context. When off, existing `SenecaMatch` flow runs unchanged (ranked list reveal).

---

**Mandatory pre-build reading list:**

1. `lib/constellation/globe-layout.ts` — understand `computeSpherePosition()` and `sphereToCartesian()`. This is how user node position is computed. NOT PCA.
2. `lib/matching/answerVectors.ts` — understand `buildAlignmentFromAnswers()` and the answer vector format
3. `lib/drepIdentity.ts` — understand `alignmentsToArray()` conversion
4. `components/governada/panel/SenecaMatch.tsx` — understand the full state machine, all steps, how the reveal transitions work
5. `lib/globe/matchChoreography.ts` — understand `buildRevealSequence()` fully before extending it
6. `components/governada/MatchResultOverlay.tsx` — understand the current overlay layout before adding spatial context
7. `components/globe/UserNodeRings.tsx` — understand the Three.js rendering pattern and WHERE it's mounted
8. `components/globe/GlobeConstellation.tsx` — read to find where `UserNodeRings` is mounted, then follow the same pattern for match user node
9. `lib/globe/types.ts` — understand FocusState and the command union before extending
10. `components/governada/match/QuickMatchFlow.tsx` — read + grep all imports before deleting

---

**Acceptance criteria:**

- [ ] User node placement uses `computeSpherePosition()` from `globe-layout.ts` — NOT PCA, NOT a new layout function
- [ ] After match, user node appears as a Three.js element (warm gold, bloom-integrated) at the correct alignment position
- [ ] Reveal sequence extends existing `buildRevealSequence()` — all current choreography preserved, new steps appended
- [ ] Camera flies to USER's position (not DRep's) — user is the destination
- [ ] Nearby DReps glow with match intensity (brighter = closer alignment)
- [ ] Seneca narrates cluster context with graceful fallback if cluster data unavailable
- [ ] Post-reveal suggestion chips trigger Chunk 2 discovery tools (not direct globe manipulation)
- [ ] `MatchResultOverlay` shows cluster name + neighborhood context above DRep card
- [ ] `QuickMatchFlow.tsx` deleted, no dead imports remain
- [ ] Anonymous users see "Connect wallet to save your place" after reveal
- [ ] Authenticated users returning to homepage see their persisted user node position
- [ ] Feature flag `globe_spatial_match` falls back to current ranked-list flow when off
- [ ] `computeGlobeLayout()` remains unchanged — pure function, no side effects
- [ ] `npm run preflight` passes clean

**Effort:** M-L (6-9 days — smaller than originally estimated: `/match` redirect done, user node infra exists, post-reveal chips reuse Chunk 2 tools)

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
Chunk 1 (Cluster Detection + Labels) ← FOUNDATION — ships first
    ├── NOTE: The alignment layout itself already exists in lib/constellation/globe-layout.ts
    ├── Chunk 1 adds: cluster detection, naming, API endpoint, globe labels, highlightCluster command
    ├── Chunk 2 (Entity Discovery via Globe) ← needs cluster data + highlightCluster command
    ├── Chunk 3 (Spatial Match) ← needs cluster context for narrative + reuses Chunk 2 discovery tools for post-reveal chips
    ├── Chunk 4 (Regional Energy) ← needs cluster centroids for atmosphere shader
    └── Chunk 6 (Globe Entity Elevation) ← needs spatial context (cluster membership per node)

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
| 1. Cluster Detection + Labels   | S-M (3-5d)      | 1                            |
| 7a. Treasury Surface            | M (5-7d)        | 1                            |
| 7c. GHI Discovery               | M (5-7d)        | 1                            |
| 3. Spatial Match                | M-L (6-9d)      | 2                            |
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
