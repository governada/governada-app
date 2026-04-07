-- Add pool_status and retiring_epoch columns to pools table
-- pool_status: 'registered' | 'retiring' | 'retired' (from Koios pool_info)
-- retiring_epoch: the epoch at which the pool will retire (null if not retiring)

ALTER TABLE pools ADD COLUMN IF NOT EXISTS pool_status TEXT DEFAULT 'registered';
ALTER TABLE pools ADD COLUMN IF NOT EXISTS retiring_epoch INTEGER;

-- Index for filtering by status (e.g., hide retired pools from default browse)
CREATE INDEX IF NOT EXISTS idx_pools_pool_status ON pools(pool_status);
