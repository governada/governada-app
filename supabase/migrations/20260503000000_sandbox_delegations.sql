create table if not exists public.sandbox_delegations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stake_address text not null check (stake_address like 'stake1%'),
  target_drep_id text not null,
  simulated_tx_hash text not null unique check (simulated_tx_hash like 'sandbox-%')
);

alter table public.sandbox_delegations enable row level security;

comment on table public.sandbox_delegations is
  'Preview-only sandbox delegation submissions. Records simulated transaction hashes without submitting on-chain.';
comment on column public.sandbox_delegations.stake_address is
  'Mainnet stake address validated by the normal delegation preflight path.';
comment on column public.sandbox_delegations.target_drep_id is
  'DRep id selected by the citizen in the delegation flow.';
comment on column public.sandbox_delegations.simulated_tx_hash is
  'Synthetic transaction hash returned to the app in sandbox mode.';

create index if not exists sandbox_delegations_stake_address_idx
  on public.sandbox_delegations (stake_address);

create index if not exists sandbox_delegations_target_drep_id_idx
  on public.sandbox_delegations (target_drep_id);

create index if not exists sandbox_delegations_created_at_idx
  on public.sandbox_delegations (created_at desc);
