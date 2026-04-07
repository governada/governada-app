-- Add rationale anchor columns to cc_votes for CIP-136 constitutional analysis
ALTER TABLE cc_votes ADD COLUMN IF NOT EXISTS meta_url TEXT;
ALTER TABLE cc_votes ADD COLUMN IF NOT EXISTS meta_hash TEXT;

-- CC rationale cache: stores fetched and parsed CIP-136 rationale documents
CREATE TABLE IF NOT EXISTS cc_rationales (
  cc_hot_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  meta_url TEXT NOT NULL,
  meta_hash TEXT,
  -- CIP-136 structured fields
  author_name TEXT,
  summary TEXT,
  rationale_statement TEXT,
  precedent_discussion TEXT,
  counterargument_discussion TEXT,
  conclusion TEXT,
  internal_vote JSONB,  -- { constitutional, unconstitutional, abstain, didNotVote, againstVote }
  cited_articles JSONB, -- ["Article I, § 1", "Article II, § 6", ...]
  raw_json JSONB,       -- full CIP-136 document for future re-parsing
  -- Scoring fields (populated by scoring pipeline)
  fidelity_score INTEGER,           -- 0-100 composite Constitutional Fidelity score
  article_coverage_score INTEGER,   -- 0-100 how well relevant articles were addressed
  reasoning_quality_score INTEGER,  -- 0-100 AI-assessed reasoning quality
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  scored_at TIMESTAMPTZ,
  PRIMARY KEY (cc_hot_id, proposal_tx_hash, proposal_index)
);

-- RLS for cc_rationales
ALTER TABLE cc_rationales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cc_rationales"
  ON cc_rationales FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can write cc_rationales"
  ON cc_rationales FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- CC member metadata cache (from Koios committee_info + rationale author names)
CREATE TABLE IF NOT EXISTS cc_members (
  cc_hot_id TEXT PRIMARY KEY,
  cc_cold_id TEXT,
  author_name TEXT,                 -- from CIP-136 rationale authors field
  status TEXT,                      -- authorized, resigned, expired
  expiration_epoch INTEGER,
  has_script BOOLEAN DEFAULT false,
  -- Aggregate scoring (updated by scoring pipeline)
  fidelity_score INTEGER,           -- composite Constitutional Fidelity score
  rationale_provision_rate REAL,    -- % of votes with rationales
  avg_article_coverage REAL,        -- average article coverage score
  avg_reasoning_quality REAL,       -- average reasoning quality score
  consistency_score REAL,           -- cross-proposal consistency
  responsiveness_score REAL,        -- average time-to-vote
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cc_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cc_members"
  ON cc_members FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can write cc_members"
  ON cc_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
