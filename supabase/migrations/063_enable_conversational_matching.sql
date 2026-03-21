-- Enable conversational matching feature flag for all users.
-- The flag was created in migration 059 with enabled=false.
-- Semantic matching (conversational_matching_semantic) remains disabled
-- until the embedding pipeline is warm.

UPDATE feature_flags
SET enabled = true, updated_at = now()
WHERE key = 'conversational_matching';
