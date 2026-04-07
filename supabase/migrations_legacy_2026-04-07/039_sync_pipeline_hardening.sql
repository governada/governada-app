-- ============================================================================
-- 039: Sync Pipeline Hardening
-- Adds spo_scores and governance_epoch_stats to sync_log CHECK constraint.
-- These types are already used in code but rejected by the DB constraint.
-- ============================================================================

ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks',
    'spo_votes', 'cc_votes', 'alignment_cache', 'similarity_cache', 'epoch_recaps',
    'snapshot_backfill', 'spo_scores', 'governance_epoch_stats'
  ));
