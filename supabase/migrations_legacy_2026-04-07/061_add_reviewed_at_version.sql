ALTER TABLE draft_reviews
ADD COLUMN reviewed_at_version INTEGER;

COMMENT ON COLUMN draft_reviews.reviewed_at_version IS
  'The draft version number at the time this review was submitted. Used for stale review detection.';
