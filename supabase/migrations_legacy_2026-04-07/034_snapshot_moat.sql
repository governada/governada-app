-- Historical Snapshot Data Moat — 7 new tables + existing table hardening.
-- All new tables: append-only, epoch/date-keyed, NOT NULL + CHECK on metrics,
-- RLS: public read + service_role insert only (no UPDATE/DELETE = immutable).

-- ============================================================================
-- TIER 1: High urgency — data disappears if not captured
-- ============================================================================

-- 1. Inter-body alignment snapshots (epoch-level, per proposal)
CREATE TABLE IF NOT EXISTS inter_body_alignment_snapshots (
  epoch integer NOT NULL,
  proposal_tx_hash text NOT NULL,
  proposal_index integer NOT NULL,
  drep_yes_pct real NOT NULL CHECK (drep_yes_pct BETWEEN 0 AND 100),
  drep_no_pct real NOT NULL CHECK (drep_no_pct BETWEEN 0 AND 100),
  drep_total integer NOT NULL CHECK (drep_total >= 0),
  spo_yes_pct real NOT NULL CHECK (spo_yes_pct BETWEEN 0 AND 100),
  spo_no_pct real NOT NULL CHECK (spo_no_pct BETWEEN 0 AND 100),
  spo_total integer NOT NULL CHECK (spo_total >= 0),
  cc_yes_pct real NOT NULL CHECK (cc_yes_pct BETWEEN 0 AND 100),
  cc_no_pct real NOT NULL CHECK (cc_no_pct BETWEEN 0 AND 100),
  cc_total integer NOT NULL CHECK (cc_total >= 0),
  alignment_score real NOT NULL CHECK (alignment_score BETWEEN 0 AND 100),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epoch, proposal_tx_hash, proposal_index)
);

ALTER TABLE inter_body_alignment_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY ibas_public_read ON inter_body_alignment_snapshots FOR SELECT USING (true);
CREATE POLICY ibas_service_insert ON inter_body_alignment_snapshots FOR INSERT WITH CHECK (true);

CREATE INDEX idx_ibas_proposal ON inter_body_alignment_snapshots(proposal_tx_hash, proposal_index);

-- 2. Proposal vote snapshots (epoch-level accumulation curve)
CREATE TABLE IF NOT EXISTS proposal_vote_snapshots (
  epoch integer NOT NULL,
  proposal_tx_hash text NOT NULL,
  proposal_index integer NOT NULL,
  drep_yes_count integer NOT NULL CHECK (drep_yes_count >= 0),
  drep_no_count integer NOT NULL CHECK (drep_no_count >= 0),
  drep_abstain_count integer NOT NULL CHECK (drep_abstain_count >= 0),
  drep_yes_power bigint NOT NULL DEFAULT 0 CHECK (drep_yes_power >= 0),
  drep_no_power bigint NOT NULL DEFAULT 0 CHECK (drep_no_power >= 0),
  spo_yes_count integer NOT NULL CHECK (spo_yes_count >= 0),
  spo_no_count integer NOT NULL CHECK (spo_no_count >= 0),
  spo_abstain_count integer NOT NULL CHECK (spo_abstain_count >= 0),
  cc_yes_count integer NOT NULL CHECK (cc_yes_count >= 0),
  cc_no_count integer NOT NULL CHECK (cc_no_count >= 0),
  cc_abstain_count integer NOT NULL CHECK (cc_abstain_count >= 0),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epoch, proposal_tx_hash, proposal_index)
);

ALTER TABLE proposal_vote_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY pvs_public_read ON proposal_vote_snapshots FOR SELECT USING (true);
CREATE POLICY pvs_service_insert ON proposal_vote_snapshots FOR INSERT WITH CHECK (true);

CREATE INDEX idx_pvs_proposal ON proposal_vote_snapshots(proposal_tx_hash, proposal_index);

-- 3. Treasury health snapshots (computed health score per epoch)
CREATE TABLE IF NOT EXISTS treasury_health_snapshots (
  epoch integer PRIMARY KEY,
  health_score integer NOT NULL CHECK (health_score BETWEEN 0 AND 100),
  balance_trend integer NOT NULL CHECK (balance_trend BETWEEN 0 AND 100),
  withdrawal_velocity integer NOT NULL CHECK (withdrawal_velocity BETWEEN 0 AND 100),
  income_stability integer NOT NULL CHECK (income_stability BETWEEN 0 AND 100),
  pending_load integer NOT NULL CHECK (pending_load BETWEEN 0 AND 100),
  runway_adequacy integer NOT NULL CHECK (runway_adequacy BETWEEN 0 AND 100),
  runway_months integer NOT NULL CHECK (runway_months >= 0),
  burn_rate_per_epoch integer NOT NULL CHECK (burn_rate_per_epoch >= 0),
  pending_count integer NOT NULL CHECK (pending_count >= 0),
  pending_total_ada bigint NOT NULL CHECK (pending_total_ada >= 0),
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE treasury_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY ths_public_read ON treasury_health_snapshots FOR SELECT USING (true);
CREATE POLICY ths_service_insert ON treasury_health_snapshots FOR INSERT WITH CHECK (true);

-- ============================================================================
-- TIER 2: High value — enriches existing history
-- ============================================================================

-- 5. Classification history (preserves old vectors when reclassified)
CREATE TABLE IF NOT EXISTS classification_history (
  proposal_tx_hash text NOT NULL,
  proposal_index integer NOT NULL,
  classified_at timestamptz NOT NULL DEFAULT now(),
  dim_treasury_conservative real NOT NULL CHECK (dim_treasury_conservative BETWEEN 0 AND 1),
  dim_treasury_growth real NOT NULL CHECK (dim_treasury_growth BETWEEN 0 AND 1),
  dim_decentralization real NOT NULL CHECK (dim_decentralization BETWEEN 0 AND 1),
  dim_security real NOT NULL CHECK (dim_security BETWEEN 0 AND 1),
  dim_innovation real NOT NULL CHECK (dim_innovation BETWEEN 0 AND 1),
  dim_transparency real NOT NULL CHECK (dim_transparency BETWEEN 0 AND 1),
  classifier_version text NOT NULL DEFAULT 'v1',
  PRIMARY KEY (proposal_tx_hash, proposal_index, classified_at)
);

ALTER TABLE classification_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY ch_public_read ON classification_history FOR SELECT USING (true);
CREATE POLICY ch_service_insert ON classification_history FOR INSERT WITH CHECK (true);

CREATE INDEX idx_ch_proposal ON classification_history(proposal_tx_hash, proposal_index);

-- 6. Delegation snapshots (per-DRep delegation metrics per epoch)
CREATE TABLE IF NOT EXISTS delegation_snapshots (
  epoch integer NOT NULL,
  drep_id text NOT NULL,
  delegator_count integer NOT NULL CHECK (delegator_count >= 0),
  total_power_lovelace bigint NOT NULL CHECK (total_power_lovelace >= 0),
  top_10_delegator_pct real CHECK (top_10_delegator_pct BETWEEN 0 AND 100),
  new_delegators integer CHECK (new_delegators >= 0),
  lost_delegators integer CHECK (lost_delegators >= 0),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epoch, drep_id)
);

ALTER TABLE delegation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY ds_public_read ON delegation_snapshots FOR SELECT USING (true);
CREATE POLICY ds_service_insert ON delegation_snapshots FOR INSERT WITH CHECK (true);

CREATE INDEX idx_ds_drep ON delegation_snapshots(drep_id);

-- ============================================================================
-- TIER 3: Nice-to-have — deepens analysis
-- ============================================================================

-- 7. Governance participation snapshots (system-wide per epoch)
CREATE TABLE IF NOT EXISTS governance_participation_snapshots (
  epoch integer PRIMARY KEY,
  active_drep_count integer NOT NULL CHECK (active_drep_count >= 0),
  total_drep_count integer NOT NULL CHECK (total_drep_count >= 0),
  participation_rate real NOT NULL CHECK (participation_rate BETWEEN 0 AND 100),
  avg_vote_delay_epochs real CHECK (avg_vote_delay_epochs >= 0),
  rationale_rate real CHECK (rationale_rate BETWEEN 0 AND 100),
  avg_rationale_length integer CHECK (avg_rationale_length >= 0),
  total_voting_power_lovelace bigint CHECK (total_voting_power_lovelace >= 0),
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE governance_participation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY gps_public_read ON governance_participation_snapshots FOR SELECT USING (true);
CREATE POLICY gps_service_insert ON governance_participation_snapshots FOR INSERT WITH CHECK (true);

-- 8. User governance profile history (preserves identity evolution)
CREATE TABLE IF NOT EXISTS user_governance_profile_history (
  wallet_address text NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  pca_coordinates real[],
  alignment_scores jsonb,
  personality_label text,
  votes_used integer CHECK (votes_used >= 0),
  confidence real CHECK (confidence BETWEEN 0 AND 1),
  PRIMARY KEY (wallet_address, snapshot_at)
);

ALTER TABLE user_governance_profile_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY ugph_owner_read ON user_governance_profile_history
  FOR SELECT USING (true);
CREATE POLICY ugph_service_insert ON user_governance_profile_history
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_ugph_wallet ON user_governance_profile_history(wallet_address);

-- ============================================================================
-- EXTEND sync_log CHECK for new snapshot sync types
-- ============================================================================
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks',
    'spo_votes', 'cc_votes', 'alignment_cache', 'similarity_cache', 'epoch_recaps',
    'snapshot_backfill'
  ));

-- ============================================================================
-- RETROFIT: Add CHECK constraints to existing snapshot tables
-- ============================================================================

-- treasury_snapshots: ensure non-negative balances
ALTER TABLE treasury_snapshots
  ADD CONSTRAINT ck_ts_balance CHECK (balance_lovelace::bigint >= 0),
  ADD CONSTRAINT ck_ts_reserves CHECK (reserves_lovelace::bigint >= 0);

-- integrity_snapshots: ensure percentage ranges
ALTER TABLE integrity_snapshots
  ADD CONSTRAINT ck_is_vote_power CHECK (vote_power_coverage_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT ck_is_canonical CHECK (canonical_summary_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT ck_is_ai_proposal CHECK (ai_proposal_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT ck_is_ai_rationale CHECK (ai_rationale_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT ck_is_hash_mismatch CHECK (hash_mismatch_rate_pct BETWEEN 0 AND 100);

-- drep_power_snapshots: ensure non-negative power
ALTER TABLE drep_power_snapshots
  ADD CONSTRAINT ck_dps_power CHECK (amount_lovelace >= 0);
