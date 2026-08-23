begin;

-- Cyborg hard LLM boundary: service-only lineage, capabilities, replay protection and budgets.
-- This migration is deliberately non-activating: it grants no runtime/publishing/payment authority.

-- access: service-only public.hq_cyborg_chat_sessions
-- authorization-test: public.hq_cyborg_chat_sessions
create table if not exists public.hq_cyborg_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_key text not null,
  external_chat_id text not null,
  mission_id uuid references public.hq_cyborg_missions(id),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actor_key, external_chat_id)
);

-- access: service-only public.hq_cyborg_invocation_budgets
-- authorization-test: public.hq_cyborg_invocation_budgets
create table if not exists public.hq_cyborg_invocation_budgets (
  mission_id uuid primary key references public.hq_cyborg_missions(id) on delete cascade,
  max_model_calls integer not null default 64 check (max_model_calls > 0),
  calls_used integer not null default 0 check (calls_used >= 0),
  max_tokens bigint not null default 200000 check (max_tokens > 0),
  tokens_used bigint not null default 0 check (tokens_used >= 0),
  max_cost_microunits bigint check (max_cost_microunits is null or max_cost_microunits >= 0),
  cost_used_microunits bigint not null default 0 check (cost_used_microunits >= 0),
  updated_at timestamptz not null default now(),
  check (calls_used <= max_model_calls),
  check (tokens_used <= max_tokens)
);

-- access: service-only public.hq_cyborg_capabilities
-- authorization-test: public.hq_cyborg_capabilities
create table if not exists public.hq_cyborg_capabilities (
  nonce uuid primary key,
  invocation_id uuid not null unique,
  mission_id uuid not null references public.hq_cyborg_missions(id) on delete cascade,
  chat_session_id uuid not null references public.hq_cyborg_chat_sessions(id) on delete cascade,
  mission_revision text not null,
  caller_service_id text not null,
  provider text not null,
  model text not null,
  operation text not null,
  risk_class text not null check (risk_class in ('read','local_mutation','remote_mutation','production_mutation','owner_only')),
  authority_scope jsonb not null default '[]'::jsonb check (jsonb_typeof(authority_scope) = 'array'),
  tool_scope jsonb not null default '[]'::jsonb check (jsonb_typeof(tool_scope) = 'array'),
  data_classification text not null check (data_classification in ('public','internal','confidential','restricted')),
  policy_version text not null,
  max_tokens integer not null check (max_tokens > 0),
  token_hash text not null unique,
  status text not null default 'issued' check (status in ('issued','consumed','revoked')),
  issued_at timestamptz not null,
  not_before timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > not_before),
  check (expires_at <= issued_at + interval '5 minutes')
);

-- access: service-only public.hq_cyborg_model_invocations
-- authorization-test: public.hq_cyborg_model_invocations
create table if not exists public.hq_cyborg_model_invocations (
  id uuid primary key,
  mission_id uuid not null references public.hq_cyborg_missions(id) on delete cascade,
  chat_session_id uuid not null references public.hq_cyborg_chat_sessions(id) on delete cascade,
  root_mission_id uuid not null references public.hq_cyborg_missions(id) on delete cascade,
  parent_invocation_id uuid references public.hq_cyborg_model_invocations(id),
  capability_nonce uuid not null unique references public.hq_cyborg_capabilities(nonce),
  mission_revision text not null,
  caller_service_id text not null,
  provider text not null,
  model text not null,
  operation text not null,
  policy_decision text not null check (policy_decision in ('ALLOW','DENY','REQUIRE_APPROVAL','REQUIRE_REPLAN','REQUIRE_REDACTION','REQUIRE_STRONGER_MODEL')),
  request_hash text not null,
  capability_hash text not null,
  status text not null default 'running' check (status in ('accepted','running','completed','failed','denied')),
  usage jsonb not null default '{}'::jsonb,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- access: service-only public.hq_cyborg_model_responses
-- authorization-test: public.hq_cyborg_model_responses
create table if not exists public.hq_cyborg_model_responses (
  invocation_id uuid primary key references public.hq_cyborg_model_invocations(id) on delete cascade,
  mission_id uuid not null references public.hq_cyborg_missions(id) on delete cascade,
  response_hash text not null,
  policy_decision_hash text not null,
  previous_receipt_hash text,
  receipt_hash text not null unique,
  lineage_verified boolean not null default true check (lineage_verified),
  created_at timestamptz not null default now()
);

-- access: service-only public.hq_cyborg_boundary_events
-- authorization-test: public.hq_cyborg_boundary_events
create table if not exists public.hq_cyborg_boundary_events (
  id bigint generated always as identity primary key,
  mission_id uuid references public.hq_cyborg_missions(id) on delete set null,
  invocation_id uuid,
  event_code text not null,
  severity text not null check (severity in ('info','warning','high','critical')),
  details jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);

create index if not exists hq_cyborg_chat_mission_idx on public.hq_cyborg_chat_sessions(mission_id);
create index if not exists hq_cyborg_capability_mission_time_idx on public.hq_cyborg_capabilities(mission_id, expires_at desc);
create index if not exists hq_cyborg_invocation_mission_time_idx on public.hq_cyborg_model_invocations(mission_id, started_at desc);
create index if not exists hq_cyborg_response_mission_time_idx on public.hq_cyborg_model_responses(mission_id, created_at desc);
create index if not exists hq_cyborg_boundary_event_time_idx on public.hq_cyborg_boundary_events(event_code, observed_at desc);

alter table public.hq_cyborg_chat_sessions enable row level security;
alter table public.hq_cyborg_invocation_budgets enable row level security;
alter table public.hq_cyborg_capabilities enable row level security;
alter table public.hq_cyborg_model_invocations enable row level security;
alter table public.hq_cyborg_model_responses enable row level security;
alter table public.hq_cyborg_boundary_events enable row level security;

revoke all on public.hq_cyborg_chat_sessions, public.hq_cyborg_invocation_budgets,
  public.hq_cyborg_capabilities, public.hq_cyborg_model_invocations,
  public.hq_cyborg_model_responses, public.hq_cyborg_boundary_events
  from anon, authenticated;

grant select,insert,update on public.hq_cyborg_chat_sessions, public.hq_cyborg_invocation_budgets,
  public.hq_cyborg_capabilities, public.hq_cyborg_model_invocations to service_role;
grant select,insert on public.hq_cyborg_model_responses, public.hq_cyborg_boundary_events to service_role;
grant usage,select on sequence public.hq_cyborg_boundary_events_id_seq to service_role;

create or replace function public.hq_cyborg_admit_chat_mission(
  p_actor_key text, p_external_chat_id text, p_supplied_mission_id uuid, p_objective text, p_base_revision text
)
returns table(mission_id uuid, chat_session_id uuid, mission_revision text, mission_state text)
language plpgsql security invoker set search_path=public as $$
declare v_chat public.hq_cyborg_chat_sessions; v_mission public.hq_cyborg_missions;
begin
  if nullif(trim(p_actor_key),'') is null or nullif(trim(p_external_chat_id),'') is null then raise exception 'CYBORG_CHAT_IDENTITY_REQUIRED'; end if;
  if nullif(trim(p_objective),'') is null or nullif(trim(p_base_revision),'') is null then raise exception 'CYBORG_MISSION_CONTRACT_REQUIRED'; end if;
  insert into public.hq_cyborg_chat_sessions(actor_key, external_chat_id)
  values(left(trim(p_actor_key),240), left(trim(p_external_chat_id),240))
  on conflict(actor_key, external_chat_id) do update set updated_at=now() returning * into v_chat;
  if v_chat.status <> 'active' then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  if p_supplied_mission_id is not null then
    if v_chat.mission_id is null or v_chat.mission_id <> p_supplied_mission_id then raise exception 'CYBORG_CAPABILITY_MISSION_MISMATCH'; end if;
    select * into v_mission from public.hq_cyborg_missions where id=p_supplied_mission_id for update;
    if not found then raise exception 'CYBORG_MISSION_NOT_FOUND'; end if;
    if v_mission.state in ('complete','blocked','aborted') then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  elsif v_chat.mission_id is not null then
    select * into v_mission from public.hq_cyborg_missions where id=v_chat.mission_id for update;
    if found and v_mission.state in ('complete','blocked','aborted') then v_mission := null; end if;
  end if;
  if v_mission.id is null then
    insert into public.hq_cyborg_missions(objective,state,base_revision,mission)
    values(left(trim(p_objective),4000),'received',trim(p_base_revision),jsonb_build_object('source','cyborg-admission','actorKey',left(trim(p_actor_key),240),'externalChatId',left(trim(p_external_chat_id),240),'admittedAt',now()))
    returning * into v_mission;
    insert into public.hq_cyborg_invocation_budgets(mission_id) values(v_mission.id) on conflict(mission_id) do nothing;
    update public.hq_cyborg_chat_sessions set mission_id=v_mission.id,updated_at=now() where id=v_chat.id returning * into v_chat;
  end if;
  return query select v_mission.id,v_chat.id,v_mission.base_revision,v_mission.state;
end $$;

create or replace function public.hq_cyborg_register_capability(
  p_nonce uuid,p_invocation_id uuid,p_mission_id uuid,p_chat_session_id uuid,p_mission_revision text,p_caller_service_id text,
  p_provider text,p_model text,p_operation text,p_risk_class text,p_authority_scope jsonb,p_tool_scope jsonb,p_data_classification text,
  p_policy_version text,p_max_tokens integer,p_token_hash text,p_issued_at timestamptz,p_not_before timestamptz,p_expires_at timestamptz
)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_chat public.hq_cyborg_chat_sessions; v_state text;
begin
  select * into v_chat from public.hq_cyborg_chat_sessions where id=p_chat_session_id for update;
  if not found or v_chat.mission_id <> p_mission_id then raise exception 'CYBORG_CAPABILITY_MISSION_MISMATCH'; end if;
  if v_chat.status <> 'active' then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  select state into v_state from public.hq_cyborg_missions where id=p_mission_id;
  if v_state is null then raise exception 'CYBORG_MISSION_NOT_FOUND'; end if;
  if v_state in ('complete','blocked','aborted') then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  if p_risk_class in ('production_mutation','owner_only') then raise exception 'CYBORG_OWNER_APPROVAL_REQUIRED'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '5 minutes' then raise exception 'CYBORG_CAPABILITY_EXPIRY_INVALID'; end if;
  insert into public.hq_cyborg_capabilities(nonce,invocation_id,mission_id,chat_session_id,mission_revision,caller_service_id,provider,model,operation,risk_class,authority_scope,tool_scope,data_classification,policy_version,max_tokens,token_hash,issued_at,not_before,expires_at)
  values(p_nonce,p_invocation_id,p_mission_id,p_chat_session_id,p_mission_revision,p_caller_service_id,p_provider,p_model,p_operation,p_risk_class,coalesce(p_authority_scope,'[]'::jsonb),coalesce(p_tool_scope,'[]'::jsonb),p_data_classification,p_policy_version,p_max_tokens,p_token_hash,p_issued_at,p_not_before,p_expires_at);
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

create or replace function public.hq_cyborg_record_model_result(
  p_invocation_id uuid,p_response_hash text,p_policy_decision_hash text,p_previous_receipt_hash text,p_receipt_hash text,p_usage jsonb,p_error_code text default null
)
returns void language plpgsql security invoker set search_path=public as $$
declare v_mission_id uuid;
begin
  select mission_id into v_mission_id from public.hq_cyborg_model_invocations where id=p_invocation_id for update;
  if v_mission_id is null then raise exception 'CYBORG_INVOCATION_NOT_FOUND'; end if;
  if p_error_code is not null then update public.hq_cyborg_model_invocations set status='failed',usage=coalesce(p_usage,'{}'::jsonb),error_code=left(p_error_code,200),completed_at=now() where id=p_invocation_id; return; end if;
  if nullif(p_response_hash,'') is null or nullif(p_receipt_hash,'') is null then raise exception 'CYBORG_LINEAGE_REQUIRED'; end if;
  update public.hq_cyborg_model_invocations set status='completed',usage=coalesce(p_usage,'{}'::jsonb),completed_at=now() where id=p_invocation_id;
  insert into public.hq_cyborg_model_responses(invocation_id,mission_id,response_hash,policy_decision_hash,previous_receipt_hash,receipt_hash,lineage_verified)
  values(p_invocation_id,v_mission_id,p_response_hash,p_policy_decision_hash,p_previous_receipt_hash,p_receipt_hash,true);
end $$;

create or replace function public.hq_cyborg_record_boundary_event(p_event_code text,p_severity text,p_mission_id uuid default null,p_invocation_id uuid default null,p_details jsonb default '{}'::jsonb)
returns bigint language plpgsql security invoker set search_path=public as $$
declare v_id bigint;
begin
  insert into public.hq_cyborg_boundary_events(mission_id,invocation_id,event_code,severity,details)
  values(p_mission_id,p_invocation_id,left(p_event_code,160),p_severity,coalesce(p_details,'{}'::jsonb)) returning id into v_id; return v_id;
end $$;

revoke all on function public.hq_cyborg_admit_chat_mission(text,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.hq_cyborg_register_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,text,text,integer,text,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.hq_cyborg_consume_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,integer,text,text) from public,anon,authenticated;
revoke all on function public.hq_cyborg_record_model_result(uuid,text,text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.hq_cyborg_record_boundary_event(text,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hq_cyborg_admit_chat_mission(text,text,uuid,text,text) to service_role;
grant execute on function public.hq_cyborg_register_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,text,text,integer,text,timestamptz,timestamptz,timestamptz) to service_role;
grant execute on function public.hq_cyborg_consume_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,integer,text,text) to service_role;
grant execute on function public.hq_cyborg_record_model_result(uuid,text,text,text,text,jsonb,text) to service_role;
grant execute on function public.hq_cyborg_record_boundary_event(text,text,uuid,uuid,jsonb) to service_role;

commit;
