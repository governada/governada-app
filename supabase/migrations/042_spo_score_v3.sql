-- SPO Score V3: deliberation quality, confidence, sybil detection, attribution

-- 1. Add V3 columns to pools table
ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS deliberation_raw INTEGER,
  ADD COLUMN IF NOT EXISTS deliberation_pct INTEGER,
  ADD COLUMN IF NOT EXISTS governance_identity_raw INTEGER,
  ADD COLUMN IF NOT EXISTS governance_identity_pct INTEGER,
  ADD COLUMN IF NOT EXISTS score_momentum NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS confidence INTEGER,
  ADD COLUMN IF NOT EXISTS current_tier TEXT,
  ADD COLUMN IF NOT EXISTS governance_statement TEXT,
  ADD COLUMN IF NOT EXISTS homepage_url TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB,
  ADD COLUMN IF NOT EXISTS metadata_hash_verified BOOLEAN DEFAULT false;

-- 2. Add V3 columns to spo_score_snapshots
ALTER TABLE spo_score_snapshots
  ADD COLUMN IF NOT EXISTS participation_pct INTEGER,
  ADD COLUMN IF NOT EXISTS deliberation_raw INTEGER,
  ADD COLUMN IF NOT EXISTS deliberation_pct INTEGER,
  ADD COLUMN IF NOT EXISTS consistency_raw INTEGER,
  ADD COLUMN IF NOT EXISTS consistency_pct INTEGER,
  ADD COLUMN IF NOT EXISTS reliability_raw INTEGER,
  ADD COLUMN IF NOT EXISTS reliability_pct INTEGER,
  ADD COLUMN IF NOT EXISTS governance_identity_raw INTEGER,
  ADD COLUMN IF NOT EXISTS governance_identity_pct INTEGER,
  ADD COLUMN IF NOT EXISTS score_momentum NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS confidence INTEGER;

-- 3. Sybil detection flags
CREATE TABLE IF NOT EXISTS spo_sybil_flags (
  id SERIAL PRIMARY KEY,
  pool_a TEXT NOT NULL,
  pool_b TEXT NOT NULL,
  agreement_rate NUMERIC(5,3) NOT NULL,
  shared_votes INTEGER NOT NULL,
  epoch_no INTEGER NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT now(),
  resolved BOOLEAN DEFAULT false,
  UNIQUE (pool_a, pool_b, epoch_no)
);

ALTER TABLE spo_sybil_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sybil flags" ON spo_sybil_flags FOR SELECT USING (true);
CREATE POLICY "Service write sybil flags" ON spo_sybil_flags FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_spo_sybil_flags_epoch ON spo_sybil_flags(epoch_no);
CREATE INDEX IF NOT EXISTS idx_spo_sybil_flags_pools ON spo_sybil_flags(pool_a, pool_b);

-- 4. Extend sync_log CHECK for spo_scores type
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks', 'spo_scores', 'spo_votes', 'cc_votes'
  ));

-- 5. Index for confidence-gated tier queries
CREATE INDEX IF NOT EXISTS idx_pools_confidence ON pools(confidence) WHERE confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pools_current_tier ON pools(current_tier) WHERE current_tier IS NOT NULL;
