-- Add AI summary column to vote_rationales table
ALTER TABLE vote_rationales ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Reset all existing proposal AI summaries so they regenerate with the
-- updated prompt (shorter, 160-char limit).
UPDATE proposals SET ai_summary = NULL WHERE ai_summary IS NOT NULL;
