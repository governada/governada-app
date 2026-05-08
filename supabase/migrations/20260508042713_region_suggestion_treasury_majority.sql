create or replace function public.get_cluster_treasury_behavior(drep_ids text[])
returns table (
  proposals_30d integer,
  yes_30d integer,
  approved_30d numeric,
  proposals_90d integer,
  yes_90d integer,
  approved_90d numeric,
  proposals_180d integer,
  yes_180d integer,
  approved_180d numeric,
  proposals_all_time integer,
  yes_all_time integer,
  approved_all_time numeric
)
language sql
stable
as $$
  with cluster_members as (
    select distinct unnest(drep_ids) as drep_id
  ),
  cluster_size as (
    select count(*)::numeric as total_count
    from cluster_members
  ),
  cluster_treasury_votes as (
    select
      v.proposal_tx_hash,
      v.proposal_index,
      max(v.block_time) as latest_block_time,
      count(distinct v.drep_id) filter (where v.vote = 'Yes') as yes_count,
      cs.total_count,
      max(coalesce(p.withdrawal_amount, 0)) as withdrawal_amount
    from public.drep_votes v
    join cluster_members cm
      on cm.drep_id = v.drep_id
    cross join cluster_size cs
    join public.proposals p
      on p.tx_hash = v.proposal_tx_hash
     and p.proposal_index = v.proposal_index
    where p.proposal_type = 'TreasuryWithdrawals'
    group by v.proposal_tx_hash, v.proposal_index, cs.total_count
  ),
  cluster_treasury_behavior as (
    select
      proposal_tx_hash,
      proposal_index,
      latest_block_time,
      ((yes_count::numeric / nullif(total_count, 0)) >= 0.5) as cluster_voted_yes,
      withdrawal_amount
    from cluster_treasury_votes
  )
  select
    COUNT(*) FILTER (
      where to_timestamp(latest_block_time) > now() - interval '30 days'
    )::integer as proposals_30d,
    COUNT(*) FILTER (
      where cluster_voted_yes
        and to_timestamp(latest_block_time) > now() - interval '30 days'
    )::integer as yes_30d,
    coalesce(SUM(withdrawal_amount) FILTER (
      where cluster_voted_yes
        and to_timestamp(latest_block_time) > now() - interval '30 days'
    ), 0)::numeric as approved_30d,
    COUNT(*) FILTER (
      where to_timestamp(latest_block_time) > now() - interval '90 days'
    )::integer as proposals_90d,
    COUNT(*) FILTER (
      where cluster_voted_yes
        and to_timestamp(latest_block_time) > now() - interval '90 days'
    )::integer as yes_90d,
    coalesce(SUM(withdrawal_amount) FILTER (
      where cluster_voted_yes
        and to_timestamp(latest_block_time) > now() - interval '90 days'
    ), 0)::numeric as approved_90d,
    COUNT(*) FILTER (
      where to_timestamp(latest_block_time) > now() - interval '180 days'
    )::integer as proposals_180d,
    COUNT(*) FILTER (
      where cluster_voted_yes
        and to_timestamp(latest_block_time) > now() - interval '180 days'
    )::integer as yes_180d,
    coalesce(SUM(withdrawal_amount) FILTER (
      where cluster_voted_yes
        and to_timestamp(latest_block_time) > now() - interval '180 days'
    ), 0)::numeric as approved_180d,
    COUNT(*)::integer as proposals_all_time,
    COUNT(*) FILTER (where cluster_voted_yes)::integer as yes_all_time,
    coalesce(SUM(withdrawal_amount) FILTER (where cluster_voted_yes), 0)::numeric
      as approved_all_time
  from cluster_treasury_behavior;
$$;

revoke all on function public.get_cluster_treasury_behavior(text[]) from public;
grant execute on function public.get_cluster_treasury_behavior(text[]) to service_role;
