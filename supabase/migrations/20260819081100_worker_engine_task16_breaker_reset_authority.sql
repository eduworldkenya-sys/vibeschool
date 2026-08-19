-- TASK 16: circuit-breaker reset authority separation.
-- NON-ACTIVATING. Service transport may trip a breaker to fail closed, but may not
-- remove a safety prohibition. Reset is an authenticated HQ-owner governance action.

create or replace function public.hq_workforce_owner_reset_execution_breaker(
  p_breaker_id uuid,
  p_expected_runtime_version bigint,
  p_reason text,
  p_evidence jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid;
  ec public.hq_workforce_engine_contract%rowtype;
  b public.hq_workforce_execution_breakers%rowtype;
  v_id uuid;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'breaker_reset_requires_authenticated_owner'; end if;
  if p_expected_runtime_version is null or p_expected_runtime_version<0 then
    raise exception 'breaker_reset_expected_runtime_version_required';
  end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'breaker_reset_reason_required'; end if;
  if coalesce(jsonb_typeof(p_evidence),'null')<>'object' then raise exception 'breaker_reset_evidence_invalid'; end if;

  perform pg_advisory_xact_lock(hashtextextended('worker-engine|task16|runtime-transition',0));
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.runtime_state_version<>p_expected_runtime_version then
    raise exception 'breaker_reset_stale_runtime_state:expected:%:actual:%',p_expected_runtime_version,ec.runtime_state_version;
  end if;

  select * into b from public.hq_workforce_execution_breakers where id=p_breaker_id for update;
  if not found then raise exception 'execution_breaker_not_found'; end if;
  if b.status='reset' then
    return jsonb_build_object('breaker_id',b.id,'status','reset','idempotent',true,'runtime_state_version',ec.runtime_state_version);
  end if;

  -- A global stop cannot be cleared while runtime is operational. The owner must first
  -- prove Safe OFF, then explicitly remove the prohibition. Reset itself grants no
  -- runtime/capability authority and does not increment runtime state version.
  if b.scope_type='global' and (
      ec.runtime_state<>'OFF' or ec.runtime_execution_enabled
      or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0
      or ec.heartbeat_enabled or ec.factory_enabled
      or ec.shadow_enabled or ec.shadow_scheduler_enabled
      or not ec.shadow_global_stop
    ) then
    raise exception 'global_breaker_reset_requires_safe_off';
  end if;

  v_id:=public.hq_workforce_reset_execution_breaker(
    b.id,
    'owner:'||v_uid::text,
    btrim(p_reason),
    p_evidence||jsonb_build_object(
      'owner_id',v_uid,
      'runtime_state',ec.runtime_state,
      'runtime_state_version',ec.runtime_state_version,
      'authority_effect','none',
      'mutation_authority_granted',false
    )
  );

  return jsonb_build_object(
    'breaker_id',v_id,
    'status','reset',
    'idempotent',false,
    'runtime_state',ec.runtime_state,
    'runtime_state_version',ec.runtime_state_version,
    'authority_effect','none'
  );
end $$;

-- Internal primitive remains usable by its owner wrapper and triggers, but no external
-- transport role can call it. Trip remains service-callable so failures can fail closed.
revoke all on function public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_owner_reset_execution_breaker(uuid,bigint,text,jsonb)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_reset_execution_breaker(uuid,bigint,text,jsonb)
  to authenticated;

-- Helper trigger functions are not application APIs.
revoke all on function public.hq_workforce_guard_runtime_transition_event_immutable()
  from public,anon,authenticated,service_role;

-- Non-activating security assertion.
do $$
begin
  if has_function_privilege('service_role','public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)','EXECUTE') then
    raise exception 'TASK16 service_role can reset breaker';
  end if;
  if has_function_privilege('anon','public.hq_workforce_owner_reset_execution_breaker(uuid,bigint,text,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_reset_execution_breaker(uuid,bigint,text,jsonb)','EXECUTE') then
    raise exception 'TASK16 owner breaker reset exposed to non-owner transport';
  end if;
  if not has_function_privilege('service_role','public.hq_workforce_trip_execution_breaker(text,text,text,text,jsonb)','EXECUTE') then
    raise exception 'TASK16 fail-closed service breaker trip unexpectedly removed';
  end if;
end $$;
