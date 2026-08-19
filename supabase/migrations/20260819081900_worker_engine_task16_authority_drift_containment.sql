-- TASK 16: selected authority is part of the activation envelope. Suspension,
-- revocation or expiry while operating is a safety-reducing event and must fail closed.

create or replace function public.hq_workforce_assert_task_in_active_envelope(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  e public.hq_workforce_runtime_activation_envelopes%rowtype;
  t public.hq_workforce_task_contracts%rowtype;
  v_matching_grants integer:=0;
  v_selected_active integer:=0;
  v_active_outside integer:=0;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found or ec.runtime_state<>'CONTROLLED_OPERATING' or not ec.runtime_execution_enabled
     or ec.runtime_activation_envelope_id is null then
    raise exception 'worker_runtime_activation_envelope_required';
  end if;
  select * into e from public.hq_workforce_runtime_activation_envelopes
   where id=ec.runtime_activation_envelope_id and status='active';
  if not found then raise exception 'worker_runtime_activation_envelope_not_active'; end if;
  if e.runtime_state_version<>ec.runtime_state_version then raise exception 'worker_runtime_activation_envelope_version_mismatch'; end if;
  if e.expires_at<=clock_timestamp() then raise exception 'worker_runtime_activation_envelope_expired'; end if;
  if e.autonomy_level<>ec.runtime_autonomy_level or e.max_risk<>ec.runtime_max_risk then
    raise exception 'worker_runtime_activation_envelope_projection_mismatch';
  end if;

  select count(*) into v_selected_active
    from public.hq_workforce_capability_authority_grants g
   where g.id=any(e.authority_grant_ids)
     and g.status='active' and g.activated_at is not null and g.activated_by is not null and g.expires_at>clock_timestamp();
  if v_selected_active<>cardinality(e.authority_grant_ids) then
    raise exception 'worker_runtime_activation_envelope_authority_drift';
  end if;

  select count(*) into v_active_outside
    from public.hq_workforce_capability_authority_grants g
   where g.status='active' and g.activated_at is not null and g.activated_by is not null
     and g.expires_at>clock_timestamp() and not (g.id=any(e.authority_grant_ids));
  if v_active_outside<>0 then raise exception 'worker_runtime_unselected_active_authority_detected'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if not found then raise exception 'worker_runtime_task_not_found'; end if;

  if t.autonomous_authority_grant_id is not null then
    if not exists(
      select 1 from public.hq_workforce_capability_authority_grants g
       where g.id=t.autonomous_authority_grant_id and g.id=any(e.authority_grant_ids)
         and g.status='active' and g.activated_at is not null and g.activated_by is not null and g.expires_at>clock_timestamp()
    ) then raise exception 'worker_runtime_task_outside_activation_envelope'; end if;
    v_matching_grants:=1;
  else
    select count(*) into v_matching_grants
      from public.hq_workforce_capability_authority_grants g
     where g.id=any(e.authority_grant_ids)
       and g.status='active' and g.activated_at is not null and g.activated_by is not null and g.expires_at>clock_timestamp()
       and (g.permitted_worker_key is null or g.permitted_worker_key=t.worker_key)
       and g.capability_key=t.capability_key and g.capability_version=t.capability_version
       and g.operation=t.operation and g.resource_type=t.resource_type
       and g.scope_type=t.scope_type and g.scope_ref=t.scope_ref;
    if v_matching_grants<1 then raise exception 'worker_runtime_task_outside_activation_envelope'; end if;
  end if;

  return jsonb_build_object(
    'activation_envelope_id',e.id,'runtime_state_version',e.runtime_state_version,
    'envelope_expires_at',e.expires_at,'authority_grant_id',t.autonomous_authority_grant_id,
    'matching_selected_authority_count',v_matching_grants
  );
end $$;

create or replace function public.hq_workforce_fail_closed_envelope_authority_watchdog()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  e public.hq_workforce_runtime_activation_envelopes%rowtype;
  v_selected_active integer:=0;
  v_active_outside integer:=0;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.runtime_state<>'CONTROLLED_OPERATING' or not ec.runtime_execution_enabled or ec.runtime_activation_envelope_id is null then
    return jsonb_build_object('status','not_operating','tripped',false);
  end if;
  select * into e from public.hq_workforce_runtime_activation_envelopes where id=ec.runtime_activation_envelope_id and status='active';
  if not found then
    perform public.hq_workforce_trip_execution_breaker('global','global','runtime_envelope_missing','runtime-watchdog',jsonb_build_object('runtime_state_version',ec.runtime_state_version));
    return jsonb_build_object('status','fail_closed','tripped',true,'reason','runtime_envelope_missing');
  end if;

  select count(*) into v_selected_active from public.hq_workforce_capability_authority_grants g
   where g.id=any(e.authority_grant_ids) and g.status='active' and g.activated_at is not null and g.activated_by is not null and g.expires_at>clock_timestamp();
  select count(*) into v_active_outside from public.hq_workforce_capability_authority_grants g
   where g.status='active' and g.activated_at is not null and g.activated_by is not null and g.expires_at>clock_timestamp()
     and not (g.id=any(e.authority_grant_ids));

  if v_selected_active<>cardinality(e.authority_grant_ids) or v_active_outside<>0 then
    perform public.hq_workforce_trip_execution_breaker(
      'global','global','runtime_authority_drift','runtime-watchdog',
      jsonb_build_object('activation_envelope_id',e.id,'selected_authority_count',cardinality(e.authority_grant_ids),
        'selected_active_count',v_selected_active,'active_outside_count',v_active_outside,'runtime_state_version',ec.runtime_state_version)
    );
    return jsonb_build_object('status','fail_closed','tripped',true,'reason','runtime_authority_drift');
  end if;
  return jsonb_build_object('status','healthy','tripped',false,'selected_authority_count',v_selected_active);
end $$;

create or replace function public.hq_workforce_scheduled_bounded_runtime_queue()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_off_cleanup jsonb; v_authority_watchdog jsonb; v_watchdog jsonb; v_queue jsonb;
begin
  v_off_cleanup:=public.hq_workforce_fail_closed_off_state_authority_cleanup();
  v_authority_watchdog:=public.hq_workforce_fail_closed_envelope_authority_watchdog();
  v_watchdog:=public.hq_workforce_fail_closed_runtime_watchdog();
  v_queue:=public.hq_workforce_execute_bounded_runtime_queue(10,120);
  return coalesce(v_queue,'{}'::jsonb)||jsonb_build_object(
    'off_state_global_stop_cleanup',v_off_cleanup,'authority_watchdog',v_authority_watchdog,'runtime_watchdog',v_watchdog
  );
exception when others then
  return jsonb_build_object('status','failed_closed','error',sqlerrm,'processed',0,'consequential_execution',false);
end $$;

revoke all on function public.hq_workforce_fail_closed_envelope_authority_watchdog() from public,anon,authenticated;
grant execute on function public.hq_workforce_fail_closed_envelope_authority_watchdog() to service_role;
