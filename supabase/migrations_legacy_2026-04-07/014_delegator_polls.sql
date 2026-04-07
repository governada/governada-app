-- Delegator sentiment polling: ADA holders vote Yes/No/Abstain on open proposals.
-- Polls are implicit for all open proposals (no separate poll table needed).

CREATE TABLE poll_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  stake_address TEXT,
  delegated_drep_id TEXT,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
  initial_vote TEXT NOT NULL CHECK (initial_vote IN ('yes', 'no', 'abstain')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  vote_count INTEGER DEFAULT 1,
  UNIQUE(proposal_tx_hash, proposal_index, wallet_address)
);

CREATE INDEX idx_poll_responses_proposal
  ON poll_responses(proposal_tx_hash, proposal_index);

CREATE INDEX idx_poll_responses_drep
  ON poll_responses(delegated_drep_id)
  WHERE delegated_drep_id IS NOT NULL;

CREATE INDEX idx_poll_responses_wallet
  ON poll_responses(wallet_address);
