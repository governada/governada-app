# Seneca + Globe Architecture Refactor — Checkpoint

**Branch**: `claude/competent-golick`
**Plan**: `C:\Users\dalto\.claude-personal\plans\goofy-growing-hoare.md`
**Status**: Phase 3 partially complete — extraction files created, GlobeConstellation.tsx not yet updated

## Completed

### Phase 1: Foundation (committed ✅)

Created canonical type/utility modules:

- `lib/globe/types.ts` (241 lines) — GlobeCommand, FocusState, ConstellationRef, CinematicStateInput, color constants, camera defaults, SceneState
- `lib/globe/focusState.ts` (36 lines) — R3F cross-reconciler window global bridge
- `lib/globe/shaders.ts` (139 lines) — All GLSL shaders (atmosphere, node, SPO, pulse)
- `lib/globe/helpers.ts` (64 lines) — rotateAroundY, sleep, estimateGPUTier, seededRandom, makeCircleTexture
- `lib/entity/entityId.ts` (137 lines) — Unified entity ID parsing/formatting

### Phase 2: Communication Consolidation (committed ✅)

- `lib/globe/globeCommandBus.ts` (33 lines) — Single `dispatchGlobeCommand()` utility
- `hooks/useGlobeCommandListener.ts` (23 lines) — Single listener hook
- All 6 inline CustomEvent dispatches replaced across: SenecaThread, SenecaMatch, SenecaConversation, GovernadaShell, GlobeTooltip
- All 5 inline addEventListener blocks replaced across: SynapticHomePage, AnonymousLanding, GlobeLayout (consolidated 2→1)
- Zero inline `new CustomEvent('senecaGlobeCommand')` remaining in any .tsx file

### Phase 3: GlobeConstellation Decomposition (IN PROGRESS)

**Created extraction files** (not yet committed):

- `components/globe/GlobeAtmosphere.tsx` (51 lines) — Atmospheric fresnel rim glow
- `components/globe/GlobeCamera.tsx` (120 lines) — IdleCameraWobble, CinematicCamera, TiltedGlobeGroup
- `components/globe/GlobeAmbient.tsx` (54 lines) — AmbientStarfield, RaycastConfig
- `components/globe/GlobeEdges.tsx` (266 lines) — NetworkEdgeLines, EdgeLayer, ConstellationEdges, NeuralMesh
- `components/globe/GlobeEffects.tsx` (387 lines) — NetworkPulses, MatchedEdgeGlow, FlyToParticles, GloryRing

**STILL NEEDED for Phase 3:**

1. **Update GlobeConstellation.tsx** — Add imports from the 5 new files, remove the inline function definitions. The agents added imports at the top but the inline definitions still exist, causing "conflicts with local declaration" errors.
2. **Extract NodePoints** — The biggest sub-component (~430 lines, lines 1241-1851). Includes `ConstellationNodes` (grouping layer) and `NodePoints` (GPU-instanced renderer). This is the performance-critical core. Extract to `components/globe/NodePoints.tsx`.
3. **Remove EDGE_STYLES const** (line 1853) from GlobeConstellation.tsx — now in GlobeEdges.tsx.
4. **Clean up unused imports** in GlobeConstellation.tsx — shaders (ATMOSPHERE*\*, PULSE*\*), helpers (seededRandom, makeCircleTexture), useThree, AXIAL_TILT are now imported by the extracted components, not needed in the main file.
5. **Type check** — run `npx tsc --noEmit 2>&1 | grep GlobeConstellation` to verify zero new errors.

**Key interfaces needed by NodePoints extraction:**

- `ConstellationNodes` takes: `{ nodes, nodeMap, userNode, proposalNodes, fragmentShader?, overlayColorMode, urgentNodeIds, completedNodeIds, visitedNodeIds }`
- `NodePoints` takes: `{ nodes, nodeType, getColor, defaultSize, fragmentShader?, userNode? }`
- Both use `getSharedFocus()` and `getSharedFocusVersion()` from `lib/globe/focusState.ts`
- NodePoints uses `NODE_VERT`, `NODE_FRAG`, `SPO_FRAG` from `lib/globe/shaders.ts`
- NodePoints uses `DREP_COLOR`, `SPO_COLOR`, `USER_COLOR`, `PROPOSAL_COLOR`, `MATCH_COLOR`, `POINT_SCALE` from `lib/globe/types.ts`

## Remaining Phases

### Phase 4: SenecaThread Decomposition

Split `components/governada/SenecaThread.tsx` (1,379 lines → ~400):

- `hooks/useSenecaStreaming.ts` (~200 lines) — streaming useEffect with abort, globe dispatch, tool status
- `components/governada/panel/SenecaIdle.tsx` (~200 lines) — idle state: ghost prompts, quick actions
- `components/governada/panel/SenecaMessages.tsx` (~150 lines) — scrollable conversation view
- `components/governada/panel/SenecaSearch.tsx` (~100 lines) — search mode UI

### Phase 5: Choreography Scheduler

Create `lib/globe/choreographer.ts` (~100 lines):

- `Choreography` type: named sequence of `{ command, delayMs, label? }` with computed `totalDuration`
- `createChoreographer(dispatch)` → `{ play, cancelAll }`
- `ChoreographyHandle`: `{ cancel(), done: Promise, totalDuration }`
- Replace `getRevealDurationMs()` with `handle.totalDuration`
- Update `SenecaMatch.tsx` to use choreographer

### Phase 6: Behavior Registry

Create `lib/globe/behaviors/`:

- `types.ts` — GlobeBehavior interface
- `registry.ts` — registerBehavior, executeBehavior
- `matchBehavior.ts`, `voteSplitBehavior.ts`, `topicWarmBehavior.ts`
- Wire into `useSenecaGlobeBridge` as optional routing layer

### Phase 7: Cleanup

- Archive: ConstellationHero.tsx, GovernanceConstellation.tsx, InhabitedConstellation.tsx
- Remove re-export shims from Phase 1
- Update all 15 files importing ConstellationRef from GovernanceConstellation to import from lib/globe/types

## Verification

After completing Phase 3:

- `npx tsc --noEmit 2>&1 | grep -E "GlobeConstellation|GlobeEdges|GlobeEffects|GlobeCamera|GlobeAtmosphere|GlobeAmbient|NodePoints"` should return zero errors
- `wc -l components/GlobeConstellation.tsx` should be ~600 lines (down from 2,504 current)
- All globe visual behaviors must be preserved (match flow, vote split, temporal replay, warm topic, fly-to, idle rotation, breathing)
