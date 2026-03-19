-- Team approval records for proposal submission.
-- The lead can always submit; editors must approve before the lead can proceed.

CREATE TABLE proposal_team_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES proposal_drafts(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES proposal_team_members(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_id, team_member_id)
);

CREATE INDEX idx_team_approvals_draft ON proposal_team_approvals(draft_id);

COMMENT ON TABLE proposal_team_approvals IS
  'Records team member approvals for proposal submission. The lead can always submit; editors must approve.';
