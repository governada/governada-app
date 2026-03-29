-- =============================================================================
-- 070: Intelligence Cache Tables
-- =============================================================================
-- Pre-computed intelligence sections for proposals (constitutional checks,
-- key questions, passage predictions) + reviewer briefing cache +
-- review session tracking.

-- =============================================================================
-- 1. Proposal Intelligence Cache
-- =============================================================================

CREATE TABLE IF NOT EXISTS proposal_intelligence_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  section_type TEXT NOT NULL,
  content JSONB NOT NULL,
  content_hash TEXT,
  model_used TEXT,
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_proposal_intel_cache UNIQUE (proposal_tx_hash, proposal_index, section_type)
);

CREATE INDEX IF NOT EXISTS idx_proposal_intel_cache_proposal
  ON proposal_intelligence_cache (proposal_tx_hash, proposal_index);

ALTER TABLE proposal_intelligence_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON proposal_intelligence_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow service_role write" ON proposal_intelligence_cache
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 2. Reviewer Briefing Cache
-- =============================================================================

CREATE TABLE IF NOT EXISTS reviewer_briefing_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  content JSONB NOT NULL,
  voter_context_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_reviewer_briefing_cache UNIQUE (voter_id, proposal_tx_hash, proposal_index)
);

ALTER TABLE reviewer_briefing_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON reviewer_briefing_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow service_role write" ON reviewer_briefing_cache
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 3. Review Sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS review_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  proposals_reviewed INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  avg_seconds_per_proposal REAL,
  session_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_voter
  ON review_sessions (voter_id, started_at DESC);

ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON review_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow service_role write" ON review_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 4. Update sync_log CHECK constraint
-- =============================================================================

ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks', 'spo_scores', 'spo_votes', 'cc_votes',
    'data_moat', 'delegator_snapshots', 'drep_lifecycle', 'epoch_summaries',
    'committee_sync', 'metadata_archive', 'governance_epoch_stats',
    'catalyst', 'catalyst_proposals', 'catalyst_funds',
    'reconciliation',
    'intelligence_precompute', 'passage_predictions'
  ));

-- =============================================================================
-- 5. Feature flags
-- =============================================================================

INSERT INTO feature_flags (key, enabled, description)
VALUES
  ('intelligence_precompute', true, 'Background pre-computation of intelligence brief sections'),
  ('batch_review_mode', true, 'Batch review UX (] shortcut, progress bar, session tracking)'),
  ('passage_prediction', true, 'Show passage prediction in review intelligence brief')
ON CONFLICT (key) DO NOTHING;
