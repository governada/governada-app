-- Session 10: Engagement Engine
-- Adds email support columns, governance briefs table

-- Email support on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_frequency TEXT DEFAULT 'weekly'
  CHECK (digest_frequency IN ('weekly', 'biweekly', 'monthly', 'off'));

-- Governance briefs storage
CREATE TABLE IF NOT EXISTS governance_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  brief_type TEXT NOT NULL CHECK (brief_type IN ('drep', 'holder')),
  content_json JSONB NOT NULL,
  rendered_html TEXT,
  epoch INT,
  delivered_channels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefs_wallet ON governance_briefs(wallet_address);
CREATE INDEX IF NOT EXISTS idx_briefs_created ON governance_briefs(created_at DESC);

-- RLS for governance_briefs
ALTER TABLE governance_briefs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'governance_briefs' AND policyname = 'service_role_full_access_briefs'
  ) THEN
    CREATE POLICY service_role_full_access_briefs ON governance_briefs FOR ALL
      USING (current_setting('role') = 'service_role');
  END IF;
END
$$;
