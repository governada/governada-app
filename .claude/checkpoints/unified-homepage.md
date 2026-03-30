# Unified Homepage Refactor — Checkpoint

**Last updated**: 2026-03-29
**Master plan**: `.claude/checkpoints/unified-homepage-plan.md`

## Current State

### PRs

| PR   | Status         | Branch                     | Description                                                                         |
| ---- | -------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| #740 | **MERGED**     | `feat/three-worlds-nav`    | Nav simplification: remove Governance + Match from nav                              |
| #744 | **MERGED**     | `feat/route-consolidation` | Route consolidation: /g and /match redirects, GovernadaShell cleanup                |
| #753 | **CI pending** | `feat/homepage-unified`    | Homepage unified: URL params, EntityDetailSheet, DiscoveryOverlay (stacked on #744) |
| #754 | **CI pending** | `feat/homepage-cleanup`    | Fix redirect loops: restore standalone entity pages, remove /g links                |

### Merge Order

1. PR 1 (#740) — DONE
2. PR 2 (#744) — DONE
3. PR 4 (#754) — merge next (fixes redirect loops from PR 2)
4. PR 3 (#753) — merge last (stacked on PR 2, rebase after #754)

### What Remains (Post-Merge)

- Remove deprecated globe components: GlobeLayout, FilterBar, ListOverlay, ListItem, PanelOverlay, GlobeControls, ImmersiveMatchPage
- Add keyboard shortcuts: F (filter cycle), L (discovery toggle)
- Update panelUtils.ts for new URL structure
- Grep for remaining /g/ or /governance/ link references
- Visual verification via Claude Chrome

## Instructions for Continuing Agent

1. Read this checkpoint FIRST, then the master plan at `.claude/checkpoints/unified-homepage-plan.md`.
2. Merge PR 4 (#754) first, then rebase PR 3 (#753) on main and merge.
3. After both merge, a cleanup PR removes deprecated components + adds keyboard shortcuts.
