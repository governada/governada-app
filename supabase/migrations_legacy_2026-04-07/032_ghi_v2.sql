-- GHI v2: Decentralization snapshots table + circulating supply in governance_stats
-- + ghi_snapshots table (was missing a migration — code already uses it)

-- 1. Ensure ghi_snapshots exists (was created ad-hoc, now formalized)
CREATE TABLE IF NOT EXISTS ghi_snapshots (
  epoch_no INTEGER PRIMARY KEY,
  score INTEGER NOT NULL,
  band TEXT NOT NULL CHECK (band IN ('critical', 'fair', 'good', 'strong')),
  components JSONB NOT NULL DEFAULT '[]',
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Decentralization snapshots — one row per epoch, stores all 7 EDI metrics
CREATE TABLE IF NOT EXISTS decentralization_snapshots (
  epoch_no INTEGER PRIMARY KEY,
  composite_score INTEGER NOT NULL,
  nakamoto_coefficient INTEGER NOT NULL,
  gini REAL NOT NULL,
  shannon_entropy REAL NOT NULL,
  hhi INTEGER NOT NULL,
  theil_index REAL NOT NULL,
  concentration_ratio REAL NOT NULL,
  tau_decentralization INTEGER NOT NULL,
  total_delegated_ada BIGINT,
  active_drep_count INTEGER,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add circulating supply column to governance_stats
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'governance_stats' AND column_name = 'circulating_supply_lovelace'
  ) THEN
    ALTER TABLE governance_stats ADD COLUMN circulating_supply_lovelace BIGINT;
  END IF;
END $$;

-- 4. Seed the ghi_citizen_engagement feature flag (default OFF)
INSERT INTO feature_flags (key, enabled, description, category)
VALUES ('ghi_citizen_engagement', false, 'Enable Citizen Engagement component in GHI (requires 5+ epochs of delegator snapshots)', 'governance')
ON CONFLICT (key) DO NOTHING;

-- 5. RLS policies
ALTER TABLE ghi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE decentralization_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ghi_snapshots' AND policyname = 'ghi_snapshots_public_read') THEN
    CREATE POLICY ghi_snapshots_public_read ON ghi_snapshots FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decentralization_snapshots' AND policyname = 'decentral_snapshots_public_read') THEN
    CREATE POLICY decentral_snapshots_public_read ON decentralization_snapshots FOR SELECT USING (true);
  END IF;
END $$;
