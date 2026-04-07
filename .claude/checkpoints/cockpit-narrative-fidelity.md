# Cockpit Narrative Fidelity — Push to 9/10

## Status: Ready for Fresh Agent

## Context

The Cockpit (Governance Command Center Homepage) is shipped to production behind `globe_homepage_v2` flag. Two PRs merged:

- **PR #618**: All 11 build phases (foundation, shell, Seneca strip, action rail, overlay tabs, globe enhancements, tooltip, network edges, detail panel, cinematics, sound, temporal scrub, mobile, boot choreography, completion feedback, accessibility)
- **PR #619**: Adversarial review fixes (StatusStrip visibility, Seneca overlay awareness, real urgentCount)

An adversarial code + production review scored the DRep narrative fidelity at **6/10**. The target is **9/10 minimum**.

## The DRep Narrative (Acceptance Spec)

This is the story every interaction must deliver:

> A DRep opens Governada → HUD cascades in with Seneca narrating → sees urgent nodes pulsing → hovers action card → globe pans, Seneca narrates entity → clicks Review → cinematic zoom + detail panel → opens Studio for deep review → votes → returns to Cockpit → node resolves green, rail item checks off → clears rationale debt → enters dead-time discovery mode → scrubs temporal history → wraps up fully informed. Every step must work exactly as described.

## What's Working Well (DO NOT CHANGE)

These are confirmed strong by the adversarial review. Changing them risks regression.

- **Zustand store design** (`stores/cockpitStore.ts`): Clean persistence split, 200-node cap, sound in localStorage, visited in sessionStorage
- **Overlay system** (`lib/cockpit/overlayConfigs.ts`): Co-located config per overlay, extensible
- **Action rail card animation** (`components/cockpit/ActionRailCard.tsx`): Framer Motion spring physics, green flash → slide-out
- **Sound design** (`hooks/useGovernadaSound.ts`): All procedural Web Audio, temperature-modulated ambient, opt-in default
- **Boot sequence timing** (`lib/cockpit/types.ts`): Constants-driven cascade, sessionStorage skip on revisit
- **Accessibility** (`components/cockpit/CockpitTextMode.tsx`): Full sr-only semantics, ARIA roles
- **Mobile swipe-to-complete** (`components/cockpit/CockpitMobile.tsx`): Haptic + drag threshold
- **Detail panel** (`components/cockpit/CockpitDetailPanel.tsx`): Focus trap, Esc close, spring animation, entity-adaptive action button
- **StatusStrip** (now visible below header with real urgentCount)
- **Seneca overlay awareness** (prepends context hints per overlay tab)

## Remaining Gaps (What Blocks 9/10)

### Gap 1: Globe Node Interaction — Unreliable Click Detection

**Current score: Transition Cinematics 6/10, Globe as Memory 5/10**
**Target: Both 8+/10**

**Problem:** Node hitboxes are tiny. Clicking on the globe almost always rotates the camera instead of selecting a node. The click-to-detail-panel flow — the CORE interaction loop of the narrative — fires unreliably.

**Files:**

- `components/GlobeConstellation.tsx` — Node rendering, raycaster setup
- `components/ConstellationScene.tsx` — Scene wrapper, props
- `components/cockpit/CockpitHomePage.tsx` — `handleNodeSelect` handler

**Fix approach:**

1. **Increase raycaster threshold** — The Three.js raycaster has a `params.Points.threshold` that controls hit detection radius. Increase it (e.g., from default 1 to 3-5) so near-misses still register.
2. **Add hover glow** — When the cursor is near a node (within raycaster threshold), brighten/scale the node so users can see the target before clicking. Use the existing `hoveredNode` state.
3. **Differentiate click from drag** — Track `mousedown` → `mouseup` distance. If < 5px, treat as click (raycast for node). If > 5px, treat as drag (rotate globe). Currently any mouse movement during click = rotation.
4. **Cursor change** — Set `cursor: pointer` when raycaster detects a node under the cursor.

**Acceptance:** A user can reliably click any visible proposal hexagon or DRep point and get the detail panel 90%+ of the time.

### Gap 2: Data-Driven Discovery Prompts

**Current score: Dead-time Intelligence 4/10**
**Target: 8+/10**

**Problem:** When no urgent actions remain, the Seneca strip shows 5 hardcoded static strings ("delegation patterns shifted 12%...", "a new proposal cluster emerged..."). These are fake data that will never match reality.

**Files:**

- `hooks/useSenecaStrip.ts` — `DISCOVERY_PROMPTS` array (lines ~81-87)
- `lib/intelligence/context.ts` — Context synthesis endpoint

**Fix approach:**

1. When `isDeadTime` is true, pull discovery insights from the `/api/intelligence/context` response instead of hardcoded strings
2. If the context endpoint returns `insights` or `discoveries`, use those
3. If no data-driven insights available, fall back to 2-3 generic but honest prompts ("Governance is quiet. Explore the constellation to discover DReps aligned with your values.")
4. Remove ALL fake statistics from the hardcoded prompts

**Acceptance:** Discovery mode shows real governance insights or honest generic prompts — never fake statistics.

### Gap 3: Globe Overlay Recoloring — More Dramatic Visual Shift

**Current score: Overlay Tabs Change Everything 7/10**
**Target: 9/10**

**Problem:** When switching overlays (1-4 keys), the globe appearance barely changes. The `overlayColorMode` is passed to `ConstellationScene` but the actual visual difference is subtle. The promise of "everything changes" is only ~60% delivered.

**Files:**

- `components/GlobeConstellation.tsx` — `getDrepColor`, `getSpoColor`, `getProposalColor` callbacks (~line 998+)
- `lib/cockpit/overlayConfigs.ts` — Config per overlay

**Fix approach:**

1. **Urgent overlay:** Non-actionable nodes should dim to 15% opacity (currently they dim to `#333333` which is still visible). Add opacity reduction via the `aDimmed` attribute or by adjusting the alpha in the fragment shader.
2. **Network overlay:** Teal tint on all delegation-related nodes, dim non-delegated. Delegation bonds (golden arcs) should brighten.
3. **Proposals overlay:** Proposal hexagons should glow/brighten, ALL other nodes (DReps, SPOs, CC) should significantly dim.
4. **Ecosystem overlay:** Default colors — this is the baseline "everything visible" mode.

**Acceptance:** A screenshot of each overlay should look visually distinct from the others at a glance. A user unfamiliar with the app should be able to tell "something changed" on every tab switch.

### Gap 4: Network Edges — Actual Lines, Not Just Legend

**Current score: Cross-body Relationship Edges 3/10**
**Target: 7+/10**

**Problem:** `NetworkEdges.tsx` only renders a count legend ("10 voting alignment pairs"), not actual lines between nodes on the globe. The spec promises visible relationship edges.

**Files:**

- `components/cockpit/NetworkEdges.tsx` — Currently legend-only
- `app/api/cockpit/network-edges/route.ts` — API endpoint (may need verification)
- `components/GlobeConstellation.tsx` — Would need to accept edge data as children or props

**Fix approach (simplest viable):**

1. Use a 2D SVG overlay on top of the globe canvas
2. For each edge pair, project the 3D node positions to 2D screen coordinates using the Three.js camera
3. Draw SVG lines between projected positions, updating on each animation frame (or on camera change)
4. Color-code: teal for delegation, amber for alignment, violet for CC-DRep
5. Fade in/out on network overlay switch
6. Cap at 15-20 edges for performance

**Alternative (if 3D projection is too complex):**

- Render `<Line>` elements from `@react-three/drei` inside the R3F scene using the globe node 3D positions directly. This avoids the projection math but requires passing edge data into the scene.

**Acceptance:** Network overlay shows at least 10 visible colored lines connecting node pairs on the globe.

### Gap 5: Visited Node Visual Encoding

**Current score: Globe as Memory 5/10**
**Target: 8/10**

**Problem:** `visitedNodeIds` is tracked in sessionStorage and passed conceptually, but there is NO visual encoding on the globe. Visited vs. unvisited nodes look identical.

**Files:**

- `components/GlobeConstellation.tsx` — Node rendering, shader pipeline
- `stores/cockpitStore.ts` — `visitedNodeIds` array

**Fix approach:**

1. Pass `visitedNodeIds` as a prop to `ConstellationScene` → `GlobeConstellation`
2. In the node rendering, add a subtle visual distinction: visited nodes get a thin ring (border) or slightly reduced opacity (~80% vs 100% for unvisited)
3. The tooltip already shows "Visited" chip — make the globe itself echo this

**Acceptance:** After clicking a node and returning, that node looks subtly different from unvisited nodes.

## Dependency Order

```
Gap 1 (hitbox) → Gap 5 (visited encoding)  [sequential — hitbox fix needed before visited visuals matter]
Gap 2 (discovery)                           [independent]
Gap 3 (overlay recoloring)                  [independent]
Gap 4 (network edges)                       [independent, after Gap 3 for overlay integration]
```

**Recommended execution:** Fix Gap 1 first (it's the core interaction loop). Then tackle Gaps 2, 3, 4 in parallel. Gap 5 depends on Gap 1 being reliable.

## Effort Estimate

| Gap       | Description                    | Effort          | Impact on Score                 |
| --------- | ------------------------------ | --------------- | ------------------------------- |
| 1         | Globe node hitbox + hover glow | 3-4 hours       | +2 points (cinematics + memory) |
| 2         | Data-driven discovery prompts  | 1-2 hours       | +1 point (dead-time)            |
| 3         | Dramatic overlay recoloring    | 2-3 hours       | +1 point (overlay tabs)         |
| 4         | Network edge lines             | 3-4 hours       | +1 point (edges)                |
| 5         | Visited node visual encoding   | 1-2 hours       | +1 point (memory)               |
| **Total** |                                | **10-15 hours** | **6/10 → projected 9-10/10**    |

## Key Files Reference

| File                                        | Purpose                                                               |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `components/cockpit/CockpitHomePage.tsx`    | Main orchestrator — all HUD components are children                   |
| `stores/cockpitStore.ts`                    | Zustand store — single source of truth for HUD state                  |
| `components/GlobeConstellation.tsx`         | Core 3D renderer — shaders, node geometry, raycaster, color callbacks |
| `components/ConstellationScene.tsx`         | Scene wrapper — props interface for globe features                    |
| `hooks/useSenecaStrip.ts`                   | Seneca strip data — boot narration, rotation, hover, discovery modes  |
| `hooks/useCockpitActions.ts`                | Action queue hook — maps items to globe node IDs                      |
| `hooks/useGovernadaSound.ts`                | Procedural Web Audio sounds                                           |
| `lib/cockpit/types.ts`                      | Types, boot sequence constants, density computation                   |
| `lib/cockpit/overlayConfigs.ts`             | Per-overlay configuration (colors, filters, hints)                    |
| `components/cockpit/ActionRailCard.tsx`     | Individual action cards with completion animation                     |
| `components/cockpit/CockpitDetailPanel.tsx` | Right-side detail panel on node selection                             |
| `components/cockpit/NetworkEdges.tsx`       | Network edges (currently legend-only)                                 |
| `components/cockpit/OverlayTabs.tsx`        | Bottom center overlay tab bar                                         |
| `components/cockpit/StatusStrip.tsx`        | Top HUD bar (epoch, temp, urgent, sound)                              |
| `components/cockpit/SenecaStrip.tsx`        | AI narration strip                                                    |
| `components/cockpit/TemporalScrubber.tsx`   | Epoch history scrubber                                                |
| `components/cockpit/CockpitMobile.tsx`      | Mobile layout                                                         |
| `components/governada/GlobeTooltip.tsx`     | Hover tooltip with action buttons                                     |
| `components/hub/HubHomePage.tsx`            | Entry dispatcher — `globe_homepage_v2` flag check                     |

## Full Build Plan Reference

The original 13-phase plan lived in a private local file. The path is omitted from the repo copy.

## Adversarial Review Protocol

After fixing all 5 gaps, the agent MUST run an adversarial review before declaring the build complete.

### Review Process

1. **Launch a separate adversarial reviewer agent** (`subagent_type: "general-purpose"`, model: `opus`) with:
   - This checkpoint file (the plan)
   - The DRep narrative (above)
   - Access to Claude Chrome MCP tools for production testing
   - Read access to the codebase

2. **The reviewer independently:**
   - Reads the plan and DRep narrative
   - Reads the built code (all cockpit components, stores, hooks)
   - Navigates to https://governada.io in Chrome
   - Walks through the DRep narrative step by step, taking screenshots
   - Produces a structured review:

   **SPEC VIOLATIONS** (must fix before ship):
   - Anything in the narrative that doesn't work or is missing
   - Broken interactions
   - Persona-specific failures

   **QUALITY GAPS** (should fix):
   - Janky animations, visual hierarchy issues
   - Information scent failures
   - Mobile layout issues

   **WHAT'S STRONG** (do NOT change):
   - What works well

3. **Scores each elevation 1-13** on implementation quality (1-10)
4. **Scores overall DRep narrative fidelity** (1-10)

### Iteration Loop

1. Reviewer produces findings
2. Builder fixes all SPEC VIOLATIONS and QUALITY GAPS
3. Builder deploys to production (full pipeline: preflight → commit → push → PR → merge → verify health)
4. Reviewer re-reviews AGAINST PRODUCTION (not just code)
5. Repeat until:
   - Zero SPEC VIOLATIONS remaining
   - Zero QUALITY GAPS remaining
   - **DRep narrative fidelity ≥ 9/10**
   - Both agents agree: "This matches the spec"

### Reviewer Heuristics

The reviewer must specifically probe:

- **Cohesion test:** Hover a node → does Seneca strip, action rail, AND globe all respond? If any one doesn't react, spec violation.
- **Dead-time test:** Are there states where the homepage feels empty or useless? Every state should deliver value.
- **5-second test:** Can a DRep understand "what needs my attention" within 5 seconds?
- **Return visit test:** Does boot sequence skip on return? Do visited nodes show memory?
- **Keyboard test:** Can every interaction be completed via keyboard alone?
- **Reduced motion test:** Does `prefers-reduced-motion` result in functional experience?
- **Edge cases:** 0 urgent items? 20 urgent items? No delegation? New DRep with no votes?
- **Click reliability test:** Can nodes be selected on the globe reliably (90%+ success rate)?
- **Overlay visual test:** Can you tell which overlay is active JUST from looking at the globe (without seeing the tab bar)?

### Context Overflow Protocol

If context runs low mid-build or mid-review:

1. Save state to `.claude/checkpoints/cockpit-narrative-fidelity.md` with: gaps completed, current gap in progress, remaining work, any failures
2. Hand off: "Continue the Cockpit narrative fidelity push from `.claude/checkpoints/cockpit-narrative-fidelity.md`"

## Handoff Instructions

Tell the fresh agent:

> Continue the Cockpit narrative fidelity push from `.claude/checkpoints/cockpit-narrative-fidelity.md`. The Cockpit is live at https://governada.io behind the `globe_homepage_v2` flag. Current narrative fidelity: 6/10, target: 9/10 minimum. Fix the 5 gaps in dependency order, deploy each fix to production, then run the adversarial review protocol. Iterate until builder + reviewer agree on 9+/10.
