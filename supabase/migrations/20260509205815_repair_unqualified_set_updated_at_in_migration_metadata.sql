-- Repair Supabase preview-branch replay for stored migration metadata.
--
-- Production trigger statements were stored in
-- supabase_migrations.schema_migrations with unqualified
-- set_updated_at() references. Production search_path includes
-- public so the original apply succeeded; preview-branch replay
-- runs with an effectively empty search_path and fails on the
-- same statements.
--
-- The file fix in 20260407004742_systems_command_center.sql
-- aligns the file's source-of-truth representation for migration 072.
-- This migration aligns all affected stored statements that drive replay.
--
-- Idempotent: UPDATE only mutates rows whose statement still
-- contains the unqualified reference. Safe to re-apply.
--
-- This does NOT re-run the original migrations' DDL; production
-- triggers already exist and continue to work. It only corrects
-- what future preview-branch replays will execute.
--
-- Authorized: orchestrator 2026-05-09 (Tim relay), expanded to all
-- affected stored set_updated_at() statements after the pre-apply scan.

UPDATE supabase_migrations.schema_migrations
   SET statements = (
     SELECT array_agg(
       CASE
         WHEN s LIKE '%EXECUTE FUNCTION set_updated_at()%'
           THEN replace(
             s,
             'EXECUTE FUNCTION set_updated_at()',
             'EXECUTE FUNCTION public.set_updated_at()'
           )
         ELSE s
       END
       ORDER BY ord
     )
     FROM unnest(statements) WITH ORDINALITY AS t(s, ord)
   )
 WHERE EXISTS (
     SELECT 1 FROM unnest(statements) AS s
     WHERE s LIKE '%EXECUTE FUNCTION set_updated_at()%'
   );
