-- HQ proof-of-control v1
-- Completes control-plane observability without inventing business decisions.
begin;

create or replace function public.hq_get_org_summary()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;begin
 perform public.hq_assert_owner();
 select jsonb_build_object(
  'departments',count(*) filter(where active),
  'functions',(select count(*) from public.hq_functions where active),
  'open_work',(select count(*) from public.hq_work_items where status in('open','in_progress','waiting_approval')),
  'waiting_approval',(select count(*) from public.hq_work_items where status='waiting_approval'),
  'overdue',(select count(*) from public.hq_work_items where status in('open','in_progress','waiting_approval') and due_at<now())
 ) into v from public.hq_departments;
 return v;
end $$;
revoke all on function public.hq_get_org_summary() from public,anon;
grant execute on function public.hq_get_org_summary() to authenticated;

create or replace function public.hq_get_control_health()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;begin
 perform public.hq_assert_owner();
 select jsonb_build_object(
  'events',jsonb_build_object('total',(select count(*) from platform_events),'fresh',(select count(*) from platform_events where coalesce(metadata->>'historical','false')<>'true'),'duplicates',(select count(*) from (select idempotency_key from platform_events where idempotency_key is not null group by idempotency_key having count(*)>1)x)),
  'notifications',jsonb_build_object('unread',(select count(*) from hq_notifications where status='unread'),'active',(select count(*) from hq_notifications where status<>'resolved')),
  'incidents',jsonb_build_object('open',(select count(*) from hq_incidents where status<>'resolved')),
  'decisions',jsonb_build_object('total',(select count(*) from hq_decisions),'active',(select count(*) from hq_decisions where status in('locked','active')),'waiting',(select count(*) from hq_decisions where status in('reviewed','approved'))),
  'propagation',jsonb_build_object('targets',(select count(*) from hq_propagation_targets),'drift',(select count(*) from hq_propagation_targets where status='drift'),'configs',(select count(*) from hq_product_configs where active)),
  'work',public.hq_get_work_health(),
  'checked_at',now()
 ) into v;
 return v;
end $$;
revoke all on function public.hq_get_control_health() from public,anon;
grant execute on function public.hq_get_control_health() to authenticated;

commit;