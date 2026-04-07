-- Create citizen_milestones and citizen_impact_scores tables.
-- Referenced by lib/citizenMilestones.ts, lib/citizenImpactScore.ts,
-- app/api/citizen/milestones/route.ts, app/api/you/impact-score/route.ts.

BEGIN;

-- ── citizen_milestones ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citizen_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  milestone_key TEXT NOT NULL,
  milestone_label TEXT,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  epoch INTEGER,
  metadata JSONB,
  UNIQUE (user_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS idx_citizen_milestones_user_id
  ON citizen_milestones(user_id);

ALTER TABLE citizen_milestones ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own milestones
CREATE POLICY "Users can read own milestones"
  ON citizen_milestones FOR SELECT
  USING (auth.uid()::text = user_id);

-- Block direct writes from client (service_role bypasses RLS)
CREATE POLICY "Block anon/auth inserts"
  ON citizen_milestones FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Block anon/auth updates"
  ON citizen_milestones FOR UPDATE
  USING (false) WITH CHECK (false);

CREATE POLICY "Block anon/auth deletes"
  ON citizen_milestones FOR DELETE
  USING (false);


-- ── citizen_impact_scores ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citizen_impact_scores (
  user_id TEXT PRIMARY KEY,
  score NUMERIC NOT NULL DEFAULT 0,
  delegation_tenure_score NUMERIC NOT NULL DEFAULT 0,
  rep_activity_score NUMERIC NOT NULL DEFAULT 0,
  engagement_depth_score NUMERIC NOT NULL DEFAULT 0,
  coverage_score NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citizen_impact_scores_score
  ON citizen_impact_scores(score DESC);

ALTER TABLE citizen_impact_scores ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own impact score
CREATE POLICY "Users can read own impact score"
  ON citizen_impact_scores FOR SELECT
  USING (auth.uid()::text = user_id);

-- Block direct writes from client (service_role bypasses RLS)
CREATE POLICY "Block anon/auth inserts"
  ON citizen_impact_scores FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Block anon/auth updates"
  ON citizen_impact_scores FOR UPDATE
  USING (false) WITH CHECK (false);

CREATE POLICY "Block anon/auth deletes"
  ON citizen_impact_scores FOR DELETE
  USING (false);

COMMIT;
