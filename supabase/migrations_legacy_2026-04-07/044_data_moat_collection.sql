-- Data Moat Collection: New tables for historical data that compounds over time
-- and becomes impossible for competitors to replicate.

-- =============================================================================
-- 1. DRep Delegator Snapshots (per-epoch delegation distribution)
-- The single highest-value missing dataset. Enables delegation network analysis,
-- whale detection, concentration metrics, and migration tracking.
-- =============================================================================

CREATE TABLE IF NOT EXISTS drep_delegator_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  drep_id TEXT NOT NULL,
  epoch_no INTEGER NOT NULL,
  stake_address TEXT NOT NULL,
  amount_lovelace BIGINT NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_drep_delegator_snapshot UNIQUE (drep_id, epoch_no, stake_address)
);

COMMENT ON TABLE drep_delegator_snapshots IS 'Per-epoch snapshot of individual delegators per DRep. Enables delegation concentration, migration tracking, and network graph analysis.';

CREATE INDEX IF NOT EXISTS idx_drep_deleg_snap_drep_epoch ON drep_delegator_snapshots(drep_id, epoch_no);
CREATE INDEX IF NOT EXISTS idx_drep_deleg_snap_epoch ON drep_delegator_snapshots(epoch_no);
CREATE INDEX IF NOT EXISTS idx_drep_deleg_snap_stake ON drep_delegator_snapshots(stake_address);

-- =============================================================================
-- 2. DRep Lifecycle Events (registration, updates, retirements)
-- Tracks the full biography of every DRep: when they registered, changed
-- metadata, retired, re-registered. Enables tenure analysis, churn detection,
-- and identity evolution tracking.
-- =============================================================================

CREATE TABLE IF NOT EXISTS drep_lifecycle_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  drep_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('registration', 'update', 'deregistration')),
  tx_hash TEXT NOT NULL,
  epoch_no INTEGER NOT NULL,
  block_time INTEGER,
  deposit TEXT,
  anchor_url TEXT,
  anchor_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_drep_lifecycle_event UNIQUE (drep_id, tx_hash)
);

COMMENT ON TABLE drep_lifecycle_events IS 'Full DRep lifecycle: registrations, metadata updates, retirements. Enables tenure calculation, churn analysis, and metadata evolution tracking.';

CREATE INDEX IF NOT EXISTS idx_drep_lifecycle_drep ON drep_lifecycle_events(drep_id, epoch_no);
CREATE INDEX IF NOT EXISTS idx_drep_lifecycle_action ON drep_lifecycle_events(action, epoch_no);

-- =============================================================================
-- 3. Epoch Governance Summaries (aggregate per-epoch stats from Koios)
-- System-level metrics: DRep count, total voting power, participation.
-- Enables governance growth curves and maturity tracking.
-- =============================================================================

CREATE TABLE IF NOT EXISTS epoch_governance_summaries (
  epoch_no INTEGER PRIMARY KEY,
  total_dreps INTEGER,
  active_dreps INTEGER,
  total_voting_power_lovelace BIGINT,
  total_proposals INTEGER,
  total_votes INTEGER,
  block_count INTEGER,
  tx_count INTEGER,
  fees_lovelace BIGINT,
  active_stake_lovelace BIGINT,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE epoch_governance_summaries IS 'Per-epoch aggregate governance stats. Tracks ecosystem growth, DRep participation trends, and chain activity context.';

-- =============================================================================
-- 4. Committee Members (CC membership, terms, expiration)
-- Small table tracking Constitutional Committee composition over time.
-- =============================================================================

CREATE TABLE IF NOT EXISTS committee_members (
  cc_hot_id TEXT NOT NULL,
  cc_cold_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_epoch INTEGER,
  expiration_epoch INTEGER,
  anchor_url TEXT,
  anchor_hash TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_committee_members PRIMARY KEY (cc_hot_id)
);

COMMENT ON TABLE committee_members IS 'Constitutional Committee membership and terms. Tracks committee composition, turnover, and term expiration.';

CREATE INDEX IF NOT EXISTS idx_cc_members_status ON committee_members(status);

-- =============================================================================
-- 5. Metadata Archive (persistent CIP-119/108/136 metadata blobs)
-- Off-chain metadata is ephemeral: IPFS links rot, servers go down.
-- This table persistently archives the raw metadata JSON so we have the
-- only historical record of what DReps said and how CC members voted.
-- =============================================================================

CREATE TABLE IF NOT EXISTS metadata_archive (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('drep', 'proposal', 'vote_rationale', 'cc_rationale')),
  entity_id TEXT NOT NULL,
  meta_url TEXT,
  meta_hash TEXT,
  meta_json JSONB,
  cip_standard TEXT CHECK (cip_standard IN ('CIP-100', 'CIP-108', 'CIP-119', 'CIP-136', 'unknown')),
  fetch_status TEXT NOT NULL DEFAULT 'success' CHECK (fetch_status IN ('success', 'hash_mismatch', 'fetch_error', 'decode_error', 'timeout')),
  content_hash TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_metadata_archive UNIQUE (entity_type, entity_id, content_hash)
);

COMMENT ON TABLE metadata_archive IS 'Persistent archive of off-chain governance metadata (CIP-119 DRep profiles, CIP-108 proposals, CIP-136 CC rationales). Off-chain data disappears; this is the permanent record.';

CREATE INDEX IF NOT EXISTS idx_metadata_archive_entity ON metadata_archive(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_metadata_archive_fetched ON metadata_archive(fetched_at);
CREATE INDEX IF NOT EXISTS idx_metadata_archive_cip ON metadata_archive(cip_standard);

-- =============================================================================
-- 6. Extend sync_log CHECK constraint for new sync types
-- =============================================================================

ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks', 'spo_scores', 'spo_votes', 'cc_votes',
    'data_moat', 'delegator_snapshots', 'drep_lifecycle', 'epoch_summaries',
    'committee_sync', 'metadata_archive', 'governance_epoch_stats'
  ));

-- =============================================================================
-- 7. Snapshot completeness tracking for new types
-- =============================================================================

-- Ensure snapshot_completeness_log can track new snapshot types
-- (no schema change needed, just documenting the new types we'll write:
--   'delegator_snapshots', 'drep_lifecycle', 'epoch_governance_summary',
--   'committee_members', 'metadata_archive')

-- =============================================================================
-- 8. RLS Policies (read-only for anon, matching existing pattern)
-- =============================================================================

ALTER TABLE drep_delegator_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE drep_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE epoch_governance_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON drep_delegator_snapshots FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON drep_lifecycle_events FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON epoch_governance_summaries FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON committee_members FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON metadata_archive FOR SELECT USING (true);
