begin;

-- The canonical Chemistry stage executor already proves an exact active lease in
-- cyborg-admission. Keep the database backstop equally strict: it may register a
-- chemistry_stage_attempt capability only when the caller is the canonical
-- executor and the leased stage/worker pair is exact. This grants no generic
-- service authority and does not change runtime, scheduler, publishing or payment
-- posture.
create or replace function public.hq_cyborg_register_capability(
  p_nonce uuid,
  p_invocation_id uuid,
  p_mission_id uuid,
  p_chat_session_id uuid,
  p_mission_revision text,
  p_caller_service_id text,
  p_provider text,
  p_model text,
  p_operation text,
  p_request_hash text,
  p_source_authority_kind text,
  p_source_authority_ref text,
  p_source_authority_token text,
  p_risk_class text,
  p_authority_scope jsonb,
  p_tool_scope jsonb,
  p_data_classification text,
  p_policy_version text,
  p_max_tokens integer,
  p_token_hash text,
  p_issued_at timestamptz,
  p_not_before timestamptz,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_chat public.hq_cyborg_chat_sessions%rowtype;
  v_state text;
  v_model_invocation public.hq_workforce_model_invocations%rowtype;
  v_attempt public.chemistry_worker_stage_attempts%rowtype;
  v_engine public.hq_workforce_engine_contract%rowtype;
  v_expected_worker text;
  v_expected_role text;
  v_task_id uuid;
  v_attempt_id uuid;
begin
  if nullif(trim(p_request_hash),'') is null then raise exception 'CYBORG_REQUEST_HASH_REQUIRED'; end if;
  if nullif(trim(p_source_authority_kind),'') is null or nullif(trim(p_source_authority_ref),'') is null then
    raise exception 'CYBORG_SOURCE_AUTHORITY_REQUIRED';
  end if;

  if p_caller_service_id in ('edge.content-authoring-worker','edge.content-semantic-verifier') then
    if p_source_authority_kind <> 'worker_model_invocation' then raise exception 'CYBORG_WORKER_SOURCE_AUTHORITY_REQUIRED'; end if;
  elsif p_caller_service_id in ('edge.content-critic-worker','edge.content-repair-worker','edge.chemistry-stage-executor') then
    if p_source_authority_kind <> 'chemistry_stage_attempt' then raise exception 'CYBORG_WORKER_STAGE_AUTHORITY_REQUIRED'; end if;
  elsif p_source_authority_kind <> 'service' then
    raise exception 'CYBORG_SOURCE_AUTHORITY_KIND_DENIED';
  end if;

  select * into v_chat from public.hq_cyborg_chat_sessions where id=p_chat_session_id for update;
  if not found or v_chat.mission_id <> p_mission_id then raise exception 'CYBORG_CAPABILITY_MISSION_MISMATCH'; end if;
  if v_chat.status <> 'active' then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  select state into v_state from public.hq_cyborg_missions where id=p_mission_id;
  if v_state is null then raise exception 'CYBORG_MISSION_NOT_FOUND'; end if;
  if v_state in ('complete','blocked','aborted') then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  if p_risk_class in ('production_mutation','owner_only') then raise exception 'CYBORG_OWNER_APPROVAL_REQUIRED'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '5 minutes' then raise exception 'CYBORG_CAPABILITY_EXPIRY_INVALID'; end if;

  if p_source_authority_kind='service' then
    if p_source_authority_ref <> p_invocation_id::text then raise exception 'CYBORG_SERVICE_AUTHORITY_REF_INVALID'; end if;
    if nullif(trim(coalesce(p_source_authority_token,'')),'') is not null then raise exception 'CYBORG_SERVICE_AUTHORITY_TOKEN_DENIED'; end if;

  elsif p_source_authority_kind='worker_model_invocation' then
    begin
      select * into v_model_invocation
      from public.hq_workforce_model_invocations
      where id=p_source_authority_ref::uuid
      for update;
    exception when invalid_text_representation then
      raise exception 'CYBORG_WORKER_MODEL_AUTHORITY_INVALID';
    end;
    if not found then raise exception 'CYBORG_WORKER_MODEL_AUTHORITY_NOT_FOUND'; end if;
    if v_model_invocation.status <> 'authorized' then raise exception 'CYBORG_WORKER_MODEL_AUTHORITY_NOT_AUTHORIZED'; end if;
    if v_model_invocation.model_key <> p_model then raise exception 'CYBORG_WORKER_MODEL_MISMATCH'; end if;
    if v_model_invocation.token_budget < p_max_tokens then raise exception 'CYBORG_WORKER_MODEL_BUDGET_EXCEEDED'; end if;
    if p_caller_service_id in ('edge.content-authoring-worker','edge.content-semantic-verifier')
       and v_model_invocation.worker_key <> 'content-factory-r2-canary-01' then
      raise exception 'CYBORG_WORKER_IDENTITY_MISMATCH';
    end if;
    if nullif(trim(coalesce(p_source_authority_token,'')),'') is not null then raise exception 'CYBORG_WORKER_MODEL_TOKEN_DENIED'; end if;
    v_expected_worker:=v_model_invocation.worker_key;
    v_task_id:=v_model_invocation.task_id;

  elsif p_source_authority_kind='chemistry_stage_attempt' then
    begin
      select * into v_attempt
      from public.chemistry_worker_stage_attempts
      where id=p_source_authority_ref::uuid
      for update;
    exception when invalid_text_representation then
      raise exception 'CYBORG_CHEMISTRY_STAGE_AUTHORITY_INVALID';
    end;
    if not found then raise exception 'CYBORG_CHEMISTRY_STAGE_AUTHORITY_NOT_FOUND'; end if;
    if v_attempt.state <> 'CLAIMED' then raise exception 'CYBORG_CHEMISTRY_STAGE_NOT_CLAIMED'; end if;
    if v_attempt.lease_expires_at <= clock_timestamp() then raise exception 'CYBORG_CHEMISTRY_STAGE_LEASE_EXPIRED'; end if;
    if nullif(trim(coalesce(p_source_authority_token,'')),'') is null
       or v_attempt.lease_token::text <> trim(p_source_authority_token) then
      raise exception 'CYBORG_CHEMISTRY_STAGE_LEASE_INVALID';
    end if;
    if coalesce((v_attempt.input_packet->>'side_effects_allowed')::boolean,true) then
      raise exception 'CYBORG_CHEMISTRY_SHADOW_SIDE_EFFECT_FORBIDDEN';
    end if;

    if p_caller_service_id='edge.content-critic-worker' then
      if v_attempt.stage not in ('P3_REVIEW','FRESH_P3_REVIEW') or v_attempt.worker_key <> 'content-critic-chemistry-v1' then
        raise exception 'CYBORG_CHEMISTRY_CRITIC_STAGE_MISMATCH';
      end if;
      v_expected_role:='critic';
    elsif p_caller_service_id='edge.content-repair-worker' then
      if v_attempt.stage <> 'REPAIRING' or v_attempt.worker_key <> 'content-repair-chemistry-v1' then
        raise exception 'CYBORG_CHEMISTRY_REPAIR_STAGE_MISMATCH';
      end if;
      v_expected_role:='repair';
    elsif p_caller_service_id='edge.chemistry-stage-executor' then
      if v_attempt.stage='AUTHORING' and v_attempt.worker_key='content-factory-r2-canary-01' then
        v_expected_role:='author';
      elsif v_attempt.stage in ('P2_REVIEW','FRESH_P2_REVIEW') and v_attempt.worker_key='quality-worker-01' then
        v_expected_role:='quality';
      elsif v_attempt.stage in ('P3_REVIEW','FRESH_P3_REVIEW') and v_attempt.worker_key='content-critic-chemistry-v1' then
        v_expected_role:='critic';
      elsif v_attempt.stage='REPAIRING' and v_attempt.worker_key='content-repair-chemistry-v1' then
        v_expected_role:='repair';
      else
        raise exception 'CYBORG_CHEMISTRY_EXECUTOR_STAGE_MISMATCH';
      end if;
    else
      raise exception 'CYBORG_CHEMISTRY_STAGE_CALLER_DENIED';
    end if;

    select * into v_engine from public.hq_workforce_engine_contract where singleton=true;
    if coalesce(v_engine.runtime_execution_enabled,false)
       or coalesce(v_engine.shadow_enabled,false)
       or coalesce(v_engine.shadow_scheduler_enabled,false)
       or not coalesce(v_engine.shadow_global_stop,true) then
      raise exception 'CYBORG_CHEMISTRY_STAGE_POSTURE_DRIFT';
    end if;

    perform public.content_convergence_assert_certified_worker(v_attempt.worker_key,v_expected_role);
    v_expected_worker:=v_attempt.worker_key;
    v_attempt_id:=v_attempt.id;
  else
    raise exception 'CYBORG_SOURCE_AUTHORITY_KIND_DENIED';
  end if;

  insert into public.hq_cyborg_capabilities(
    nonce,invocation_id,mission_id,chat_session_id,mission_revision,caller_service_id,
    provider,model,operation,request_hash,source_authority_kind,source_authority_ref,
    risk_class,authority_scope,tool_scope,data_classification,policy_version,max_tokens,
    token_hash,issued_at,not_before,expires_at
  ) values(
    p_nonce,p_invocation_id,p_mission_id,p_chat_session_id,p_mission_revision,p_caller_service_id,
    p_provider,p_model,p_operation,p_request_hash,p_source_authority_kind,p_source_authority_ref,
    p_risk_class,coalesce(p_authority_scope,'[]'::jsonb),coalesce(p_tool_scope,'[]'::jsonb),
    p_data_classification,p_policy_version,p_max_tokens,p_token_hash,p_issued_at,p_not_before,p_expires_at
  );

  begin
    insert into public.hq_cyborg_source_authorizations(
      source_authority_kind,source_authority_ref,caller_service_id,worker_key,task_id,
      chemistry_attempt_id,capability_nonce
    ) values(
      p_source_authority_kind,p_source_authority_ref,p_caller_service_id,v_expected_worker,v_task_id,
      v_attempt_id,p_nonce
    );
  exception when unique_violation then
    raise exception 'CYBORG_SOURCE_AUTHORITY_REPLAYED';
  end;

  return p_invocation_id;
end
$$;

revoke all on function public.hq_cyborg_register_capability(
  uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,text,text,integer,text,timestamptz,timestamptz,timestamptz
) from public,anon,authenticated;
grant execute on function public.hq_cyborg_register_capability(
  uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,text,text,integer,text,timestamptz,timestamptz,timestamptz
) to service_role;

commit;
