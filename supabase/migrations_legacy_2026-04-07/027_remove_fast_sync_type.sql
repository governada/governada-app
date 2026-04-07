-- Remove 'fast' from sync_log CHECK constraint (fast sync consolidated into proposals via Inngest).
-- Also clean up any historical 'fast' rows by updating them to 'proposals'.
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN ('full', 'integrity_check', 'proposals', 'dreps', 'votes', 'secondary', 'slow', 'treasury', 'api_health_check'));

UPDATE sync_log SET sync_type = 'proposals' WHERE sync_type = 'fast';
