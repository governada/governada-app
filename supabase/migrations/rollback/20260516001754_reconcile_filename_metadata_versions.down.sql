BEGIN;

UPDATE supabase_migrations.schema_migrations sm
SET version = audit.old_version
FROM supabase_migrations.audit_filename_metadata_version_reconciliation audit
WHERE sm.version = audit.new_version
  AND sm.name = audit.name
  AND audit.snapshot_reason = 'F3 filename metadata reconciliation 2026-05-16'
  AND NOT EXISTS (
    SELECT 1
    FROM supabase_migrations.schema_migrations conflict
    WHERE conflict.version = audit.old_version
  );

COMMIT;
