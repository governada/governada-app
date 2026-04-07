ALTER TABLE vote_rationales
  ADD COLUMN IF NOT EXISTS fetch_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fetch_status IN ('pending', 'retry', 'fetched', 'inline', 'failed')),
  ADD COLUMN IF NOT EXISTS fetch_attempts INTEGER NOT NULL DEFAULT 0
    CHECK (fetch_attempts >= 0),
  ADD COLUMN IF NOT EXISTS fetch_last_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fetch_last_error TEXT,
  ADD COLUMN IF NOT EXISTS next_fetch_at TIMESTAMPTZ;

UPDATE vote_rationales
SET
  fetch_status = CASE
    WHEN rationale_text IS NOT NULL AND btrim(rationale_text) <> '' THEN 'fetched'
    ELSE 'pending'
  END,
  fetch_attempts = COALESCE(fetch_attempts, 0),
  next_fetch_at = CASE
    WHEN rationale_text IS NOT NULL AND btrim(rationale_text) <> '' THEN NULL
    ELSE COALESCE(next_fetch_at, NOW())
  END,
  fetched_at = CASE
    WHEN rationale_text IS NOT NULL AND btrim(rationale_text) <> '' THEN COALESCE(fetched_at, NOW())
    ELSE fetched_at
  END
WHERE fetch_status IS NULL
   OR next_fetch_at IS NULL
   OR fetch_attempts IS NULL;

CREATE INDEX IF NOT EXISTS idx_vote_rationales_fetch_queue
  ON vote_rationales(fetch_status, next_fetch_at)
  WHERE meta_url IS NOT NULL;
