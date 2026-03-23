-- Add ensemble scoring columns to drep_votes
-- These are additive nullable columns — existing queries are unaffected.

ALTER TABLE drep_votes
  ADD COLUMN IF NOT EXISTS rationale_quality_secondary smallint,
  ADD COLUMN IF NOT EXISTS rationale_quality_divergence smallint,
  ADD COLUMN IF NOT EXISTS rationale_quality_divergence_flag boolean DEFAULT false;

-- Index for monitoring divergent scores (admin queries)
CREATE INDEX IF NOT EXISTS idx_drep_votes_divergence_flag
  ON drep_votes (rationale_quality_divergence_flag)
  WHERE rationale_quality_divergence_flag = true;

COMMENT ON COLUMN drep_votes.rationale_quality_secondary IS 'GPT-4o governance-value rubric score (0-100)';
COMMENT ON COLUMN drep_votes.rationale_quality_divergence IS 'Absolute difference between primary (Claude) and secondary (GPT-4o) scores';
COMMENT ON COLUMN drep_votes.rationale_quality_divergence_flag IS 'True when divergence exceeds 15 points — signals potential scoring bias';
