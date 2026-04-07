-- 018: Data Integrity Overhaul
-- Canonical proposal tallies, vote completeness, hash verification, power provenance

-- 1. Canonical proposal voting summary (from Koios /proposal_voting_summary)
CREATE TABLE IF NOT EXISTS proposal_voting_summary (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  epoch_no INTEGER NOT NULL,
  drep_yes_votes_cast INTEGER,
  drep_yes_vote_power BIGINT,
  drep_no_votes_cast INTEGER,
  drep_no_vote_power BIGINT,
  drep_abstain_votes_cast INTEGER,
  drep_abstain_vote_power BIGINT,
  drep_always_abstain_power BIGINT,
  drep_always_no_confidence_power BIGINT,
  pool_yes_votes_cast INTEGER,
  pool_yes_vote_power BIGINT,
  pool_no_votes_cast INTEGER,
  pool_no_vote_power BIGINT,
  pool_abstain_votes_cast INTEGER,
  pool_abstain_vote_power BIGINT,
  committee_yes_votes_cast INTEGER,
  committee_no_votes_cast INTEGER,
  committee_abstain_votes_cast INTEGER,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (proposal_tx_hash, proposal_index)
);

-- 2. CIP-129 bech32 proposal ID on proposals table
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS proposal_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_proposal_id
  ON proposals(proposal_id) WHERE proposal_id IS NOT NULL;

-- 3. Rationale hash verification + AI summary on vote_rationales
ALTER TABLE vote_rationales
  ADD COLUMN IF NOT EXISTS hash_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- 4. DRep metadata hash verification
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS metadata_hash_verified BOOLEAN;

-- 5. Per-vote power source tracking
ALTER TABLE drep_votes
  ADD COLUMN IF NOT EXISTS power_source TEXT
  CHECK (power_source IN ('exact', 'nearest'));

UPDATE drep_votes SET power_source = 'exact'
  WHERE voting_power_lovelace IS NOT NULL AND power_source IS NULL;
