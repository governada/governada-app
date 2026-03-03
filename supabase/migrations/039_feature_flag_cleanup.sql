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
