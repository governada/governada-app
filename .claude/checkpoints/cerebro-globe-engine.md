# Cerebro Globe Engine — Checkpoint

**Last session**: 2026-04-01
**PRs shipped**: #787, #796, #797 (all merged to main)
**PR in flight**: #798 (Seneca streaming tests) — CI running, needs merge

## Vision

Every globe interaction — match flow, discovery, filtering, analysis, future features — follows the same "Cerebro" pattern: mute irrelevant nodes, camera moves to find relevant ones, visual effects signal that the system is "thinking" and "finding." Three clean layers:

```
PRODUCERS (SenecaMatch, discovery, browse, AI, all behaviors)
  → Write FocusIntent via setSharedIntent() — what's relevant & why

FOCUS ENGINE (pure functions, lib/globe/focusEngine.ts)
  → Derives FocusState + CameraDerived from intent

SEQUENCER (for theatrical moments only, lib/globe/sequencer.ts)
  → Promise-based, lockable, completion-signaling
  → Used for: reveals, spatial placement, cleanup
```

## Completed (all merged to main)

### PR #787 — Reactive Focus Engine (Phase 1) ✅

- Created `lib/globe/focusEngine.ts` (318 lines) — pure derivation functions
- Created `lib/globe/focusIntent.ts` (37 lines) — window-global intent bridge
- Migrated match Q&A phase to reactive intents
- Deleted 817 lines dead code

### PR #796 — Sequencer + Engine Lock (Priority 1) ✅

- `lib/globe/sequencer.ts` (185 lines) — promise-based with engine lock
- 47 unit tests (focusEngine 32 + sequencer 15)
- Double-dispatch eliminated, event-driven overlay

### PR #797 — Generalize FocusEngine (Priority 2) ✅

All globe interactions now use the reactive FocusIntent path:

- **5 behaviors migrated** from imperative ref calls to `setSharedIntent()`:
  - `topicWarmBehavior` — `from-alignment` intent, no camera move
  - `clusterBehavior` — `from-alignment` with cluster centroid, zoom
  - `discoveryBehavior` — explicit node IDs for neighborhood/active entities
  - `voteSplitBehavior` — async fetch → colorOverrides intent
  - `spatialMatchBehavior` — writes userNode to intent instead of state
- **New `focusControlBehavior`** handles bridge commands: highlight, dim, narrowTo, clear, reset
- **5 bridge switch cases removed** from `useSenecaGlobeBridge.ts`
- **`forceActive` field** added to FocusIntent for dim-all mode
- **33 new tests** (28 behavior + 5 engine) — 70 total globe tests

### PR #798 — Seneca Streaming Tests ⏳ (CI running, needs merge)

- Extracted `extractActionMarkers()` and `extractGlobeMarkers()` from `streamAdvisor.ts`
- Exported `getDisplayStatus()` from `advisor-tools.ts`
- **149 unit tests** across 5 files:
  - `intent-detection.test.ts` (49 tests) — detectGlobeIntent, isConversationalQuery
  - `stream-parsing.test.ts` (32 tests) — topic detection, marker extraction
  - `globe-commands.test.ts` (31 tests) — tool thinking commands, display status
  - `advisor-prompt.test.ts` (20 tests) — system prompt for all modes/personas
  - `tool-executors.test.ts` (17 tests) — executeAdvisorTool with mocked data

## Remaining Work — Priority Order

### Priority 3: Cerebro Polish (next)

The "wow factor" capabilities. The architecture is now clean enough to add these:

- **Generalize visual effects** — `MatchedEdgeGlow` (amber connections) and `GloryRing` (golden torus) currently only trigger during match flow. They should activate for any high-intensity focus (cluster highlight, discovery neighborhood, etc.). Files: `components/globe/GlobeEffects.tsx`
- **Atmospheric color shifting** — warm gold for match, cool blue for discovery, neutral for browse. File: `components/globe/GlobeAtmosphere.tsx`
- **Convergence particles** — scattered focused nodes → answer node
- **Region highlighting** — convex hull glow around clusters
- **Focus layering** — compose multiple focus rules (vote split colors + cluster highlight)
- **Scene snapshots** — serialize focus + camera for bookmarkable URLs
- **Transition curve control** — ease-in-out for dramatic, ease-out for snappy
- **Sustained "considering" pulse** on nodes Cerebro is evaluating

### GlobeConstellation Decomposition (deferred, maintenance)

Decomposing GlobeConstellation.tsx (~2300 lines) into sub-components. Phases 1-2 done (types, helpers, shaders, command bus extracted). Phase 3 partially done. This is readability/maintenance, not functionality.

## Architecture Quick Reference

### Globe Control Flow (post-PR #797)

```
REACTIVE PATH (default, ~95% of interactions):
  Producer → setSharedIntent(intent)
  → Engine tick (50ms, GlobeConstellation.tsx)
  → deriveFromIntent() → FocusState + CameraDerived
  → NodePoints reads FocusState (per-frame via window global)
  → CinematicCamera smooths toward derived position

SEQUENCER PATH (theatrical, ~4 sequences total):
  Producer → runSequence(steps, dispatch)
  → Engine lock acquired (isEngineLocked() = true)
  → Steps dispatched via setTimeout chain
  → Commands flow through bus → bridge → behaviors/ref methods
  → On completion: lock released, handle.done resolves

IMPERATIVE PATH (only flyTo, pulse, flash, cinematic, setRotation, zoomOut, flyToPosition, sequence):
  Bridge switch → globeRef.method()
  These are camera/animation commands that don't produce focus state
```

### Key Files

| File                                         | Lines   | Role                                                                   |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `lib/globe/focusEngine.ts`                   | ~320    | Pure derivation: intent → state + camera                               |
| `lib/globe/focusIntent.ts`                   | 37      | Window-global intent bridge (write side)                               |
| `lib/globe/focusState.ts`                    | 36      | Window-global state bridge (read side)                                 |
| `lib/globe/sequencer.ts`                     | 185     | Promise-based sequencer with engine lock                               |
| `lib/globe/types.ts`                         | ~345    | Canonical types (FocusIntent, FocusState, GlobeCommand)                |
| `lib/globe/matchChoreography.ts`             | 193     | Reveal/cleanup step definitions                                        |
| `lib/globe/behaviors/`                       | 7 files | match, voteSplit, topicWarm, cluster, discovery, spatial, focusControl |
| `components/GlobeConstellation.tsx`          | ~2300   | Main globe component (engine tick, ref methods)                        |
| `components/governada/panel/SenecaMatch.tsx` | ~800    | Match flow UI (intent producer + sequencer consumer)                   |
| `hooks/useSenecaGlobeBridge.ts`              | ~155    | Command bridge + behavior registry                                     |
| `components/globe/GlobeEffects.tsx`          | ~varies | MatchedEdgeGlow, GloryRing (match-only, needs generalization)          |

### FocusIntent Vocabulary (complete as of PR #797)

```typescript
interface FocusIntent {
  focusedIds: Set<string> | 'all-dreps' | 'all' | 'from-alignment' | null;
  intensities?: Map<string, number>;
  dimStrength?: number;
  nodeTypeFilter?: string | null;
  colorOverrides?: Map<string, string> | null;
  intermediateIds?: Map<string, number> | null;
  userNode?: { position: [number, number, number]; intensity: number } | null;
  cameraProximity?: 'overview' | 'cluster' | 'tight' | 'locked';
  flyToFocus?: boolean;
  approachAngle?: number;
  scanProgress?: number;
  activationDelays?: Map<string, number> | null;
  orbitSpeedOverride?: number;
  forceActive?: boolean; // NEW in #797 — dim-all mode
  alignmentVector?: number[];
  topN?: number;
}
```

### Test Coverage

| Area                           | Coverage    | Notes                                                                         |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------- |
| focusEngine pure functions     | ✅ 37 tests | All sentinels, camera derivation, alignment scoring, forceActive, dimStrength |
| sequencer                      | ✅ 15 tests | Completion, cancel, lock, auto-cancel, fake timers                            |
| behaviors (all 7)              | ✅ 28 tests | Intent production for each command type                                       |
| cluster detection              | ✅ 8 tests  | Pre-existing                                                                  |
| Seneca intent detection        | ✅ 49 tests | detectGlobeIntent, isConversationalQuery (PR #798)                            |
| Seneca stream parsing          | ✅ 32 tests | Topic detection, marker extraction (PR #798)                                  |
| Seneca globe commands          | ✅ 31 tests | Tool thinking commands, display status (PR #798)                              |
| Seneca prompt builder          | ✅ 20 tests | All modes, personas, contexts (PR #798)                                       |
| Seneca tool executors          | ✅ 17 tests | Mocked data executors, error handling (PR #798)                               |
| GlobeConstellation integration | ❌ None     | Would need R3F test harness                                                   |
| Match flow E2E                 | ❌ None     | Would need Playwright                                                         |
