-- Fast proposal listing (homepage + governance widget)
CREATE INDEX IF NOT EXISTS idx_proposals_open
  ON proposals(block_time DESC)
  WHERE ratified_epoch IS NULL AND enacted_epoch IS NULL
    AND dropped_epoch IS NULL AND expired_epoch IS NULL;

-- Vote aggregation by proposal (ThresholdMeter queries)
CREATE INDEX IF NOT EXISTS idx_drep_votes_proposal_vote
  ON drep_votes(proposal_tx_hash, proposal_index, vote);

-- DRep listing sorted by score
CREATE INDEX IF NOT EXISTS idx_dreps_score
  ON dreps(score DESC);

-- Vote power queries
CREATE INDEX IF NOT EXISTS idx_drep_votes_power_not_null
  ON drep_votes(proposal_tx_hash, proposal_index)
  WHERE voting_power_lovelace IS NOT NULL;

-- Proposed epoch for active epoch calculation
CREATE INDEX IF NOT EXISTS idx_proposals_proposed_epoch
  ON proposals(proposed_epoch);
