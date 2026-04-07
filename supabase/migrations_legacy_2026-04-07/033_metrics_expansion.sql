-- 033: Metrics Expansion — SPO/CC votes, inter-body alignment, epoch recaps, proposal similarity cache
-- Phase 1 of the metrics expansion plan

-- ---------------------------------------------------------------------------
-- SPO Votes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS spo_votes (
  pool_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('Yes', 'No', 'Abstain')),
  block_time INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  PRIMARY KEY (pool_id, proposal_tx_hash, proposal_index)
);

ALTER TABLE spo_votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'spo_votes_public_read') THEN
    CREATE POLICY spo_votes_public_read ON spo_votes FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'spo_votes_service_write') THEN
    CREATE POLICY spo_votes_service_write ON spo_votes
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_spo_votes_proposal ON spo_votes (proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_spo_votes_epoch ON spo_votes (epoch);

-- ---------------------------------------------------------------------------
-- CC Votes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cc_votes (
  cc_hot_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('Yes', 'No', 'Abstain')),
  block_time INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  PRIMARY KEY (cc_hot_id, proposal_tx_hash, proposal_index)
);

ALTER TABLE cc_votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cc_votes_public_read') THEN
    CREATE POLICY cc_votes_public_read ON cc_votes FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cc_votes_service_write') THEN
    CREATE POLICY cc_votes_service_write ON cc_votes
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cc_votes_proposal ON cc_votes (proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_cc_votes_epoch ON cc_votes (epoch);

-- ---------------------------------------------------------------------------
-- Inter-Body Alignment Cache
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inter_body_alignment (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  drep_yes_pct REAL,
  drep_no_pct REAL,
  spo_yes_pct REAL,
  spo_no_pct REAL,
  cc_yes_pct REAL,
  cc_no_pct REAL,
  alignment_score REAL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (proposal_tx_hash, proposal_index)
);

ALTER TABLE inter_body_alignment ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'inter_body_alignment_public_read') THEN
    CREATE POLICY inter_body_alignment_public_read ON inter_body_alignment FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'inter_body_alignment_service_write') THEN
    CREATE POLICY inter_body_alignment_service_write ON inter_body_alignment
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Epoch Recaps
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS epoch_recaps (
  epoch INTEGER PRIMARY KEY,
  proposals_submitted INTEGER DEFAULT 0,
  proposals_ratified INTEGER DEFAULT 0,
  proposals_expired INTEGER DEFAULT 0,
  proposals_dropped INTEGER DEFAULT 0,
  drep_participation_pct REAL,
  treasury_withdrawn_ada BIGINT DEFAULT 0,
  ai_narrative TEXT,
  computed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE epoch_recaps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'epoch_recaps_public_read') THEN
    CREATE POLICY epoch_recaps_public_read ON epoch_recaps FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'epoch_recaps_service_write') THEN
    CREATE POLICY epoch_recaps_service_write ON epoch_recaps
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Proposal Similarity Cache
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS proposal_similarity_cache (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  similar_tx_hash TEXT NOT NULL,
  similar_index INTEGER NOT NULL,
  similarity_score REAL NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (proposal_tx_hash, proposal_index, similar_tx_hash, similar_index)
);

ALTER TABLE proposal_similarity_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proposal_similarity_cache_public_read') THEN
    CREATE POLICY proposal_similarity_cache_public_read ON proposal_similarity_cache FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proposal_similarity_cache_service_write') THEN
    CREATE POLICY proposal_similarity_cache_service_write ON proposal_similarity_cache
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_similarity_cache_source ON proposal_similarity_cache (proposal_tx_hash, proposal_index);

-- ---------------------------------------------------------------------------
-- Extend sync_log CHECK constraint for new sync types
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
  ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
    CHECK (sync_type IN (
      'proposals', 'dreps', 'votes', 'secondary', 'slow', 'full',
      'treasury', 'scoring', 'integrity_check', 'api_health_check',
      'spo_votes', 'cc_votes', 'alignment_cache', 'similarity_cache', 'epoch_recaps'
    ));
END $$;

-- ---------------------------------------------------------------------------
-- Feature flags for new features
-- ---------------------------------------------------------------------------

INSERT INTO feature_flags (key, enabled, description, category)
VALUES
  ('spo_cc_votes', false, 'SPO and CC vote data display', 'Governance'),
  ('governance_footprint', false, 'Wallet governance footprint API and UI', 'Governance'),
  ('proposal_similarity', false, 'Classification-based proposal similarity', 'Intelligence'),
  ('epoch_recaps', false, 'AI-generated epoch narratives', 'Narrative')
ON CONFLICT (key) DO NOTHING;
