-- Add claimed_drep_id column to users table for DRep profile claiming
ALTER TABLE users ADD COLUMN IF NOT EXISTS claimed_drep_id text;
CREATE INDEX IF NOT EXISTS idx_users_claimed_drep ON users(claimed_drep_id);
