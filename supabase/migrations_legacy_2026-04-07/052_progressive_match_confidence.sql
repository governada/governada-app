-- WP-11: Progressive Match Confidence
-- Adds confidence_sources JSONB column to user_governance_profiles and history tables
-- to store the breakdown of multi-source confidence scoring.

-- Add confidence_sources to profiles
ALTER TABLE user_governance_profiles
ADD COLUMN IF NOT EXISTS confidence_sources jsonb DEFAULT NULL;

-- Add confidence_sources to profile history
ALTER TABLE user_governance_profile_history
ADD COLUMN IF NOT EXISTS confidence_sources jsonb DEFAULT NULL;

-- Add has_quick_match flag to track whether user completed Quick Match
ALTER TABLE user_governance_profiles
ADD COLUMN IF NOT EXISTS has_quick_match boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN user_governance_profiles.confidence_sources IS 'Breakdown of progressive confidence sources: quizAnswers, pollVotes, proposalDiversity, engagement, delegation';
COMMENT ON COLUMN user_governance_profiles.has_quick_match IS 'Whether the user has completed the Quick Match quiz';
