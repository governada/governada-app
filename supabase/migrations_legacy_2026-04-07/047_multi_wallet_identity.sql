-- Multi-wallet identity foundation.
-- Decouples user identity from a single wallet address by introducing:
--   1. A stable UUID `id` as the new PK on `users`
--   2. A `user_wallets` junction table (one user → many wallets)
--   3. `user_id` FK columns on all user-scoped tables
--
-- Pre-launch migration: no data backfill or dual-write needed.

BEGIN;

-- ============================================================================
-- 1. Add UUID `id` to `users` and make it the new PK
-- ============================================================================

-- Add the id column with a default UUID
ALTER TABLE users ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Backfill any existing rows (dev/test data)
UPDATE users SET id = gen_random_uuid() WHERE id IS NULL;

-- Make id NOT NULL
ALTER TABLE users ALTER COLUMN id SET NOT NULL;

-- Drop FK constraints that reference users_pkey (wallet_address)
-- These tables will get a new user_id FK in section 3
ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_wallet_fkey;
ALTER TABLE user_channels DROP CONSTRAINT IF EXISTS user_channels_user_wallet_fkey;

-- Drop existing PK on wallet_address
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;

-- Add new PK on id
ALTER TABLE users ADD PRIMARY KEY (id);

-- Keep wallet_address unique and indexed (still needed for auth lookup)
ALTER TABLE users ADD CONSTRAINT users_wallet_address_unique UNIQUE (wallet_address);

-- ============================================================================
-- 2. Create `user_wallets` junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_wallets (
  stake_address TEXT PRIMARY KEY,             -- stable governance-meaningful key
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_address TEXT NOT NULL,              -- bech32 payment address (most recent)
  label         TEXT,                         -- user-defined label ("DRep wallet", "Cold storage")
  segments      TEXT[] DEFAULT '{}',          -- cached: ['drep', 'spo', 'citizen']
  drep_id       TEXT,                         -- derived DRep ID if registered
  pool_id       TEXT,                         -- pool bech32 if SPO
  linked_at     TIMESTAMPTZ DEFAULT now(),
  last_used     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_wallets_user ON user_wallets(user_id);

-- RLS: public read, service role write
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY uw_public_read ON user_wallets FOR SELECT USING (true);
CREATE POLICY uw_service_write ON user_wallets FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- ============================================================================
-- 3. Add `user_id` FK to all user-scoped tables
-- ============================================================================

-- 3a. poll_responses
ALTER TABLE poll_responses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_poll_responses_user ON poll_responses(user_id);

-- Update unique constraint: one vote per user per proposal (replaces wallet-based constraint)
ALTER TABLE poll_responses DROP CONSTRAINT IF EXISTS poll_responses_proposal_tx_hash_proposal_index_wallet_add_key;
ALTER TABLE poll_responses ADD CONSTRAINT poll_responses_user_proposal_unique
  UNIQUE (proposal_tx_hash, proposal_index, user_id);

-- 3b. governance_events
ALTER TABLE governance_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_governance_events_user ON governance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_governance_events_user_created ON governance_events(user_id, created_at DESC);

-- 3c. governance_briefs
ALTER TABLE governance_briefs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_briefs_user ON governance_briefs(user_id);

-- 3d. user_governance_profiles — replace wallet_address PK with user_id PK
-- Must recreate since PK changes
CREATE TABLE IF NOT EXISTS user_governance_profiles_new (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  wallet_address   TEXT,                  -- kept for reference, no longer PK
  pca_coordinates  REAL[],
  alignment_scores JSONB,
  personality_label TEXT,
  votes_used       INTEGER NOT NULL DEFAULT 0,
  confidence       REAL NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Migrate any existing dev data
INSERT INTO user_governance_profiles_new (user_id, wallet_address, pca_coordinates, alignment_scores, personality_label, votes_used, confidence, updated_at)
  SELECT u.id, ugp.wallet_address, ugp.pca_coordinates, ugp.alignment_scores, ugp.personality_label, ugp.votes_used, ugp.confidence, ugp.updated_at
  FROM user_governance_profiles ugp
  JOIN users u ON u.wallet_address = ugp.wallet_address;

DROP TABLE IF EXISTS user_governance_profiles;
ALTER TABLE user_governance_profiles_new RENAME TO user_governance_profiles;

CREATE INDEX IF NOT EXISTS idx_user_gov_profiles_updated
  ON user_governance_profiles (updated_at DESC);

-- 3e. user_governance_profile_history — replace wallet_address in composite PK
CREATE TABLE IF NOT EXISTS user_governance_profile_history_new (
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address   TEXT,                  -- kept for reference
  snapshot_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  pca_coordinates  REAL[],
  alignment_scores JSONB,
  personality_label TEXT,
  votes_used       INTEGER CHECK (votes_used >= 0),
  confidence       REAL CHECK (confidence BETWEEN 0 AND 1),
  PRIMARY KEY (user_id, snapshot_at)
);

INSERT INTO user_governance_profile_history_new (user_id, wallet_address, snapshot_at, pca_coordinates, alignment_scores, personality_label, votes_used, confidence)
  SELECT u.id, ugph.wallet_address, ugph.snapshot_at, ugph.pca_coordinates, ugph.alignment_scores, ugph.personality_label, ugph.votes_used, ugph.confidence
  FROM user_governance_profile_history ugph
  JOIN users u ON u.wallet_address = ugph.wallet_address;

DROP TABLE IF EXISTS user_governance_profile_history;
ALTER TABLE user_governance_profile_history_new RENAME TO user_governance_profile_history;

ALTER TABLE user_governance_profile_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY ugph_owner_read ON user_governance_profile_history FOR SELECT USING (true);
CREATE POLICY ugph_service_insert ON user_governance_profile_history FOR INSERT WITH CHECK (true);
CREATE INDEX idx_ugph_user ON user_governance_profile_history(user_id);

-- 3f. notification_preferences — add user_id alongside user_wallet
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- 3g. user_channels — add user_id alongside user_wallet
ALTER TABLE user_channels ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_user_channels_user ON user_channels(user_id);

-- 3h. notification_log — add user_id alongside user_wallet
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);

-- 3i. revoked_sessions — add user_id alongside wallet_address
ALTER TABLE revoked_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 3j. admin_audit_log — add user_id alongside wallet_address
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. Drop `connected_wallets` from users (replaced by user_wallets table)
-- ============================================================================

ALTER TABLE users DROP COLUMN IF EXISTS connected_wallets;

COMMIT;
