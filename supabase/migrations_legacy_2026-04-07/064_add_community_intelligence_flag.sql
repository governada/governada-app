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
