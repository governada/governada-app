-- DD05 vote-ingestion follow-up:
-- 1. Make cached rationale presence explicit on drep_votes
-- 2. Add durable sync cursors for incremental syncs

ALTER TABLE drep_votes
ADD COLUMN IF NOT EXISTS has_rationale BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE drep_votes
SET has_rationale = TRUE
WHERE meta_url IS NOT NULL;

UPDATE drep_votes AS dv
SET has_rationale = TRUE
FROM vote_rationales AS vr
WHERE dv.vote_tx_hash = vr.vote_tx_hash
  AND vr.rationale_text IS NOT NULL
  AND btrim(vr.rationale_text) <> '';

CREATE TABLE IF NOT EXISTS sync_cursors (
  sync_type TEXT PRIMARY KEY,
  cursor_block_time INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drep_votes_block_time_tx
  ON drep_votes(block_time DESC, vote_tx_hash);
