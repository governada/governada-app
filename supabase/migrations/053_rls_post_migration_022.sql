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
