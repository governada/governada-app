-- Add lineage tracking for proposal forks/revisions
ALTER TABLE proposal_drafts
ADD COLUMN supersedes_id UUID REFERENCES proposal_drafts(id) ON DELETE SET NULL;

CREATE INDEX idx_proposal_drafts_supersedes ON proposal_drafts(supersedes_id)
WHERE supersedes_id IS NOT NULL;

COMMENT ON COLUMN proposal_drafts.supersedes_id IS
  'References the draft this proposal is a revision/fork of. Used for lineage tracking.';
