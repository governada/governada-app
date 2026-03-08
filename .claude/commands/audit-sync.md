Audit the sync pipeline for performance, reliability, and hardening gaps.

## Purpose

Evaluate the health and resilience of the Koios → Supabase sync pipeline. This is the plumbing that makes Civica's data trustworthy. If syncs fail silently or produce stale data, every surface in the product degrades.

## Scope

Argument: `$ARGUMENTS`

- If empty: Full sync audit (all sync types, freshness, error handling, self-healing)
- If a sync type (e.g., "proposals", "dreps", "scoring", "alignment"): Focused audit on that pipeline

## Phase 1: Current State Evidence

### 1.1 Sync Health (Live Data)

Query production data via API or Supabase MCP:

- `v_sync_health` view: last run, last success, error counts per sync type
- `sync_log` recent failures: last 50 entries with `success = false`
- `sync_log` duration trends: avg/p95/max duration per sync type (last 7 days)
- Ghost entries: `sync_log` entries where `finished_at IS NULL AND started_at < NOW() - INTERVAL '30 min'`

### 1.2 Freshness Monitoring

- Read `inngest/functions/sync-freshness-guard.ts` — verify thresholds match actual sync schedules
- Check: are any sync types consistently running close to their staleness threshold?
- Check: self-healing trigger count in last 7 days (from sync_log metrics or PostHog)
- Check: are there sync types in the SyncType enum NOT covered by the freshness guard?

### 1.3 Error Handling Patterns

For each sync function in `inngest/functions/sync-*.ts`:

- Does it have `onFailure` handler? (required for sync_log cleanup)
- Does it use `withRetry()` for transient errors?
- Does it use `validateArray()` for data validation?
- Does it emit PostHog events on failure?
- Does it alert Discord/email on critical failures?
- Is concurrency properly limited? (check `concurrency` config)

### 1.4 Constraint Integrity

- Compare `SyncType` enum in `lib/sync-utils.ts` against `sync_log` CHECK constraint in latest migration
- Flag any mismatch (sync type in code but not in DB constraint = silent failures)

### 1.5 Performance Bottlenecks

- Read each sync function and identify:
  - Steps that might exceed 60s (Cloudflare 524 risk)
  - Batch sizes that might cause PostgREST timeouts
  - Sequential operations that could be parallelized
  - Missing indexes for queries used in sync functions

## Phase 2: Scoring (5 dimensions, 10 pts each = 50 total)

### S1: Reliability (10 pts)

| Score | Anchor                                                                                             |
| ----- | -------------------------------------------------------------------------------------------------- |
| 1-3   | Frequent silent failures, no self-healing, missing onFailure handlers                              |
| 4-6   | Most syncs succeed, basic error handling, some gaps in monitoring                                  |
| 7-8   | All syncs have retry/onFailure/alerting, freshness guard covers all types, <5% failure rate        |
| 9-10  | Zero silent failures, self-healing covers all failure modes, anomaly detection catches degradation |

### S2: Data Validation (10 pts)

| Score | Anchor                                                                           |
| ----- | -------------------------------------------------------------------------------- |
| 1-3   | Raw data inserted without validation                                             |
| 4-6   | Zod validation on some pipelines, batch continues on invalid records             |
| 7-8   | All pipelines validate, invalid records logged/alerted, data provenance tracked  |
| 9-10  | Schema versioning, rollback on high invalid %, cross-pipeline consistency checks |

### S3: Performance (10 pts)

| Score | Anchor                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------- |
| 1-3   | Syncs frequently timeout, no batching, sequential where parallel possible                            |
| 4-6   | Batching in place, most syncs under 60s per step, some bottlenecks                                   |
| 7-8   | All steps <60s, optimal batch sizes, concurrency limits prevent stampede, duration anomaly detection |
| 9-10  | P95 <30s for all steps, adaptive batch sizes, real-time sync status dashboard                        |

### S4: Self-Healing (10 pts)

| Score | Anchor                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | No automatic recovery, manual intervention required                                                                           |
| 4-6   | Freshness guard retriggers stale syncs, basic rate limiting on retries                                                        |
| 7-8   | Graduated response (retry → alert → escalate), covers all sync types, rate-limited to prevent loops                           |
| 9-10  | Root cause classification (transient vs permanent), automatic remediation for known failure modes, incident timeline tracking |

### S5: Observability (10 pts)

| Score | Anchor                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------- |
| 1-3   | Console.log only, no structured monitoring                                                            |
| 4-6   | sync_log table, basic PostHog events, Discord alerts                                                  |
| 7-8   | Structured sync_log with metrics, PostHog anomaly events, Discord + email escalation, admin dashboard |
| 9-10  | Distributed tracing, sync dependency graph visualization, automated incident reports, SLA tracking    |

## Phase 3: Gap Analysis & Work Plan

For each gap found:

1. Classify: correctness (data could be wrong), reliability (sync could fail), performance (sync is slow), observability (failures go unnoticed)
2. Estimate blast radius: how many surfaces/personas are affected?
3. Propose fix with specific file references
4. Follow `docs/strategy/context/work-plan-template.md` for chunk format

## Recommended Cadence

- **Weekly**: Check `v_sync_health` for anomalies (can be automated via Inngest)
- **Monthly**: Run `/audit-sync` focused on the 2-3 highest-error-rate pipelines
- **Quarterly**: Full `/audit-sync` with performance benchmarking
