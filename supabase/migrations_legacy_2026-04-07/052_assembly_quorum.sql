-- Add quorum_threshold to citizen_assemblies
-- When set > 0, assembly won't finalize results unless total_votes >= quorum_threshold
-- Status becomes 'quorum_not_met' instead of 'closed' when quorum not reached

ALTER TABLE citizen_assemblies
  ADD COLUMN IF NOT EXISTS quorum_threshold integer NOT NULL DEFAULT 0;

-- Allow the new status value
-- (status is a text column, no constraint change needed — just documenting)
COMMENT ON COLUMN citizen_assemblies.quorum_threshold IS
  'Minimum votes required for assembly results to be valid. 0 = no quorum.';
COMMENT ON COLUMN citizen_assemblies.status IS
  'draft | active | closed | cancelled | quorum_not_met';
