-- HQ Operating System v2: deepen the existing owner report without creating parallel truth tables.
-- Production was commissioned with this exact contract before merge.

create or replace function public.hq_get_seven_day_owner_report()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_period jsonb; v_brief jsonb; v_dashboard jsonb; v_control jsonb; v_finance jsonb; v_engagement jsonb; v_goals jsonb; v_ops jsonb;
begin
  perform public.hq_assert_owner();
  v_period:=public.hq_get_company_period_report(current_date-6,current_date);
  v_brief:=public.hq_get_company_brief_v2();
  v_dashboard:=public.hq_get_executive_dashboard_v2(7);
  v_control:=public.hq_get_control_health_v2();
  v_finance:=public.hq_get_finance_metrics();
  v_engagement:=public.hq_get_product_engagement(7);
  v_goals:=public.hq_get_goal_progress();
  v_ops:=jsonb_build_object(
    'support',jsonb_build_object(
      'open_cases',(select count(*) from public.hq_support_cases where status not in ('resolved','closed')),
      'sla_breaches',(select count(*) from public.hq_support_cases where status not in ('resolved','closed') and sla_due_at is not null and sla_due_at<now()),
      'critical_cases',(select count(*) from public.hq_support_cases where status not in ('resolved','closed') and severity in ('critical','high'))),
    'notifications',jsonb_build_object(
      'pending',(select count(*) from public.hq_notification_delivery_outbox where status in ('pending','queued')),
      'failed_24h',(select count(*) from public.hq_notification_delivery_outbox where status='failed' and created_at>=now()-interval '24 hours'),
      'delivered_24h',(select count(*) from public.hq_notification_delivery_outbox where delivered_at>=now()-interval '24 hours')),
    'payments',jsonb_build_object(
      'attempts_7d',(select count(*) from public.commerce_payment_attempts where created_at>=now()-interval '7 days'),
      'settled_7d',(select count(*) from public.commerce_payment_attempts where settled_at>=now()-interval '7 days'),
      'failed_7d',(select count(*) from public.commerce_payment_attempts where created_at>=now()-interval '7 days' and (processing_error is not null or state in ('failed','cancelled','timed_out')))),
    'security',jsonb_build_object(
      'events_24h',(select count(*) from public.hq_security_events where created_at>=now()-interval '24 hours'),
      'denied_24h',(select count(*) from public.hq_security_events where created_at>=now()-interval '24 hours' and outcome in ('denied','blocked','rejected'))),
    'runtime',jsonb_build_object(
      'authorizations_24h',(select count(*) from public.hq_workforce_runtime_authorization_events where occurred_at>=now()-interval '24 hours'),
      'denials_24h',(select count(*) from public.hq_workforce_runtime_authorization_events where occurred_at>=now()-interval '24 hours' and decision in ('deny','denied','blocked','reject','rejected')))
  );
  return jsonb_build_object(
    'generated_at',now(),'period',jsonb_build_object('start',current_date-6,'end',current_date),
    'executive_questions',jsonb_build_object(
      'what_happened',v_brief->'what_happened','what_grew',v_brief->'what_grew','what_declined',v_brief->'what_declined',
      'what_broke',v_brief->'what_broke','why',v_brief->'why','who_owns_it',v_brief->'who_owns_it',
      'what_decision_is_required',v_brief->'decisions_required','what_was_automatically_done',v_brief->'automatically_taken','did_it_work',v_brief->'did_it_work'),
    'company_period',v_period,'executive_dashboard',v_dashboard,'control_plane',v_control,'finance',v_finance,'product_engagement',v_engagement,'goals',v_goals,'operations',v_ops,
    'outstanding',jsonb_build_object(
      'incidents',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'severity',severity,'title',title,'department',owner_department,'status',status,'verification_status',verification_status,'detected_at',detected_at) order by detected_at desc),'[]'::jsonb) from public.hq_incidents where status<>'resolved'),
      'findings',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'severity',severity,'title',title,'department',department_key,'decision_required',decision_required,'recommended_action',recommended_action,'status',status) order by last_detected_at desc),'[]'::jsonb) from public.hq_findings where status in('open','acknowledged','in_progress')),
      'work',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'department',w.department_key,'owner_id',w.owner_id,'priority',w.priority,'title',w.title,'status',w.status,'due_at',w.due_at,'verification_status',w.verification_status) order by case w.priority when 'critical' then 1 when 'high' then 2 else 3 end,w.due_at nulls last),'[]'::jsonb) from public.hq_work_items w where w.status in('open','in_progress','waiting_approval')),
      'support_cases',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'case_no',case_no,'severity',severity,'category',category,'title',title,'status',status,'sla_due_at',sla_due_at) order by case severity when 'critical' then 1 when 'high' then 2 else 3 end,created_at desc),'[]'::jsonb) from public.hq_support_cases where status not in ('resolved','closed'))));
end
$function$;

revoke all on function public.hq_get_seven_day_owner_report() from public, anon;
grant execute on function public.hq_get_seven_day_owner_report() to authenticated, service_role;
