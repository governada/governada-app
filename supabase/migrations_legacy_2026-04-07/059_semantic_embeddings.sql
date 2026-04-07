-- Enable pgvector
create extension if not exists vector with schema extensions;

-- Unified embeddings table (polymorphic by entity_type)
create table public.embeddings (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('proposal', 'rationale', 'drep_profile', 'user_preference', 'proposal_draft', 'review_annotation')),
  entity_id text not null,
  secondary_id text,
  embedding extensions.vector(3072) not null,
  content_hash text not null,
  model text not null default 'text-embedding-3-large',
  dimensions int not null default 3072,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique constraint per entity
create unique index embeddings_entity_unique on public.embeddings (entity_type, entity_id, secondary_id) where secondary_id is not null;
create unique index embeddings_entity_unique_no_secondary on public.embeddings (entity_type, entity_id) where secondary_id is null;

-- Partial HNSW indexes per entity type (optimal for <100K vectors)
create index embeddings_proposal_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'proposal';
create index embeddings_rationale_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'rationale';
create index embeddings_drep_profile_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'drep_profile';
create index embeddings_user_preference_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'user_preference';
create index embeddings_proposal_draft_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'proposal_draft';
create index embeddings_review_annotation_hnsw on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where entity_type = 'review_annotation';

-- Lookup index
create index embeddings_entity_lookup on public.embeddings (entity_type, entity_id);

-- Precomputed similarity cache
create table public.semantic_similarity_cache (
  id bigint generated always as identity primary key,
  source_entity_type text not null,
  source_entity_id text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  similarity float not null,
  computed_at timestamptz not null default now(),
  unique (source_entity_type, source_entity_id, target_entity_type, target_entity_id)
);

create index similarity_cache_source on public.semantic_similarity_cache (source_entity_type, source_entity_id);

-- Shadow scoring columns on existing tables
alter table public.drep_votes
  add column if not exists embedding_proposal_relevance float,
  add column if not exists embedding_originality float;

alter table public.dreps
  add column if not exists embedding_philosophy_coherence float;

-- AI influence columns for workspace
alter table public.proposal_drafts
  add column if not exists ai_influence_score float,
  add column if not exists ai_originality_score float;

-- RPC function for vector similarity search
create or replace function public.match_embeddings(
  query_embedding extensions.vector(3072),
  match_entity_type text,
  match_threshold float default 0.5,
  match_count int default 10,
  filter_metadata jsonb default null
)
returns table (
  id bigint,
  entity_type text,
  entity_id text,
  secondary_id text,
  similarity float,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    e.id,
    e.entity_type,
    e.entity_id,
    e.secondary_id,
    1 - (e.embedding <=> query_embedding) as similarity,
    e.metadata
  from public.embeddings e
  where e.entity_type = match_entity_type
    and 1 - (e.embedding <=> query_embedding) > match_threshold
    and (filter_metadata is null or e.metadata @> filter_metadata)
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Cross-entity similarity function
create or replace function public.embedding_similarity(
  embedding_a extensions.vector(3072),
  embedding_b extensions.vector(3072)
)
returns float
language sql
immutable
as $$
  select 1 - (embedding_a <=> embedding_b);
$$;

-- RLS: public read, service_role write
alter table public.embeddings enable row level security;
alter table public.semantic_similarity_cache enable row level security;

create policy "Embeddings are publicly readable"
  on public.embeddings for select using (true);

create policy "Only service role can insert embeddings"
  on public.embeddings for insert with check (auth.role() = 'service_role');

create policy "Only service role can update embeddings"
  on public.embeddings for update using (auth.role() = 'service_role');

create policy "Only service role can delete embeddings"
  on public.embeddings for delete using (auth.role() = 'service_role');

create policy "Similarity cache is publicly readable"
  on public.semantic_similarity_cache for select using (true);

create policy "Only service role can write similarity cache"
  on public.semantic_similarity_cache for insert with check (auth.role() = 'service_role');

create policy "Only service role can update similarity cache"
  on public.semantic_similarity_cache for update using (auth.role() = 'service_role');

create policy "Only service role can delete similarity cache"
  on public.semantic_similarity_cache for delete using (auth.role() = 'service_role');

-- Feature flags for semantic embeddings (all default OFF)
insert into public.feature_flags (key, enabled, description, category) values
  ('semantic_embeddings', false, 'Master flag for semantic embedding pipeline', 'AI'),
  ('embedding_rationale_scoring', false, 'Embedding-based rationale quality sub-scores', 'AI'),
  ('embedding_governance_identity', false, 'Embedding-based governance identity sub-scores', 'AI'),
  ('embedding_research_precedent', false, 'Semantic search for research precedent skill', 'AI'),
  ('embedding_proposal_similarity', false, 'Embedding-enhanced proposal similarity', 'AI'),
  ('embedding_ghi_deliberation', false, 'Embedding-enhanced GHI deliberation quality', 'AI'),
  ('embedding_anti_gaming', false, 'Embedding-based anti-gaming detection', 'AI'),
  ('embedding_cc_blocs', false, 'Embedding-based CC bloc detection', 'AI'),
  ('embedding_ai_quality', false, 'AI quality measurement for workspace', 'AI'),
  ('conversational_matching', false, 'Conversational DRep matching flow', 'Matching'),
  ('conversational_matching_semantic', false, 'Semantic matching in conversational flow', 'Matching')
on conflict (key) do nothing;
