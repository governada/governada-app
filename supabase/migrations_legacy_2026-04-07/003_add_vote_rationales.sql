-- Vote Rationales Table
-- Caches rationale text fetched from IPFS/HTTP URLs
-- This allows us to display rationale inline instead of linking to raw URLs

CREATE TABLE IF NOT EXISTS vote_rationales (
  vote_tx_hash TEXT PRIMARY KEY,
  drep_id TEXT NOT NULL,
  proposal_tx_hash TEXT,
  proposal_index INTEGER,
  meta_url TEXT,
  rationale_text TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by DRep (when displaying their voting history)
CREATE INDEX IF NOT EXISTS idx_vote_rationales_drep ON vote_rationales(drep_id);

-- Index for querying by proposal (if we ever want to show all rationales for a proposal)
CREATE INDEX IF NOT EXISTS idx_vote_rationales_proposal ON vote_rationales(proposal_tx_hash, proposal_index);
