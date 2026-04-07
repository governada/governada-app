-- Governance Passport: server-side persistence for onboarding state
-- Replaces localStorage-only passport from the legacy get-started wizard

create table if not exists governance_passport (
  id uuid default gen_random_uuid() primary key,
  stake_address text unique not null,
  match_results jsonb,
  match_archetype text,
  civic_level text default 'explorer',
  ceremony_completed boolean default false,
  ring_participation real default 0,
  ring_deliberation real default 0,
  ring_impact real default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table governance_passport enable row level security;

create policy "Users can read own passport"
  on governance_passport for select
  using (stake_address = current_setting('app.stake_address', true));

create policy "Users can insert own passport"
  on governance_passport for insert
  with check (stake_address = current_setting('app.stake_address', true));

create policy "Users can update own passport"
  on governance_passport for update
  using (stake_address = current_setting('app.stake_address', true));
