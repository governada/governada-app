-- DRep Score V3: 4-pillar quality-and-impact scoring upgrade
-- New columns on dreps table for pillar scores (raw + percentile) and momentum

DO $$
BEGIN
  -- Engagement Quality (percentile + raw)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'engagement_quality') THEN
    ALTER TABLE dreps ADD COLUMN engagement_quality INTEGER;
    ALTER TABLE dreps ADD COLUMN engagement_quality_raw INTEGER;
  END IF;

  -- Effective Participation V3 (avoids collision with existing effective_participation)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'effective_participation_v3') THEN
    ALTER TABLE dreps ADD COLUMN effective_participation_v3 INTEGER;
    ALTER TABLE dreps ADD COLUMN effective_participation_v3_raw INTEGER;
  END IF;

  -- Reliability V3
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'reliability_v3') THEN
    ALTER TABLE dreps ADD COLUMN reliability_v3 INTEGER;
    ALTER TABLE dreps ADD COLUMN reliability_v3_raw INTEGER;
  END IF;

  -- Governance Identity
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'governance_identity') THEN
    ALTER TABLE dreps ADD COLUMN governance_identity INTEGER;
    ALTER TABLE dreps ADD COLUMN governance_identity_raw INTEGER;
  END IF;

  -- Score momentum (points per day, from linear regression)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'score_momentum') THEN
    ALTER TABLE dreps ADD COLUMN score_momentum REAL;
  END IF;
END $$;

-- Add V3 pillar columns to drep_score_history
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drep_score_history' AND column_name = 'engagement_quality') THEN
    ALTER TABLE drep_score_history ADD COLUMN engagement_quality INTEGER;
    ALTER TABLE drep_score_history ADD COLUMN effective_participation_v3 INTEGER;
    ALTER TABLE drep_score_history ADD COLUMN reliability_v3 INTEGER;
    ALTER TABLE drep_score_history ADD COLUMN governance_identity INTEGER;
  END IF;
END $$;

-- Update sync_log CHECK constraint to allow 'scoring' type
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN ('fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes', 'secondary', 'slow', 'treasury', 'api_health_check', 'scoring'));
