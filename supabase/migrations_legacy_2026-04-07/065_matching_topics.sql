-- Migration: matching_topics table for dynamic topic pills
-- Applied via Supabase MCP — this file is a reference copy

create table matching_topics (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_text text not null,
  alignment_hints jsonb,
  source text not null default 'static',
  epoch_introduced integer,
  selection_count integer default 0,
  enabled boolean default true,
  trending boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed static topics
insert into matching_topics (slug, display_text, alignment_hints, source) values
  ('treasury', 'Treasury', '{"treasuryConservative": 75, "treasuryGrowth": 25}', 'static'),
  ('innovation', 'Innovation', '{"innovation": 80, "security": 30}', 'static'),
  ('security', 'Security', '{"security": 80, "innovation": 30}', 'static'),
  ('transparency', 'Transparency', '{"transparency": 85}', 'static'),
  ('decentralization', 'Decentralization', '{"decentralization": 80}', 'static'),
  ('developer-funding', 'Developer Funding', '{"treasuryGrowth": 70, "innovation": 65}', 'static'),
  ('community-growth', 'Community Growth', '{"treasuryGrowth": 60, "decentralization": 55}', 'static'),
  ('constitutional-compliance', 'Constitutional Compliance', '{"transparency": 70, "security": 60}', 'static');

-- Index for API queries (enabled + sorted by selection_count)
create index idx_matching_topics_enabled on matching_topics (enabled, source, selection_count desc);
