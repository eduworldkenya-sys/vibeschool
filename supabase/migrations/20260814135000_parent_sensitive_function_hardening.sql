begin;

-- These write functions are designed to work with the parent-child RLS boundary,
-- so they do not need SECURITY DEFINER privileges. Keep them SECURITY INVOKER
-- to preserve Postgres/Supabase row-level authorization as the final boundary.

alter function public.parent_add_health_record(uuid,text,text,text,text,text,date) security invoker;
alter function public.parent_add_health_vaccination(uuid,text,text,date,date,text) security invoker;
alter function public.parent_archive_health_record(uuid) security invoker;
alter function public.parent_archive_health_vaccination(uuid) security invoker;
alter function public.parent_add_fee_payment(uuid,numeric,text,text,text,integer,text,date) security invoker;
alter function public.parent_add_pocket_money(uuid,text,numeric,text,text,date) security invoker;
alter function public.parent_add_savings_goal(uuid,text,text,numeric,date) security invoker;
alter function public.parent_add_savings_contribution(uuid,uuid,numeric,text,date) security invoker;

commit;
