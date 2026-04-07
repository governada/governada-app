-- Session 3: DRep Command Center
-- New tables for milestones, positioning tools, vote explanations
-- Column additions to users and drep_power_snapshots

BEGIN;

-- =============================================
-- 1. New tables
-- =============================================

CREATE TABLE IF NOT EXISTS drep_milestones (
  drep_id TEXT NOT NULL,
  milestone_key TEXT NOT NULL,
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (drep_id, milestone_key)
);

CREATE TABLE IF NOT EXISTS position_statements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drep_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,
  statement_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vote_explanations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drep_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,
  explanation_text TEXT NOT NULL,
  ai_assisted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_philosophy (
  drep_id TEXT PRIMARY KEY,
  philosophy_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. Indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_drep_milestones_drep ON drep_milestones(drep_id);
CREATE INDEX IF NOT EXISTS idx_position_statements_drep ON position_statements(drep_id);
CREATE INDEX IF NOT EXISTS idx_position_statements_proposal ON position_statements(proposal_tx_hash, proposal_index);
CREATE UNIQUE INDEX IF NOT EXISTS idx_position_statements_unique ON position_statements(drep_id, proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_vote_explanations_drep ON vote_explanations(drep_id);
CREATE INDEX IF NOT EXISTS idx_vote_explanations_proposal ON vote_explanations(proposal_tx_hash, proposal_index);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vote_explanations_unique ON vote_explanations(drep_id, proposal_tx_hash, proposal_index);

-- =============================================
-- 3. Column additions
-- =============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '{}';
ALTER TABLE drep_power_snapshots ADD COLUMN IF NOT EXISTS delegator_count INT;

-- =============================================
-- 4. Updated_at triggers
-- =============================================

CREATE TRIGGER set_position_statements_updated_at
  BEFORE UPDATE ON position_statements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_vote_explanations_updated_at
  BEFORE UPDATE ON vote_explanations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_governance_philosophy_updated_at
  BEFORE UPDATE ON governance_philosophy
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================
-- 5. RLS policies (public read, service-role write)
-- =============================================

ALTER TABLE drep_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_philosophy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON drep_milestones FOR SELECT USING (true);
CREATE POLICY "Service role only" ON drep_milestones FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role only update" ON drep_milestones FOR UPDATE USING (false);
CREATE POLICY "Service role only delete" ON drep_milestones FOR DELETE USING (false);

CREATE POLICY "Public read access" ON position_statements FOR SELECT USING (true);
CREATE POLICY "Service role only" ON position_statements FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role only update" ON position_statements FOR UPDATE USING (false);
CREATE POLICY "Service role only delete" ON position_statements FOR DELETE USING (false);

CREATE POLICY "Public read access" ON vote_explanations FOR SELECT USING (true);
CREATE POLICY "Service role only" ON vote_explanations FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role only update" ON vote_explanations FOR UPDATE USING (false);
CREATE POLICY "Service role only delete" ON vote_explanations FOR DELETE USING (false);

CREATE POLICY "Public read access" ON governance_philosophy FOR SELECT USING (true);
CREATE POLICY "Service role only" ON governance_philosophy FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role only update" ON governance_philosophy FOR UPDATE USING (false);
CREATE POLICY "Service role only delete" ON governance_philosophy FOR DELETE USING (false);

COMMIT;
