-- VIBESCHOOL TASK 15: safety corrections discovered during threat review.
-- 1. Stop neutralizes active authority even if runtime is already OFF.
-- 2. Releasing owner Global Stop resets only the owner-global-stop breaker.
-- 3. Authority activation is rejected while Global Stop remains active.

create or replace function public.hq_workforce_owner_stop_operations(
  p_expected_updated_at timestamptz,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_uid uuid;
  v_result jsonb;
  v_previous jsonb;
  v_suspended integer:=0;
  g record;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'control_room_owner_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'control_room_reason_required'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if p_expected_updated_at is null or ec.updated_at is distinct from p_expected_updated_at then
    raise exception 'control_room_stale_runtime_state';
  end if;

  v_previous:=jsonb_build_object(
    'runtime_execution_enabled',ec.runtime_execution_enabled,
    'runtime_autonomy_level',ec.runtime_autonomy_level,
    'runtime_max_risk',ec.runtime_max_risk,
    'updated_at',ec.updated_at
  );

  if ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then
    v_result:=public.hq_workforce_owner_set_runtime(false,0,0,p_reason);
  else
    v_result:=jsonb_build_object(
      'runtime_execution_enabled',false,'runtime_autonomy_level',0,'runtime_max_risk',0,
      'changed_by',v_uid,'reason',btrim(p_reason)
    );
  end if;

  -- Normal Stop is also an authority cleanup operation. This intentionally executes
  -- even when runtime was already OFF, because an OFF runtime with active authority
  -- is not the requested shutdown post-condition.
  for g in
    select id from public.hq_workforce_capability_authority_grants
    where status='active'
    order by id for update
  loop
    perform public.hq_workforce_owner_transition_capability_authority(
      g.id,'suspend',p_reason,
      jsonb_build_array(jsonb_build_object('source','hq_control_room','action','stop_operations'))
    );
    v_suspended:=v_suspended+1;
  end loop;

  v_result:=v_result||jsonb_build_object('authority_suspended',v_suspended);
  insert into public.hq_workforce_owner_control_events(
    action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
  ) values(
    'stop_operations',v_uid,v_previous,
    jsonb_build_object('runtime_execution_enabled',false,'runtime_autonomy_level',0,'runtime_max_risk',0,'active_authority',0),
    v_result,
    case when not ec.runtime_execution_enabled and ec.runtime_autonomy_level=0 and ec.runtime_max_risk=0 and v_suspended=0
      then 'idempotent' else 'succeeded' end,
    btrim(p_reason)
  );
  return v_result||jsonb_build_object('idempotent',
    not ec.runtime_execution_enabled and ec.runtime_autonomy_level=0 and ec.runtime_max_risk=0 and v_suspended=0);
end $$;

create or replace function public.hq_workforce_owner_set_global_stop(
  p_active boolean,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_uid uuid;
  v_breaker uuid;
  v_previous jsonb;
  v_suspended integer:=0;
  v_reset integer:=0;
  g record;
  b record;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'control_room_owner_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'control_room_reason_required'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  v_previous:=jsonb_build_object(
    'shadow_global_stop',ec.shadow_global_stop,
    'runtime_execution_enabled',ec.runtime_execution_enabled,
    'runtime_autonomy_level',ec.runtime_autonomy_level,
    'runtime_max_risk',ec.runtime_max_risk
  );

  if coalesce(p_active,false) then
    update public.hq_workforce_engine_contract
       set runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,
           heartbeat_enabled=false,factory_enabled=false,shadow_enabled=false,
           shadow_scheduler_enabled=false,shadow_global_stop=true,updated_at=clock_timestamp()
     where singleton=true;

    v_breaker:=public.hq_workforce_trip_execution_breaker(
      'global','global','owner_global_stop','hq-owner:'||v_uid::text,
      jsonb_build_object('reason',btrim(p_reason),'source','hq_control_room')
    );

    for g in
      select id from public.hq_workforce_capability_authority_grants
      where status='active'
      order by id for update
    loop
      perform public.hq_workforce_owner_transition_capability_authority(
        g.id,'suspend',p_reason,
        jsonb_build_array(jsonb_build_object('source','hq_control_room','action','global_stop'))
      );
      v_suspended:=v_suspended+1;
    end loop;

    insert into public.hq_workforce_owner_control_events(
      action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
    ) values(
      'global_stop_activate',v_uid,v_previous,jsonb_build_object('global_stop',true),
      jsonb_build_object('global_stop',true,'runtime_execution_enabled',false,'breaker_id',v_breaker,'authority_suspended',v_suspended),
      case when ec.shadow_global_stop and not ec.runtime_execution_enabled and v_suspended=0 then 'idempotent' else 'succeeded' end,
      btrim(p_reason)
    );
    return jsonb_build_object(
      'global_stop',true,'runtime_execution_enabled',false,'breaker_id',v_breaker,
      'authority_suspended',v_suspended
    );
  end if;

  -- Releasing the owner emergency stop removes ONLY its own breaker. Any anomaly,
  -- budget or operator breaker remains tripped and continues to block runtime.
  update public.hq_workforce_engine_contract
     set shadow_global_stop=false,runtime_execution_enabled=false,runtime_autonomy_level=0,
         runtime_max_risk=0,heartbeat_enabled=false,factory_enabled=false,updated_at=clock_timestamp()
   where singleton=true;

  for b in
    select id from public.hq_workforce_execution_breakers
    where scope_type='global' and scope_ref='global' and status='tripped'
      and reason_code='owner_global_stop'
    order by created_at for update
  loop
    perform public.hq_workforce_reset_execution_breaker(
      b.id,'hq-owner:'||v_uid::text,p_reason,
      jsonb_build_object('source','hq_control_room','authority_effect','none','runtime_effect','none')
    );
    v_reset:=v_reset+1;
  end loop;

  insert into public.hq_workforce_owner_control_events(
    action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
  ) values(
    'global_stop_release',v_uid,v_previous,jsonb_build_object('global_stop',false),
    jsonb_build_object(
      'global_stop',false,'runtime_execution_enabled',false,'authority_reactivated',false,
      'owner_global_stop_breakers_reset',v_reset
    ),
    case when not ec.shadow_global_stop and v_reset=0 then 'idempotent' else 'succeeded' end,
    btrim(p_reason)
  );
  return jsonb_build_object(
    'global_stop',false,'runtime_execution_enabled',false,'authority_reactivated',false,
    'owner_global_stop_breakers_reset',v_reset
  );
end $$;

create or replace function public.hq_workforce_owner_control_authority(
  p_grant_id uuid,
  p_action text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid;
  g public.hq_workforce_capability_authority_grants%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  v_result jsonb;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'control_room_owner_required'; end if;
  if p_action not in ('certify','activate','suspend','revoke') then raise exception 'control_room_authority_action_invalid'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'control_room_reason_required'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if p_action='activate' and ec.shadow_global_stop then
    raise exception 'control_room_authority_activation_global_stop_active';
  end if;

  select * into g from public.hq_workforce_capability_authority_grants where id=p_grant_id for update;
  if not found then raise exception 'capability_authority_grant_not_found'; end if;

  v_result:=public.hq_workforce_owner_transition_capability_authority(
    g.id,p_action,p_reason,
    jsonb_build_array(jsonb_build_object('source','hq_control_room','action',p_action,'grant_key',g.grant_key))
  );
  insert into public.hq_workforce_owner_control_events(
    action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
  ) values(
    'authority_change',v_uid,
    jsonb_build_object('grant_id',g.id,'grant_key',g.grant_key,'status',g.status,'expires_at',g.expires_at),
    jsonb_build_object('action',p_action),v_result,
    case when coalesce((v_result->>'idempotent')::boolean,false) then 'idempotent' else 'succeeded' end,
    btrim(p_reason)
  );
  return v_result;
end $$;

revoke all on function public.hq_workforce_owner_stop_operations(timestamptz,text) from public,anon,service_role;
revoke all on function public.hq_workforce_owner_set_global_stop(boolean,text) from public,anon,service_role;
revoke all on function public.hq_workforce_owner_control_authority(uuid,text,text) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_stop_operations(timestamptz,text) to authenticated;
grant execute on function public.hq_workforce_owner_set_global_stop(boolean,text) to authenticated;
grant execute on function public.hq_workforce_owner_control_authority(uuid,text,text) to authenticated;
