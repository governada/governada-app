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
