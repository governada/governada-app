create table if not exists public.prioritization_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  user_id_or_stake_address text not null,
  item_id text not null,
  acknowledged_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  constraint prioritization_acknowledgments_user_item_key unique (user_id_or_stake_address, item_id),
  constraint prioritization_acknowledgments_user_not_blank check (length(btrim(user_id_or_stake_address)) > 0),
  constraint prioritization_acknowledgments_item_not_blank check (length(btrim(item_id)) > 0)
);

create index if not exists prioritization_acknowledgments_user_idx
  on public.prioritization_acknowledgments (user_id_or_stake_address);

create index if not exists prioritization_acknowledgments_item_idx
  on public.prioritization_acknowledgments (item_id);

alter table public.prioritization_acknowledgments enable row level security;

create table if not exists public.user_visit_state (
  id uuid primary key default gen_random_uuid(),
  stake_address text,
  last_visit_at timestamp with time zone not null,
  prior_visit_at timestamp with time zone,
  constraint user_visit_state_stake_address_not_blank check (
    stake_address is null or length(btrim(stake_address)) > 0
  )
);

create unique index if not exists user_visit_state_stake_address_key
  on public.user_visit_state (stake_address)
  where stake_address is not null;

create index if not exists user_visit_state_last_visit_at_idx
  on public.user_visit_state (last_visit_at desc);

alter table public.user_visit_state enable row level security;
