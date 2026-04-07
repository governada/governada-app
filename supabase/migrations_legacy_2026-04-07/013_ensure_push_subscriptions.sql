-- Ensure push_subscriptions column exists on users table.
-- Stores Web Push subscription data (endpoint + VAPID keys) per user.
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscriptions JSONB DEFAULT '{}'::jsonb;

-- Track which notifications have been sent to prevent duplicates.
-- Keyed by notification type + identifier (e.g., proposal tx_hash).
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_push_check TIMESTAMPTZ;
