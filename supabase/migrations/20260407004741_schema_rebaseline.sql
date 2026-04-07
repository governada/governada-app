-- Rebaseline assembled on 2026-04-07 from the archived pre-rebaseline migration set.
-- This file replaces the old active migration lineage after repairing remote history drift.
-- Source files remain in supabase/migrations_legacy_2026-04-07 for reference only.

-- BEGIN 001_score_v2.sql
-- DRep Score V2 Migration
-- Run this in the Supabase SQL Editor to add the new scoring infrastructure.

-- 1. Add profile_completeness column to dreps table
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS profile_completeness integer DEFAULT 0;

-- 2. Create drep_score_history table for tracking score changes over time
CREATE TABLE IF NOT EXISTS drep_score_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  drep_id text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  effective_participation integer NOT NULL DEFAULT 0,
  rationale_rate integer NOT NULL DEFAULT 0,
  consistency_score integer NOT NULL DEFAULT 0,
  profile_completeness integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (drep_id, snapshot_date)
);

-- Indexes for efficient queries on the history table
CREATE INDEX IF NOT EXISTS idx_score_history_drep_id ON drep_score_history (drep_id);
CREATE INDEX IF NOT EXISTS idx_score_history_snapshot_date ON drep_score_history (snapshot_date);

-- Enable RLS (read-only for anon, write via service role)
ALTER TABLE drep_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on drep_score_history"
  ON drep_score_history FOR SELECT
  USING (true);

-- END 001_score_v2.sql

-- BEGIN 002_add_proposals_table.sql
-- Add proposals table for caching classified governance proposals
-- Run this in your Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS proposals (
  tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  proposal_type TEXT NOT NULL,
  title TEXT,
  abstract TEXT,
  withdrawal_amount BIGINT,
  treasury_tier TEXT,
  param_changes JSONB,
  relevant_prefs TEXT[],
  proposed_epoch INTEGER,
  block_time INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tx_hash, proposal_index)
);

-- Index for querying by proposal type
CREATE INDEX IF NOT EXISTS idx_proposals_type ON proposals(proposal_type);

-- Index for querying by treasury tier
CREATE INDEX IF NOT EXISTS idx_proposals_treasury_tier ON proposals(treasury_tier);

-- Index for querying by block time (for recent proposals)
CREATE INDEX IF NOT EXISTS idx_proposals_block_time ON proposals(block_time DESC);

-- Update the dreps table to add new columns for V2 scoring
-- Run these if migrating from V1

ALTER TABLE dreps 
ADD COLUMN IF NOT EXISTS consistency_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deliberation_modifier DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS effective_participation INTEGER DEFAULT 0;

-- Note: decentralization_score column can be dropped if no longer needed
-- ALTER TABLE dreps DROP COLUMN IF EXISTS decentralization_score;

-- END 002_add_proposals_table.sql

-- BEGIN 003_add_vote_rationales.sql
-- Vote Rationales Table
-- Caches rationale text fetched from IPFS/HTTP URLs
-- This allows us to display rationale inline instead of linking to raw URLs

CREATE TABLE IF NOT EXISTS vote_rationales (
  vote_tx_hash TEXT PRIMARY KEY,
  drep_id TEXT NOT NULL,
  proposal_tx_hash TEXT,
  proposal_index INTEGER,
  meta_url TEXT,
  rationale_text TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by DRep (when displaying their voting history)
CREATE INDEX IF NOT EXISTS idx_vote_rationales_drep ON vote_rationales(drep_id);

-- Index for querying by proposal (if we ever want to show all rationales for a proposal)
CREATE INDEX IF NOT EXISTS idx_vote_rationales_proposal ON vote_rationales(proposal_tx_hash, proposal_index);

-- END 003_add_vote_rationales.sql

-- BEGIN 004_add_drep_votes.sql
-- DRep Votes Table
-- Stores individual vote records fetched from Koios during sync
-- Eliminates the need for Koios API calls on profile page loads

CREATE TABLE IF NOT EXISTS drep_votes (
  vote_tx_hash TEXT PRIMARY KEY,
  drep_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('Yes', 'No', 'Abstain')),
  epoch_no INTEGER,
  block_time INTEGER NOT NULL,
  meta_url TEXT,
  meta_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drep_votes_drep ON drep_votes(drep_id);
CREATE INDEX IF NOT EXISTS idx_drep_votes_drep_block_time ON drep_votes(drep_id, block_time DESC);
CREATE INDEX IF NOT EXISTS idx_drep_votes_proposal ON drep_votes(proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_drep_votes_epoch ON drep_votes(epoch_no);

-- END 004_add_drep_votes.sql

-- BEGIN 005_add_ai_summary.sql
-- Add AI summary column to proposals table
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- END 005_add_ai_summary.sql

-- BEGIN 006_add_alignment_scores.sql
-- Add pre-computed per-category alignment scores to dreps table.
-- These are computed during sync from real vote data + classified proposals.
-- Client picks relevant categories based on user preferences and averages them.

ALTER TABLE dreps
  ADD COLUMN IF NOT EXISTS alignment_treasury_conservative INTEGER,
  ADD COLUMN IF NOT EXISTS alignment_treasury_growth INTEGER,
  ADD COLUMN IF NOT EXISTS alignment_decentralization INTEGER,
  ADD COLUMN IF NOT EXISTS alignment_security INTEGER,
  ADD COLUMN IF NOT EXISTS alignment_innovation INTEGER,
  ADD COLUMN IF NOT EXISTS alignment_transparency INTEGER,
  ADD COLUMN IF NOT EXISTS last_vote_time INTEGER;

-- END 006_add_alignment_scores.sql

-- BEGIN 007_add_claimed_drep_id.sql
-- Add claimed_drep_id column to users table for DRep profile claiming
ALTER TABLE users ADD COLUMN IF NOT EXISTS claimed_drep_id text;
CREATE INDEX IF NOT EXISTS idx_users_claimed_drep ON users(claimed_drep_id);

-- END 007_add_claimed_drep_id.sql

-- BEGIN 008_social_link_checks.sql
-- Social link reachability checks
-- Stores HEAD-check results for DRep social/reference links
CREATE TABLE IF NOT EXISTS social_link_checks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  drep_id text NOT NULL,
  uri text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  http_status integer,
  last_checked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(drep_id, uri)
);
CREATE INDEX IF NOT EXISTS idx_social_checks_drep ON social_link_checks(drep_id);

-- END 008_social_link_checks.sql

-- BEGIN 009_reliability_score.sql
-- Rename consistency_score -> reliability_score
-- Part of V3 scoring model: Consistency pillar replaced with Reliability
-- (streak, recency, gap penalty, tenure — orthogonal to participation)

ALTER TABLE dreps RENAME COLUMN consistency_score TO reliability_score;
ALTER TABLE drep_score_history RENAME COLUMN consistency_score TO reliability_score;

-- Store raw reliability component values for dashboard breakdown and hints
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS reliability_streak integer DEFAULT 0;
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS reliability_recency integer DEFAULT 0;
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS reliability_longest_gap integer DEFAULT 0;
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS reliability_tenure integer DEFAULT 0;

-- END 009_reliability_score.sql

-- BEGIN 010_proposal_lifecycle.sql
-- Add lifecycle epoch columns to proposals table
-- Needed to determine which proposals were active in each epoch
-- for accurate reliability scoring and the DRep Dashboard proposal inbox.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS expired_epoch INTEGER;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ratified_epoch INTEGER;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS enacted_epoch INTEGER;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS dropped_epoch INTEGER;

-- END 010_proposal_lifecycle.sql

-- BEGIN 011_add_rationale_ai_summary.sql
-- Add AI summary column to vote_rationales table
ALTER TABLE vote_rationales ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Reset all existing proposal AI summaries so they regenerate with the
-- updated prompt (shorter, 160-char limit).
UPDATE proposals SET ai_summary = NULL WHERE ai_summary IS NOT NULL;

-- END 011_add_rationale_ai_summary.sql

-- BEGIN 012_add_proposal_expiration_epoch.sql
-- Add expiration_epoch to proposals table
-- This is the hard deadline epoch from Koios (proposed_epoch + govActionLifetime).
-- Storing it directly avoids estimating from govActionLifetime, which is a
-- protocol parameter that could change via a ParameterChange governance action.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS expiration_epoch INTEGER;

-- END 012_add_proposal_expiration_epoch.sql

-- BEGIN 013_ensure_push_subscriptions.sql
-- Ensure push_subscriptions column exists on users table.
-- Stores Web Push subscription data (endpoint + VAPID keys) per user.
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscriptions JSONB DEFAULT '{}'::jsonb;

-- Track which notifications have been sent to prevent duplicates.
-- Keyed by notification type + identifier (e.g., proposal tx_hash).
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_push_check TIMESTAMPTZ;

-- END 013_ensure_push_subscriptions.sql

-- BEGIN 014_delegator_polls.sql
-- Delegator sentiment polling: ADA holders vote Yes/No/Abstain on open proposals.
-- Polls are implicit for all open proposals (no separate poll table needed).

CREATE TABLE poll_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  stake_address TEXT,
  delegated_drep_id TEXT,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
  initial_vote TEXT NOT NULL CHECK (initial_vote IN ('yes', 'no', 'abstain')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  vote_count INTEGER DEFAULT 1,
  UNIQUE(proposal_tx_hash, proposal_index, wallet_address)
);

CREATE INDEX idx_poll_responses_proposal
  ON poll_responses(proposal_tx_hash, proposal_index);

CREATE INDEX idx_poll_responses_drep
  ON poll_responses(delegated_drep_id)
  WHERE delegated_drep_id IS NOT NULL;

CREATE INDEX idx_poll_responses_wallet
  ON poll_responses(wallet_address);

-- END 014_delegator_polls.sql

-- BEGIN 015_drep_power_snapshots.sql
-- Historical voting power snapshots per DRep per epoch
-- Enables accurate threshold calculations using power-at-vote-time

CREATE TABLE IF NOT EXISTS drep_power_snapshots (
  drep_id TEXT NOT NULL,
  epoch_no INTEGER NOT NULL,
  amount_lovelace BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (drep_id, epoch_no)
);

CREATE INDEX IF NOT EXISTS idx_power_snapshots_epoch ON drep_power_snapshots(epoch_no);

-- END 015_drep_power_snapshots.sql

-- BEGIN 016_add_vote_power.sql
-- Denormalized voting power on each vote record for fast proposal-level aggregation
ALTER TABLE drep_votes ADD COLUMN IF NOT EXISTS voting_power_lovelace BIGINT;

-- END 016_add_vote_power.sql

-- BEGIN 017_sync_performance_indexes.sql
-- Fast proposal listing (homepage + governance widget)
CREATE INDEX IF NOT EXISTS idx_proposals_open
  ON proposals(block_time DESC)
  WHERE ratified_epoch IS NULL AND enacted_epoch IS NULL
    AND dropped_epoch IS NULL AND expired_epoch IS NULL;

-- Vote aggregation by proposal (ThresholdMeter queries)
CREATE INDEX IF NOT EXISTS idx_drep_votes_proposal_vote
  ON drep_votes(proposal_tx_hash, proposal_index, vote);

-- DRep listing sorted by score
CREATE INDEX IF NOT EXISTS idx_dreps_score
  ON dreps(score DESC);

-- Vote power queries
CREATE INDEX IF NOT EXISTS idx_drep_votes_power_not_null
  ON drep_votes(proposal_tx_hash, proposal_index)
  WHERE voting_power_lovelace IS NOT NULL;

-- Proposed epoch for active epoch calculation
CREATE INDEX IF NOT EXISTS idx_proposals_proposed_epoch
  ON proposals(proposed_epoch);

-- END 017_sync_performance_indexes.sql

-- BEGIN 018_data_integrity.sql
-- 018: Data Integrity Overhaul
-- Canonical proposal tallies, vote completeness, hash verification, power provenance

-- 1. Canonical proposal voting summary (from Koios /proposal_voting_summary)
CREATE TABLE IF NOT EXISTS proposal_voting_summary (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  epoch_no INTEGER NOT NULL,
  drep_yes_votes_cast INTEGER,
  drep_yes_vote_power BIGINT,
  drep_no_votes_cast INTEGER,
  drep_no_vote_power BIGINT,
  drep_abstain_votes_cast INTEGER,
  drep_abstain_vote_power BIGINT,
  drep_always_abstain_power BIGINT,
  drep_always_no_confidence_power BIGINT,
  pool_yes_votes_cast INTEGER,
  pool_yes_vote_power BIGINT,
  pool_no_votes_cast INTEGER,
  pool_no_vote_power BIGINT,
  pool_abstain_votes_cast INTEGER,
  pool_abstain_vote_power BIGINT,
  committee_yes_votes_cast INTEGER,
  committee_no_votes_cast INTEGER,
  committee_abstain_votes_cast INTEGER,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (proposal_tx_hash, proposal_index)
);

-- 2. CIP-129 bech32 proposal ID on proposals table
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS proposal_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_proposal_id
  ON proposals(proposal_id) WHERE proposal_id IS NOT NULL;

-- 3. Rationale hash verification + AI summary on vote_rationales
ALTER TABLE vote_rationales
  ADD COLUMN IF NOT EXISTS hash_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- 4. DRep metadata hash verification
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS metadata_hash_verified BOOLEAN;

-- 5. Per-vote power source tracking
ALTER TABLE drep_votes
  ADD COLUMN IF NOT EXISTS power_source TEXT
  CHECK (power_source IN ('exact', 'nearest'));

UPDATE drep_votes SET power_source = 'exact'
  WHERE voting_power_lovelace IS NOT NULL AND power_source IS NULL;

-- END 018_data_integrity.sql

-- BEGIN 019_data_infra.sql
-- 019: Data Infrastructure
-- Sync logging, analytical views (semantic layer), hash tracking improvements, DRep anchor fields

-- 1. Sync log table for operational monitoring
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('fast', 'full', 'integrity_check')),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_log_type_time ON sync_log(sync_type, started_at DESC);

-- 2. Hash check tracking on vote_rationales
ALTER TABLE vote_rationales
  ADD COLUMN IF NOT EXISTS hash_check_attempted_at TIMESTAMPTZ;

-- 3. DRep anchor fields for metadata hash verification
ALTER TABLE dreps
  ADD COLUMN IF NOT EXISTS anchor_url TEXT,
  ADD COLUMN IF NOT EXISTS anchor_hash TEXT;

-- 4. Analytical views (semantic layer)

CREATE OR REPLACE VIEW v_vote_power_coverage AS
SELECT
  count(*) as total_votes,
  count(voting_power_lovelace) as with_power,
  count(*) FILTER (WHERE voting_power_lovelace IS NULL) as null_power,
  count(*) FILTER (WHERE power_source = 'exact') as exact_count,
  count(*) FILTER (WHERE power_source = 'nearest') as nearest_count,
  CASE WHEN count(*) > 0
    THEN round(count(voting_power_lovelace)::numeric / count(*) * 100, 2)
    ELSE 0 END as coverage_pct
FROM drep_votes;

CREATE OR REPLACE VIEW v_ai_summary_coverage AS
SELECT
  (SELECT count(*) FROM proposals) as total_proposals,
  (SELECT count(*) FROM proposals WHERE ai_summary IS NOT NULL) as proposals_with_summary,
  (SELECT count(*) FROM proposals WHERE abstract IS NOT NULL AND abstract != '') as proposals_with_abstract,
  (SELECT count(*) FROM vote_rationales) as total_rationales,
  (SELECT count(*) FROM vote_rationales WHERE rationale_text IS NOT NULL AND rationale_text != '') as rationales_with_text,
  (SELECT count(*) FROM vote_rationales WHERE ai_summary IS NOT NULL) as rationales_with_summary;

CREATE OR REPLACE VIEW v_hash_verification AS
SELECT
  count(*) FILTER (WHERE hash_verified = true) as rationale_verified,
  count(*) FILTER (WHERE hash_verified = false) as rationale_mismatch,
  count(*) FILTER (WHERE hash_verified IS NULL) as rationale_pending,
  count(*) FILTER (WHERE hash_verified IS NULL AND hash_check_attempted_at IS NOT NULL) as rationale_unreachable,
  CASE WHEN count(*) FILTER (WHERE hash_verified IS NOT NULL) > 0
    THEN round(count(*) FILTER (WHERE hash_verified = false)::numeric
      / count(*) FILTER (WHERE hash_verified IS NOT NULL) * 100, 2)
    ELSE 0 END as mismatch_rate_pct
FROM vote_rationales;

CREATE OR REPLACE VIEW v_metadata_verification AS
SELECT
  count(*) FILTER (WHERE metadata_hash_verified = true) as drep_verified,
  count(*) FILTER (WHERE metadata_hash_verified = false) as drep_mismatch,
  count(*) FILTER (WHERE metadata_hash_verified IS NULL) as drep_pending,
  count(*) FILTER (WHERE anchor_hash IS NOT NULL) as drep_with_anchor_hash
FROM dreps;

CREATE OR REPLACE VIEW v_canonical_summary_coverage AS
SELECT
  (SELECT count(*) FROM proposals) as total_proposals,
  (SELECT count(*) FROM proposals WHERE proposal_id IS NOT NULL) as with_proposal_id,
  (SELECT count(*) FROM proposal_voting_summary) as with_canonical_summary;

CREATE OR REPLACE VIEW v_sync_health AS
SELECT
  s1.sync_type,
  max(s1.started_at) as last_run,
  max(s1.finished_at) as last_finished,
  (SELECT duration_ms FROM sync_log s2
    WHERE s2.sync_type = s1.sync_type ORDER BY s2.started_at DESC LIMIT 1) as last_duration_ms,
  (SELECT success FROM sync_log s2
    WHERE s2.sync_type = s1.sync_type ORDER BY s2.started_at DESC LIMIT 1) as last_success,
  (SELECT error_message FROM sync_log s2
    WHERE s2.sync_type = s1.sync_type ORDER BY s2.started_at DESC LIMIT 1) as last_error,
  count(*) FILTER (WHERE s1.success = true) as success_count,
  count(*) FILTER (WHERE s1.success = false) as failure_count
FROM sync_log s1
GROUP BY s1.sync_type;

CREATE OR REPLACE VIEW v_system_stats AS
SELECT
  (SELECT count(*) FROM dreps) as total_dreps,
  (SELECT count(*) FROM drep_votes) as total_votes,
  (SELECT count(*) FROM proposals) as total_proposals,
  (SELECT count(*) FROM vote_rationales) as total_rationales,
  (SELECT count(*) FROM drep_power_snapshots) as total_power_snapshots,
  (SELECT count(DISTINCT drep_id) FROM drep_power_snapshots) as dreps_with_snapshots,
  (SELECT max(block_time) FROM drep_votes) as newest_vote_time,
  (SELECT max(fetched_at) FROM proposal_voting_summary) as newest_summary_fetch;

-- END 019_data_infra.sql

-- BEGIN 020_integrity_snapshots.sql
-- 020: Integrity Snapshots
-- Daily metric snapshots for KPI trend comparison on the data integrity dashboard.

CREATE TABLE IF NOT EXISTS integrity_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  vote_power_coverage_pct NUMERIC(5,2),
  canonical_summary_pct NUMERIC(5,2),
  ai_proposal_pct NUMERIC(5,2),
  ai_rationale_pct NUMERIC(5,2),
  hash_mismatch_rate_pct NUMERIC(5,2),
  total_dreps INTEGER,
  total_votes INTEGER,
  total_proposals INTEGER,
  total_rationales INTEGER,
  metrics_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrity_snapshots_date
  ON integrity_snapshots(snapshot_date DESC);

-- END 020_integrity_snapshots.sql

-- BEGIN 021_drop_decentralization_score.sql
-- Drop deprecated decentralization_score column (v1 scoring leftover)
-- Not referenced by any code; staging never had it.
ALTER TABLE dreps DROP COLUMN IF EXISTS decentralization_score;

-- END 021_drop_decentralization_score.sql

-- BEGIN 022_rls_hardening.sql
-- Phase 1: Database Security Hardening
-- Addresses all Supabase security advisor findings

BEGIN;

-- =============================================
-- 1. Add SELECT policies for tables with RLS enabled but ZERO policies
-- =============================================

-- Public governance data (anyone can read)
CREATE POLICY "Public read access" ON drep_power_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read access" ON social_link_checks FOR SELECT USING (true);
CREATE POLICY "Public read access" ON proposal_voting_summary FOR SELECT USING (true);
CREATE POLICY "Public read access" ON integrity_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sync_log FOR SELECT USING (true);
CREATE POLICY "Public read access" ON poll_responses FOR SELECT USING (true);
CREATE POLICY "Public read access" ON users FOR SELECT USING (true);

-- Admin tables: block anon/authenticated reads (service role bypasses RLS)
CREATE POLICY "Service role only" ON api_keys FOR SELECT USING (false);
CREATE POLICY "Service role only" ON api_usage_log FOR SELECT USING (false);

-- =============================================
-- 2. Fix overly permissive write policies
--    All writes go through service role (bypasses RLS).
--    These policies block any direct anon/authenticated writes.
-- =============================================

-- notification_log: replace open INSERT
DROP POLICY "Allow notification log inserts" ON notification_log;
CREATE POLICY "Block anon inserts" ON notification_log FOR INSERT WITH CHECK (false);

-- notification_preferences: replace open INSERT/UPDATE/DELETE
DROP POLICY "Users can manage own prefs" ON notification_preferences;
DROP POLICY "Users can update own prefs" ON notification_preferences;
DROP POLICY "Users can delete own prefs" ON notification_preferences;
CREATE POLICY "Block anon inserts" ON notification_preferences FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon updates" ON notification_preferences FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block anon deletes" ON notification_preferences FOR DELETE USING (false);

-- user_channels: replace open INSERT/UPDATE/DELETE
DROP POLICY "Users can insert own channels" ON user_channels;
DROP POLICY "Users can update own channels" ON user_channels;
DROP POLICY "Users can delete own channels" ON user_channels;
CREATE POLICY "Block anon inserts" ON user_channels FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon updates" ON user_channels FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block anon deletes" ON user_channels FOR DELETE USING (false);

-- profile_views: replace open INSERT
DROP POLICY "Allow public inserts" ON profile_views;
CREATE POLICY "Block anon inserts" ON profile_views FOR INSERT WITH CHECK (false);

-- =============================================
-- 3. Convert all SECURITY_DEFINER views to SECURITY_INVOKER
-- =============================================

ALTER VIEW v_sync_health SET (security_invoker = on);
ALTER VIEW v_vote_power_coverage SET (security_invoker = on);
ALTER VIEW v_hash_verification SET (security_invoker = on);
ALTER VIEW v_ai_summary_coverage SET (security_invoker = on);
ALTER VIEW v_canonical_summary_coverage SET (security_invoker = on);
ALTER VIEW v_metadata_verification SET (security_invoker = on);
ALTER VIEW v_system_stats SET (security_invoker = on);
ALTER VIEW v_api_hourly_stats SET (security_invoker = on);
ALTER VIEW v_api_daily_stats SET (security_invoker = on);
ALTER VIEW v_api_key_stats SET (security_invoker = on);
ALTER VIEW v_api_abuse_signals SET (security_invoker = on);

-- =============================================
-- 4. Fix mutable function search_path
-- =============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- =============================================
-- 5. Drop duplicate index
-- =============================================

DROP INDEX IF EXISTS idx_proposals_epoch;

COMMIT;

-- END 022_rls_hardening.sql

-- BEGIN 023_drep_command_center.sql
-- Session 3: DRep Command Center
-- New tables for milestones, positioning tools, vote explanations
-- Column additions to users and drep_power_snapshots

BEGIN;

-- =============================================
-- 1. New tables
-- =============================================

CREATE TABLE IF NOT EXISTS drep_milestones (
  drep_id TEXT NOT NULL,
  milestone_key TEXT NOT NULL,
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (drep_id, milestone_key)
);

CREATE TABLE IF NOT EXISTS position_statements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drep_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,
  statement_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vote_explanations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drep_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,
  explanation_text TEXT NOT NULL,
  ai_assisted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_philosophy (
  drep_id TEXT PRIMARY KEY,
  philosophy_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. Indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_drep_milestones_drep ON drep_milestones(drep_id);
CREATE INDEX IF NOT EXISTS idx_position_statements_drep ON position_statements(drep_id);
CREATE INDEX IF NOT EXISTS idx_position_statements_proposal ON position_statements(proposal_tx_hash, proposal_index);
CREATE UNIQUE INDEX IF NOT EXISTS idx_position_statements_unique ON position_statements(drep_id, proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_vote_explanations_drep ON vote_explanations(drep_id);
CREATE INDEX IF NOT EXISTS idx_vote_explanations_proposal ON vote_explanations(proposal_tx_hash, proposal_index);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vote_explanations_unique ON vote_explanations(drep_id, proposal_tx_hash, proposal_index);

-- =============================================
-- 3. Column additions
-- =============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '{}';
ALTER TABLE drep_power_snapshots ADD COLUMN IF NOT EXISTS delegator_count INT;

-- =============================================
-- 4. Updated_at triggers
-- =============================================

CREATE TRIGGER set_position_statements_updated_at
  BEFORE UPDATE ON position_statements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_vote_explanations_updated_at
  BEFORE UPDATE ON vote_explanations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_governance_philosophy_updated_at
  BEFORE UPDATE ON governance_philosophy
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================
-- 5. RLS policies (public read, service-role write)
-- =============================================

ALTER TABLE drep_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_philosophy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON drep_milestones FOR SELECT USING (true);
CREATE POLICY "Service role only" ON drep_milestones FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role only update" ON drep_milestones FOR UPDATE USING (false);
CREATE POLICY "Service role only delete" ON drep_milestones FOR DELETE USING (false);

CREATE POLICY "Public read access" ON position_statements FOR SELECT USING (true);
CREATE POLICY "Service role only" ON position_statements FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role only update" ON position_statements FOR UPDATE USING (false);
CREATE POLICY "Service role only delete" ON position_statements FOR DELETE USING (false);

CREATE POLICY "Public read access" ON vote_explanations FOR SELECT USING (true);
CREATE POLICY "Service role only" ON vote_explanations FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role only update" ON vote_explanations FOR UPDATE USING (false);
CREATE POLICY "Service role only delete" ON vote_explanations FOR DELETE USING (false);

CREATE POLICY "Public read access" ON governance_philosophy FOR SELECT USING (true);
CREATE POLICY "Service role only" ON governance_philosophy FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role only update" ON governance_philosophy FOR UPDATE USING (false);
CREATE POLICY "Service role only delete" ON governance_philosophy FOR DELETE USING (false);

COMMIT;

-- END 023_drep_command_center.sql

-- BEGIN 024_governance_citizen.sql
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

-- END 024_governance_citizen.sql

-- BEGIN 025_treasury_intelligence.sql
-- Session 7: Treasury Intelligence Dashboard
-- Treasury snapshots, accountability polls, and related infrastructure

BEGIN;

-- =============================================
-- 1. Treasury snapshots (epoch-level balance tracking)
-- =============================================

CREATE TABLE IF NOT EXISTS treasury_snapshots (
  epoch_no INT PRIMARY KEY,
  balance_lovelace BIGINT NOT NULL,
  withdrawals_lovelace BIGINT NOT NULL DEFAULT 0,
  reserves_lovelace BIGINT,
  fees_lovelace BIGINT,
  reserves_income_lovelace BIGINT,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_snapshots_epoch ON treasury_snapshots(epoch_no DESC);

-- =============================================
-- 2. Treasury accountability polls (recurring evaluation cycles)
-- =============================================

CREATE TABLE IF NOT EXISTS treasury_accountability_polls (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,
  cycle_number INT NOT NULL DEFAULT 1,
  opened_epoch INT NOT NULL,
  closes_epoch INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'closed')),
  results_summary JSONB DEFAULT '{}',
  next_cycle_epoch INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (proposal_tx_hash, proposal_index, cycle_number)
);

CREATE INDEX IF NOT EXISTS idx_accountability_polls_status ON treasury_accountability_polls(status);
CREATE INDEX IF NOT EXISTS idx_accountability_polls_epoch ON treasury_accountability_polls(opened_epoch);

-- =============================================
-- 3. Treasury accountability responses
-- =============================================

CREATE TABLE IF NOT EXISTS treasury_accountability_responses (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INT NOT NULL,
  cycle_number INT NOT NULL,
  user_address TEXT NOT NULL,
  delivered_rating TEXT NOT NULL CHECK (delivered_rating IN ('delivered', 'partial', 'not_delivered', 'too_early')),
  would_approve_again TEXT NOT NULL CHECK (would_approve_again IN ('yes', 'no', 'unsure')),
  evidence_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (proposal_tx_hash, proposal_index, cycle_number, user_address)
);

CREATE INDEX IF NOT EXISTS idx_accountability_responses_proposal ON treasury_accountability_responses(proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_accountability_responses_user ON treasury_accountability_responses(user_address);

-- =============================================
-- 4. Store proposal meta_json for future AI timeline extraction
-- =============================================

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS meta_json JSONB;

-- =============================================
-- 5. RLS policies
-- =============================================

ALTER TABLE treasury_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_accountability_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_accountability_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON treasury_snapshots FOR SELECT USING (true);
CREATE POLICY "Service role only" ON treasury_snapshots FOR ALL USING (false);

CREATE POLICY "Public read access" ON treasury_accountability_polls FOR SELECT USING (true);
CREATE POLICY "Service role only" ON treasury_accountability_polls FOR ALL USING (false);

CREATE POLICY "Public read access" ON treasury_accountability_responses FOR SELECT USING (true);
CREATE POLICY "Service role only" ON treasury_accountability_responses FOR ALL USING (false);

COMMIT;

-- END 025_treasury_intelligence.sql

-- BEGIN 026_fix_sync_log_constraint.sql
-- Fix sync_log CHECK constraint: original only allowed 'fast', 'full', 'integrity_check'
-- but sync routes write 'proposals', 'dreps', 'votes', 'secondary', 'slow'.
-- SyncLogger silently caught the constraint violation, leaving v_sync_health blind.
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN ('fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes', 'secondary', 'slow', 'treasury', 'api_health_check'));

-- END 026_fix_sync_log_constraint.sql

-- BEGIN 027_engagement_engine.sql
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

-- END 027_engagement_engine.sql

-- BEGIN 027_remove_fast_sync_type.sql
-- Remove 'fast' from sync_log CHECK constraint (fast sync consolidated into proposals via Inngest).
-- Also clean up any historical 'fast' rows by updating them to 'proposals'.
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN ('full', 'integrity_check', 'proposals', 'dreps', 'votes', 'secondary', 'slow', 'treasury', 'api_health_check'));

UPDATE sync_log SET sync_type = 'proposals' WHERE sync_type = 'fast';

-- END 027_remove_fast_sync_type.sql

-- BEGIN 028_feature_flag_categories_and_seed.sql
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Uncategorized';

UPDATE feature_flags SET category = 'Cross-Chain' WHERE key IN ('cross_chain_observatory', 'cross_chain_embed', 'cross_chain_sync');

INSERT INTO feature_flags (key, enabled, description, category) VALUES
  ('ai_proposal_explainer', true, 'On-demand Claude proposal explanations via Explain button', 'AI'),
  ('ai_narratives', true, 'AI-generated DRep profile narratives and governance briefs (falls back to template)', 'AI'),
  ('ai_state_of_governance', true, 'AI narrative in weekly State of Governance reports', 'AI'),
  ('ai_governance_brief', true, 'Weekly AI governance brief generation and GovernanceBriefCard', 'AI'),
  ('developer_platform', true, '/developers page and header nav link', 'Platform'),
  ('delegator_identity', true, 'DelegatorGovernanceCard on /governance and OG image', 'Platform'),
  ('embeddable_widgets', true, 'All /embed/* pages and embed.js script loader', 'Platform'),
  ('drep_qa', true, 'DRep-delegator Q&A channel in communication feed', 'Social'),
  ('social_proof', true, 'SocialProofBadge on DRep profiles and proposal detail', 'Social'),
  ('milestone_celebrations', true, 'Milestone celebration toast overlays on dashboard', 'Social'),
  ('delegation_ceremony', true, 'Enhanced identity-aware delegation ceremony modal', 'Social'),
  ('activity_feeds', true, 'Activity feeds on Pulse, Governance, DRep profiles, and homepage ticker', 'Social'),
  ('governance_health_index', true, 'GHI gauge and sparkline on Pulse and Homepage', 'Intelligence'),
  ('cross_proposal_insights', true, 'Cross-proposal insight cards on Pulse page', 'Intelligence'),
  ('state_of_governance_reports', true, 'State of Governance weekly reports and Pulse link', 'Intelligence'),
  ('narrative_summaries', true, 'NarrativeSummary text on Proposals, Pulse, Dashboard, DRep profiles', 'Narrative'),
  ('proposals_hero', true, 'ProposalsHero command-center hero on /proposals', 'Narrative'),
  ('governance_dna_quiz', true, 'Governance DNA Quiz on /discover with match reveals', 'Discovery'),
  ('drep_quick_view', true, 'DRepQuickView bottom/side sheet on discover', 'Discovery'),
  ('sentiment_polls', true, 'Sentiment polls on proposal detail pages', 'Discovery'),
  ('compare_page', true, '/compare page and CompareButton on profiles', 'Discovery'),
  ('representation_matching', true, 'Match percentage display and Best Match sort from quiz data', 'Discovery'),
  ('drep_authoring', true, 'VoteExplanationEditor, GovernancePhilosophyEditor, PositionStatementEditor', 'DRep Tools'),
  ('claim_experience', true, 'Enhanced claim page with FOMO treatment and ClaimCelebration', 'DRep Tools'),
  ('onboarding_checklist', true, 'Post-claim OnboardingChecklist on dashboard', 'DRep Tools'),
  ('watchlist', true, 'Watchlist intelligence and watchlist toggle on DRep cards', 'Governance'),
  ('governance_calendar', true, 'Governance calendar on /governance page', 'Governance'),
  ('citizen_levels', true, 'Governance citizen levels, progression, and CitizenProgressBar', 'Governance'),
  ('financial_impact', true, 'FinancialImpactCard on proposals and DRepTreasuryStance on profiles', 'Governance'),
  ('leaderboard', true, 'Leaderboard, Hall of Fame, and Movers on Pulse page', 'Governance'),
  ('treasury_intelligence', true, 'Treasury Simulator and Accountability tabs plus accountability polls', 'Treasury'),
  ('constellation_3d', true, 'R3F WebGL constellation on homepage (fallback: static gradient)', 'Visual'),
  ('score_simulator', true, 'Score Simulator on dashboard', 'Dashboard'),
  ('score_history', true, 'Score history chart on dashboard and DRep profile', 'Dashboard'),
  ('activity_heatmap', true, 'Activity heatmap on dashboard and DRep profile', 'Dashboard'),
  ('sharing_surfaces', true, 'Wrapped cards, delegator cards, epoch summaries, badge embeds', 'Sharing'),
  ('notifications', true, 'Automated notification generation via check-notifications Inngest', 'Notifications'),
  ('push_notifications', true, 'Push notification delivery channel', 'Notifications')
ON CONFLICT (key) DO NOTHING;

-- END 028_feature_flag_categories_and_seed.sql

-- BEGIN 029_pca_alignment_system.sql
-- PCA Alignment System: tables for AI classification, PCA engine, and temporal trajectories

-- 1. Proposal classifications (AI-powered semantic classification per dimension)
CREATE TABLE IF NOT EXISTS proposal_classifications (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index   INTEGER NOT NULL,
  dim_treasury_conservative REAL DEFAULT 0,
  dim_treasury_growth       REAL DEFAULT 0,
  dim_decentralization      REAL DEFAULT 0,
  dim_security              REAL DEFAULT 0,
  dim_innovation            REAL DEFAULT 0,
  dim_transparency          REAL DEFAULT 0,
  ai_summary    TEXT,
  classified_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (proposal_tx_hash, proposal_index)
);

-- 2. PCA run results (global loadings + metadata per computation)
CREATE TABLE IF NOT EXISTS pca_results (
  run_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at             TIMESTAMPTZ DEFAULT now(),
  num_dreps               INTEGER NOT NULL,
  num_proposals           INTEGER NOT NULL,
  components              INTEGER NOT NULL,
  explained_variance      REAL[] NOT NULL,
  total_explained_variance REAL NOT NULL,
  loadings                JSONB NOT NULL,
  proposal_ids            TEXT[] NOT NULL,
  is_active               BOOLEAN DEFAULT true
);

-- Only one active PCA run at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pca_results_active
  ON pca_results (is_active) WHERE is_active = true;

-- 3. Per-DRep PCA coordinates
CREATE TABLE IF NOT EXISTS drep_pca_coordinates (
  drep_id     TEXT NOT NULL,
  run_id      UUID NOT NULL REFERENCES pca_results(run_id) ON DELETE CASCADE,
  coordinates REAL[] NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (drep_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_drep_pca_active
  ON drep_pca_coordinates (run_id);

-- 4. Alignment snapshots for temporal trajectories
CREATE TABLE IF NOT EXISTS alignment_snapshots (
  drep_id                        TEXT NOT NULL,
  epoch                          INTEGER NOT NULL,
  alignment_treasury_conservative INTEGER,
  alignment_treasury_growth       INTEGER,
  alignment_decentralization      INTEGER,
  alignment_security              INTEGER,
  alignment_innovation            INTEGER,
  alignment_transparency          INTEGER,
  pca_coordinates                 REAL[],
  snapshot_at                     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (drep_id, epoch)
);

CREATE INDEX IF NOT EXISTS idx_alignment_snapshots_drep
  ON alignment_snapshots (drep_id, epoch DESC);

-- 5. Add raw score columns to dreps table (percentile goes in existing columns)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'alignment_treasury_conservative_raw') THEN
    ALTER TABLE dreps ADD COLUMN alignment_treasury_conservative_raw REAL;
    ALTER TABLE dreps ADD COLUMN alignment_treasury_growth_raw REAL;
    ALTER TABLE dreps ADD COLUMN alignment_decentralization_raw REAL;
    ALTER TABLE dreps ADD COLUMN alignment_security_raw REAL;
    ALTER TABLE dreps ADD COLUMN alignment_innovation_raw REAL;
    ALTER TABLE dreps ADD COLUMN alignment_transparency_raw REAL;
  END IF;
END $$;

-- 6. Add rationale_quality column to drep_votes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drep_votes' AND column_name = 'rationale_quality') THEN
    ALTER TABLE drep_votes ADD COLUMN rationale_quality REAL;
  END IF;
END $$;

-- RLS: read-only public access for classification and PCA data
ALTER TABLE proposal_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pca_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE drep_pca_coordinates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alignment_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proposal_classifications_read') THEN
    CREATE POLICY proposal_classifications_read ON proposal_classifications FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pca_results_read') THEN
    CREATE POLICY pca_results_read ON pca_results FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drep_pca_coordinates_read') THEN
    CREATE POLICY drep_pca_coordinates_read ON drep_pca_coordinates FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'alignment_snapshots_read') THEN
    CREATE POLICY alignment_snapshots_read ON alignment_snapshots FOR SELECT USING (true);
  END IF;
END $$;

-- END 029_pca_alignment_system.sql

-- BEGIN 030_drep_score_v3.sql
-- DRep Score V3: 4-pillar quality-and-impact scoring upgrade
-- New columns on dreps table for pillar scores (raw + percentile) and momentum

DO $$
BEGIN
  -- Engagement Quality (percentile + raw)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'engagement_quality') THEN
    ALTER TABLE dreps ADD COLUMN engagement_quality INTEGER;
    ALTER TABLE dreps ADD COLUMN engagement_quality_raw INTEGER;
  END IF;

  -- Effective Participation V3 (avoids collision with existing effective_participation)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'effective_participation_v3') THEN
    ALTER TABLE dreps ADD COLUMN effective_participation_v3 INTEGER;
    ALTER TABLE dreps ADD COLUMN effective_participation_v3_raw INTEGER;
  END IF;

  -- Reliability V3
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'reliability_v3') THEN
    ALTER TABLE dreps ADD COLUMN reliability_v3 INTEGER;
    ALTER TABLE dreps ADD COLUMN reliability_v3_raw INTEGER;
  END IF;

  -- Governance Identity
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'governance_identity') THEN
    ALTER TABLE dreps ADD COLUMN governance_identity INTEGER;
    ALTER TABLE dreps ADD COLUMN governance_identity_raw INTEGER;
  END IF;

  -- Score momentum (points per day, from linear regression)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dreps' AND column_name = 'score_momentum') THEN
    ALTER TABLE dreps ADD COLUMN score_momentum REAL;
  END IF;
END $$;

-- Add V3 pillar columns to drep_score_history
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drep_score_history' AND column_name = 'engagement_quality') THEN
    ALTER TABLE drep_score_history ADD COLUMN engagement_quality INTEGER;
    ALTER TABLE drep_score_history ADD COLUMN effective_participation_v3 INTEGER;
    ALTER TABLE drep_score_history ADD COLUMN reliability_v3 INTEGER;
    ALTER TABLE drep_score_history ADD COLUMN governance_identity INTEGER;
  END IF;
END $$;

-- Update sync_log CHECK constraint to allow 'scoring' type
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN ('fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes', 'secondary', 'slow', 'treasury', 'api_health_check', 'scoring'));

-- END 030_drep_score_v3.sql

-- BEGIN 031_user_governance_profiles.sql
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

-- END 031_user_governance_profiles.sql

-- BEGIN 032_cross_chain_v2.sql
-- Cross-Chain Observatory v2: add AI insight, make score/grade nullable
-- Historical rows with scores/grades are preserved; new rows will have NULLs.

ALTER TABLE governance_benchmarks
  ADD COLUMN IF NOT EXISTS ai_insight TEXT;

ALTER TABLE governance_benchmarks
  ALTER COLUMN governance_score DROP NOT NULL;

ALTER TABLE governance_benchmarks
  ALTER COLUMN grade DROP NOT NULL;

-- END 032_cross_chain_v2.sql

-- BEGIN 032_ghi_v2.sql
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

-- END 032_ghi_v2.sql

-- BEGIN 033_metrics_expansion.sql
-- 033: Metrics Expansion — SPO/CC votes, inter-body alignment, epoch recaps, proposal similarity cache
-- Phase 1 of the metrics expansion plan

-- ---------------------------------------------------------------------------
-- SPO Votes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS spo_votes (
  pool_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('Yes', 'No', 'Abstain')),
  block_time INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  PRIMARY KEY (pool_id, proposal_tx_hash, proposal_index)
);

ALTER TABLE spo_votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'spo_votes_public_read') THEN
    CREATE POLICY spo_votes_public_read ON spo_votes FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'spo_votes_service_write') THEN
    CREATE POLICY spo_votes_service_write ON spo_votes
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_spo_votes_proposal ON spo_votes (proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_spo_votes_epoch ON spo_votes (epoch);

-- ---------------------------------------------------------------------------
-- CC Votes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cc_votes (
  cc_hot_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('Yes', 'No', 'Abstain')),
  block_time INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  PRIMARY KEY (cc_hot_id, proposal_tx_hash, proposal_index)
);

ALTER TABLE cc_votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cc_votes_public_read') THEN
    CREATE POLICY cc_votes_public_read ON cc_votes FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cc_votes_service_write') THEN
    CREATE POLICY cc_votes_service_write ON cc_votes
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cc_votes_proposal ON cc_votes (proposal_tx_hash, proposal_index);
CREATE INDEX IF NOT EXISTS idx_cc_votes_epoch ON cc_votes (epoch);

-- ---------------------------------------------------------------------------
-- Inter-Body Alignment Cache
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inter_body_alignment (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  drep_yes_pct REAL,
  drep_no_pct REAL,
  spo_yes_pct REAL,
  spo_no_pct REAL,
  cc_yes_pct REAL,
  cc_no_pct REAL,
  alignment_score REAL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (proposal_tx_hash, proposal_index)
);

ALTER TABLE inter_body_alignment ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'inter_body_alignment_public_read') THEN
    CREATE POLICY inter_body_alignment_public_read ON inter_body_alignment FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'inter_body_alignment_service_write') THEN
    CREATE POLICY inter_body_alignment_service_write ON inter_body_alignment
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Epoch Recaps
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS epoch_recaps (
  epoch INTEGER PRIMARY KEY,
  proposals_submitted INTEGER DEFAULT 0,
  proposals_ratified INTEGER DEFAULT 0,
  proposals_expired INTEGER DEFAULT 0,
  proposals_dropped INTEGER DEFAULT 0,
  drep_participation_pct REAL,
  treasury_withdrawn_ada BIGINT DEFAULT 0,
  ai_narrative TEXT,
  computed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE epoch_recaps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'epoch_recaps_public_read') THEN
    CREATE POLICY epoch_recaps_public_read ON epoch_recaps FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'epoch_recaps_service_write') THEN
    CREATE POLICY epoch_recaps_service_write ON epoch_recaps
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Proposal Similarity Cache
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS proposal_similarity_cache (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  similar_tx_hash TEXT NOT NULL,
  similar_index INTEGER NOT NULL,
  similarity_score REAL NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (proposal_tx_hash, proposal_index, similar_tx_hash, similar_index)
);

ALTER TABLE proposal_similarity_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proposal_similarity_cache_public_read') THEN
    CREATE POLICY proposal_similarity_cache_public_read ON proposal_similarity_cache FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proposal_similarity_cache_service_write') THEN
    CREATE POLICY proposal_similarity_cache_service_write ON proposal_similarity_cache
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_similarity_cache_source ON proposal_similarity_cache (proposal_tx_hash, proposal_index);

-- ---------------------------------------------------------------------------
-- Extend sync_log CHECK constraint for new sync types
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
  ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
    CHECK (sync_type IN (
      'proposals', 'dreps', 'votes', 'secondary', 'slow', 'full',
      'treasury', 'scoring', 'integrity_check', 'api_health_check',
      'spo_votes', 'cc_votes', 'alignment_cache', 'similarity_cache', 'epoch_recaps'
    ));
END $$;

-- ---------------------------------------------------------------------------
-- Feature flags for new features
-- ---------------------------------------------------------------------------

INSERT INTO feature_flags (key, enabled, description, category)
VALUES
  ('spo_cc_votes', false, 'SPO and CC vote data display', 'Governance'),
  ('governance_footprint', false, 'Wallet governance footprint API and UI', 'Governance'),
  ('proposal_similarity', false, 'Classification-based proposal similarity', 'Intelligence'),
  ('epoch_recaps', false, 'AI-generated epoch narratives', 'Narrative')
ON CONFLICT (key) DO NOTHING;

-- END 033_metrics_expansion.sql

-- BEGIN 033_snapshot_hardening.sql
-- Snapshot Hardening: expand drep_score_history, create completeness log,
-- and extend sync_log CHECK for new snapshot sync types.

-- 1. Add epoch, momentum, and raw pillar scores to drep_score_history
ALTER TABLE drep_score_history
  ADD COLUMN IF NOT EXISTS epoch_no integer,
  ADD COLUMN IF NOT EXISTS score_momentum numeric(6,3),
  ADD COLUMN IF NOT EXISTS engagement_quality_raw integer,
  ADD COLUMN IF NOT EXISTS effective_participation_v3_raw integer,
  ADD COLUMN IF NOT EXISTS reliability_v3_raw integer,
  ADD COLUMN IF NOT EXISTS governance_identity_raw integer;

CREATE INDEX IF NOT EXISTS idx_score_history_epoch
  ON drep_score_history(epoch_no) WHERE epoch_no IS NOT NULL;

-- 2. Snapshot completeness log — one row per snapshot run per type
-- epoch_no defaults to 0 for non-epoch snapshots (benchmarks) so the unique
-- constraint always matches correctly (NULLs break Postgres upsert).
CREATE TABLE IF NOT EXISTS snapshot_completeness_log (
  id serial PRIMARY KEY,
  snapshot_type text NOT NULL,
  epoch_no integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  record_count integer NOT NULL,
  expected_count integer,
  coverage_pct numeric(5,2),
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (snapshot_type, epoch_no, snapshot_date)
);

-- 3. Extend sync_log CHECK to include alignment, ghi, benchmarks
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks'
  ));

-- END 033_snapshot_hardening.sql

-- BEGIN 034_snapshot_moat.sql
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

-- END 034_snapshot_moat.sql

-- BEGIN 035_v4_feature_flags.sql
-- v4 feature flags: new multi-body governance features (disabled by default)
INSERT INTO feature_flags (key, enabled, description, category) VALUES
  ('spo_profiles', false, 'SPO governance profile pages', 'v4'),
  ('cc_page', false, 'Constitutional Committee transparency page', 'v4'),
  ('tri_body_votes', false, 'Tri-body vote indicators on proposals', 'v4'),
  ('pulse_v2', false, 'Pulse v2 intelligence hub layout', 'v4'),
  ('discover_tabs', false, 'Multi-entity tabs on Discover page', 'v4'),
  ('inter_body_pulse', false, 'Inter-body governance section in Pulse', 'v4')
ON CONFLICT (key) DO NOTHING;

-- Graduate mature flags that should always be on
UPDATE feature_flags SET enabled = true WHERE key IN (
  'narrative_summaries',
  'proposals_hero',
  'governance_health_index',
  'social_proof',
  'activity_feeds',
  'score_history',
  'governance_calendar',
  'sentiment_polls',
  'governance_dna_quiz'
);

-- END 035_v4_feature_flags.sql

-- BEGIN 036_v4_flag_cleanup.sql
-- Remove unused v4 flags (inter_body_pulse is redundant with spo_cc_votes from 033,
-- pulse_v2 has no fallback since old pulse was replaced)
DELETE FROM feature_flags WHERE key IN ('inter_body_pulse', 'pulse_v2');

-- Enable v4 features that are ready to ship
UPDATE feature_flags SET enabled = true WHERE key IN (
  'tri_body_votes',
  'discover_tabs'
);

-- spo_profiles and cc_page stay disabled until SPO/CC data is richer

-- END 036_v4_flag_cleanup.sql

-- BEGIN 037_spo_governance_snapshots.sql
-- SPO governance layer: score + alignment snapshots per epoch

CREATE TABLE IF NOT EXISTS spo_score_snapshots (
  pool_id text NOT NULL,
  epoch_no integer NOT NULL,
  governance_score integer,
  participation_rate numeric(5,2),
  rationale_rate numeric(5,2),
  vote_count integer DEFAULT 0,
  snapshot_at timestamptz DEFAULT now(),
  PRIMARY KEY (pool_id, epoch_no)
);

CREATE TABLE IF NOT EXISTS spo_alignment_snapshots (
  pool_id text NOT NULL,
  epoch_no integer NOT NULL,
  alignment_treasury_conservative numeric(5,2),
  alignment_treasury_growth numeric(5,2),
  alignment_decentralization numeric(5,2),
  alignment_security numeric(5,2),
  alignment_innovation numeric(5,2),
  alignment_transparency numeric(5,2),
  snapshot_at timestamptz DEFAULT now(),
  PRIMARY KEY (pool_id, epoch_no)
);

CREATE INDEX IF NOT EXISTS idx_spo_score_snapshots_epoch ON spo_score_snapshots(epoch_no);
CREATE INDEX IF NOT EXISTS idx_spo_alignment_snapshots_epoch ON spo_alignment_snapshots(epoch_no);

-- END 037_spo_governance_snapshots.sql

-- BEGIN 038_governance_epoch_stats.sql
-- Per-epoch governance aggregate stats (historicized from governance_stats)

CREATE TABLE IF NOT EXISTS governance_epoch_stats (
  epoch_no integer PRIMARY KEY,
  total_dreps integer,
  active_dreps integer,
  total_delegated_ada_lovelace text,
  total_proposals integer,
  proposals_submitted integer DEFAULT 0,
  proposals_ratified integer DEFAULT 0,
  proposals_expired integer DEFAULT 0,
  proposals_dropped integer DEFAULT 0,
  participation_rate numeric(5,2),
  rationale_rate numeric(5,2),
  avg_drep_score numeric(5,2),
  computed_at timestamptz DEFAULT now()
);

-- END 038_governance_epoch_stats.sql

-- BEGIN 039_feature_flag_cleanup.sql
-- Delete 45 always-on feature flags whose code checks have been removed.
-- Only 4 flags remain: ghi_citizen_engagement, governance_footprint, cc_page, spo_profiles.

DELETE FROM feature_flags WHERE key NOT IN (
  'ghi_citizen_engagement',
  'governance_footprint',
  'cc_page',
  'spo_profiles'
);

-- Enable governance_footprint — data is flowing, feature is complete
UPDATE feature_flags SET enabled = true WHERE key = 'governance_footprint';

-- END 039_feature_flag_cleanup.sql

-- BEGIN 039_sync_pipeline_hardening.sql
-- ============================================================================
-- 039: Sync Pipeline Hardening
-- Adds spo_scores and governance_epoch_stats to sync_log CHECK constraint.
-- These types are already used in code but rejected by the DB constraint.
-- ============================================================================

ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks',
    'spo_votes', 'cc_votes', 'alignment_cache', 'similarity_cache', 'epoch_recaps',
    'snapshot_backfill', 'spo_scores', 'governance_epoch_stats'
  ));

-- END 039_sync_pipeline_hardening.sql

-- BEGIN 040_pools_table.sql
-- Pools table: SPO metadata + governance scores

CREATE TABLE IF NOT EXISTS pools (
  pool_id TEXT PRIMARY KEY,
  ticker TEXT,
  pool_name TEXT,
  pledge_lovelace BIGINT DEFAULT 0,
  margin NUMERIC(7,4) DEFAULT 0,
  fixed_cost_lovelace BIGINT DEFAULT 0,
  delegator_count INTEGER DEFAULT 0,
  live_stake_lovelace BIGINT DEFAULT 0,
  governance_score INTEGER,
  participation_raw INTEGER,
  consistency_raw INTEGER,
  reliability_raw INTEGER,
  participation_pct INTEGER,
  consistency_pct INTEGER,
  reliability_pct INTEGER,
  vote_count INTEGER DEFAULT 0,
  alignment_treasury_conservative NUMERIC(5,2),
  alignment_treasury_growth NUMERIC(5,2),
  alignment_decentralization NUMERIC(5,2),
  alignment_security NUMERIC(5,2),
  alignment_innovation NUMERIC(5,2),
  alignment_transparency NUMERIC(5,2),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pools" ON pools FOR SELECT USING (true);
CREATE POLICY "Service write pools" ON pools FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_pools_governance_score ON pools(governance_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_pools_vote_count ON pools(vote_count DESC);

-- END 040_pools_table.sql

-- BEGIN 041_phase3_performance_indexes.sql
-- Phase 3A: Performance indexes for hot query paths
-- All IF NOT EXISTS — safe to run idempotently

-- poll_responses: governance/matches lookup, polls/vote upsert check
CREATE INDEX IF NOT EXISTS idx_poll_responses_wallet
  ON poll_responses (wallet_address);

CREATE INDEX IF NOT EXISTS idx_poll_responses_proposal
  ON poll_responses (proposal_tx_hash, proposal_index);

-- drep_score_history: dashboard + score-history (every DRep page view)
CREATE INDEX IF NOT EXISTS idx_drep_score_history_drep
  ON drep_score_history (drep_id);

-- social_link_checks: DRep profile display + slow sync
CREATE INDEX IF NOT EXISTS idx_social_link_checks_drep_uri
  ON social_link_checks (drep_id, uri);

-- drep_pca_coordinates: governance/matches PCA similarity lookups
CREATE INDEX IF NOT EXISTS idx_drep_pca_run
  ON drep_pca_coordinates (run_id);

-- sync_log: sync-freshness-guard Inngest cron checks
CREATE INDEX IF NOT EXISTS idx_sync_log_type_time
  ON sync_log (sync_type, started_at DESC);

-- END 041_phase3_performance_indexes.sql

-- BEGIN 042_spo_score_v3.sql
-- SPO Score V3: deliberation quality, confidence, sybil detection, attribution

-- 1. Add V3 columns to pools table
ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS deliberation_raw INTEGER,
  ADD COLUMN IF NOT EXISTS deliberation_pct INTEGER,
  ADD COLUMN IF NOT EXISTS governance_identity_raw INTEGER,
  ADD COLUMN IF NOT EXISTS governance_identity_pct INTEGER,
  ADD COLUMN IF NOT EXISTS score_momentum NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS confidence INTEGER,
  ADD COLUMN IF NOT EXISTS current_tier TEXT,
  ADD COLUMN IF NOT EXISTS governance_statement TEXT,
  ADD COLUMN IF NOT EXISTS homepage_url TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB,
  ADD COLUMN IF NOT EXISTS metadata_hash_verified BOOLEAN DEFAULT false;

-- 2. Add V3 columns to spo_score_snapshots
ALTER TABLE spo_score_snapshots
  ADD COLUMN IF NOT EXISTS participation_pct INTEGER,
  ADD COLUMN IF NOT EXISTS deliberation_raw INTEGER,
  ADD COLUMN IF NOT EXISTS deliberation_pct INTEGER,
  ADD COLUMN IF NOT EXISTS consistency_raw INTEGER,
  ADD COLUMN IF NOT EXISTS consistency_pct INTEGER,
  ADD COLUMN IF NOT EXISTS reliability_raw INTEGER,
  ADD COLUMN IF NOT EXISTS reliability_pct INTEGER,
  ADD COLUMN IF NOT EXISTS governance_identity_raw INTEGER,
  ADD COLUMN IF NOT EXISTS governance_identity_pct INTEGER,
  ADD COLUMN IF NOT EXISTS score_momentum NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS confidence INTEGER;

-- 3. Sybil detection flags
CREATE TABLE IF NOT EXISTS spo_sybil_flags (
  id SERIAL PRIMARY KEY,
  pool_a TEXT NOT NULL,
  pool_b TEXT NOT NULL,
  agreement_rate NUMERIC(5,3) NOT NULL,
  shared_votes INTEGER NOT NULL,
  epoch_no INTEGER NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT now(),
  resolved BOOLEAN DEFAULT false,
  UNIQUE (pool_a, pool_b, epoch_no)
);

ALTER TABLE spo_sybil_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sybil flags" ON spo_sybil_flags FOR SELECT USING (true);
CREATE POLICY "Service write sybil flags" ON spo_sybil_flags FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_spo_sybil_flags_epoch ON spo_sybil_flags(epoch_no);
CREATE INDEX IF NOT EXISTS idx_spo_sybil_flags_pools ON spo_sybil_flags(pool_a, pool_b);

-- 4. Extend sync_log CHECK for spo_scores type
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks', 'spo_scores', 'spo_votes', 'cc_votes'
  ));

-- 5. Index for confidence-gated tier queries
CREATE INDEX IF NOT EXISTS idx_pools_confidence ON pools(confidence) WHERE confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pools_current_tier ON pools(current_tier) WHERE current_tier IS NOT NULL;

-- END 042_spo_score_v3.sql

-- BEGIN 043_backfill_score_history_epochs.sql
-- Backfill epoch_no for drep_score_history entries that have null epoch_no.
-- Uses Cardano mainnet epoch math: epoch = floor((unix_time - shelley_genesis) / epoch_length) + shelley_base_epoch
-- Shelley genesis: 1596491091, epoch length: 432000s (5 days), base epoch: 209

UPDATE drep_score_history
SET epoch_no = FLOOR(
  (EXTRACT(EPOCH FROM snapshot_date::timestamp AT TIME ZONE 'UTC') - 1596491091) / 432000
)::int + 209
WHERE epoch_no IS NULL
  AND snapshot_date IS NOT NULL;

-- END 043_backfill_score_history_epochs.sql

-- BEGIN 044_data_moat_collection.sql
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

-- END 044_data_moat_collection.sql

-- BEGIN 045_catalyst_collection.sql
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

-- END 045_catalyst_collection.sql

-- BEGIN 046_cc_rationale_columns.sql
-- Add rationale anchor columns to cc_votes for CIP-136 constitutional analysis
ALTER TABLE cc_votes ADD COLUMN IF NOT EXISTS meta_url TEXT;
ALTER TABLE cc_votes ADD COLUMN IF NOT EXISTS meta_hash TEXT;

-- CC rationale cache: stores fetched and parsed CIP-136 rationale documents
CREATE TABLE IF NOT EXISTS cc_rationales (
  cc_hot_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  meta_url TEXT NOT NULL,
  meta_hash TEXT,
  -- CIP-136 structured fields
  author_name TEXT,
  summary TEXT,
  rationale_statement TEXT,
  precedent_discussion TEXT,
  counterargument_discussion TEXT,
  conclusion TEXT,
  internal_vote JSONB,  -- { constitutional, unconstitutional, abstain, didNotVote, againstVote }
  cited_articles JSONB, -- ["Article I, § 1", "Article II, § 6", ...]
  raw_json JSONB,       -- full CIP-136 document for future re-parsing
  -- Scoring fields (populated by scoring pipeline)
  fidelity_score INTEGER,           -- 0-100 composite Constitutional Fidelity score
  article_coverage_score INTEGER,   -- 0-100 how well relevant articles were addressed
  reasoning_quality_score INTEGER,  -- 0-100 AI-assessed reasoning quality
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  scored_at TIMESTAMPTZ,
  PRIMARY KEY (cc_hot_id, proposal_tx_hash, proposal_index)
);

-- RLS for cc_rationales
ALTER TABLE cc_rationales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cc_rationales"
  ON cc_rationales FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can write cc_rationales"
  ON cc_rationales FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- CC member metadata cache (from Koios committee_info + rationale author names)
CREATE TABLE IF NOT EXISTS cc_members (
  cc_hot_id TEXT PRIMARY KEY,
  cc_cold_id TEXT,
  author_name TEXT,                 -- from CIP-136 rationale authors field
  status TEXT,                      -- authorized, resigned, expired
  expiration_epoch INTEGER,
  has_script BOOLEAN DEFAULT false,
  -- Aggregate scoring (updated by scoring pipeline)
  fidelity_score INTEGER,           -- composite Constitutional Fidelity score
  rationale_provision_rate REAL,    -- % of votes with rationales
  avg_article_coverage REAL,        -- average article coverage score
  avg_reasoning_quality REAL,       -- average reasoning quality score
  consistency_score REAL,           -- cross-proposal consistency
  responsiveness_score REAL,        -- average time-to-vote
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cc_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cc_members"
  ON cc_members FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can write cc_members"
  ON cc_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- END 046_cc_rationale_columns.sql

-- BEGIN 047_multi_wallet_identity.sql
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

-- END 047_multi_wallet_identity.sql

-- BEGIN 048_globe_constellation_flag.sql
-- Globe constellation visualization (admin-only prototype)
INSERT INTO feature_flags (key, enabled, description, category)
VALUES ('globe_constellation', false, 'Globe-based constellation visualization (prototype)', 'visualization')
ON CONFLICT (key) DO NOTHING;

-- END 048_globe_constellation_flag.sql

-- BEGIN 049_rationale_documents.sql
-- Stores CIP-100 JSON-LD rationale documents submitted by DReps via Governada.
-- Served at /api/rationale/[hash] as the on-chain vote anchor URL.

CREATE TABLE IF NOT EXISTS rationale_documents (
  content_hash TEXT PRIMARY KEY,
  drep_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  document JSONB NOT NULL,
  rationale_text TEXT NOT NULL,
  vote_tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rationale_documents_drep ON rationale_documents(drep_id);
CREATE INDEX IF NOT EXISTS idx_rationale_documents_proposal ON rationale_documents(proposal_tx_hash, proposal_index);

-- END 049_rationale_documents.sql

-- BEGIN 050_governance_philosophy_anchor.sql
-- Add anchor_hash column to governance_philosophy table.
-- Links a DRep's governance statement to its CIP-100 document
-- stored in rationale_documents.

ALTER TABLE governance_philosophy
  ADD COLUMN IF NOT EXISTS anchor_hash TEXT;

-- END 050_governance_philosophy_anchor.sql

-- BEGIN 051_constitutional_analysis_and_drep_epoch_updates.sql
-- 5d: Add constitutional analysis column to proposal_classifications
ALTER TABLE proposal_classifications
ADD COLUMN IF NOT EXISTS constitutional_analysis JSONB;

COMMENT ON COLUMN proposal_classifications.constitutional_analysis IS 'AI-generated constitutional alignment analysis (alignment, confidence, summary, relevant articles)';

-- 5e: Create drep_epoch_updates table for AI-generated per-DRep epoch summaries
CREATE TABLE IF NOT EXISTS drep_epoch_updates (
  drep_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  update_text TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  rationale_count INTEGER NOT NULL DEFAULT 0,
  proposals_voted JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (drep_id, epoch)
);

CREATE INDEX IF NOT EXISTS idx_drep_epoch_updates_epoch ON drep_epoch_updates(epoch);
CREATE INDEX IF NOT EXISTS idx_drep_epoch_updates_drep ON drep_epoch_updates(drep_id);

COMMENT ON TABLE drep_epoch_updates IS 'AI-generated per-DRep epoch voting summaries for delegator communication';

-- END 051_constitutional_analysis_and_drep_epoch_updates.sql

-- BEGIN 052_assembly_quorum.sql
-- Add quorum_threshold to citizen_assemblies
-- When set > 0, assembly won't finalize results unless total_votes >= quorum_threshold
-- Status becomes 'quorum_not_met' instead of 'closed' when quorum not reached

ALTER TABLE citizen_assemblies
  ADD COLUMN IF NOT EXISTS quorum_threshold integer NOT NULL DEFAULT 0;

-- Allow the new status value
-- (status is a text column, no constraint change needed — just documenting)
COMMENT ON COLUMN citizen_assemblies.quorum_threshold IS
  'Minimum votes required for assembly results to be valid. 0 = no quorum.';
COMMENT ON COLUMN citizen_assemblies.status IS
  'draft | active | closed | cancelled | quorum_not_met';

-- END 052_assembly_quorum.sql

-- BEGIN 052_cc_transparency_index.sql
-- CC Transparency Index: adds headline transparency score + participation tracking
-- + historical snapshot table for trend analysis.

-- 1. Add new columns to cc_members for the 5-pillar Transparency Index
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS transparency_index INTEGER;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS participation_score REAL;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS rationale_quality_score REAL;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS independence_score REAL;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS community_engagement_score REAL;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS transparency_grade TEXT;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS votes_cast INTEGER DEFAULT 0;
ALTER TABLE cc_members ADD COLUMN IF NOT EXISTS eligible_proposals INTEGER DEFAULT 0;

-- 2. Historical snapshots for trend tracking (one row per member per epoch)
CREATE TABLE IF NOT EXISTS cc_transparency_snapshots (
  cc_hot_id TEXT NOT NULL,
  epoch_no INTEGER NOT NULL,
  transparency_index INTEGER,
  participation_score REAL,
  rationale_quality_score REAL,
  responsiveness_score REAL,
  independence_score REAL,
  community_engagement_score REAL,
  votes_cast INTEGER DEFAULT 0,
  eligible_proposals INTEGER DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cc_hot_id, epoch_no)
);

CREATE INDEX IF NOT EXISTS idx_cc_transparency_snapshots_epoch
  ON cc_transparency_snapshots(epoch_no);

CREATE INDEX IF NOT EXISTS idx_cc_transparency_snapshots_member
  ON cc_transparency_snapshots(cc_hot_id);

-- RLS
ALTER TABLE cc_transparency_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cc_transparency_snapshots"
  ON cc_transparency_snapshots FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can write cc_transparency_snapshots"
  ON cc_transparency_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- END 052_cc_transparency_index.sql

-- BEGIN 052_progressive_match_confidence.sql
-- WP-11: Progressive Match Confidence
-- Adds confidence_sources JSONB column to user_governance_profiles and history tables
-- to store the breakdown of multi-source confidence scoring.

-- Add confidence_sources to profiles
ALTER TABLE user_governance_profiles
ADD COLUMN IF NOT EXISTS confidence_sources jsonb DEFAULT NULL;

-- Add confidence_sources to profile history
ALTER TABLE user_governance_profile_history
ADD COLUMN IF NOT EXISTS confidence_sources jsonb DEFAULT NULL;

-- Add has_quick_match flag to track whether user completed Quick Match
ALTER TABLE user_governance_profiles
ADD COLUMN IF NOT EXISTS has_quick_match boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN user_governance_profiles.confidence_sources IS 'Breakdown of progressive confidence sources: quizAnswers, pollVotes, proposalDiversity, engagement, delegation';
COMMENT ON COLUMN user_governance_profiles.has_quick_match IS 'Whether the user has completed the Quick Match quiz';

-- END 052_progressive_match_confidence.sql

-- BEGIN 052_proposal_outcome_tracking.sql
-- WP-12: Proposal Outcome Tracking
-- Tracks delivery status for enacted proposals, connecting governance decisions to real-world impact.

CREATE TABLE proposal_outcomes (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index   INTEGER NOT NULL,

  -- Delivery status
  delivery_status  TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (delivery_status IN ('in_progress', 'delivered', 'partial', 'not_delivered', 'unknown')),

  -- Computed delivery score 0-100 (aggregated from accountability poll results)
  delivery_score   SMALLINT CHECK (delivery_score IS NULL OR (delivery_score >= 0 AND delivery_score <= 100)),

  -- Accountability poll aggregation
  total_poll_responses   INTEGER NOT NULL DEFAULT 0,
  delivered_count        INTEGER NOT NULL DEFAULT 0,
  partial_count          INTEGER NOT NULL DEFAULT 0,
  not_delivered_count    INTEGER NOT NULL DEFAULT 0,
  too_early_count        INTEGER NOT NULL DEFAULT 0,
  would_approve_again_pct NUMERIC(5,2),

  -- Milestone tracking (for treasury proposals with known deliverables)
  milestones_total       SMALLINT,
  milestones_completed   SMALLINT,

  -- Epoch tracking
  enacted_epoch          INTEGER,
  last_evaluated_epoch   INTEGER,
  epochs_since_enactment INTEGER GENERATED ALWAYS AS (
    CASE WHEN enacted_epoch IS NOT NULL AND last_evaluated_epoch IS NOT NULL
      THEN last_evaluated_epoch - enacted_epoch
      ELSE NULL
    END
  ) STORED,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (proposal_tx_hash, proposal_index),
  CONSTRAINT fk_proposal FOREIGN KEY (proposal_tx_hash, proposal_index)
    REFERENCES proposals (tx_hash, proposal_index) ON DELETE CASCADE
);

CREATE INDEX idx_proposal_outcomes_status ON proposal_outcomes (delivery_status);
CREATE INDEX idx_proposal_outcomes_score ON proposal_outcomes (delivery_score DESC NULLS LAST);

ALTER TABLE proposal_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read proposal outcomes"
  ON proposal_outcomes FOR SELECT USING (true);

CREATE POLICY "Service role can manage proposal outcomes"
  ON proposal_outcomes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Feature flag
INSERT INTO feature_flags (key, enabled, description, category)
VALUES ('proposal_outcome_tracking', true, 'WP-12: Show delivery status and outcome tracking on proposal pages and DRep voting records', 'governance')
ON CONFLICT (key) DO NOTHING;

-- END 052_proposal_outcome_tracking.sql

-- BEGIN 053_add_dreps_confidence_column.sql
-- Add confidence column to dreps table for score confidence tracking.
-- The scoring function (sync-drep-scores) computes and upserts this value.
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS confidence integer;

-- END 053_add_dreps_confidence_column.sql

-- BEGIN 054_rls_post_migration_022.sql
-- Enable RLS on 7 tables created after migration 022 (rls_hardening).
-- All are public governance data: read-only for anon/authenticated,
-- full access for service_role (which bypasses RLS automatically).

BEGIN;

-- 1. snapshot_completeness_log (migration 033)
ALTER TABLE snapshot_completeness_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON snapshot_completeness_log FOR SELECT USING (true);
CREATE POLICY "Block anon inserts" ON snapshot_completeness_log FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon updates" ON snapshot_completeness_log FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block anon deletes" ON snapshot_completeness_log FOR DELETE USING (false);

-- 2. user_governance_profiles (migration 031)
ALTER TABLE user_governance_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON user_governance_profiles FOR SELECT USING (true);
CREATE POLICY "Block anon inserts" ON user_governance_profiles FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon updates" ON user_governance_profiles FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block anon deletes" ON user_governance_profiles FOR DELETE USING (false);

-- 3. governance_epoch_stats (migration 038)
ALTER TABLE governance_epoch_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON governance_epoch_stats FOR SELECT USING (true);
CREATE POLICY "Block anon inserts" ON governance_epoch_stats FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon updates" ON governance_epoch_stats FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block anon deletes" ON governance_epoch_stats FOR DELETE USING (false);

-- 4. spo_score_snapshots (migration 037)
ALTER TABLE spo_score_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON spo_score_snapshots FOR SELECT USING (true);
CREATE POLICY "Block anon inserts" ON spo_score_snapshots FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon updates" ON spo_score_snapshots FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block anon deletes" ON spo_score_snapshots FOR DELETE USING (false);

-- 5. spo_alignment_snapshots (migration 037)
ALTER TABLE spo_alignment_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON spo_alignment_snapshots FOR SELECT USING (true);
CREATE POLICY "Block anon inserts" ON spo_alignment_snapshots FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon updates" ON spo_alignment_snapshots FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block anon deletes" ON spo_alignment_snapshots FOR DELETE USING (false);

-- 6. rationale_documents (migration 049)
ALTER TABLE rationale_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON rationale_documents FOR SELECT USING (true);
CREATE POLICY "Block anon inserts" ON rationale_documents FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon updates" ON rationale_documents FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block anon deletes" ON rationale_documents FOR DELETE USING (false);

-- 7. drep_epoch_updates (migration 051)
ALTER TABLE drep_epoch_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON drep_epoch_updates FOR SELECT USING (true);
CREATE POLICY "Block anon inserts" ON drep_epoch_updates FOR INSERT WITH CHECK (false);
CREATE POLICY "Block anon updates" ON drep_epoch_updates FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block anon deletes" ON drep_epoch_updates FOR DELETE USING (false);

COMMIT;

-- END 054_rls_post_migration_022.sql

-- BEGIN 055_pool_status_and_retiring.sql
-- Add pool_status and retiring_epoch columns to pools table
-- pool_status: 'registered' | 'retiring' | 'retired' (from Koios pool_info)
-- retiring_epoch: the epoch at which the pool will retire (null if not retiring)

ALTER TABLE pools ADD COLUMN IF NOT EXISTS pool_status TEXT DEFAULT 'registered';
ALTER TABLE pools ADD COLUMN IF NOT EXISTS retiring_epoch INTEGER;

-- Index for filtering by status (e.g., hide retired pools from default browse)
CREATE INDEX IF NOT EXISTS idx_pools_pool_status ON pools(pool_status);

-- END 055_pool_status_and_retiring.sql

-- BEGIN 056_citizen_milestones_and_impact.sql
-- Create citizen_milestones and citizen_impact_scores tables.
-- Referenced by lib/citizenMilestones.ts, lib/citizenImpactScore.ts,
-- app/api/citizen/milestones/route.ts, app/api/you/impact-score/route.ts.

BEGIN;

-- ── citizen_milestones ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citizen_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  milestone_key TEXT NOT NULL,
  milestone_label TEXT,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  epoch INTEGER,
  metadata JSONB,
  UNIQUE (user_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS idx_citizen_milestones_user_id
  ON citizen_milestones(user_id);

ALTER TABLE citizen_milestones ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own milestones
CREATE POLICY "Users can read own milestones"
  ON citizen_milestones FOR SELECT
  USING (auth.uid()::text = user_id);

-- Block direct writes from client (service_role bypasses RLS)
CREATE POLICY "Block anon/auth inserts"
  ON citizen_milestones FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Block anon/auth updates"
  ON citizen_milestones FOR UPDATE
  USING (false) WITH CHECK (false);

CREATE POLICY "Block anon/auth deletes"
  ON citizen_milestones FOR DELETE
  USING (false);


-- ── citizen_impact_scores ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citizen_impact_scores (
  user_id TEXT PRIMARY KEY,
  score NUMERIC NOT NULL DEFAULT 0,
  delegation_tenure_score NUMERIC NOT NULL DEFAULT 0,
  rep_activity_score NUMERIC NOT NULL DEFAULT 0,
  engagement_depth_score NUMERIC NOT NULL DEFAULT 0,
  coverage_score NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citizen_impact_scores_score
  ON citizen_impact_scores(score DESC);

ALTER TABLE citizen_impact_scores ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own impact score
CREATE POLICY "Users can read own impact score"
  ON citizen_impact_scores FOR SELECT
  USING (auth.uid()::text = user_id);

-- Block direct writes from client (service_role bypasses RLS)
CREATE POLICY "Block anon/auth inserts"
  ON citizen_impact_scores FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Block anon/auth updates"
  ON citizen_impact_scores FOR UPDATE
  USING (false) WITH CHECK (false);

CREATE POLICY "Block anon/auth deletes"
  ON citizen_impact_scores FOR DELETE
  USING (false);

COMMIT;

-- END 056_citizen_milestones_and_impact.sql

-- BEGIN 056_community_consensus_flag.sql
-- Add community_consensus feature flag (disabled by default)
INSERT INTO feature_flags (key, enabled, description, category)
VALUES ('community_consensus', false, 'Community Consensus visualization on Hub — aggregated sentiment across all active proposals', 'engagement')
ON CONFLICT (key) DO NOTHING;

-- END 056_community_consensus_flag.sql

-- BEGIN 056_community_intelligence_feature_flags.sql
-- Seed feature flag rows for community intelligence features.
-- All disabled by default; toggle via /admin/flags when ready.

INSERT INTO feature_flags (key, enabled, description, category) VALUES
  ('score_tiers',                false, 'Tier computation + change detection in sync pipeline', 'Intelligence'),
  ('alignment_drift',            false, 'Citizen-DRep alignment drift detection', 'Intelligence'),
  ('spo_governance_identity',    false, 'SPO Governance Identity pillar (4th scoring pillar)', 'Governance'),
  ('spo_claim_flow',             false, 'SPO pool ownership claim flow', 'Governance'),
  ('governance_font',            false, 'Custom display font (Space Grotesk) for headings', 'Platform'),
  ('state_of_governance_report', false, 'Auto-generated epoch report with community intelligence', 'Intelligence'),
  ('governance_temperature',     false, 'Governance Temperature gauge (0-100 aggregate sentiment)', 'Intelligence'),
  ('community_mandate',          false, 'Citizen Mandate dashboard (priority signal aggregation)', 'Intelligence'),
  ('sentiment_divergence',       false, 'Sentiment Divergence Index (citizen vs DRep alignment)', 'Intelligence')
ON CONFLICT (key) DO NOTHING;

-- END 056_community_intelligence_feature_flags.sql

-- BEGIN 056_user_notification_preferences_and_what_changed.sql
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

-- END 056_user_notification_preferences_and_what_changed.sql

-- BEGIN 057_governance_tuner.sql
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

-- END 057_governance_tuner.sql

-- BEGIN 058_proposal_briefs.sql
-- Living Brief: proposal intelligence briefs + feedback
-- Feature: living_brief

-- proposal_briefs stores AI-generated intelligence briefs per proposal
CREATE TABLE IF NOT EXISTS proposal_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  conviction_score SMALLINT NOT NULL DEFAULT 0,
  polarization_score SMALLINT NOT NULL DEFAULT 0,
  rationale_hash TEXT,
  rationale_count SMALLINT NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  model_used TEXT,
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proposal_tx_hash, proposal_index)
);

-- Indexes for lookup and staleness checks
CREATE INDEX idx_proposal_briefs_lookup ON proposal_briefs(proposal_tx_hash, proposal_index);
CREATE INDEX idx_proposal_briefs_updated ON proposal_briefs(updated_at);

-- RLS: public read, service_role write
ALTER TABLE proposal_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposal_briefs_public_read" ON proposal_briefs FOR SELECT USING (true);
CREATE POLICY "proposal_briefs_service_write" ON proposal_briefs FOR ALL USING (auth.role() = 'service_role');

-- Brief feedback from authenticated users
CREATE TABLE IF NOT EXISTS proposal_brief_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_id UUID NOT NULL REFERENCES proposal_briefs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brief_id, user_id)
);

ALTER TABLE proposal_brief_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brief_feedback_public_read" ON proposal_brief_feedback FOR SELECT USING (true);
CREATE POLICY "brief_feedback_user_insert" ON proposal_brief_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brief_feedback_user_update" ON proposal_brief_feedback FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_brief_feedback_brief ON proposal_brief_feedback(brief_id);

-- Feature flag: disabled by default for safe rollout
INSERT INTO feature_flags (key, enabled, description, category)
VALUES ('living_brief', false, 'Living Brief: AI-synthesized proposal intelligence replacing raw data zones', 'AI')
ON CONFLICT (key) DO NOTHING;

-- END 058_proposal_briefs.sql

-- BEGIN 059_semantic_embeddings.sql
-- Enable pgvector
create extension if not exists vector with schema extensions;

-- Unified embeddings table (polymorphic by entity_type)
create table public.embeddings (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('proposal', 'rationale', 'drep_profile', 'user_preference', 'proposal_draft', 'review_annotation')),
  entity_id text not null,
  secondary_id text,
  embedding extensions.vector(3072) not null,
  content_hash text not null,
  model text not null default 'text-embedding-3-large',
  dimensions int not null default 3072,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique constraint per entity
create unique index embeddings_entity_unique on public.embeddings (entity_type, entity_id, secondary_id) where secondary_id is not null;
create unique index embeddings_entity_unique_no_secondary on public.embeddings (entity_type, entity_id) where secondary_id is null;

-- Partial HNSW indexes per entity type (optimal for <100K vectors)
create index embeddings_proposal_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'proposal';
create index embeddings_rationale_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'rationale';
create index embeddings_drep_profile_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'drep_profile';
create index embeddings_user_preference_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'user_preference';
create index embeddings_proposal_draft_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'proposal_draft';
create index embeddings_review_annotation_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'review_annotation';

-- Lookup index
create index embeddings_entity_lookup on public.embeddings (entity_type, entity_id);

-- Precomputed similarity cache
create table public.semantic_similarity_cache (
  id bigint generated always as identity primary key,
  source_entity_type text not null,
  source_entity_id text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  similarity float not null,
  computed_at timestamptz not null default now(),
  unique (source_entity_type, source_entity_id, target_entity_type, target_entity_id)
);

create index similarity_cache_source on public.semantic_similarity_cache (source_entity_type, source_entity_id);

-- Shadow scoring columns on existing tables
alter table public.drep_votes
  add column if not exists embedding_proposal_relevance float,
  add column if not exists embedding_originality float;

alter table public.dreps
  add column if not exists embedding_philosophy_coherence float;

-- AI influence columns for workspace
alter table public.proposal_drafts
  add column if not exists ai_influence_score float,
  add column if not exists ai_originality_score float;

-- RPC function for vector similarity search
create or replace function public.match_embeddings(
  query_embedding extensions.vector(3072),
  match_entity_type text,
  match_threshold float default 0.5,
  match_count int default 10,
  filter_metadata jsonb default null
)
returns table (
  id bigint,
  entity_type text,
  entity_id text,
  secondary_id text,
  similarity float,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    e.id,
    e.entity_type,
    e.entity_id,
    e.secondary_id,
    1 - (e.embedding <=> query_embedding) as similarity,
    e.metadata
  from public.embeddings e
  where e.entity_type = match_entity_type
    and 1 - (e.embedding <=> query_embedding) > match_threshold
    and (filter_metadata is null or e.metadata @> filter_metadata)
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Cross-entity similarity function
create or replace function public.embedding_similarity(
  embedding_a extensions.vector(3072),
  embedding_b extensions.vector(3072)
)
returns float
language sql
immutable
as $$
  select 1 - (embedding_a <=> embedding_b);
$$;

-- RLS: public read, service_role write
alter table public.embeddings enable row level security;
alter table public.semantic_similarity_cache enable row level security;

create policy "Embeddings are publicly readable"
  on public.embeddings for select using (true);

create policy "Only service role can insert embeddings"
  on public.embeddings for insert with check (auth.role() = 'service_role');

create policy "Only service role can update embeddings"
  on public.embeddings for update using (auth.role() = 'service_role');

create policy "Only service role can delete embeddings"
  on public.embeddings for delete using (auth.role() = 'service_role');

create policy "Similarity cache is publicly readable"
  on public.semantic_similarity_cache for select using (true);

create policy "Only service role can write similarity cache"
  on public.semantic_similarity_cache for insert with check (auth.role() = 'service_role');

create policy "Only service role can update similarity cache"
  on public.semantic_similarity_cache for update using (auth.role() = 'service_role');

create policy "Only service role can delete similarity cache"
  on public.semantic_similarity_cache for delete using (auth.role() = 'service_role');

-- Feature flags for semantic embeddings (all default OFF)
insert into public.feature_flags (key, enabled, description, category) values
  ('semantic_embeddings', false, 'Master flag for semantic embedding pipeline', 'AI'),
  ('embedding_rationale_scoring', false, 'Embedding-based rationale quality sub-scores', 'AI'),
  ('embedding_governance_identity', false, 'Embedding-based governance identity sub-scores', 'AI'),
  ('embedding_research_precedent', false, 'Semantic search for research precedent skill', 'AI'),
  ('embedding_proposal_similarity', false, 'Embedding-enhanced proposal similarity', 'AI'),
  ('embedding_ghi_deliberation', false, 'Embedding-enhanced GHI deliberation quality', 'AI'),
  ('embedding_anti_gaming', false, 'Embedding-based anti-gaming detection', 'AI'),
  ('embedding_cc_blocs', false, 'Embedding-based CC bloc detection', 'AI'),
  ('embedding_ai_quality', false, 'AI quality measurement for workspace', 'AI'),
  ('conversational_matching', false, 'Conversational DRep matching flow', 'Matching'),
  ('conversational_matching_semantic', false, 'Semantic matching in conversational flow', 'Matching')
on conflict (key) do nothing;

-- END 059_semantic_embeddings.sql

-- BEGIN 060_add_supersedes_id.sql
-- Add lineage tracking for proposal forks/revisions
ALTER TABLE proposal_drafts
ADD COLUMN supersedes_id UUID REFERENCES proposal_drafts(id) ON DELETE SET NULL;

CREATE INDEX idx_proposal_drafts_supersedes ON proposal_drafts(supersedes_id)
WHERE supersedes_id IS NOT NULL;

COMMENT ON COLUMN proposal_drafts.supersedes_id IS
  'References the draft this proposal is a revision/fork of. Used for lineage tracking.';

-- END 060_add_supersedes_id.sql

-- BEGIN 061_add_reviewed_at_version.sql
ALTER TABLE draft_reviews
ADD COLUMN reviewed_at_version INTEGER;

COMMENT ON COLUMN draft_reviews.reviewed_at_version IS
  'The draft version number at the time this review was submitted. Used for stale review detection.';

-- END 061_add_reviewed_at_version.sql

-- BEGIN 062_add_team_approvals.sql
-- Team approval records for proposal submission.
-- The lead can always submit; editors must approve before the lead can proceed.

CREATE TABLE proposal_team_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES proposal_drafts(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES proposal_team_members(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_id, team_member_id)
);

CREATE INDEX idx_team_approvals_draft ON proposal_team_approvals(draft_id);

COMMENT ON TABLE proposal_team_approvals IS
  'Records team member approvals for proposal submission. The lead can always submit; editors must approve.';

-- END 062_add_team_approvals.sql

-- BEGIN 063_enable_conversational_matching.sql
-- Enable conversational matching feature flag for all users.
-- The flag was created in migration 059 with enabled=false.
-- Semantic matching (conversational_matching_semantic) remains disabled
-- until the embedding pipeline is warm.

UPDATE feature_flags
SET enabled = true, updated_at = now()
WHERE key = 'conversational_matching';

-- END 063_enable_conversational_matching.sql

-- BEGIN 064_add_community_intelligence_flag.sql
-- Add community_intelligence feature flag
INSERT INTO feature_flags (key, enabled, description, category, targeting, updated_at)
VALUES (
  'community_intelligence',
  true,
  'Community Pulse — aggregate governance preference intelligence from matching',
  'Intelligence',
  '{}',
  now()
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = now();

-- END 064_add_community_intelligence_flag.sql

-- BEGIN 065_matching_topics.sql
-- Migration: matching_topics table for dynamic topic pills
-- Applied via Supabase MCP — this file is a reference copy

create table matching_topics (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_text text not null,
  alignment_hints jsonb,
  source text not null default 'static',
  epoch_introduced integer,
  selection_count integer default 0,
  enabled boolean default true,
  trending boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed static topics
insert into matching_topics (slug, display_text, alignment_hints, source) values
  ('treasury', 'Treasury', '{"treasuryConservative": 75, "treasuryGrowth": 25}', 'static'),
  ('innovation', 'Innovation', '{"innovation": 80, "security": 30}', 'static'),
  ('security', 'Security', '{"security": 80, "innovation": 30}', 'static'),
  ('transparency', 'Transparency', '{"transparency": 85}', 'static'),
  ('decentralization', 'Decentralization', '{"decentralization": 80}', 'static'),
  ('developer-funding', 'Developer Funding', '{"treasuryGrowth": 70, "innovation": 65}', 'static'),
  ('community-growth', 'Community Growth', '{"treasuryGrowth": 60, "decentralization": 55}', 'static'),
  ('constitutional-compliance', 'Constitutional Compliance', '{"transparency": 70, "security": 60}', 'static');

-- Index for API queries (enabled + sorted by selection_count)
create index idx_matching_topics_enabled on matching_topics (enabled, source, selection_count desc);

-- END 065_matching_topics.sql

-- BEGIN 066_proposer_score_foundation.sql
-- Proposer Score Foundation
-- Canonical proposer entities resolved from CIP-100 author metadata.

-- 1. Proposers table — one row per canonical proposer entity
CREATE TABLE proposers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'individual'
    CHECK (type IN ('individual', 'organization', 'institutional')),
  first_proposal_epoch INTEGER,
  proposal_count INTEGER NOT NULL DEFAULT 0,
  enacted_count INTEGER NOT NULL DEFAULT 0,
  dropped_count INTEGER NOT NULL DEFAULT 0,
  composite_score REAL,
  track_record_score REAL,
  proposal_quality_score REAL,
  fiscal_responsibility_score REAL,
  governance_citizenship_score REAL,
  confidence INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'Emerging',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Alias mapping — CIP-100 author entries → canonical proposer
CREATE TABLE proposer_aliases (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alias_name TEXT NOT NULL,
  alias_key TEXT NOT NULL DEFAULT '',
  proposer_id TEXT NOT NULL REFERENCES proposers(id) ON DELETE CASCADE,
  UNIQUE (alias_name, alias_key)
);

CREATE INDEX idx_proposer_aliases_name ON proposer_aliases (alias_name);
CREATE INDEX idx_proposer_aliases_proposer ON proposer_aliases (proposer_id);

-- 3. Link proposals to proposers for fast lookups
CREATE TABLE proposal_proposers (
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  proposer_id TEXT NOT NULL REFERENCES proposers(id) ON DELETE CASCADE,
  PRIMARY KEY (proposal_tx_hash, proposal_index, proposer_id)
);

CREATE INDEX idx_proposal_proposers_proposer ON proposal_proposers (proposer_id);

-- 4. RLS — public read, service role write
ALTER TABLE proposers ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposer_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_proposers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read proposers" ON proposers FOR SELECT USING (true);
CREATE POLICY "Service write proposers" ON proposers FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read proposer_aliases" ON proposer_aliases FOR SELECT USING (true);
CREATE POLICY "Service write proposer_aliases" ON proposer_aliases FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read proposal_proposers" ON proposal_proposers FOR SELECT USING (true);
CREATE POLICY "Service write proposal_proposers" ON proposal_proposers FOR ALL USING (auth.role() = 'service_role');

-- END 066_proposer_score_foundation.sql

-- BEGIN 067_ai_pipeline_extensions.sql
-- AI Pipeline Extensions
-- Adds columns for enhanced rationale scoring, proposal quality, and GHI narratives.

-- 1. DRep rationale AI summary (citizen-facing, from enhanced scoring)
ALTER TABLE drep_votes ADD COLUMN IF NOT EXISTS rationale_ai_summary TEXT;

-- 2. Proposal body quality scoring (for Proposer Score)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ai_proposal_quality INTEGER;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ai_proposal_quality_details JSONB;

-- 3. GHI epoch narrative
ALTER TABLE ghi_snapshots ADD COLUMN IF NOT EXISTS narrative TEXT;

-- END 067_ai_pipeline_extensions.sql

-- BEGIN 068_governance_passport.sql
-- Governance Passport: server-side persistence for onboarding state
-- Replaces localStorage-only passport from the legacy get-started wizard

create table if not exists governance_passport (
  id uuid default gen_random_uuid() primary key,
  stake_address text unique not null,
  match_results jsonb,
  match_archetype text,
  civic_level text default 'explorer',
  ceremony_completed boolean default false,
  ring_participation real default 0,
  ring_deliberation real default 0,
  ring_impact real default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table governance_passport enable row level security;

create policy "Users can read own passport"
  on governance_passport for select
  using (stake_address = current_setting('app.stake_address', true));

create policy "Users can insert own passport"
  on governance_passport for insert
  with check (stake_address = current_setting('app.stake_address', true));

create policy "Users can update own passport"
  on governance_passport for update
  using (stake_address = current_setting('app.stake_address', true));

-- END 068_governance_passport.sql

-- BEGIN 069_annotation_suggestions.sql
-- Add suggested_text column for tracked-change suggestions
-- Phase 3b: Workspace Studio Upgrade — reviewer "Suggest Edit" persistence

ALTER TABLE proposal_annotations
  ADD COLUMN IF NOT EXISTS suggested_text jsonb DEFAULT NULL;

COMMENT ON COLUMN proposal_annotations.suggested_text IS
  'For suggestion annotations: { original: string, proposed: string, explanation: string }';

-- Add status column to track suggestion resolution (accepted/rejected/pending)
ALTER TABLE proposal_annotations
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

COMMENT ON COLUMN proposal_annotations.status IS
  'Annotation lifecycle: active (default), accepted (suggestion applied), rejected (suggestion dismissed)';

-- END 069_annotation_suggestions.sql

-- BEGIN 070_intelligence_cache.sql
-- =============================================================================
-- 070: Intelligence Cache Tables
-- =============================================================================
-- Pre-computed intelligence sections for proposals (constitutional checks,
-- key questions, passage predictions) + reviewer briefing cache +
-- review session tracking.

-- =============================================================================
-- 1. Proposal Intelligence Cache
-- =============================================================================

CREATE TABLE IF NOT EXISTS proposal_intelligence_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  section_type TEXT NOT NULL,
  content JSONB NOT NULL,
  content_hash TEXT,
  model_used TEXT,
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_proposal_intel_cache UNIQUE (proposal_tx_hash, proposal_index, section_type)
);

CREATE INDEX IF NOT EXISTS idx_proposal_intel_cache_proposal
  ON proposal_intelligence_cache (proposal_tx_hash, proposal_index);

ALTER TABLE proposal_intelligence_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON proposal_intelligence_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow service_role write" ON proposal_intelligence_cache
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 2. Reviewer Briefing Cache
-- =============================================================================

CREATE TABLE IF NOT EXISTS reviewer_briefing_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  content JSONB NOT NULL,
  voter_context_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_reviewer_briefing_cache UNIQUE (voter_id, proposal_tx_hash, proposal_index)
);

ALTER TABLE reviewer_briefing_cache ENABLE ROW LEVEL SECURITY;

-- Reads go through authenticated API routes (reviewer-cache/route.ts);
-- RLS is secondary defense. voter_id is a stake address, not auth.uid().
CREATE POLICY "Allow owner read" ON reviewer_briefing_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow service_role write" ON reviewer_briefing_cache
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 3. Review Sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS review_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  proposals_reviewed INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  avg_seconds_per_proposal REAL,
  session_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_review_sessions_voter_started UNIQUE (voter_id, started_at)
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_voter
  ON review_sessions (voter_id, started_at DESC);

ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;

-- Reads go through authenticated API routes (review-session/route.ts);
-- RLS is secondary defense.
CREATE POLICY "Allow owner read" ON review_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow service_role write" ON review_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 4. Update sync_log CHECK constraint
-- =============================================================================

ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN (
    'fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes',
    'secondary', 'slow', 'treasury', 'api_health_check', 'scoring',
    'alignment', 'ghi', 'benchmarks', 'spo_scores', 'spo_votes', 'cc_votes',
    'data_moat', 'delegator_snapshots', 'drep_lifecycle', 'epoch_summaries',
    'committee_sync', 'metadata_archive', 'governance_epoch_stats',
    'catalyst', 'catalyst_proposals', 'catalyst_funds',
    'reconciliation',
    'intelligence_precompute', 'passage_predictions'
  ));

-- =============================================================================
-- 5. Feature flags
-- =============================================================================

INSERT INTO feature_flags (key, enabled, description)
VALUES
  ('intelligence_precompute', true, 'Background pre-computation of intelligence brief sections'),
  ('batch_review_mode', true, 'Batch review UX (] shortcut, progress bar, session tracking)'),
  ('passage_prediction', true, 'Show passage prediction in review intelligence brief')
ON CONFLICT (key) DO NOTHING;

-- END 070_intelligence_cache.sql

-- BEGIN 071_systems_review_ops.sql
-- Systems operating loop persistence
-- Weekly reviews plus named hardening commitments for the /admin/systems cockpit

BEGIN;

CREATE TABLE IF NOT EXISTS systems_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wallet_address TEXT NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('good', 'warning', 'critical', 'bootstrap')),
  focus_area TEXT NOT NULL,
  summary TEXT NOT NULL,
  top_risk TEXT NOT NULL,
  change_notes TEXT,
  linked_slo_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES systems_reviews(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  owner TEXT NOT NULL DEFAULT 'Founder + agents',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'blocked', 'done')),
  due_date DATE,
  linked_slo_ids TEXT[] NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_systems_reviews_reviewed_at
  ON systems_reviews(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_systems_reviews_status
  ON systems_reviews(overall_status, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_systems_commitments_status
  ON systems_commitments(status, due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_systems_commitments_review
  ON systems_commitments(review_id);
CREATE INDEX IF NOT EXISTS idx_systems_commitments_due
  ON systems_commitments(due_date ASC NULLS LAST);

DROP TRIGGER IF EXISTS set_systems_commitments_updated_at ON systems_commitments;
CREATE TRIGGER set_systems_commitments_updated_at
  BEFORE UPDATE ON systems_commitments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE systems_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "systems_reviews_service_role_full_access"
  ON systems_reviews FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "systems_commitments_service_role_full_access"
  ON systems_commitments FOR ALL
  USING (auth.role() = 'service_role');

COMMIT;

-- END 071_systems_review_ops.sql

-- BEGIN 072_dd05_vote_ingestion_contract.sql
-- DD05 vote-ingestion follow-up:
-- 1. Make cached rationale presence explicit on drep_votes
-- 2. Add durable sync cursors for incremental syncs

ALTER TABLE drep_votes
ADD COLUMN IF NOT EXISTS has_rationale BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE drep_votes
SET has_rationale = TRUE
WHERE meta_url IS NOT NULL;

UPDATE drep_votes AS dv
SET has_rationale = TRUE
FROM vote_rationales AS vr
WHERE dv.vote_tx_hash = vr.vote_tx_hash
  AND vr.rationale_text IS NOT NULL
  AND btrim(vr.rationale_text) <> '';

CREATE TABLE IF NOT EXISTS sync_cursors (
  sync_type TEXT PRIMARY KEY,
  cursor_block_time INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drep_votes_block_time_tx
  ON drep_votes(block_time DESC, vote_tx_hash);

-- END 072_dd05_vote_ingestion_contract.sql

-- BEGIN 073_dd05_rationale_fetch_queue.sql
ALTER TABLE vote_rationales
  ADD COLUMN IF NOT EXISTS fetch_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fetch_status IN ('pending', 'retry', 'fetched', 'inline', 'failed')),
  ADD COLUMN IF NOT EXISTS fetch_attempts INTEGER NOT NULL DEFAULT 0
    CHECK (fetch_attempts >= 0),
  ADD COLUMN IF NOT EXISTS fetch_last_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fetch_last_error TEXT,
  ADD COLUMN IF NOT EXISTS next_fetch_at TIMESTAMPTZ;

UPDATE vote_rationales
SET
  fetch_status = CASE
    WHEN rationale_text IS NOT NULL AND btrim(rationale_text) <> '' THEN 'fetched'
    ELSE 'pending'
  END,
  fetch_attempts = COALESCE(fetch_attempts, 0),
  next_fetch_at = CASE
    WHEN rationale_text IS NOT NULL AND btrim(rationale_text) <> '' THEN NULL
    ELSE COALESCE(next_fetch_at, NOW())
  END,
  fetched_at = CASE
    WHEN rationale_text IS NOT NULL AND btrim(rationale_text) <> '' THEN COALESCE(fetched_at, NOW())
    ELSE fetched_at
  END
WHERE fetch_status IS NULL
   OR next_fetch_at IS NULL
   OR fetch_attempts IS NULL;

CREATE INDEX IF NOT EXISTS idx_vote_rationales_fetch_queue
  ON vote_rationales(fetch_status, next_fetch_at)
  WHERE meta_url IS NOT NULL;

-- END 073_dd05_rationale_fetch_queue.sql

-- BEGIN 074_dd05_sync_cursor_timestamps.sql
ALTER TABLE sync_cursors
  ADD COLUMN IF NOT EXISTS cursor_timestamp TIMESTAMPTZ;

-- END 074_dd05_sync_cursor_timestamps.sql

