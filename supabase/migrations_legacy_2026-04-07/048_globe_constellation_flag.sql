-- Globe constellation visualization (admin-only prototype)
INSERT INTO feature_flags (key, enabled, description, category)
VALUES ('globe_constellation', false, 'Globe-based constellation visualization (prototype)', 'visualization')
ON CONFLICT (key) DO NOTHING;
