-- CC Transparency Index: adds headline transparency score + participation tracking
-- + historical snapshot table for trend analysis.

-- 1. Add new columns to cc_members for the 5-pillar Transparency Index
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS transparency_index INTEGER;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS participation_score REAL;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS rationale_quality_score REAL;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS independence_score REAL;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS community_engagement_score REAL;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS transparency_grade TEXT;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS votes_cast INTEGER DEFAULT 0;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS eligible_proposals INTEGER DEFAULT 0;

-- 2. Historical snapshots for trend tracking (one row per member per epoch)
CREATE TABLE IF NOT EXISTS cc_transparency_snapshots (
  cc_hot_id TEXT NOT NULL,
  epoch_no INTEGER NOT NULL,
  transparency_index INTEGER,
  participation_score REAL,
  rationale_quality_score REAL,
  responsiveness_score REAL,
  independence_score REAL,
  community_engagement_score REAL,
  votes_cast INTEGER DEFAULT 0,
  eligible_proposals INTEGER DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cc_hot_id, epoch_no)
);

CREATE INDEX IF NOT EXISTS idx_cc_transparency_snapshots_epoch
  ON cc_transparency_snapshots(epoch_no);

CREATE INDEX IF NOT EXISTS idx_cc_transparency_snapshots_member
  ON cc_transparency_snapshots(cc_hot_id);

-- RLS
ALTER TABLE cc_transparency_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cc_transparency_snapshots"
  ON cc_transparency_snapshots FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can write cc_transparency_snapshots"
  ON cc_transparency_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
