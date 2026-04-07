-- Rename consistency_score -> reliability_score
-- Part of V3 scoring model: Consistency pillar replaced with Reliability
-- (streak, recency, gap penalty, tenure — orthogonal to participation)

ALTER TABLE dreps RENAME COLUMN consistency_score TO reliability_score;
ALTER TABLE drep_score_history RENAME COLUMN consistency_score TO reliability_score;

-- Store raw reliability component values for dashboard breakdown and hints
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS reliability_streak integer DEFAULT 0;
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS reliability_recency integer DEFAULT 0;
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS reliability_longest_gap integer DEFAULT 0;
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS reliability_tenure integer DEFAULT 0;
