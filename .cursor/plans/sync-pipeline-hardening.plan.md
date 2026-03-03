# Sync Pipeline Hardening Plan

Production robustness fixes identified from the data integrity audit.

## Phase 1: Critical Fixes (P0)

### 1.1 — sync_log CHECK constraint
Migration `039_sync_pipeline_hardening.sql`: Add `spo_scores` and `governance_epoch_stats` to the sync_log CHECK constraint. Without this, SyncLogger.start() silently fails for these types.

### 1.2 — Integrity alert self-healing: HTTP → Inngest events
In `app/api/admin/integrity/alert/route.ts`, replace HTTP-based self-healing (fetch to sync routes) with Inngest event sends. HTTP self-healing is fragile — the routes may not exist, and the integrity route itself can timeout waiting for sync to complete.

## Phase 2: Monitoring Expansion (P1)

### 2.1 — FRESHNESS_THRESHOLDS expansion
In `inngest/functions/sync-freshness-guard.ts`, add missing sync types: `spo_votes`, `cc_votes`, `epoch_recaps`, `spo_scores`, `governance_epoch_stats`. Currently these syncs are invisible to self-healing.

### 2.2 — ACTIVE_SYNC_TYPES expansion
In `app/api/admin/integrity/alert/route.ts`, expand `ACTIVE_SYNC_TYPES` and `SYNC_CONFIG` to include `scoring`, `alignment`, `treasury`, `ghi`, `benchmarks`, `spo_votes`, `cc_votes`, `epoch_recaps`, `spo_scores`, `governance_epoch_stats`. 60% of sync types are currently unmonitored.

### 2.3 — batchUpsert exponential backoff
In `lib/sync-utils.ts`, upgrade from 1 retry with fixed 2s delay to 3 retries with exponential backoff (2s → 4s → 8s). Single retry is insufficient under sustained DB pressure.

## Phase 3: Consistency & Safety (P2)

### 3.1 — Route all Koios calls through koiosFetch
In `utils/koios.ts`, refactor `fetchDelegatedDRep`, `fetchDRepDelegatorCount`, and `fetchAccountInfo` to use `koiosFetch` instead of raw `fetch`. They currently bypass retry and circuit-breaker logic.

### 3.2 — Self-heal backoff
In `inngest/functions/sync-freshness-guard.ts`, add throttle: don't re-trigger the same sync type more than 3x in 2 hours. Prevents hammering persistently failing syncs.

### 3.3 — Health endpoint snapshot alignment
In `app/api/health/route.ts`, expand snapshot checks to match the 13 checks in `check-snapshot-completeness.ts`. Currently only checks 3 tables.

### 3.4 — Snapshot completeness: new tables
In `inngest/functions/check-snapshot-completeness.ts`, add checks for `spo_score_snapshots`, `spo_alignment_snapshots`, and `governance_epoch_stats`.

## Phase 4: Advanced Anomaly Detection (P3)

### 4.1 — Multi-run anomaly detection
In `lib/sync-utils.ts` SyncLogger, enhance `checkRecordCountAnomaly` to detect 3 consecutive drops (not just single-run comparison). Gradual degradation currently goes undetected.

## Validation
- `npx tsc --noEmit` must pass
- No new lint errors
