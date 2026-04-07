-- Proposer Score Foundation
-- Canonical proposer entities resolved from CIP-100 author metadata.

-- 1. Proposers table — one row per canonical proposer entity
CREATE TABLE proposers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'individual'
    CHECK (type IN ('individual', 'organization', 'institutional')),
  first_proposal_epoch INTEGER,
  proposal_count INTEGER NOT NULL DEFAULT 0,
  enacted_count INTEGER NOT NULL DEFAULT 0,
  dropped_count INTEGER NOT NULL DEFAULT 0,
  composite_score REAL,
  track_record_score REAL,
  proposal_quality_score REAL,
  fiscal_responsibility_score REAL,
  governance_citizenship_score REAL,
  confidence INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'Emerging',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Alias mapping — CIP-100 author entries → canonical proposer
CREATE TABLE proposer_aliases (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alias_name TEXT NOT NULL,
  alias_key TEXT NOT NULL DEFAULT '',
  proposer_id TEXT NOT NULL REFERENCES proposers(id) ON DELETE CASCADE,
  UNIQUE (alias_name, alias_key)
);

CREATE INDEX idx_proposer_aliases_name ON proposer_aliases (alias_name);
CREATE INDEX idx_proposer_aliases_proposer ON proposer_aliases (proposer_id);

-- 3. Link proposals to proposers for fast lookups
CREATE TABLE proposal_proposers (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  proposer_id TEXT NOT NULL REFERENCES proposers(id) ON DELETE CASCADE,
  PRIMARY KEY (proposal_tx_hash, proposal_index, proposer_id)
);

CREATE INDEX idx_proposal_proposers_proposer ON proposal_proposers (proposer_id);

-- 4. RLS — public read, service role write
ALTER TABLE proposers ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposer_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_proposers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read proposers" ON proposers FOR SELECT USING (true);
CREATE POLICY "Service write proposers" ON proposers FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read proposer_aliases" ON proposer_aliases FOR SELECT USING (true);
CREATE POLICY "Service write proposer_aliases" ON proposer_aliases FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read proposal_proposers" ON proposal_proposers FOR SELECT USING (true);
CREATE POLICY "Service write proposal_proposers" ON proposal_proposers FOR ALL USING (auth.role() = 'service_role');
