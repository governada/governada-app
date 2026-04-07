-- Drop deprecated decentralization_score column (v1 scoring leftover)
-- Not referenced by any code; staging never had it.
ALTER TABLE dreps DROP COLUMN IF EXISTS decentralization_score;
