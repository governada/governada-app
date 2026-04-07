-- Remove unused v4 flags (inter_body_pulse is redundant with spo_cc_votes from 033,
-- pulse_v2 has no fallback since old pulse was replaced)
DELETE FROM feature_flags WHERE key IN ('inter_body_pulse', 'pulse_v2');

-- Enable v4 features that are ready to ship
UPDATE feature_flags SET enabled = true WHERE key IN (
  'tri_body_votes',
  'discover_tabs'
);

-- spo_profiles and cc_page stay disabled until SPO/CC data is richer
