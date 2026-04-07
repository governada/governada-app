-- 020: Integrity Snapshots
-- Daily metric snapshots for KPI trend comparison on the data integrity dashboard.

CREATE TABLE IF NOT EXISTS integrity_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  vote_power_coverage_pct NUMERIC(5,2),
  canonical_summary_pct NUMERIC(5,2),
  ai_proposal_pct NUMERIC(5,2),
  ai_rationale_pct NUMERIC(5,2),
  hash_mismatch_rate_pct NUMERIC(5,2),
  total_dreps INTEGER,
  total_votes INTEGER,
  total_proposals INTEGER,
  total_rationales INTEGER,
  metrics_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrity_snapshots_date
  ON integrity_snapshots(snapshot_date DESC);
