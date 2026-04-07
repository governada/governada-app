-- Cross-Chain Observatory v2: add AI insight, make score/grade nullable
-- Historical rows with scores/grades are preserved; new rows will have NULLs.

ALTER TABLE governance_benchmarks
  ADD COLUMN IF NOT EXISTS ai_insight TEXT;

ALTER TABLE governance_benchmarks
  ALTER COLUMN governance_score DROP NOT NULL;

ALTER TABLE governance_benchmarks
  ALTER COLUMN grade DROP NOT NULL;
