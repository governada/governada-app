-- Add suggested_text column for tracked-change suggestions
-- Phase 3b: Workspace Studio Upgrade — reviewer "Suggest Edit" persistence

ALTER TABLE proposal_annotations
  ADD COLUMN IF NOT EXISTS suggested_text jsonb DEFAULT NULL;

COMMENT ON COLUMN proposal_annotations.suggested_text IS
  'For suggestion annotations: { original: string, proposed: string, explanation: string }';

-- Add status column to track suggestion resolution (accepted/rejected/pending)
ALTER TABLE proposal_annotations
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

COMMENT ON COLUMN proposal_annotations.status IS
  'Annotation lifecycle: active (default), accepted (suggestion applied), rejected (suggestion dismissed)';
