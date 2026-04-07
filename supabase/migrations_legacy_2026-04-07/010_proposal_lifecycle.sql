-- Add lifecycle epoch columns to proposals table
-- Needed to determine which proposals were active in each epoch
-- for accurate reliability scoring and the DRep Dashboard proposal inbox.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS expired_epoch INTEGER;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ratified_epoch INTEGER;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS enacted_epoch INTEGER;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS dropped_epoch INTEGER;
