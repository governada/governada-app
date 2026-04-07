-- Add pre-computed per-category alignment scores to dreps table.
-- These are computed during sync from real vote data + classified proposals.
-- Client picks relevant categories based on user preferences and averages them.

ALTER TABLE dreps
  ADD COLUMN IF NOT EXISTS alignment_treasury_conservative INTEGER,
  ADD COLUMN IF NOT EXISTS alignment_treasury_growth INTEGER,
  ADD COLUMN IF NOT EXISTS alignment_decentralization INTEGER,
  ADD COLUMN IF NOT EXISTS alignment_security INTEGER,
  ADD COLUMN IF NOT EXISTS alignment_innovation INTEGER,
  ADD COLUMN IF NOT EXISTS alignment_transparency INTEGER,
  ADD COLUMN IF NOT EXISTS last_vote_time INTEGER;
