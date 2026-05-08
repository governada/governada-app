INSERT INTO public.feature_flags (key, enabled, description, category, targeting, updated_at)
VALUES
  (
    'globe_alignment_layout',
    true,
    'Gates cluster label visibility on the globe and the highlightCluster behavior. Part of Living Republic Epic Chunk 1.',
    'Uncategorized',
    '{}'::jsonb,
    '2026-03-30 14:28:47.520712+00'::timestamptz
  ),
  (
    'globe_spatial_match',
    true,
    'Spatial match flow: user node placement, extended reveal, neighborhood context (Living Republic Chunk 3)',
    'Uncategorized',
    '{}'::jsonb,
    '2026-03-31 13:15:46.678813+00'::timestamptz
  )
ON CONFLICT (key) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  targeting = EXCLUDED.targeting,
  updated_at = EXCLUDED.updated_at;
