-- Founder Workforce Command Centre truth projection. Read-only and non-activating.
-- Separates professional readiness, operational state and granted authority.

create or replace function public.hq_workforce_get_live_readiness_map()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_result jsonb;
begin
  perform public.hq_assert_owner();

  select jsonb_build_object(
    'generated_at', clock_timestamp(),
    'refresh_after_seconds', 15,
    'engine', jsonb_build_object(
      'runtime_enabled', coalesce(ec.runtime_execution_enabled,false),
      'runtime_level', coalesce(ec.runtime_autonomy_level,0),
      'max_risk', coalesce(ec.runtime_max_risk,0),
      'global_stop', coalesce(ec.shadow_global_stop,true),
      'shadow_enabled', coalesce(ec.shadow_enabled,false),
      'canary_state', case when coalesce(ec.shadow_enabled,false) then 'shadow' else 'stopped' end
    ),
    'fleet', jsonb_build_object(
      'working_now', count(*) filter(where op.operational_state='working'),
      'blocked', count(*) filter(where op.operational_state='blocked'),
      'waiting_review', count(*) filter(where op.operational_state='waiting_review'),
      'expiring_soon', count(*) filter(where a.expires_at between clock_timestamp() and clock_timestamp()+interval '7 days'),
      'expired', count(*) filter(where a.expires_at <= clock_timestamp()),
      'authority_active', count(*) filter(where coalesce(auth.active_grants,0)>0)
    ),
    'workers', coalesce(jsonb_agg(jsonb_build_object(
      'worker_key', w.worker_key,
      'title', w.title,
      'mission', w.mission,
      'department_key', w.department_key,
      'registry_status', w.status,
      'risk_class', a.risk_class,
      'qualification_state', coalesce(a.qualification_state,'UNASSESSED'),
      'certification_state', case when a.expires_at <= clock_timestamp() then 'EXPIRED' else coalesce(a.certification_state,'SUSPENDED') end,
      'legacy_recertification_required', coalesce(a.legacy_recertification_required,true),
      'certified_at', a.certified_at,
      'expires_at', a.expires_at,
      'assessment', coalesce(a.assessment,'{}'::jsonb),
      'evidence_count', coalesce(cardinality(a.certification_evidence_ids),0),
      'operational_state', coalesce(op.operational_state,case when w.status='active' then 'available' else 'stopped' end),
      'assignment', op.assignment,
      'authority', jsonb_build_object(
        'runtime_level', case when coalesce(auth.active_grants,0)>0 and ec.runtime_execution_enabled then ec.runtime_autonomy_level else 0 end,
        'risk_limit', case when coalesce(auth.active_grants,0)>0 and ec.runtime_execution_enabled then ec.runtime_max_risk else 0 end,
        'active_grants', coalesce(auth.active_grants,0),
        'capabilities', coalesce(auth.capabilities,'[]'::jsonb),
        'global_stop_applies', coalesce(ec.shadow_global_stop,true) or not coalesce(ec.runtime_execution_enabled,false)
      ),
      'latest_failure', failure.latest_failure,
      'repair_action', case
        when a.worker_key is null then 'Begin professional qualification'
        when a.expires_at <= clock_timestamp() then 'Request independent recertification'
        when a.certification_state='NEEDS_REPAIR' or a.qualification_state='FAILED_QUALIFICATION' then 'Open failed checks and repair plan'
        when coalesce(a.legacy_recertification_required,true) then 'Complete legacy recertification'
        when w.status='draft' and a.certification_state='CERTIFIED' then 'Reconcile certified assurance with draft registry'
        else null end,
      'health', health.latest_health
    ) order by w.department_key,w.worker_key),'[]'::jsonb)
  ) into v_result
  from public.hq_workforce_workers w
  cross join public.hq_workforce_engine_contract ec
  left join public.hq_workforce_worker_assurance a on a.worker_key=w.worker_key and a.standard_key='vibeschool-professional-worker' and a.standard_version=1
  left join lateral (
    select case fa.status when 'assigned' then 'assigned' when 'working' then 'working' when 'waiting_review' then 'waiting_review' when 'blocked' then 'blocked' else 'available' end operational_state,
      jsonb_build_object('id',fa.id,'title',wi.title,'status',fa.status,'priority',wi.priority,'updated_at',fa.updated_at) assignment
    from public.hq_workforce_founder_assignments fa join public.hq_work_items wi on wi.id=fa.work_item_id
    where fa.worker_key=w.worker_key and fa.status not in ('completed','cancelled') order by fa.updated_at desc limit 1
  ) op on true
  left join lateral (
    select count(*) filter(where g.status='active' and g.expires_at>clock_timestamp()) active_grants,
      coalesce(jsonb_agg(distinct g.capability_key) filter(where g.status='active' and g.expires_at>clock_timestamp()),'[]'::jsonb) capabilities
    from public.hq_workforce_capability_authority_grants g where g.permitted_worker_key=w.worker_key
  ) auth on true
  left join lateral (
    select jsonb_build_object('severity',i.severity,'outcome',i.outcome,'root_cause',i.root_cause_class,'detected_at',i.detected_at) latest_failure
    from public.hq_workforce_improvement_incidents i where i.worker_key=w.worker_key and i.outcome in ('failed','blocked','degraded') order by i.detected_at desc limit 1
  ) failure on true
  left join lateral (
    select jsonb_build_object('status',h.status,'metrics',h.metrics,'window_ended_at',h.window_ended_at) latest_health
    from public.hq_workforce_health_events h where h.scope_type='worker' and h.scope_key=w.worker_key order by h.window_ended_at desc limit 1
  ) health on true
  where ec.singleton=true
  group by ec.singleton;
  return v_result;
end
$function$;

revoke all on function public.hq_workforce_get_live_readiness_map() from public,anon;
grant execute on function public.hq_workforce_get_live_readiness_map() to authenticated;
comment on function public.hq_workforce_get_live_readiness_map() is 'Owner-only command-centre projection; read-only and non-activating.';

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then
    raise exception 'command_centre_migration_must_not_activate_runtime';
  end if;
end $$;
