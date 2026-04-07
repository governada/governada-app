-- Governance Tuner: depth level for notification configuration
-- Users choose how closely they follow governance (hands_off, informed, engaged, deep)

-- Add governance_depth column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS governance_depth text
  NOT NULL DEFAULT 'informed'
  CHECK (governance_depth IN ('hands_off', 'informed', 'engaged', 'deep'));

-- Entity subscriptions for inline "Watch" buttons on DRep/proposal pages
CREATE TABLE IF NOT EXISTS user_entity_subscriptions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('drep', 'spo', 'proposal', 'cc_member')),
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_type, entity_id)
);

-- RLS: users can only manage their own subscriptions
ALTER TABLE user_entity_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entity subscriptions"
  ON user_entity_subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own entity subscriptions"
  ON user_entity_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own entity subscriptions"
  ON user_entity_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- Service role bypass (for Inngest functions / sync jobs)
CREATE POLICY "Service role full access to entity subscriptions"
  ON user_entity_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_entity_subs_user ON user_entity_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_subs_entity ON user_entity_subscriptions(entity_type, entity_id);

-- Backfill: set appropriate defaults based on existing wallet segments
-- DReps get 'deep' (full control), SPOs get 'engaged', citizens stay at 'informed' default
UPDATE users SET governance_depth = 'deep'
WHERE id IN (
  SELECT DISTINCT user_id FROM user_wallets WHERE 'drep' = ANY(segments)
);

UPDATE users SET governance_depth = 'engaged'
WHERE id IN (
  SELECT DISTINCT user_id FROM user_wallets WHERE 'spo' = ANY(segments)
)
AND governance_depth = 'informed';  -- Don't downgrade DReps who are also SPOs
