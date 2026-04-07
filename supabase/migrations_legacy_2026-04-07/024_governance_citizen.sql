-- Session 6: Governance Citizen Experience
-- Tables for governance events timeline and stats tracking

BEGIN;

-- =============================================
-- 1. Governance stats (singleton row for epoch tracking)
-- =============================================

CREATE TABLE IF NOT EXISTS governance_stats (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_epoch INT NOT NULL DEFAULT 0,
  epoch_end_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO governance_stats (id, current_epoch) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 2. Governance events (per-user timeline)
-- =============================================

CREATE TABLE IF NOT EXISTS governance_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  related_drep_id TEXT,
  epoch INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_events_wallet ON governance_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_governance_events_type ON governance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_governance_events_epoch ON governance_events(epoch);
CREATE INDEX IF NOT EXISTS idx_governance_events_wallet_created ON governance_events(wallet_address, created_at DESC);

-- =============================================
-- 3. Users table additions for citizen features
-- =============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;

-- =============================================
-- 4. RLS policies
-- =============================================

ALTER TABLE governance_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON governance_stats FOR SELECT USING (true);
CREATE POLICY "Service role only" ON governance_stats FOR ALL USING (false);

CREATE POLICY "Public read access" ON governance_events FOR SELECT USING (true);
CREATE POLICY "Service role only" ON governance_events FOR ALL USING (false);

COMMIT;
