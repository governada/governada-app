-- 019: Data Infrastructure
-- Sync logging, analytical views (semantic layer), hash tracking improvements, DRep anchor fields

-- 1. Sync log table for operational monitoring
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('fast', 'full', 'integrity_check')),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_log_type_time ON sync_log(sync_type, started_at DESC);

-- 2. Hash check tracking on vote_rationales
ALTER TABLE vote_rationales
  ADD COLUMN IF NOT EXISTS hash_check_attempted_at TIMESTAMPTZ;

-- 3. DRep anchor fields for metadata hash verification
ALTER TABLE dreps
  ADD COLUMN IF NOT EXISTS anchor_url TEXT,
  ADD COLUMN IF NOT EXISTS anchor_hash TEXT;

-- 4. Analytical views (semantic layer)

CREATE OR REPLACE VIEW v_vote_power_coverage AS
SELECT
  count(*) as total_votes,
  count(voting_power_lovelace) as with_power,
  count(*) FILTER (WHERE voting_power_lovelace IS NULL) as null_power,
  count(*) FILTER (WHERE power_source = 'exact') as exact_count,
  count(*) FILTER (WHERE power_source = 'nearest') as nearest_count,
  CASE WHEN count(*) > 0
    THEN round(count(voting_power_lovelace)::numeric / count(*) * 100, 2)
    ELSE 0 END as coverage_pct
FROM drep_votes;

CREATE OR REPLACE VIEW v_ai_summary_coverage AS
SELECT
  (SELECT count(*) FROM proposals) as total_proposals,
  (SELECT count(*) FROM proposals WHERE ai_summary IS NOT NULL) as proposals_with_summary,
  (SELECT count(*) FROM proposals WHERE abstract IS NOT NULL AND abstract != '') as proposals_with_abstract,
  (SELECT count(*) FROM vote_rationales) as total_rationales,
  (SELECT count(*) FROM vote_rationales WHERE rationale_text IS NOT NULL AND rationale_text != '') as rationales_with_text,
  (SELECT count(*) FROM vote_rationales WHERE ai_summary IS NOT NULL) as rationales_with_summary;

CREATE OR REPLACE VIEW v_hash_verification AS
SELECT
  count(*) FILTER (WHERE hash_verified = true) as rationale_verified,
  count(*) FILTER (WHERE hash_verified = false) as rationale_mismatch,
  count(*) FILTER (WHERE hash_verified IS NULL) as rationale_pending,
  count(*) FILTER (WHERE hash_verified IS NULL AND hash_check_attempted_at IS NOT NULL) as rationale_unreachable,
  CASE WHEN count(*) FILTER (WHERE hash_verified IS NOT NULL) > 0
    THEN round(count(*) FILTER (WHERE hash_verified = false)::numeric
      / count(*) FILTER (WHERE hash_verified IS NOT NULL) * 100, 2)
    ELSE 0 END as mismatch_rate_pct
FROM vote_rationales;

CREATE OR REPLACE VIEW v_metadata_verification AS
SELECT
  count(*) FILTER (WHERE metadata_hash_verified = true) as drep_verified,
  count(*) FILTER (WHERE metadata_hash_verified = false) as drep_mismatch,
  count(*) FILTER (WHERE metadata_hash_verified IS NULL) as drep_pending,
  count(*) FILTER (WHERE anchor_hash IS NOT NULL) as drep_with_anchor_hash
FROM dreps;

CREATE OR REPLACE VIEW v_canonical_summary_coverage AS
SELECT
  (SELECT count(*) FROM proposals) as total_proposals,
  (SELECT count(*) FROM proposals WHERE proposal_id IS NOT NULL) as with_proposal_id,
  (SELECT count(*) FROM proposal_voting_summary) as with_canonical_summary;

CREATE OR REPLACE VIEW v_sync_health AS
SELECT
  s1.sync_type,
  max(s1.started_at) as last_run,
  max(s1.finished_at) as last_finished,
  (SELECT duration_ms FROM sync_log s2
    WHERE s2.sync_type = s1.sync_type ORDER BY s2.started_at DESC LIMIT 1) as last_duration_ms,
  (SELECT success FROM sync_log s2
    WHERE s2.sync_type = s1.sync_type ORDER BY s2.started_at DESC LIMIT 1) as last_success,
  (SELECT error_message FROM sync_log s2
    WHERE s2.sync_type = s1.sync_type ORDER BY s2.started_at DESC LIMIT 1) as last_error,
  count(*) FILTER (WHERE s1.success = true) as success_count,
  count(*) FILTER (WHERE s1.success = false) as failure_count
FROM sync_log s1
GROUP BY s1.sync_type;

CREATE OR REPLACE VIEW v_system_stats AS
SELECT
  (SELECT count(*) FROM dreps) as total_dreps,
  (SELECT count(*) FROM drep_votes) as total_votes,
  (SELECT count(*) FROM proposals) as total_proposals,
  (SELECT count(*) FROM vote_rationales) as total_rationales,
  (SELECT count(*) FROM drep_power_snapshots) as total_power_snapshots,
  (SELECT count(DISTINCT drep_id) FROM drep_power_snapshots) as dreps_with_snapshots,
  (SELECT max(block_time) FROM drep_votes) as newest_vote_time,
  (SELECT max(fetched_at) FROM proposal_voting_summary) as newest_summary_fetch;
