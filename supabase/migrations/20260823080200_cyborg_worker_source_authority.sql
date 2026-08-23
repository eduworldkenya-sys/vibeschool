begin;

-- Bind every new Cyborg capability to one durable source authority. Worker-backed
-- callers cannot downgrade to generic service authority. The source is consumed
-- exactly once when the capability is registered, before provider execution.
-- This migration is non-activating: it grants no Worker runtime, scheduler,
-- publishing, payment, or consequential mutation authority.

alter table public.hq_cyborg_capabilities
  add column if not exists source_authority_kind text,
  add column if not exists source_authority_ref text;

update public.hq_cyborg_capabilities
set source_authority_kind = coalesce(source_authority_kind, 'service'),
    source_authority_ref = coalesce(nullif(source_authority_ref,''), 'legacy:' || nonce::text)
where source_authority_kind is null or source_authority_ref is null or source_authority_ref='';

alter table public.hq_cyborg_capabilities
  alter column source_authority_kind set not null,
  alter column source_authority_ref set not null;

alter table public.hq_cyborg_capabilities
  drop constraint if exists hq_cyborg_capabilities_source_authority_kind_check;
alter table public.hq_cyborg_capabilities
  add constraint hq_cyborg_capabilities_source_authority_kind_check
  check (source_authority_kind in ('service','worker_model_invocation','chemistry_stage_attempt'));

alter table public.hq_cyborg_model_invocations
  add column if not exists source_authority_kind text,
  add column if not exists source_authority_ref text;

update public.hq_cyborg_model_invocations i
set source_authority_kind = c.source_authority_kind,
    source_authority_ref = c.source_authority_ref
from public.hq_cyborg_capabilities c
where c.nonce=i.capability_nonce
  and (i.source_authority_kind is null or i.source_authority_ref is null);

alter table public.hq_cyborg_model_invocations
  alter column source_authority_kind set not null,
  alter column source_authority_ref set not null;

-- access: service-only public.hq_cyborg_source_authorizations
-- authorization-test: public.hq_cyborg_source_authorizations denies anon/authenticated and is RPC-written only
create table if not exists public.hq_cyborg_source_authorizations (
  id uuid primary key default gen_random_uuid(),
  source_authority_kind text not null check (source_authority_kind in ('service','worker_model_invocation','chemistry_stage_attempt')),
  source_authority_ref text not null,
  caller_service_id text not null,
  worker_key text,
  task_id uuid,
  chemistry_attempt_id uuid,
  capability_nonce uuid not null unique references public.hq_cyborg_capabilities(nonce) on delete restrict,
  bound_at timestamptz not null default clock_timestamp(),
  unique(source_authority_kind, source_authority_ref)
);

alter table public.hq_cyborg_source_authorizations enable row level security;
revoke all on public.hq_cyborg_source_authorizations from public,anon,authenticated,service_role;
grant select on public.hq_cyborg_source_authorizations to service_role;

-- Replace the weaker registration RPC. The old signature is removed so a
-- service caller cannot mint a Worker capability without proving its Worker
-- task/model authorization or certified Chemistry shadow-stage lease.
drop function if exists public.hq_cyborg_register_capability(
  uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,jsonb,text,text,integer,text,timestamptz,timestamptz,timestamptz
);

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

  -- Caller identity determines the only acceptable authority plane. This is a
  -- database backstop against a compromised/misconfigured admission function.
  if p_caller_service_id in ('edge.content-authoring-worker','edge.content-semantic-verifier') then
    if p_source_authority_kind <> 'worker_model_invocation' then raise exception 'CYBORG_WORKER_SOURCE_AUTHORITY_REQUIRED'; end if;
  elsif p_caller_service_id in ('edge.content-critic-worker','edge.content-repair-worker') then
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

create or replace function public.hq_cyborg_consume_capability(
  p_nonce uuid,p_invocation_id uuid,p_mission_id uuid,p_chat_session_id uuid,p_mission_revision text,p_caller_service_id text,
  p_provider text,p_model text,p_operation text,p_requested_tokens integer,p_request_hash text,p_capability_hash text
)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_cap public.hq_cyborg_capabilities; v_chat public.hq_cyborg_chat_sessions; v_budget public.hq_cyborg_invocation_budgets; v_state text;
begin
  select * into v_cap from public.hq_cyborg_capabilities where nonce=p_nonce for update;
  if not found then raise exception 'CYBORG_CAPABILITY_UNKNOWN'; end if;
  if v_cap.status <> 'issued' then raise exception 'CYBORG_CAPABILITY_REPLAYED'; end if;
  if v_cap.not_before > now() then raise exception 'CYBORG_CAPABILITY_NOT_YET_VALID'; end if;
  if v_cap.expires_at <= now() then raise exception 'CYBORG_CAPABILITY_EXPIRED'; end if;
  if v_cap.invocation_id <> p_invocation_id or v_cap.mission_id <> p_mission_id or v_cap.chat_session_id <> p_chat_session_id then raise exception 'CYBORG_CAPABILITY_MISSION_MISMATCH'; end if;
  if v_cap.mission_revision <> p_mission_revision then raise exception 'CYBORG_CAPABILITY_REVISION_MISMATCH'; end if;
  if v_cap.caller_service_id <> p_caller_service_id then raise exception 'CYBORG_CAPABILITY_CALLER_MISMATCH'; end if;
  if v_cap.provider <> p_provider then raise exception 'CYBORG_CAPABILITY_PROVIDER_MISMATCH'; end if;
  if v_cap.model <> p_model then raise exception 'CYBORG_CAPABILITY_MODEL_MISMATCH'; end if;
  if v_cap.operation <> p_operation then raise exception 'CYBORG_CAPABILITY_OPERATION_MISMATCH'; end if;
  if v_cap.request_hash <> p_request_hash then raise exception 'CYBORG_CAPABILITY_REQUEST_MISMATCH'; end if;
  if p_requested_tokens <= 0 or p_requested_tokens > v_cap.max_tokens then raise exception 'CYBORG_CAPABILITY_TOKEN_BUDGET_EXCEEDED'; end if;
  if v_cap.token_hash <> p_capability_hash then raise exception 'CYBORG_CAPABILITY_HASH_MISMATCH'; end if;
  if not exists(
    select 1 from public.hq_cyborg_source_authorizations a
    where a.capability_nonce=v_cap.nonce
      and a.source_authority_kind=v_cap.source_authority_kind
      and a.source_authority_ref=v_cap.source_authority_ref
      and a.caller_service_id=v_cap.caller_service_id
  ) then raise exception 'CYBORG_SOURCE_AUTHORITY_BINDING_MISSING'; end if;

  select * into v_chat from public.hq_cyborg_chat_sessions where id=p_chat_session_id for update;
  if not found or v_chat.status <> 'active' then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  select state into v_state from public.hq_cyborg_missions where id=p_mission_id for update;
  if v_state is null then raise exception 'CYBORG_MISSION_NOT_FOUND'; end if;
  if v_state in ('complete','blocked','aborted') then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;

  insert into public.hq_cyborg_invocation_budgets(mission_id) values(p_mission_id) on conflict(mission_id) do nothing;
  select * into v_budget from public.hq_cyborg_invocation_budgets where mission_id=p_mission_id for update;
  if v_budget.calls_used+1>v_budget.max_model_calls or v_budget.tokens_used+p_requested_tokens>v_budget.max_tokens then raise exception 'CYBORG_MISSION_BUDGET_EXHAUSTED'; end if;
  update public.hq_cyborg_invocation_budgets set calls_used=calls_used+1,tokens_used=tokens_used+p_requested_tokens,updated_at=now() where mission_id=p_mission_id;
  update public.hq_cyborg_capabilities set status='consumed',consumed_at=now() where nonce=p_nonce;
  insert into public.hq_cyborg_model_invocations(
    id,mission_id,chat_session_id,root_mission_id,capability_nonce,mission_revision,caller_service_id,
    provider,model,operation,policy_decision,request_hash,capability_hash,status,
    source_authority_kind,source_authority_ref
  ) values(
    p_invocation_id,p_mission_id,p_chat_session_id,p_mission_id,p_nonce,p_mission_revision,p_caller_service_id,
    p_provider,p_model,p_operation,'ALLOW',p_request_hash,p_capability_hash,'running',
    v_cap.source_authority_kind,v_cap.source_authority_ref
  );
  return v_state;
end $$;

revoke all on function public.hq_cyborg_consume_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.hq_cyborg_consume_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,integer,text,text) to service_role;

commit;
