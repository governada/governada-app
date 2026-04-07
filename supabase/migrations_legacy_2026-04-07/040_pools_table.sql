-- Pools table: SPO metadata + governance scores

CREATE TABLE IF NOT EXISTS pools (
  pool_id TEXT PRIMARY KEY,
  ticker TEXT,
  pool_name TEXT,
  pledge_lovelace BIGINT DEFAULT 0,
  margin NUMERIC(7,4) DEFAULT 0,
  fixed_cost_lovelace BIGINT DEFAULT 0,
  delegator_count INTEGER DEFAULT 0,
  live_stake_lovelace BIGINT DEFAULT 0,
  governance_score INTEGER,
  participation_raw INTEGER,
  consistency_raw INTEGER,
  reliability_raw INTEGER,
  participation_pct INTEGER,
  consistency_pct INTEGER,
  reliability_pct INTEGER,
  vote_count INTEGER DEFAULT 0,
  alignment_treasury_conservative NUMERIC(5,2),
  alignment_treasury_growth NUMERIC(5,2),
  alignment_decentralization NUMERIC(5,2),
  alignment_security NUMERIC(5,2),
  alignment_innovation NUMERIC(5,2),
  alignment_transparency NUMERIC(5,2),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pools" ON pools FOR SELECT USING (true);
CREATE POLICY "Service write pools" ON pools FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_pools_governance_score ON pools(governance_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_pools_vote_count ON pools(vote_count DESC);
