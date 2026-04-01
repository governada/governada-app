# Cerebro Globe Engine — Checkpoint

**Last session**: 2026-03-31
**PR shipped**: #787 (reactive focus engine, Phase 1) — merged
**PR in flight**: #796 (sequencer + engine lock) — CI running
**Plan file**: `C:\Users\dalto\.claude-personal\plans\idempotent-gathering-ritchie.md`

## Vision

Every globe interaction — match flow, discovery, filtering, analysis, future features — should follow the same "Cerebro" pattern: mute irrelevant nodes, camera moves to find relevant ones, visual effects signal that the system is "thinking" and "finding." The architecture has three clean layers:

```
PRODUCERS (SenecaMatch, discovery, browse, AI)
  → Write FocusIntent — what's relevant & why

FOCUS ENGINE (pure functions, lib/globe/focusEngine.ts)
  → Derives FocusState + CameraDerived from intent

SEQUENCER (for theatrical moments only, lib/globe/sequencer.ts)
  → Promise-based, lockable, completion-signaling
  → Used for: reveals, spatial placement, cleanup
```

## Completed

### PR #787 — Reactive Focus Engine (Phase 1) ✅ Merged

- Created `lib/globe/focusEngine.ts` (318 lines) — pure derivation functions
- Created `lib/globe/focusIntent.ts` (37 lines) — window-global intent bridge
- Migrated match Q&A phase to reactive intents (SenecaMatch + CerebroMatchFlow)
- Deleted 817 lines dead code (ConversationalMatchFlow, ImmersiveMatchPage)
- Reveal sequences left imperative (intentionally, addressed in PR #796)

### PR #796 — Sequencer + Engine Lock (Priority 1) ✅ Shipped (pending CI)

**What it fixed:**

1. **Double-dispatch killed** — removed `onGlobeCommand` prop forwarding from SenecaMatch. Commands dispatch via `dispatchGlobeCommand` bus only. One path, no duplication.
2. **Promise-based sequencer** — `lib/globe/sequencer.ts` (185 lines). `runSequence()` returns `{ done: Promise, cancel() }`. Acquires engine lock before first step, releases on completion or cancel.
3. **Engine lock** — `isEngineLocked()` check added to GlobeConstellation's engine tick. When sequencer is running, the reactive engine is frozen.
4. **Event-driven overlay** — SenecaMatch awaits `handle.done` instead of `setTimeout(getRevealDurationMs())`. Overlay appears when sequence actually completes.
5. **Restart fix** — cleanup sequence runs WITHOUT engine lock (`lockEngine: false`) so the quiz can restart immediately.
6. **47 unit tests** — focusEngine pure functions (32) + sequencer completion/abort/lock (15)

**Files changed:**

- `lib/globe/sequencer.ts` — NEW (185 lines)
- `components/GlobeConstellation.tsx` — added `isEngineLocked()` guard in engine tick (+5 lines)
- `components/governada/panel/SenecaMatch.tsx` — removed onGlobeCommand, wired sequencer (+36/-32)
- `components/governada/SenecaThread.tsx` — removed onGlobeCommand prop pass-through (-5 lines)
- `__tests__/globe/focusEngine.test.ts` — NEW (290 lines)
- `__tests__/globe/sequencer.test.ts` — NEW (226 lines)

**Adversarial review findings (all addressed):**

- JSDoc corrected: `done` resolves on both completion and cancel, never rejects
- Restart cleanup uses `lockEngine: false` to prevent frozen globe on first answer
- `cancelled` flag set on normal completion to make cancel() a no-op after done

## Remaining Work — Priority Order

### Priority 2: Generalize the Engine (next plan needed)

Make FocusIntent the universal input for ALL interactions, not just match flow.

**What needs to happen:**

- Extend FocusIntent vocabulary: cinematic state (orbit speed, dolly target, dim level, transition duration), rotation speed control, atmospheric color hints
- Migrate behaviors to produce FocusIntents instead of writing FocusState directly:
  - `topicWarmBehavior` → trivial (deterministic alignment highlight)
  - `clusterBehavior` → trivial (cluster member IDs → intent)
  - `discoveryBehavior` → moderate (showNeighborhood, showActiveEntities use narrowTo)
  - `voteSplitBehavior` → moderate (async vote fetch + color overrides)
  - `spatialMatchBehavior` → already partially integrated (userNode in FocusIntent)
- Generalize match-only effects to work for any interaction:
  - `MatchedEdgeGlow` — amber connections between nearby focused nodes (currently match-only)
  - `GloryRing` — golden torus around highlighted node (currently #1 match only)
  - Atmospheric color shift (warm gold for match, cool blue for discovery, etc.)
- Activation wave direction control (currently radial only, need directional sweeps)

**Key files to modify:**

- `lib/globe/types.ts` — extend FocusIntent interface
- `lib/globe/focusEngine.ts` — handle new intent fields
- `lib/globe/behaviors/` — each behavior becomes an intent producer
- `components/globe/GlobeEffects.tsx` — generalize MatchedEdgeGlow, GloryRing
- `components/globe/GlobeAtmosphere.tsx` — mode-based color shifting
- `hooks/useSenecaGlobeBridge.ts` — simplify as behaviors migrate to intents

**Effort estimate:** Medium-large. Each behavior migration is small individually but there are 5-6 of them plus the intent vocabulary extension.

### Priority 3: Cerebro Polish (future)

The "wow factor" capabilities that make it feel like a living intelligence system:

- Convergence particles (scattered focused nodes → answer node)
- Region highlighting (convex hull glow around clusters)
- Focus layering (compose multiple focus rules: vote split colors + cluster highlight)
- Scene snapshots (serialize focus + camera for bookmarkable URLs)
- Transition curve control (ease-in-out for dramatic, ease-out for snappy)
- Sustained "considering" pulse on nodes Cerebro is evaluating
- Proximity halo around focused nodes

### Seneca Testing (separate workstream)

Seneca's architecture is solid (single implementation, clean layers, proper streaming) but has **zero test coverage on the streaming path**:

- `lib/intelligence/advisor.ts` (820 lines) — untested
- `lib/intelligence/streamAdvisor.ts` (191 lines) — untested
- `lib/intelligence/advisor-tools.ts` (200+ lines) — untested
- SSE parsing, action marker extraction, tool-use loop, globe command emission — all untested

This is a separate workstream from the globe engine work. The founder acknowledged it should be addressed separately.

### GlobeConstellation Decomposition (deferred, from older checkpoint)

The older refactor (`seneca-globe-architecture-refactor.md`) was decomposing GlobeConstellation.tsx from 2,752 lines into sub-components. Phases 1-2 completed (types, helpers, shaders, command bus extracted). Phase 3 partially done (Atmosphere, Camera, Ambient extracted; Edges, Effects, NodePoints not yet wired). This work is complementary to the Cerebro engine but lower priority — it's maintenance/readability, not functionality.

## Architecture Quick Reference

### Globe Control Flow (post-PR #796)

```
REACTIVE PATH (default, ~70% of interactions):
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
  → Producer proceeds (e.g., show overlay)

IMPERATIVE PATH (legacy, being migrated in Priority 2):
  Behavior → globeRef.method() (e.g., highlightMatches, setVoteSplit)
  → Writes FocusState directly via ref
  → Engine guards prevent conflict when engine is active
```

### Key Files

| File                                         | Lines    | Role                                                             |
| -------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `lib/globe/focusEngine.ts`                   | 318      | Pure derivation: intent → state + camera                         |
| `lib/globe/focusIntent.ts`                   | 37       | Window-global intent bridge (write side)                         |
| `lib/globe/focusState.ts`                    | 36       | Window-global state bridge (read side)                           |
| `lib/globe/sequencer.ts`                     | 185      | Promise-based sequencer with engine lock                         |
| `lib/globe/types.ts`                         | 341      | Canonical types (FocusIntent, FocusState, GlobeCommand)          |
| `lib/globe/matchChoreography.ts`             | 193      | Reveal/cleanup step definitions                                  |
| `lib/globe/behaviors/`                       | ~6 files | matchBehavior, voteSplit, topicWarm, cluster, discovery, spatial |
| `components/GlobeConstellation.tsx`          | ~2300    | Main globe component (engine tick, ref methods)                  |
| `components/governada/panel/SenecaMatch.tsx` | ~800     | Match flow UI (intent producer + sequencer consumer)             |
| `hooks/useSenecaGlobeBridge.ts`              | ~120     | Command bridge + behavior registry                               |

### Seneca Architecture (single implementation, no duplication)

```
stores/senecaThreadStore.ts (328 lines) — Zustand store, single source of truth
hooks/useSenecaThread.ts (236 lines) — route-aware hook wrapping store
components/governada/SenecaThread.tsx (641 lines) — orchestrator panel
  ├── panel/SenecaIdle.tsx (358) — briefing + quick actions
  ├── panel/SenecaConversation.tsx (328) — message thread + streaming
  ├── panel/SenecaMatch.tsx (~800) — governance alignment quiz
  ├── panel/SenecaResearch.tsx (399) — deep analysis flow
  ├── panel/SenecaInput.tsx (89) — text input
  ├── panel/SenecaMessages.tsx (232) — message list
  └── panel/SenecaSearchPanel.tsx (250) — anonymous semantic search
lib/intelligence/advisor.ts (820) — backend streaming + tool loop
lib/intelligence/streamAdvisor.ts (191) — client SSE consumption
lib/intelligence/advisor-tools.ts (200+) — tool definitions
lib/intelligence/senecaPersonas.ts (373) — 4 personas with route-based selection
```

### Visual Capabilities Already Built (underused)

These exist but are wired only to the match flow — Priority 2 should generalize them:

- `activationDelays` — staggered node activation (shockwave/sweep)
- `MatchedEdgeGlow` — amber connections between nearby focused nodes
- `GloryRing` — golden torus around highlighted node
- `FlyToParticles` — 30 particles streaking to target
- Atmosphere warm color transition (matchProgress)
- Network pulses — 70 particles flowing along edges
- Micro-drift during cinematic orbit (scanning feel)
- Globe breathing — heartbeat-like scale pulse

### Test Coverage

| Area                           | Coverage    | Notes                                               |
| ------------------------------ | ----------- | --------------------------------------------------- |
| focusEngine pure functions     | ✅ 32 tests | All sentinels, camera derivation, alignment scoring |
| sequencer                      | ✅ 15 tests | Completion, cancel, lock, auto-cancel, fake timers  |
| cluster detection              | ✅ 8 tests  | Pre-existing                                        |
| Seneca streaming               | ❌ None     | advisor.ts, streamAdvisor.ts, tools — all untested  |
| GlobeConstellation integration | ❌ None     | Would need R3F test harness                         |
| Match flow E2E                 | ❌ None     | Would need Playwright                               |
