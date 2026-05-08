alter table public.dreps
  add column if not exists is_active boolean;

update public.dreps
set is_active = coalesce((info->>'isActive')::boolean, true)
where is_active is null
   or is_active is distinct from coalesce((info->>'isActive')::boolean, true);

alter table public.dreps
  alter column is_active set default true,
  alter column is_active set not null;
