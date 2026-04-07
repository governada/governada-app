This directory contains the pre-rebaseline migration set that used hand-numbered filenames such as `001_...` through `074_...`.

On April 7, 2026, the active Supabase migration lineage was rebaselined because the linked remote project history used incompatible timestamped versions in `supabase_migrations.schema_migrations`, which blocked `supabase db push`.

These files remain for historical reference only. They are not part of the active Supabase CLI migration chain anymore.
