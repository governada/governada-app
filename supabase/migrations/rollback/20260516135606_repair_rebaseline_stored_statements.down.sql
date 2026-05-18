-- F4 rollback: restore the prior 706-statement schema_rebaseline metadata
-- bundle from the audit snapshot captured by the forward migration.

BEGIN;

UPDATE supabase_migrations.schema_migrations sm
SET
  name = audit.name,
  statements = audit.statements,
  created_by = audit.created_by,
  idempotency_key = audit.idempotency_key,
  rollback = audit.rollback
FROM supabase_migrations.audit_rebaseline_stored_statements_20260516135606 audit
WHERE sm.version = audit.version
  AND audit.version = '20260407004741'
  AND audit.snapshot_reason = 'F4 rebaseline stored statements repair 20260516135606';

DO $$
DECLARE
  restored_count integer;
BEGIN
  SELECT array_length(statements, 1)
  INTO restored_count
  FROM supabase_migrations.schema_migrations
  WHERE version = '20260407004741'
    AND name = 'schema_rebaseline';

  IF restored_count <> 706 THEN
    RAISE EXCEPTION 'F4 rollback failed: restored statement count was %', restored_count;
  END IF;
END $$;

COMMIT;
