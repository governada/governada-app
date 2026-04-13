# Maturity Hardening Operating Rules

> **Purpose:** Keep post-review hardening inside the existing architecture-review program instead of starting ad hoc cleanup streams.
> **Status:** Active as of 2026-04-12
> **Canonical backlog:** `docs/strategy/context/architecture-review/execution-backlog.md`

## Default Posture

- Continue feature delivery, but route all structural hardening through the architecture-review backlog and decisions in this folder.
- Prefer small extraction PRs over broad rewrites.
- Optimize for change locality: local changes should stay local, and cross-domain changes should name the seam they extend.

## Frozen Hotspots

These files are **extraction-only** until the next review pass explicitly removes them from the list.

- `lib/data.ts`
- `lib/intelligence/context.ts`

Route-owned or workflow-heavy client files at `800+` lines should be treated the same way when touched: extract controller, service, or presenter seams first; do not add new business logic directly into the hotspot.

Allowed hotspot edits:

- extracting stable logic into new domain modules
- re-exporting or composing extracted seams
- deleting dead code
- small compatibility glue needed to finish an extraction

Disallowed hotspot edits:

- adding new cross-domain business logic
- making the hotspot the default home for a new shared read path
- growing a large client orchestrator instead of splitting it

## Paved Road

- Shared reads belong in domain-owned modules, not generic catch-all files.
- Route handlers stay thin: validate, call one service, shape the response.
- Inngest functions stay thin: orchestrate only; read, compute, and persistence logic belongs below them.
- Cross-domain changes must carry an explicit PR ownership note naming the seam extended and why it is the right seam.
- Documentation drift is part of the contract. `npm run agent:validate` and `npm run docs:doctor` must stay green.

## Current Baseline

- `lib/data.ts` line count: 1643
- `app/` file count: 531
- `components/` file count: 884
- `lib/` file count: 389
- `99` page routes
- `321` route handlers
- `89` files at `500+` lines
- `26` files at `800+` lines
- `10` files at `1000+` lines

## Near-Term Targets

- Keep `docs:doctor` and `registry:index:check` green.
- Reduce `lib/data.ts` imports over time rather than adding new ones.
- Reduce `800+` and `1000+` line hotspots through extraction, not file churn.
- Keep new feature work on existing domain seams whenever possible.
