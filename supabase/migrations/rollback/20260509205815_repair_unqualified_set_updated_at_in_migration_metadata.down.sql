UPDATE supabase_migrations.schema_migrations
   SET statements = (
     SELECT array_agg(
       CASE
         WHEN s LIKE '%EXECUTE FUNCTION public.set_updated_at()%'
           THEN replace(
             s,
             'EXECUTE FUNCTION public.set_updated_at()',
             'EXECUTE FUNCTION set_updated_at()'
           )
         ELSE s
       END
       ORDER BY ord
     )
     FROM unnest(statements) WITH ORDINALITY AS t(s, ord)
   )
 WHERE EXISTS (
     SELECT 1 FROM unnest(statements) AS s
     WHERE s LIKE '%EXECUTE FUNCTION public.set_updated_at()%'
   );
