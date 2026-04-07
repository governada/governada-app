-- Catalyst (Project Catalyst) data collection
-- Historical treasury funding data: proposals, funds, campaigns, teams.
-- ~11,385 proposals across 14 fund rounds since 2020.

-- =============================================================================
-- 1. Catalyst Funds (14 funding rounds)
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalyst_funds (
  id TEXT PRIMARY KEY,                    -- UUID from Catalyst Explorer API
  title TEXT NOT NULL,
  slug TEXT,
  status TEXT,                            -- governance, awarded, etc.
  currency TEXT DEFAULT 'ADA',
  currency_symbol TEXT DEFAULT '₳',
  amount BIGINT,                          -- total fund amount
  launched_at TIMESTAMPTZ,
  awarded_at TIMESTAMPTZ,
  hero_img_url TEXT,
  banner_img_url TEXT,
  proposals_count INTEGER DEFAULT 0,
  funded_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE catalyst_funds IS 'Project Catalyst funding rounds (Fund 2-15). Historical treasury allocation data.';

-- =============================================================================
-- 2. Catalyst Campaigns (challenges within each fund)
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalyst_campaigns (
  id TEXT PRIMARY KEY,                    -- UUID from Catalyst Explorer API
  fund_id TEXT REFERENCES catalyst_funds(id),
  title TEXT NOT NULL,
  slug TEXT,
  excerpt TEXT,
  amount BIGINT,                          -- challenge budget
  launched_at TIMESTAMPTZ,
  awarded_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE catalyst_campaigns IS 'Challenge categories within each Catalyst fund round.';

CREATE INDEX IF NOT EXISTS idx_catalyst_campaigns_fund ON catalyst_campaigns(fund_id);

-- =============================================================================
-- 3. Catalyst Proposals (~11,385 proposals)
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalyst_proposals (
  id TEXT PRIMARY KEY,                    -- UUID from Catalyst Explorer API
  fund_id TEXT REFERENCES catalyst_funds(id),
  campaign_id TEXT REFERENCES catalyst_campaigns(id),
  title TEXT NOT NULL,
  slug TEXT,
  status TEXT,                            -- complete, unfunded, in_progress, etc.
  funding_status TEXT,                    -- funded, over_budget, etc.
  -- Voting
  yes_votes_count BIGINT,
  no_votes_count BIGINT,
  abstain_votes_count BIGINT,
  unique_wallets INTEGER,
  yes_wallets INTEGER,
  no_wallets INTEGER,
  -- Funding
  amount_requested BIGINT,
  amount_received BIGINT,
  currency TEXT DEFAULT 'USD',
  -- Content
  problem TEXT,
  solution TEXT,
  experience TEXT,
  project_details JSONB,
  -- Scores
  alignment_score REAL,
  feasibility_score REAL,
  auditability_score REAL,
  -- Metadata
  website TEXT,
  opensource BOOLEAN DEFAULT false,
  project_length TEXT,
  funded_at TIMESTAMPTZ,
  link TEXT,                              -- Catalyst Explorer URL
  chain_proposal_id TEXT,                 -- on-chain proposal ID (Fund 14+)
  chain_proposal_index INTEGER,
  ideascale_id TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE catalyst_proposals IS 'All Project Catalyst proposals across all fund rounds. Enables treasury spending analysis, team track records, and funding pattern intelligence.';

CREATE INDEX IF NOT EXISTS idx_catalyst_proposals_fund ON catalyst_proposals(fund_id);
CREATE INDEX IF NOT EXISTS idx_catalyst_proposals_campaign ON catalyst_proposals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_catalyst_proposals_status ON catalyst_proposals(status, funding_status);
CREATE INDEX IF NOT EXISTS idx_catalyst_proposals_funded_at ON catalyst_proposals(funded_at);
CREATE INDEX IF NOT EXISTS idx_catalyst_proposals_chain ON catalyst_proposals(chain_proposal_id) WHERE chain_proposal_id IS NOT NULL;

-- =============================================================================
-- 4. Catalyst Team Members (proposers/builders)
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalyst_team_members (
  id TEXT PRIMARY KEY,                    -- UUID from Catalyst Explorer API
  username TEXT,
  name TEXT,
  bio TEXT,
  twitter TEXT,
  linkedin TEXT,
  discord TEXT,
  ideascale TEXT,
  telegram TEXT,
  hero_img_url TEXT,
  submitted_proposals INTEGER DEFAULT 0,
  funded_proposals INTEGER DEFAULT 0,
  completed_proposals INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE catalyst_team_members IS 'Catalyst proposers and team members. Enables builder reputation and track record analysis.';

CREATE INDEX IF NOT EXISTS idx_catalyst_team_name ON catalyst_team_members(name);

-- =============================================================================
-- 5. Proposal-Team junction (many-to-many)
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalyst_proposal_team (
  proposal_id TEXT NOT NULL REFERENCES catalyst_proposals(id) ON DELETE CASCADE,
  team_member_id TEXT NOT NULL REFERENCES catalyst_team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (proposal_id, team_member_id)
);

COMMENT ON TABLE catalyst_proposal_team IS 'Junction table linking proposals to their team members.';

CREATE INDEX IF NOT EXISTS idx_catalyst_pt_team ON catalyst_proposal_team(team_member_id);

-- =============================================================================
-- 6. Extend sync_log CHECK constraint for catalyst sync types
-- =============================================================================

ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks', 'spo_scores', 'spo_votes', 'cc_votes',
    'data_moat', 'delegator_snapshots', 'drep_lifecycle', 'epoch_summaries',
    'committee_sync', 'metadata_archive', 'governance_epoch_stats',
    'catalyst', 'catalyst_proposals', 'catalyst_funds'
  ));

-- =============================================================================
-- 7. RLS Policies
-- =============================================================================

ALTER TABLE catalyst_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalyst_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalyst_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalyst_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalyst_proposal_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON catalyst_funds FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON catalyst_campaigns FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON catalyst_proposals FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON catalyst_team_members FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON catalyst_proposal_team FOR SELECT USING (true);
