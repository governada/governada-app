-- 5d: Add constitutional analysis column to proposal_classifications
ALTER TABLE proposal_classifications
ADD COLUMN IF NOT EXISTS constitutional_analysis JSONB;

COMMENT ON COLUMN proposal_classifications.constitutional_analysis IS 'AI-generated constitutional alignment analysis (alignment, confidence, summary, relevant articles)';

-- 5e: Create drep_epoch_updates table for AI-generated per-DRep epoch summaries
CREATE TABLE IF NOT EXISTS drep_epoch_updates (
  drep_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  update_text TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  rationale_count INTEGER NOT NULL DEFAULT 0,
  proposals_voted JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (drep_id, epoch)
);

CREATE INDEX IF NOT EXISTS idx_drep_epoch_updates_epoch ON drep_epoch_updates(epoch);
CREATE INDEX IF NOT EXISTS idx_drep_epoch_updates_drep ON drep_epoch_updates(drep_id);

COMMENT ON TABLE drep_epoch_updates IS 'AI-generated per-DRep epoch voting summaries for delegator communication';
