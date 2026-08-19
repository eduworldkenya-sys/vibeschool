-- Autopilot production commissioning: authority-clock + Founder read-model convergence.
-- NON-ACTIVATING. This migration does not enable runtime, release Global Stop,
-- activate authority, mutate domain data, widen resource scope, or grant service-role
-- Founder authority. It repairs a latent runtime activation predicate and installs the
-- canonical owner-only Founder projections when production is behind repository schema.

create or replace function public.hq_workforce_owner_set_runtime(
  p_enabled boolean,
  p_autonomy_level smallint,
  p_max_risk smallint,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid;
  gp public.hq_workforce_runtime_policies%rowtype;
  v_authority integer;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'runtime_change_requires_authenticated_owner'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'runtime_change_reason_required'; end if;

  if not coalesce(p_enabled,false) then
    update public.hq_workforce_engine_contract
       set runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,
           heartbeat_enabled=false,factory_enabled=false,updated_at=clock_timestamp()
     where singleton=true;
    return jsonb_build_object('runtime_execution_enabled',false,'runtime_autonomy_level',0,'runtime_max_risk',0,'changed_by',v_uid,'reason',btrim(p_reason));
  end if;

  if p_autonomy_level not between 1 and 4 then raise exception 'runtime_activation_autonomy_invalid'; end if;
  if p_max_risk not between 0 and 5 then raise exception 'runtime_activation_risk_invalid'; end if;
  if exists(select 1 from public.hq_workforce_execution_breakers where scope_type='global' and scope_ref='global' and status='tripped') then
    raise exception 'runtime_activation_global_breaker_tripped';
  end if;
  select * into gp from public.hq_workforce_runtime_policies
   where status='active' and scope_kind='global' and scope_key='global' and enabled
   order by updated_at desc limit 1;
  if not found then raise exception 'runtime_activation_enabled_global_policy_required'; end if;
  if p_autonomy_level>gp.max_autonomy_level or p_max_risk>gp.max_risk_class then
    raise exception 'runtime_activation_exceeds_global_policy';
  end if;
  if exists(select 1 from public.hq_workforce_engine_contract where singleton=true and (shadow_enabled or shadow_scheduler_enabled or not shadow_global_stop)) then
    raise exception 'runtime_activation_requires_shadow_stopped';
  end if;

  -- Capability authority has no effective_from column. Activation time is the canonical
  -- lower bound established by the owner-governed lifecycle transition.
  select count(*) into v_authority
    from public.hq_workforce_capability_authority_grants
   where status='active'
     and activated_at is not null
     and activated_at<=clock_timestamp()
     and revoked_at is null
     and expires_at>clock_timestamp();
  if v_authority<1 then raise exception 'runtime_activation_active_capability_authority_required'; end if;

  update public.hq_workforce_engine_contract
     set runtime_execution_enabled=true,runtime_autonomy_level=p_autonomy_level,runtime_max_risk=p_max_risk,
         heartbeat_enabled=false,factory_enabled=false,updated_at=clock_timestamp()
   where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;

  return jsonb_build_object('runtime_execution_enabled',true,'runtime_autonomy_level',p_autonomy_level,
    'runtime_max_risk',p_max_risk,'heartbeat_enabled',false,'factory_enabled',false,'changed_by',v_uid,'reason',btrim(p_reason));
end $$;

revoke all on function public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)
  to authenticated;

create or replace function public.hq_autopilot_constitution_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_global_policy jsonb:='{}'::jsonb;
  v_active_authority integer:=0;
  v_tripped_breakers integer:=0;
begin
  perform public.hq_assert_owner();
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'autopilot_engine_contract_missing'; end if;

  select coalesce(to_jsonb(p),'{}'::jsonb) into v_global_policy
    from public.hq_workforce_runtime_policies p
   where p.status='active' and p.scope_kind='global' and p.scope_key='global'
   order by p.updated_at desc limit 1;

  select count(*) into v_active_authority
    from public.hq_workforce_capability_authority_grants
   where status='active'
     and activated_at is not null
     and activated_at<=clock_timestamp()
     and revoked_at is null
     and expires_at>clock_timestamp();
  select count(*) into v_tripped_breakers
    from public.hq_workforce_execution_breakers where status='tripped';

  return jsonb_build_object(
    'constitution_version','autopilot-v1-existing-primitives',
    'runtime',jsonb_build_object(
      'execution_enabled',coalesce(ec.runtime_execution_enabled,false),
      'autonomy_level',coalesce(ec.runtime_autonomy_level,0),
      'max_risk',coalesce(ec.runtime_max_risk,0),
      'heartbeat_enabled',coalesce(ec.heartbeat_enabled,false),
      'factory_enabled',coalesce(ec.factory_enabled,false),
      'shadow_enabled',coalesce(ec.shadow_enabled,false),
      'shadow_scheduler_enabled',coalesce(ec.shadow_scheduler_enabled,false),
      'global_stop',coalesce(ec.shadow_global_stop,true),
      'anomaly_paused',coalesce(ec.runtime_anomaly_paused,false)
    ),
    'global_policy',coalesce(v_global_policy,'{}'::jsonb),
    'active_capability_authority',v_active_authority,
    'tripped_breakers',v_tripped_breakers,
    'authority_principle','owner_policy_intersection_not_worker_identity',
    'worker_names_are_authority',false
  );
end $$;

create or replace function public.hq_autopilot_founder_brief()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare
  v_total bigint:=0;
  v_completed bigint:=0;
  v_verified bigint:=0;
  v_attention bigint:=0;
  v_dead bigint:=0;
  v_findings bigint:=0;
  v_decisions bigint:=0;
  v_retries bigint:=0;
  v_verifications bigint:=0;
  v_constitution jsonb;
begin
  perform public.hq_assert_owner();
  select count(*),
         count(*) filter(where status='completed'),
         count(*) filter(where status='completed' and verification_status='verified'),
         count(*) filter(where status in ('failed','dead_letter') or verification_status='failed' or (status='running' and lease_expires_at<clock_timestamp()))
    into v_total,v_completed,v_verified,v_attention
    from public.hq_workforce_task_contracts;
  select count(*) into v_dead from public.hq_workforce_dead_letters;
  select count(*) into v_findings from public.hq_findings;
  select count(*) into v_decisions from public.hq_decisions;
  select coalesce(sum(greatest(attempt_count-1,0)),0) into v_retries from public.hq_workforce_task_contracts;
  select count(*) into v_verifications from public.hq_workforce_execution_verifications;
  v_constitution:=public.hq_autopilot_constitution_snapshot();

  return jsonb_build_object(
    'read_model_version','autopilot-founder-brief-v1',
    'generated_at',clock_timestamp(),
    'operations',jsonb_build_object(
      'total_tasks',v_total,
      'completed',v_completed,
      'independently_verified',v_verified,
      'verification_records',v_verifications,
      'retries_observed',v_retries,
      'dead_letters',v_dead,
      'attention_required',v_attention
    ),
    'founder',jsonb_build_object('findings',v_findings,'decisions',v_decisions),
    'constitution',v_constitution,
    'truth_note','Counts are derived from canonical ledgers; no inferred success is reported as verified success.'
  );
end $$;

revoke all on function public.hq_autopilot_constitution_snapshot() from public,anon,service_role;
revoke all on function public.hq_autopilot_founder_brief() from public,anon,service_role;
grant execute on function public.hq_autopilot_constitution_snapshot() to authenticated;
grant execute on function public.hq_autopilot_founder_brief() to authenticated;

-- Migration-time constitutional attestation. This change must remain non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer; d text;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'autopilot_commissioning_requires_engine_contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'autopilot_commissioning_changed_fail_closed_posture';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'autopilot_commissioning_activated_authority'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)'::regprocedure)) into d;
  if position('effective_from' in d)>0 or position('activated_at' in d)=0 or position('revoked_at is null' in d)=0 then
    raise exception 'autopilot_authority_clock_contract_invalid';
  end if;
  if has_function_privilege('service_role','public.hq_autopilot_constitution_snapshot()','EXECUTE')
     or has_function_privilege('service_role','public.hq_autopilot_founder_brief()','EXECUTE') then
    raise exception 'autopilot_founder_read_model_service_role_exposed';
  end if;
end $$;
