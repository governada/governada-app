-- DRep Score V2 Migration
-- Run this in the Supabase SQL Editor to add the new scoring infrastructure.

-- 1. Add profile_completeness column to dreps table
ALTER TABLE dreps ADD COLUMN IF NOT EXISTS profile_completeness integer DEFAULT 0;

-- 2. Create drep_score_history table for tracking score changes over time
CREATE TABLE IF NOT EXISTS drep_score_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  drep_id text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  effective_participation integer NOT NULL DEFAULT 0,
  rationale_rate integer NOT NULL DEFAULT 0,
  consistency_score integer NOT NULL DEFAULT 0,
  profile_completeness integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (drep_id, snapshot_date)
);

-- Indexes for efficient queries on the history table
CREATE INDEX IF NOT EXISTS idx_score_history_drep_id ON drep_score_history (drep_id);
CREATE INDEX IF NOT EXISTS idx_score_history_snapshot_date ON drep_score_history (snapshot_date);

-- Enable RLS (read-only for anon, write via service role)
ALTER TABLE drep_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on drep_score_history"
  ON drep_score_history FOR SELECT
  USING (true);
