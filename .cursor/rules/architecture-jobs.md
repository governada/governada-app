---
description: Inngest functions, sync architecture, and background job patterns
globs: ['inngest/**', 'lib/sync/**', 'app/api/sync/**', 'app/api/inngest/**']
alwaysApply: false
---
<!-- LINE BUDGET: 100 lines -->

# Background Jobs & Sync Architecture

## Sync Architecture

All syncs are per-type Inngest durable functions (no monolithic `/api/sync` route):

- **sync-proposals**: Every 30 min (new/updated proposals)
- **sync-dreps**: Every 6h (all DReps, scores, alignment, history)
- **sync-votes**: Every 6h (bulk vote upsert + reconciliation)
- **sync-secondary**: Every 6h (delegator counts, power snapshots, integrity)
- **sync-slow**: Daily 04:00 UTC (rationales, AI summaries, hash verification, push notifications)
- **sync-freshness-guard**: Every 30 min (detects stale sync_log entries, re-triggers)
- **sync-treasury-snapshot**: Daily 22:30 UTC (Koios /totals → treasury_snapshots)
- **Integrity alerts** (`alert-integrity`): Every 6h, Discord webhooks

## Background Jobs (Inngest Cloud)

All scheduled work runs via Inngest durable functions (no platform-specific crons).
When adding or removing functions, update this list AND the count in the Tech Stack section of `architecture.md`.

**Data syncs** — call `execute*Sync()` from `lib/sync/` directly inside `step.run()`:

- `sync-dreps` — every 6h + `drepscore/sync.dreps` event (all DReps, scores, alignment, history)
- `sync-votes` — every 6h + `drepscore/sync.votes` event (bulk vote upsert + reconciliation)
- `sync-secondary` — every 6h + `drepscore/sync.secondary` event (delegator counts, power snapshots, integrity)
- `sync-slow` — daily 04:00 UTC + `drepscore/sync.slow` event (rationales, AI summaries, hash verification, push notifications)
- `sync-proposals` — every 30 min + `drepscore/sync.proposals` event (new/updated proposals)
- `sync-freshness-guard` — every 30 min (detects stale sync_log entries, re-triggers via `inngest.send()`)
- `sync-treasury-snapshot` — daily 22:30 UTC (Koios /totals → treasury_snapshots)
- `sync-governance-benchmarks` — weekly Sunday 06:00 UTC (Tally/SubSquare → governance_benchmarks, feature-flagged via `cross_chain_sync`)
- `sync-alignment` — `drepscore/sync.alignment` event (PCA alignment computation → pca_results, drep_pca_coordinates)
- `sync-drep-scores` — `drepscore/sync.scores` event, chained after sync-dreps (V3 pillar computation → dreps columns + drep_score_history)

**Alerts & health:**

- `alert-integrity` — every 6h (data quality + Discord alerts)
- `alert-inbox` — daily 03:00, 09:00, 15:00, 21:00 UTC (new proposal inbox alerts)
- `alert-api-health` — every 15 min (API health checks)

**Notifications & generation:**

- `check-notifications` — every 6h at :15 (DRep-specific: score changes, delegation, rank, milestones, deadlines, treasury)
- `check-accountability-polls` — daily 23:00 UTC (open/close/schedule treasury accountability polls)
- `generate-epoch-summary` — daily 22:00 UTC (detects epoch transitions, writes governance_events)
- `snapshot-ghi` — daily 04:30 UTC (computes GHI + stores epoch snapshot)
- `generate-governance-brief` — weekly Monday 10:00 UTC (personalized governance briefs for active users)
- `generate-state-of-governance` — weekly Sunday 20:00 UTC (canonical State of Governance report)

## Inngest Step Return Type Rule

All code paths in a `step.run()` callback must return the same object shape. Inngest serializes step results to JSON; TypeScript infers a union from divergent return paths. Later steps accessing properties that only exist on one branch will fail type-check. Always include all properties in early returns with empty defaults.

## Database Key Tables

33+ migrations. Key tables queryable via Supabase MCP `list_tables`. Most important for sync work: `dreps`, `drep_votes`, `proposals`, `sync_log`, `drep_score_history`, `proposal_voting_summary`.
