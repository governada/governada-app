-- Session 7: Treasury Intelligence Dashboard
-- Treasury snapshots, accountability polls, and related infrastructure

BEGIN;

-- =============================================
-- 1. Treasury snapshots (epoch-level balance tracking)
-- =============================================

CREATE TABLE IF NOT EXISTS treasury_snapshots (
  epoch_no INT PRIMARY KEY,
  balance_lovelace BIGINT NOT NULL,
  withdrawals_lovelace BIGINT NOT NULL DEFAULT 0,
  reserves_lovelace BIGINT,
  fees_lovelace BIGINT,
  reserves_income_lovelace BIGINT,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_snapshots_epoch ON treasury_snapshots(epoch_no DESC);

-- =============================================
-- 2. Treasury accountability polls (recurring evaluation cycles)
-- =============================================

CREATE TABLE IF NOT EXISTS treasury_accountability_polls (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,
  cycle_number INT NOT NULL DEFAULT 1,
  opened_epoch INT NOT NULL,
  closes_epoch INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'closed')),
  results_summary JSONB DEFAULT '{}',
  next_cycle_epoch INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (proposal_tx_hash, proposal_index, cycle_number)
);

CREATE INDEX IF NOT EXISTS idx_accountability_polls_status ON treasury_accountability_polls(status);
CREATE INDEX IF NOT EXISTS idx_accountability_polls_epoch ON treasury_accountability_polls(opened_epoch);

-- =============================================
-- 3. Treasury accountability responses
-- =============================================

CREATE TABLE IF NOT EXISTS treasury_accountability_responses (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,
  cycle_number INT NOT NULL,
  user_address TEXT NOT NULL,
  delivered_rating TEXT NOT NULL CHECK (delivered_rating IN ('delivered', 'partial', 'not_delivered', 'too_early')),
  would_approve_again TEXT NOT NULL CHECK (would_approve_again IN ('yes', 'no', 'unsure')),
  evidence_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (proposal_tx_hash, proposal_index, cycle_number, user_address)
);

CREATE INDEX IF NOT EXISTS idx_accountability_responses_proposal ON treasury_accountability_responses(proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_accountability_responses_user ON treasury_accountability_responses(user_address);

-- =============================================
-- 4. Store proposal meta_json for future AI timeline extraction
-- =============================================

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS meta_json JSONB;

-- =============================================
-- 5. RLS policies
-- =============================================

ALTER TABLE treasury_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_accountability_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_accountability_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON treasury_snapshots FOR SELECT USING (true);
CREATE POLICY "Service role only" ON treasury_snapshots FOR ALL USING (false);

CREATE POLICY "Public read access" ON treasury_accountability_polls FOR SELECT USING (true);
CREATE POLICY "Service role only" ON treasury_accountability_polls FOR ALL USING (false);

CREATE POLICY "Public read access" ON treasury_accountability_responses FOR SELECT USING (true);
CREATE POLICY "Service role only" ON treasury_accountability_responses FOR ALL USING (false);

COMMIT;
