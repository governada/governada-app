-- Snapshot Hardening: expand drep_score_history, create completeness log,
-- and extend sync_log CHECK for new snapshot sync types.

-- 1. Add epoch, momentum, and raw pillar scores to drep_score_history
ALTER TABLE drep_score_history
  ADD COLUMN IF NOT EXISTS epoch_no integer,
  ADD COLUMN IF NOT EXISTS score_momentum numeric(6,3),
  ADD COLUMN IF NOT EXISTS engagement_quality_raw integer,
  ADD COLUMN IF NOT EXISTS effective_participation_v3_raw integer,
  ADD COLUMN IF NOT EXISTS reliability_v3_raw integer,
  ADD COLUMN IF NOT EXISTS governance_identity_raw integer;

CREATE INDEX IF NOT EXISTS idx_score_history_epoch
  ON drep_score_history(epoch_no) WHERE epoch_no IS NOT NULL;

-- 2. Snapshot completeness log — one row per snapshot run per type
-- epoch_no defaults to 0 for non-epoch snapshots (benchmarks) so the unique
-- constraint always matches correctly (NULLs break Postgres upsert).
CREATE TABLE IF NOT EXISTS snapshot_completeness_log (
  id serial PRIMARY KEY,
  snapshot_type text NOT NULL,
  epoch_no integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  record_count integer NOT NULL,
  expected_count integer,
  coverage_pct numeric(5,2),
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (snapshot_type, epoch_no, snapshot_date)
);

-- 3. Extend sync_log CHECK to include alignment, ghi, benchmarks
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks'
  ));
