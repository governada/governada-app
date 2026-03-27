# Inhabited Constellation — Build Checkpoint

## Plan File

`C:\Users\dalto\.claude-personal\plans\valiant-brewing-zephyr.md`

## Current State

**Phase 2: Panel Overlay System — COMPLETE. Start Phase 3.**

### Phases Complete

- **Phase 0** (PR #630): Seneca unification — single thread, single state, dead code removal
- **Phase 1** (PR #632): `/g/` route namespace with globe URL state, SSR for SEO, full-viewport globe
- **Phase 2** (PR #633): Glassmorphic entity detail panels floating over the globe

### What's Live in Production

- `https://governada.io/g` — Full-viewport 3D constellation globe with Seneca AI companion
- `https://governada.io/g/drep/[id]` — Globe focuses on DRep, detail panel slides in from right
- `https://governada.io/g/proposal/[txHash]/[index]` — Proposal panel with vote bars, treasury impact
- `https://governada.io/g/pool/[poolId]` — Pool panel with governance score, strengths
- `https://governada.io/g/cc/[ccHotId]` — CC member panel with fidelity grade, vote record
- Globe node click → navigates to `/g/[entity]` → panel opens + camera flies to node
- Panel close (X button, Escape key) → navigates to `/g` + camera resets
- Related entity links in panels navigate within `/g/` (globe-to-globe)

### Key Files (Phase 1-2)

| File                                       | Purpose                                                               |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `app/g/layout.tsx`                         | Server layout — metadata, Suspense wrapper around GlobeLayout         |
| `app/g/page.tsx`                           | Globe home — SSR governance stats for SEO                             |
| `app/g/drep/[drepId]/page.tsx`             | DRep SSR content (sr-only for crawlers)                               |
| `app/g/proposal/[txHash]/[index]/page.tsx` | Proposal SSR content                                                  |
| `app/g/pool/[poolId]/page.tsx`             | Pool SSR content                                                      |
| `app/g/cc/[ccHotId]/page.tsx`              | CC member SSR content                                                 |
| `components/globe/GlobeLayout.tsx`         | Client shell — full-viewport globe + PanelOverlay + Seneca            |
| `components/globe/PanelOverlay.tsx`        | Panel container — glassmorphic, desktop right + mobile bottom sheet   |
| `components/globe/DRepGlobePanel.tsx`      | DRep detail panel (score, tier, pillars, recent votes)                |
| `components/globe/ProposalGlobePanel.tsx`  | Proposal detail panel (verdict, vote bars, treasury)                  |
| `components/globe/PoolGlobePanel.tsx`      | Pool detail panel (score, strengths, stake)                           |
| `components/globe/CCMemberGlobePanel.tsx`  | CC member detail panel (fidelity, vote record)                        |
| `components/globe/panelShared.tsx`         | Shared PillarBar + VoteBar components                                 |
| `components/globe/panelUtils.ts`           | Route-to-entity derivation helper                                     |
| `lib/globe/urlState.ts`                    | URL state encode/decode (focus, zoom, filter, sector, view, temporal) |

### Architecture

```
GlobeLayout (client component, z-layered)
  ├── ConstellationScene (full viewport, z-0) — 3D globe via React Three Fiber
  ├── GlobeControls placeholder (z-20) — Phase 3 will add filter chips here
  ├── PanelOverlay (z-30) — route-derived entity panels
  │   └── [DRepGlobePanel | ProposalGlobePanel | PoolGlobePanel | CCMemberGlobePanel]
  ├── SenecaOrb (z-40) — AI companion trigger
  └── SenecaThread (z-40) — AI conversation panel
```

### Key Design Decisions Made

1. Panels reuse same TanStack Query hooks as existing peek components (useDReps, useProposals, useCommitteeMembers)
2. Panel close → `router.push('/g')` + `globeRef.current.resetCamera()`
3. Glassmorphic style: `bg-black/75 backdrop-blur-2xl border border-white/[0.08]`
4. CSS keyframe animations (not tailwindcss-animate): `animate-panel-slide-right`, `animate-panel-slide-up`
5. Desktop panel: 400px wide, `top-16 right-4 bottom-4`, rounded-2xl
6. Mobile panel: `max-h-[70vh]`, bottom sheet with drag handle
7. `prefers-reduced-motion` disables all panel animations

## Next Phase: Phase 3 — List Overlay + Filtering

### New Components to Build

- `components/globe/ListOverlay.tsx` — Translucent list panel (left side, 380px desktop, full-width mobile). Shows entity cards. Hover highlights globe node. Click opens detail panel.
- `components/globe/ListItem.tsx` — Compact entity card for list (reuse GovernadaDRepCard/ProposalCard patterns in condensed form).
- `components/globe/FilterBar.tsx` — Filter chips + sort dropdown above the list. Supports: entity type, tier, status, alignment sector, sort (score, activity, match).
- `components/globe/GlobeControls.tsx` — Floating control bar at top of globe. Toggle list, toggle filter, sector focus buttons, zoom controls.

### List ↔ Globe Sync Requirements

- Hovering a list item highlights its node (low-latency, no camera move)
- Clicking a list item flies to node + opens detail panel (navigates to `/g/[entity]`)
- Filtering the list filters globe nodes (dim non-matching nodes)
- Scrolling the list does NOT move the globe (independent scroll)

### Seneca Integration (for Phase 3)

- "Show all proposals" → opens list with proposal filter
- "Show Tier 1 DReps" → opens list with DRep filter + Tier 1
- "Show treasury proposals" → opens list + filters to treasury type

### Reference Components for List Items

- `components/governada/cards/GovernadaDRepCard.tsx` — DRep card pattern
- `components/governada/discover/ProposalCard.tsx` — Proposal card pattern
- `components/governada/cards/GovernadaSPOCard.tsx` — SPO card pattern
- `components/governada/peeks/CCMemberPeek.tsx` — CC member data pattern

### Remaining Phases After Phase 3

- **Phase 4**: Seneca Intent Routing — AI queries translate to globe state changes
- **Phase 5**: Mobile Adaptation — 2D fallback for low-end devices, touch optimization
- **Phase 6**: Migration + Cleanup — redirect old `/governance/*` routes to `/g/`, delete dead code

## Worktree

- Branch: `claude/lucid-maxwell`
- Path: `C:\Users\dalto\governada\governada-app\.claude\worktrees\lucid-maxwell`
- Branch is up to date with main after PR #633 merge
