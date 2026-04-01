# Cerebro Globe Engine — Checkpoint

**Last session**: 2026-04-01
**Worktree**: `hungry-cerf` (`claude/hungry-cerf` branch)
**PRs shipped**: #787, #796, #797, #798, #801, #802
**PR pending**: #805 (MATCH_VISUALS constant extraction — CI running, merge when green)

## Status: Priority 1-3 Complete

The Cerebro Globe Engine is architecturally complete. All three priorities are shipped:

- **Priority 1** (#787, #796): Reactive FocusEngine + promise-based sequencer
- **Priority 2** (#797, #798, #801): Generalized to ALL globe interactions (5 behaviors, 5 bridge commands migrated to intents, 182 tests)
- **Priority 3** (#802): Visual effects generalized from match-only to universal FocusState-driven parameters

### What Priority 3 Changed (PR #802)

8 match-specific hardcoding sites replaced with FocusState fields:

| New Field               | Type                           | Default                 | Purpose                                              |
| ----------------------- | ------------------------------ | ----------------------- | ---------------------------------------------------- |
| `focusColor`            | string                         | `MATCH_COLOR` (#f59e0b) | Hex color focused nodes blend toward                 |
| `focusSizeBoost`        | number                         | 1.0                     | Size multiplier for focused nodes                    |
| `unfocusedScale`        | number                         | 0.45                    | Base scale for unfocused nodes                       |
| `emissiveRange`         | `{base, intensityFactor, max}` | `{1, 1.2, Infinity}`    | Emissive formula params                              |
| `atmosphereWarmColor`   | string                         | '#cc8844'               | Atmosphere color for focus mode                      |
| `atmosphereTemperature` | number                         | 0                       | 0=cool teal, 1=fully warm                            |
| `bloomIntensity`        | number\|null                   | null                    | Explicit bloom override or null for overlay fallback |
| `driftEnabled`          | boolean                        | false                   | Camera micro-drift                                   |

All behaviors now set atmosphere hints (warm/cool colors per mode). MatchedEdgeGlow and NetworkPulses ungated during match. SenecaMatch uses `MATCH_VISUALS` constant (PR #805).

### Known Issues (from adversarial review)

1. **atmosphereTemperature: 0 vs "not set" ambiguity** — Engine coalesces `undefined` to `0`, losing distinction between "not set" and "explicitly cold." Low probability — no behavior sends `{scanProgress: 0.8, atmosphereTemperature: 0}` today. Fix if a future behavior needs explicit cold during active focus.
2. **FlyToParticles/GloryRing still hardcode MATCH_COLOR** — Not read from FocusState. Intentional for now (reveal particles are always gold). Could generalize if needed.
3. **voteSplitMap not in sceneState** (from PR #797) — voteSplit behavior writes colorOverrides via intent but no longer populates `sceneState.voteSplitMap`. Temporal scrubber UI may not show vote data.
4. **Filtered-type nodes hardcoded to 0.15 scale** — `isFilteredType` branch ignores `unfocusedScale`. Intentional (wrong-type nodes always disappear hard).

## Architecture (Final State)

```
REACTIVE PATH (~95% of interactions):
  Producer → setSharedIntent(intent)  [includes visual params]
  → Engine tick (50ms, GlobeConstellation.tsx)
  → deriveFromIntent() → FocusState + CameraDerived  [pass-through visual fields]
  → NodePoints reads FocusState (per-frame via window global)
  → GlobeAtmosphere reads atmosphereTemperature + warmColor
  → CinematicCamera reads driftEnabled
  → Bloom reads bloomIntensity
  → MatchedEdgeGlow reads focusColor

SEQUENCER PATH (theatrical, ~4 sequences):
  Producer → runSequence(steps, dispatch)
  → Engine lock acquired → Steps dispatched → Lock released
  → Producer proceeds (e.g., show overlay)

IMPERATIVE PATH (legacy, camera/animation only):
  flyTo, pulse, flash, cinematic → globeRef methods
  → Camera motion only, no FocusState writes
```

### Key Files

| File                                         | Role                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `lib/globe/types.ts`                         | FocusIntent, FocusState, EmissiveRange, MATCH_COLOR, DEFAULT_FOCUS                  |
| `lib/globe/focusEngine.ts`                   | Pure derivation: intent → state + camera (8 visual param pass-through)              |
| `lib/globe/focusIntent.ts`                   | Window-global intent bridge (write side)                                            |
| `lib/globe/focusState.ts`                    | Window-global state bridge (read side)                                              |
| `lib/globe/sequencer.ts`                     | Promise-based sequencer with engine lock                                            |
| `lib/globe/matchChoreography.ts`             | Reveal/cleanup step definitions                                                     |
| `lib/globe/behaviors/`                       | 7 behaviors: match, voteSplit, topicWarm, cluster, discovery, spatial, focusControl |
| `components/GlobeConstellation.tsx`          | Main globe component (~2300 lines, engine tick, ref methods)                        |
| `components/globe/NodePoints.tsx`            | GPU-instanced renderer (reads all FocusState visual params)                         |
| `components/globe/GlobeEffects.tsx`          | MatchedEdgeGlow (reads focusColor), NetworkPulses, FlyToParticles, GloryRing        |
| `components/globe/GlobeAtmosphere.tsx`       | Atmosphere color lerp (atmosphereProgress prop)                                     |
| `components/globe/GlobeCamera.tsx`           | CinematicCamera (driftEnabled prop), TiltedGlobeGroup, IdleCameraWobble             |
| `components/governada/panel/SenecaMatch.tsx` | Match flow UI (MATCH_VISUALS constant, intent producer)                             |
| `hooks/useSenecaGlobeBridge.ts`              | Command bridge + behavior registry                                                  |

### Behavior Atmosphere Colors

| Behavior                 | warmColor | temperature              | Mood                 |
| ------------------------ | --------- | ------------------------ | -------------------- |
| SenecaMatch (start)      | #cc8844   | 0.3                      | Warm amber entry     |
| SenecaMatch (per-answer) | #cc8844   | scanProgress (0.15-0.95) | Intensifying warmth  |
| topicWarm                | #886644   | 0.3                      | Subtle brown warmth  |
| cluster                  | #4488cc   | 0.4                      | Cool blue analytical |
| discovery/neighborhood   | #44bbcc   | 0.3                      | Teal exploration     |
| discovery/activeEntities | #ccaa44   | 0.5                      | Warm amber activity  |
| voteSplit                | #cc6644   | 0.4                      | Orange deliberation  |
| focusControl/highlight   | #cc8844   | 0.3                      | Mild warmth          |

### Test Coverage

| Area                       | Tests   | Notes                                                          |
| -------------------------- | ------- | -------------------------------------------------------------- |
| focusEngine pure functions | 49      | All sentinels, camera, alignment, 12 visual param pass-through |
| behaviors                  | 35      | All 6 intent-producing behaviors, 12 atmosphere assertions     |
| sequencer                  | 15      | Completion, cancel, lock, auto-cancel                          |
| cluster detection          | 8       | Pre-existing                                                   |
| **Total globe tests**      | **107** |                                                                |

## Remaining Work

### Priority 4: Advanced Visual Effects (Future)

"Wow factor" capabilities now enabled by the generalized architecture:

- **Convergence particles** — scattered focused nodes → answer node (extend FlyToParticles)
- **Region highlighting** — convex hull glow around clusters
- **Focus layering** — compose multiple focus rules simultaneously (vote split colors + cluster highlight)
- **Scene snapshots** — serialize focus + camera for bookmarkable URLs
- **Transition curve control** — ease-in-out for dramatic, ease-out for snappy
- **Sustained "considering" pulse** — on nodes Cerebro is evaluating
- **Proximity halo** — around focused nodes
- **Activation wave direction control** — currently radial only, need directional sweeps

### GlobeConstellation Decomposition (Deferred)

GlobeConstellation.tsx is ~2300 lines. Phases 1-2 of decomposition completed (types, helpers, shaders, command bus extracted). Phase 3 partially done (Atmosphere, Camera, Ambient extracted; Edges, Effects, NodePoints not yet wired to be standalone). Lower priority — maintenance/readability, not functionality.

### Seneca Testing (Separate Workstream)

Seneca streaming has zero test coverage:

- `lib/intelligence/advisor.ts` (820 lines)
- `lib/intelligence/streamAdvisor.ts` (191 lines)
- `lib/intelligence/advisor-tools.ts` (200+ lines)

PR #798 added 149 unit tests for intent detection, stream parsing, globe commands, prompt builder, and tool executors — but not the full streaming path.
