-- Phase 3A: Performance indexes for hot query paths
-- All IF NOT EXISTS — safe to run idempotently

-- poll_responses: governance/matches lookup, polls/vote upsert check
CREATE INDEX IF NOT EXISTS idx_poll_responses_wallet
  ON poll_responses (wallet_address);

CREATE INDEX IF NOT EXISTS idx_poll_responses_proposal
  ON poll_responses (proposal_tx_hash, proposal_index);

-- drep_score_history: dashboard + score-history (every DRep page view)
CREATE INDEX IF NOT EXISTS idx_drep_score_history_drep
  ON drep_score_history (drep_id);

-- social_link_checks: DRep profile display + slow sync
CREATE INDEX IF NOT EXISTS idx_social_link_checks_drep_uri
  ON social_link_checks (drep_id, uri);

-- drep_pca_coordinates: governance/matches PCA similarity lookups
CREATE INDEX IF NOT EXISTS idx_drep_pca_run
  ON drep_pca_coordinates (run_id);

-- sync_log: sync-freshness-guard Inngest cron checks
CREATE INDEX IF NOT EXISTS idx_sync_log_type_time
  ON sync_log (sync_type, started_at DESC);
