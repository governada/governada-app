-- Add anchor_hash column to governance_philosophy table.
-- Links a DRep's governance statement to its CIP-100 document
-- stored in rationale_documents.

ALTER TABLE governance_philosophy
  ADD COLUMN IF NOT EXISTS anchor_hash TEXT;
