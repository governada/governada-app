-- Stores CIP-100 JSON-LD rationale documents submitted by DReps via Governada.
-- Served at /api/rationale/[hash] as the on-chain vote anchor URL.

CREATE TABLE IF NOT EXISTS rationale_documents (
  content_hash TEXT PRIMARY KEY,
  drep_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  document JSONB NOT NULL,
  rationale_text TEXT NOT NULL,
  vote_tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rationale_documents_drep ON rationale_documents(drep_id);
CREATE INDEX IF NOT EXISTS idx_rationale_documents_proposal ON rationale_documents(proposal_tx_hash, proposal_index);
