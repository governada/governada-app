-- User governance profiles for progressive matching.
-- Updated after every poll vote and quiz completion.

CREATE TABLE IF NOT EXISTS user_governance_profiles (
  wallet_address   TEXT PRIMARY KEY,
  pca_coordinates  REAL[],
  alignment_scores JSONB,
  personality_label TEXT,
  votes_used       INTEGER NOT NULL DEFAULT 0,
  confidence       REAL NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_gov_profiles_updated
  ON user_governance_profiles (updated_at DESC);
