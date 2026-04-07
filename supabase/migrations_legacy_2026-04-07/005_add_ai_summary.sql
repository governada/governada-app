-- Add AI summary column to proposals table
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ai_summary TEXT;
