-- Add community_consensus feature flag (disabled by default)
INSERT INTO feature_flags (key, enabled, description, category)
VALUES ('community_consensus', false, 'Community Consensus visualization on Hub — aggregated sentiment across all active proposals', 'engagement')
ON CONFLICT (key) DO NOTHING;
