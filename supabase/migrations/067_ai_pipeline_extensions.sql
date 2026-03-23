-- AI Pipeline Extensions
-- Adds columns for enhanced rationale scoring, proposal quality, and GHI narratives.

-- 1. DRep rationale AI summary (citizen-facing, from enhanced scoring)
ALTER TABLE drep_votes ADD COLUMN IF NOT EXISTS rationale_ai_summary TEXT;

-- 2. Proposal body quality scoring (for Proposer Score)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ai_proposal_quality INTEGER;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ai_proposal_quality_details JSONB;

-- 3. GHI epoch narrative
ALTER TABLE ghi_snapshots ADD COLUMN IF NOT EXISTS narrative TEXT;
