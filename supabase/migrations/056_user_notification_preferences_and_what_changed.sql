-- User notification preferences for digest/email opt-in
-- This is separate from the per-event notification_preferences table.
-- It stores email for notifications (NOT auth) and digest frequency.
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  digest_frequency TEXT NOT NULL DEFAULT 'none' CHECK (digest_frequency IN ('epoch', 'weekly', 'major_only', 'none')),
  alert_drep_voted BOOLEAN NOT NULL DEFAULT TRUE,
  alert_coverage_changed BOOLEAN NOT NULL DEFAULT TRUE,
  alert_score_shifted BOOLEAN NOT NULL DEFAULT TRUE,
  alert_milestone_earned BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can read own notification preferences"
  ON user_notification_preferences FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own preferences
CREATE POLICY "Users can insert own notification preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
  ON user_notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- Service role bypass (for Inngest functions)
CREATE POLICY "Service role full access to notification preferences"
  ON user_notification_preferences FOR ALL
  USING (auth.role() = 'service_role');

-- Track proposal outcomes for citizen follow-ups
CREATE TABLE IF NOT EXISTS citizen_proposal_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  sentiment TEXT NOT NULL,
  outcome TEXT, -- 'ratified' | 'expired' | 'dropped'
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citizen_proposal_followups_user
  ON citizen_proposal_followups(user_id);
CREATE INDEX IF NOT EXISTS idx_citizen_proposal_followups_proposal
  ON citizen_proposal_followups(proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_citizen_proposal_followups_pending
  ON citizen_proposal_followups(notified) WHERE notified = FALSE;

ALTER TABLE citizen_proposal_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own proposal followups"
  ON citizen_proposal_followups FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access to citizen proposal followups"
  ON citizen_proposal_followups FOR ALL
  USING (auth.role() = 'service_role');
