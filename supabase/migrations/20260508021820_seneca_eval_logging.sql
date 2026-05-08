create table if not exists public.seneca_outputs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now() not null,
  intent text not null check (intent in ('observational', 'interrogative', 'mechanical')),
  output_text text not null,
  user_context_hash text,
  source text not null,
  cinematic_state text
);

create index if not exists seneca_outputs_created_at_idx
  on public.seneca_outputs (created_at desc);
create index if not exists seneca_outputs_intent_idx
  on public.seneca_outputs (intent);

alter table public.seneca_outputs enable row level security;

create table if not exists public.seneca_drift_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now() not null,
  output_id uuid references public.seneca_outputs(id) on delete cascade,
  intent text not null,
  output_text text not null,
  references_data boolean not null,
  literary_word_earns_keep boolean not null,
  could_columnist_write boolean not null,
  score integer not null check (score between 0 and 3),
  reasoning text not null,
  is_calibration_set boolean default false not null
);

create index if not exists seneca_drift_log_created_at_idx
  on public.seneca_drift_log (created_at desc);
create index if not exists seneca_drift_log_score_idx
  on public.seneca_drift_log (score);

alter table public.seneca_drift_log enable row level security;
