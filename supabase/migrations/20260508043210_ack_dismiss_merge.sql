create or replace function public.ack_dismiss_merge(
  p_user_id_or_stake_address text,
  p_item_id text,
  p_ack_at timestamp with time zone,
  p_dismiss_at timestamp with time zone
)
returns table (
  user_id_or_stake_address text,
  item_id text,
  acknowledged_at timestamp with time zone,
  dismissed_at timestamp with time zone
)
language sql
as $$
  insert into public.prioritization_acknowledgments (
    user_id_or_stake_address,
    item_id,
    acknowledged_at,
    dismissed_at
  )
  values (
    btrim(p_user_id_or_stake_address),
    btrim(p_item_id),
    p_ack_at,
    p_dismiss_at
  )
  on conflict (user_id_or_stake_address, item_id)
  do update set
    acknowledged_at = coalesce(
      excluded.acknowledged_at,
      prioritization_acknowledgments.acknowledged_at
    ),
    dismissed_at = coalesce(
      excluded.dismissed_at,
      prioritization_acknowledgments.dismissed_at
    )
  returning
    prioritization_acknowledgments.user_id_or_stake_address,
    prioritization_acknowledgments.item_id,
    prioritization_acknowledgments.acknowledged_at,
    prioritization_acknowledgments.dismissed_at;
$$;

revoke all on function public.ack_dismiss_merge(
  text,
  text,
  timestamp with time zone,
  timestamp with time zone
) from public;
grant execute on function public.ack_dismiss_merge(
  text,
  text,
  timestamp with time zone,
  timestamp with time zone
) to service_role;
