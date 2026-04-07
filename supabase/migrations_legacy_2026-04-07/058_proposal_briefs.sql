-- Living Brief: proposal intelligence briefs + feedback
-- Feature: living_brief

-- proposal_briefs stores AI-generated intelligence briefs per proposal
CREATE TABLE IF NOT EXISTS proposal_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  conviction_score SMALLINT NOT NULL DEFAULT 0,
  polarization_score SMALLINT NOT NULL DEFAULT 0,
  rationale_hash TEXT,
  rationale_count SMALLINT NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  model_used TEXT,
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proposal_tx_hash, proposal_index)
);

-- Indexes for lookup and staleness checks
CREATE INDEX idx_proposal_briefs_lookup ON proposal_briefs(proposal_tx_hash, proposal_index);
CREATE INDEX idx_proposal_briefs_updated ON proposal_briefs(updated_at);

-- RLS: public read, service_role write
ALTER TABLE proposal_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposal_briefs_public_read" ON proposal_briefs FOR SELECT USING (true);
CREATE POLICY "proposal_briefs_service_write" ON proposal_briefs FOR ALL USING (auth.role() = 'service_role');

-- Brief feedback from authenticated users
CREATE TABLE IF NOT EXISTS proposal_brief_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_id UUID NOT NULL REFERENCES proposal_briefs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brief_id, user_id)
);

ALTER TABLE proposal_brief_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brief_feedback_public_read" ON proposal_brief_feedback FOR SELECT USING (true);
CREATE POLICY "brief_feedback_user_insert" ON proposal_brief_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brief_feedback_user_update" ON proposal_brief_feedback FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_brief_feedback_brief ON proposal_brief_feedback(brief_id);

-- Feature flag: disabled by default for safe rollout
INSERT INTO feature_flags (key, enabled, description, category)
VALUES ('living_brief', false, 'Living Brief: AI-synthesized proposal intelligence replacing raw data zones', 'AI')
ON CONFLICT (key) DO NOTHING;
