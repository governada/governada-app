-- Add confidence column to dreps table for score confidence tracking.
-- The scoring function (sync-drep-scores) computes and upserts this value.
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS confidence integer;
