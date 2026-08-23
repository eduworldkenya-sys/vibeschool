begin;

alter table public.hq_cyborg_capabilities
  add column if not exists request_hash text;

update public.hq_cyborg_capabilities
set request_hash = token_hash
where request_hash is null;

alter table public.hq_cyborg_capabilities
  alter column request_hash set not null;

-- Replace the admission RPC signature so request identity is persisted before signing.
drop function if exists public.hq_cyborg_register_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,text,text,integer,text,timestamptz,timestamptz,timestamptz);

create or replace function public.hq_cyborg_register_capability(
  p_nonce uuid,p_invocation_id uuid,p_mission_id uuid,p_chat_session_id uuid,p_mission_revision text,p_caller_service_id text,
  p_provider text,p_model text,p_operation text,p_request_hash text,p_risk_class text,p_authority_scope jsonb,p_tool_scope jsonb,p_data_classification text,
  p_policy_version text,p_max_tokens integer,p_token_hash text,p_issued_at timestamptz,p_not_before timestamptz,p_expires_at timestamptz
)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_chat public.hq_cyborg_chat_sessions; v_state text;
begin
  if nullif(trim(p_request_hash),'') is null then raise exception 'CYBORG_REQUEST_HASH_REQUIRED'; end if;
  select * into v_chat from public.hq_cyborg_chat_sessions where id=p_chat_session_id for update;
  if not found or v_chat.mission_id <> p_mission_id then raise exception 'CYBORG_CAPABILITY_MISSION_MISMATCH'; end if;
  if v_chat.status <> 'active' then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  select state into v_state from public.hq_cyborg_missions where id=p_mission_id;
  if v_state is null then raise exception 'CYBORG_MISSION_NOT_FOUND'; end if;
  if v_state in ('complete','blocked','aborted') then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  if p_risk_class in ('production_mutation','owner_only') then raise exception 'CYBORG_OWNER_APPROVAL_REQUIRED'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '5 minutes' then raise exception 'CYBORG_CAPABILITY_EXPIRY_INVALID'; end if;
  insert into public.hq_cyborg_capabilities(nonce,invocation_id,mission_id,chat_session_id,mission_revision,caller_service_id,provider,model,operation,request_hash,risk_class,authority_scope,tool_scope,data_classification,policy_version,max_tokens,token_hash,issued_at,not_before,expires_at)
  values(p_nonce,p_invocation_id,p_mission_id,p_chat_session_id,p_mission_revision,p_caller_service_id,p_provider,p_model,p_operation,p_request_hash,p_risk_class,coalesce(p_authority_scope,'[]'::jsonb),coalesce(p_tool_scope,'[]'::jsonb),p_data_classification,p_policy_version,p_max_tokens,p_token_hash,p_issued_at,p_not_before,p_expires_at);
  return p_invocation_id;
end $$;

create or replace function public.hq_cyborg_consume_capability(
  p_nonce uuid,p_invocation_id uuid,p_mission_id uuid,p_chat_session_id uuid,p_mission_revision text,p_caller_service_id text,
  p_provider text,p_model text,p_operation text,p_requested_tokens integer,p_request_hash text,p_capability_hash text
)
returns text language plpgsql security invoker set search_path=public as $$
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
  insert into public.hq_cyborg_model_invocations(id,mission_id,chat_session_id,root_mission_id,capability_nonce,mission_revision,caller_service_id,provider,model,operation,policy_decision,request_hash,capability_hash,status)
  values(p_invocation_id,p_mission_id,p_chat_session_id,p_mission_id,p_nonce,p_mission_revision,p_caller_service_id,p_provider,p_model,p_operation,'ALLOW',p_request_hash,p_capability_hash,'running');
  return v_state;
end $$;

revoke all on function public.hq_cyborg_register_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,jsonb,text,text,integer,text,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.hq_cyborg_register_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,jsonb,text,text,integer,text,timestamptz,timestamptz,timestamptz) to service_role;

commit;
