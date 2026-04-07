-- Fix sync_log CHECK constraint: original only allowed 'fast', 'full', 'integrity_check'
-- but sync routes write 'proposals', 'dreps', 'votes', 'secondary', 'slow'.
-- SyncLogger silently caught the constraint violation, leaving v_sync_health blind.
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_sync_type_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_sync_type_check
  CHECK (sync_type IN ('fast', 'full', 'integrity_check', 'proposals', 'dreps', 'votes', 'secondary', 'slow', 'treasury', 'api_health_check'));
