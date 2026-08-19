-- VIBESCHOOL TASK 15: owner adjustments reachable from HQ without direct table writes.
-- NON-ACTIVATING: policy configuration, authority lifecycle transitions, and breaker
-- recovery remain distinct from runtime activation.

create or replace function public.hq_workforce_owner_configure_global_envelope(
  p_expected_updated_at timestamptz,
  p_enabled boolean,
  p_max_autonomy_level smallint,
  p_max_risk_class smallint,
  p_max_concurrency integer,
  p_max_executions_per_minute integer,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_uid uuid;
  v_policy_id uuid;
  v_previous jsonb;
  v_result jsonb;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'control_room_owner_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'control_room_reason_required'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.runtime_execution_enabled then raise exception 'control_room_policy_change_requires_runtime_off'; end if;
  if p_expected_updated_at is null or ec.updated_at is distinct from p_expected_updated_at then
    raise exception 'control_room_stale_runtime_state';
  end if;

  v_previous:=jsonb_build_object(
    'runtime_max_concurrency',ec.runtime_max_concurrency,
    'runtime_max_executions_per_minute',ec.runtime_max_executions_per_minute,
    'global_policy',(
      select to_jsonb(p) from (
        select policy_key,enabled,max_autonomy_level,max_risk_class,max_concurrency,max_executions_per_minute,updated_at
        from public.hq_workforce_runtime_policies
        where status='active' and scope_kind='global' and scope_key='global'
        order by updated_at desc limit 1
      ) p
    )
  );

  v_policy_id:=public.hq_workforce_owner_put_runtime_policy(
    'hq-control-room-global','global','global',coalesce(p_enabled,false),
    p_max_autonomy_level,p_max_risk_class,p_max_concurrency,p_max_executions_per_minute,
    p_reason,null,null
  );

  update public.hq_workforce_engine_contract
     set runtime_max_concurrency=p_max_concurrency,
         runtime_max_executions_per_minute=p_max_executions_per_minute,
         updated_at=clock_timestamp()
   where singleton=true;

  v_result:=jsonb_build_object(
    'policy_id',v_policy_id,'enabled',coalesce(p_enabled,false),
    'max_autonomy_level',p_max_autonomy_level,'max_risk_class',p_max_risk_class,
    'max_concurrency',p_max_concurrency,'max_executions_per_minute',p_max_executions_per_minute,
    'runtime_execution_enabled',false
  );
  insert into public.hq_workforce_owner_control_events(
    action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
  ) values(
    'runtime_policy_change',v_uid,v_previous,
    jsonb_build_object('enabled',coalesce(p_enabled,false),'max_autonomy_level',p_max_autonomy_level,
      'max_risk_class',p_max_risk_class,'max_concurrency',p_max_concurrency,
      'max_executions_per_minute',p_max_executions_per_minute),
    v_result,'succeeded',btrim(p_reason)
  );
  return v_result;
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
  v_result jsonb;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'control_room_owner_required'; end if;
  if p_action not in ('certify','activate','suspend','revoke') then raise exception 'control_room_authority_action_invalid'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'control_room_reason_required'; end if;
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

create or replace function public.hq_workforce_owner_reset_breaker(
  p_breaker_id uuid,
  p_reason text
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
  if v_uid is null then raise exception 'control_room_owner_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'control_room_reason_required'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.runtime_execution_enabled then raise exception 'control_room_breaker_reset_requires_runtime_off'; end if;
  select * into b from public.hq_workforce_execution_breakers where id=p_breaker_id for update;
  if not found then raise exception 'execution_breaker_not_found'; end if;
  if b.scope_type='global' and ec.shadow_global_stop then
    raise exception 'control_room_global_breaker_release_via_global_stop_only';
  end if;

  v_id:=public.hq_workforce_reset_execution_breaker(
    b.id,'hq-owner:'||v_uid::text,p_reason,
    jsonb_build_object('source','hq_control_room','authority_effect','none')
  );
  insert into public.hq_workforce_owner_control_events(
    action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
  ) values(
    'breaker_reset',v_uid,
    jsonb_build_object('breaker_id',b.id,'scope_type',b.scope_type,'scope_ref',b.scope_ref,'status',b.status),
    jsonb_build_object('status','reset'),
    jsonb_build_object('breaker_id',v_id,'status','reset','runtime_execution_enabled',false),
    case when b.status='reset' then 'idempotent' else 'succeeded' end,btrim(p_reason)
  );
  return jsonb_build_object('breaker_id',v_id,'status','reset','runtime_execution_enabled',false);
end $$;

revoke all on function public.hq_workforce_owner_configure_global_envelope(timestamptz,boolean,smallint,smallint,integer,integer,text)
  from public,anon,service_role;
revoke all on function public.hq_workforce_owner_control_authority(uuid,text,text)
  from public,anon,service_role;
revoke all on function public.hq_workforce_owner_reset_breaker(uuid,text)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_configure_global_envelope(timestamptz,boolean,smallint,smallint,integer,integer,text)
  to authenticated;
grant execute on function public.hq_workforce_owner_control_authority(uuid,text,text)
  to authenticated;
grant execute on function public.hq_workforce_owner_reset_breaker(uuid,text)
  to authenticated;
