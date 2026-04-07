-- DRep Votes Table
-- Stores individual vote records fetched from Koios during sync
-- Eliminates the need for Koios API calls on profile page loads

CREATE TABLE IF NOT EXISTS drep_votes (
  vote_tx_hash TEXT PRIMARY KEY,
  drep_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('Yes', 'No', 'Abstain')),
  epoch_no INTEGER,
  block_time INTEGER NOT NULL,
  meta_url TEXT,
  meta_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drep_votes_drep ON drep_votes(drep_id);
CREATE INDEX IF NOT EXISTS idx_drep_votes_drep_block_time ON drep_votes(drep_id, block_time DESC);
CREATE INDEX IF NOT EXISTS idx_drep_votes_proposal ON drep_votes(proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_drep_votes_epoch ON drep_votes(epoch_no);
