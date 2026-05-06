-- Rollback for 20260506145651_homepage_prioritization_state.sql
-- Drops user_visit_state and prioritization_acknowledgments and all associated indexes.

drop index if exists public.user_visit_state_last_visit_at_idx;
drop index if exists public.user_visit_state_stake_address_key;
drop table if exists public.user_visit_state;

drop index if exists public.prioritization_acknowledgments_item_idx;
drop index if exists public.prioritization_acknowledgments_user_idx;
drop table if exists public.prioritization_acknowledgments;
