-- Extend canonical Founder OS state with business-integrity exceptions without changing callers.
alter function public.hq_founder_os_snapshot(integer) rename to hq_founder_os_snapshot_core;
revoke all on function public.hq_founder_os_snapshot_core(integer) from public,anon,authenticated,service_role;

create or replace function public.hq_founder_os_snapshot(p_recent_limit integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  base jsonb;
  revenue jsonb;
  r13x jsonb;
  v_state text;
  v_payment_exceptions bigint;
  v_content_critical bigint;
  v_content_high bigint;
  v_content_open bigint;
begin
  perform public.hq_assert_owner();
  base:=public.hq_founder_os_snapshot_core(p_recent_limit);
  revenue:=public.hq_revenue_operations_snapshot();
  r13x:=public.hq_workforce_get_r13x_certification_snapshot(clock_timestamp()-interval '7 days');

  v_payment_exceptions:=
    coalesce((revenue#>>'{payment_attempts,processing_errors_7d}')::bigint,0)+
    coalesce((revenue#>>'{payment_attempts,callback_missing_over_15m}')::bigint,0)+
    coalesce((revenue#>>'{callbacks,processing_errors_7d}')::bigint,0)+
    coalesce((revenue#>>'{callbacks,unprocessed}')::bigint,0)+
    coalesce((revenue#>>'{reconciliation,callback_without_attempt}')::bigint,0)+
    coalesce((revenue#>>'{reconciliation,paid_without_entitlement}')::bigint,0)+
    coalesce((revenue#>>'{orders,paid_not_fulfilled}')::bigint,0);

  select count(*),
         count(*) filter(where severity='critical'),
         count(*) filter(where severity='high')
    into v_content_open,v_content_critical,v_content_high
  from public.curriculum_content_health_signals
  where status not in ('resolved','closed');

  v_state:=coalesce(base->>'company_state','ATTENTION');
  if v_state<>'INCIDENT' and (v_payment_exceptions>0 or v_content_critical>0) then
    v_state:='DEGRADED';
  elsif v_state='LIVE' and (v_content_high>0 or v_content_open>0 or coalesce((r13x->>'available')::boolean,false)=false) then
    v_state:='ATTENTION';
  end if;

  return base || jsonb_build_object(
    'company_state',v_state,
    'business_integrity',jsonb_build_object(
      'payment_exceptions',v_payment_exceptions,
      'content_health_open',v_content_open,
      'content_health_critical',v_content_critical,
      'content_health_high',v_content_high,
      'mpesa_initiation_enabled',coalesce((revenue#>>'{mpesa,initiation_enabled}')::boolean,false),
      'r13x_certification_available',coalesce((r13x->>'available')::boolean,false),
      'r13x_certified',coalesce((r13x->>'certified')::boolean,false)
    )
  );
end $$;
revoke all on function public.hq_founder_os_snapshot(integer) from public,anon,service_role;
grant execute on function public.hq_founder_os_snapshot(integer) to authenticated;
comment on function public.hq_founder_os_snapshot(integer) is 'Owner-only canonical Founder OS read model including workforce, incident, revenue/reconciliation, content-health and certification integrity.';
