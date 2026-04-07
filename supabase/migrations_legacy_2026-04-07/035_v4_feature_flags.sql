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
