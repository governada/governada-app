# Inhabited Constellation — Build Checkpoint

## Plan File

`C:\Users\dalto\.claude-personal\plans\valiant-brewing-zephyr.md`

## Status

- **Phase 0**: Complete — PR #630 (Seneca unification, dead code removal)
- **Phase 1**: Complete — PR #632 (/g/ route namespace, globe URL state)
- **Phase 2**: Complete — PR #633 (panel overlay system)
- **Phase 3**: Complete — PR #634 (list overlay + filtering + globe controls)
- **Phase 4**: NOT STARTED — Seneca Intent Routing
- **Phase 5**: NOT STARTED — Mobile Adaptation
- **Phase 6**: NOT STARTED — Migration + Cleanup

## Current Branch

`claude/loving-cannon` — rebased on main, all Phase 3 work merged.

## Phase 3 Deliverables (just shipped)

- `components/globe/ListOverlay.tsx` — left panel (380px desktop, bottom sheet mobile)
- `components/globe/ListItem.tsx` — compact entity cards for 4 types
- `components/globe/FilterBar.tsx` — entity type chips + sort cycling
- `components/globe/GlobeControls.tsx` — floating pill with L/F/Reset
- `highlightNode(nodeId)` added to `ConstellationRef` in both GovernanceConstellation.tsx and GlobeConstellation.tsx
- `animate-panel-slide-left` added to globals.css
- `GlobeLayout.tsx` rewritten with list state, filter URL sync, keyboard shortcuts

## Phase 4 Requirements (Next)

**Goal:** Seneca queries translate to globe state changes. The AI becomes the navigator.

### Intent Categories

```
BROWSE:    "show me proposals" → open list overlay, filter to proposals
FOCUS:     "show me drep_X" → flyTo node, open detail panel
COMPARE:   "compare X and Y" → highlight both, open comparison panel
FILTER:    "show tier 1 dreps who vote on treasury" → filter list + globe
MATCH:     "find my match" → start match flow with globe animation
RESEARCH:  "analyze this proposal's impact" → deep research mode
VOTESPLIT: "how did people vote on proposal X" → voteSplit visualization
TEMPORAL:  "show me epoch 620" → temporal replay
```

### Key Files to Modify

- `lib/intelligence/advisor.ts` — Add intent detection layer before AI call
- `hooks/useSenecaThread.ts` — Add `executeIntent(intent)` method
- `stores/senecaThreadStore.ts` — Add `pendingGlobeAction` field
- `components/globe/GlobeLayout.tsx` — Listen for Seneca intents, dispatch to globe + list/panel

### Architecture Notes

- GlobeLayout already has `globeRef` with `flyToNode`, `highlightNode`, `resetCamera`, `highlightMatches`, `setVoteSplit`, `setTemporalState`
- ListOverlay is driven by `filter` state + `listOpen` boolean in GlobeLayout
- URL state encodes filter/sector/view via `lib/globe/urlState.ts`
- Seneca thread state is in `stores/senecaThreadStore.ts` (Zustand)
- The bridge between Seneca and globe is partially wired via `useSenecaGlobeBridge` hook

### Pattern: How List/Filter Currently Works

1. User clicks filter chip → `handleFilterChange(filter)` in GlobeLayout
2. Updates `filter` state + URL searchParams
3. ListOverlay reads `filter` prop and shows matching entities
4. Globe doesn't yet dim non-matching nodes (Phase 4 could wire this via `highlightNode` or a new `setFilteredTypes` method)

## Decisions Made This Session

- Used `z-[25]` for ListOverlay (between globe controls z-20 and panel overlay z-30)
- ListItem is a `<button>` element (not Link) — clicks call `router.push` for better hover/highlight control
- FilterBar sort cycles on click (score → activity → recent) rather than dropdown
- Data hooks cast `as` for untyped fetchJson responses (matching panel pattern)
- No virtual scrolling yet — full list renders all entities (can optimize later if perf issues)
