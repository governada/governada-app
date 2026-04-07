-- Social link reachability checks
-- Stores HEAD-check results for DRep social/reference links
CREATE TABLE IF NOT EXISTS social_link_checks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  drep_id text NOT NULL,
  uri text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  http_status integer,
  last_checked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(drep_id, uri)
);
CREATE INDEX IF NOT EXISTS idx_social_checks_drep ON social_link_checks(drep_id);
