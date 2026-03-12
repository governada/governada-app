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
