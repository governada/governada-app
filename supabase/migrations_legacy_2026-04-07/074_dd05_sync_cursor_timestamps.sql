ALTER TABLE sync_cursors
  ADD COLUMN IF NOT EXISTS cursor_timestamp TIMESTAMPTZ;
