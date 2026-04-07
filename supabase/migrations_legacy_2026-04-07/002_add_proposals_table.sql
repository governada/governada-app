-- Add proposals table for caching classified governance proposals
-- Run this in your Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS proposals (
  tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  proposal_type TEXT NOT NULL,
  title TEXT,
  abstract TEXT,
  withdrawal_amount BIGINT,
  treasury_tier TEXT,
  param_changes JSONB,
  relevant_prefs TEXT[],
  proposed_epoch INTEGER,
  block_time INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tx_hash, proposal_index)
);

-- Index for querying by proposal type
CREATE INDEX IF NOT EXISTS idx_proposals_type ON proposals(proposal_type);

-- Index for querying by treasury tier
CREATE INDEX IF NOT EXISTS idx_proposals_treasury_tier ON proposals(treasury_tier);

-- Index for querying by block time (for recent proposals)
CREATE INDEX IF NOT EXISTS idx_proposals_block_time ON proposals(block_time DESC);

-- Update the dreps table to add new columns for V2 scoring
-- Run these if migrating from V1

ALTER TABLE dreps 
ADD COLUMN IF NOT EXISTS consistency_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deliberation_modifier DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS effective_participation INTEGER DEFAULT 0;

-- Note: decentralization_score column can be dropped if no longer needed
-- ALTER TABLE dreps DROP COLUMN IF EXISTS decentralization_score;
