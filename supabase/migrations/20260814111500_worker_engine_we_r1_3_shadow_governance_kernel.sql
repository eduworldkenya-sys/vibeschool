-- WE-R1.3: governed shadow operations kernel.
-- Additive only. This migration MUST NOT enable heartbeat, factory, cron, runtime execution, or consequential writes.
-- access: service-only public.hq_workforce_shadow_runs
-- authorization-test: public.hq_workforce_shadow_runs denies anon/authenticated direct access; function-owner runtime may append governed evidence.
-- access: service-only public.hq_workforce_shadow_events
-- authorization-test: public.hq_workforce_shadow_events denies anon/authenticated direct access; function-owner runtime may append immutable trace events.
-- access: service-only public.hq_workforce_shadow_decisions
-- authorization-test: public.hq_workforce_shadow_decisions denies anon/authenticated direct access; owner-governed functions control state transitions.
-- access: service-only public.hq_workforce_evidence
-- authorization-test: public.hq_workforce_evidence denies anon/authenticated direct access; function-owner runtime may append provenance records.

alter table public.hq_workforce_engine_contract
  add column if not exists shadow_enabled boolean not null default false,
  add column if not exists shadow_scheduler_enabled boolean not null default false,
  add column if not exists shadow_global_stop boolean not null default true,
  add column if not exists shadow_max_cycles_per_hour integer not null default 4 check (shadow_max_cycles_per_hour between 1 and 1000),
  add column if not exists shadow_max_candidates_per_cycle integer not null default 25 check (shadow_max_candidates_per_cycle between 1 and 10000);

-- Preserve the certified fail-closed production boundary.
update public.hq_workforce_engine_contract
set heartbeat_enabled=false,
    factory_enabled=false,
    runtime_execution_enabled=false,
    runtime_autonomy_level=0,
    runtime_max_risk=0,
    shadow_enabled=false,
    shadow_scheduler_enabled=false,
    shadow_global_stop=true,
    updated_at=clock_timestamp()
where singleton=true;

-- Expand the skill manifest from execution-only policy into a complete governed procedure contract.
alter table public.hq_workforce_skill_manifests
  add column if not exists purpose text,
  add column if not exists input_contract jsonb not null default '{}'::jsonb,
  add column if not exists resource_contract jsonb not null default '{}'::jsonb,
  add column if not exists preconditions jsonb not null default '[]'::jsonb,
  add column if not exists expected_outcome jsonb not null default '{}'::jsonb,
  add column if not exists verification_contract jsonb not null default '{}'::jsonb,
  add column if not exists failure_handling jsonb not null default '{}'::jsonb,
  add column if not exists retry_policy jsonb not null default '{}'::jsonb,
  add column if not exists escalation_contract jsonb not null default '{}'::jsonb,
  add column if not exists shadow_capable boolean not null default false,
  add column if not exists immutable_version_key text;

update public.hq_workforce_skill_manifests
set immutable_version_key=skill_key||'@'||version::text
where immutable_version_key is null;

create unique index if not exists hq_workforce_skill_manifest_version_key_uq
  on public.hq_workforce_skill_manifests(immutable_version_key);

create table if not exists public.hq_workforce_shadow_runs (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null default gen_random_uuid() unique,
  cycle_key text not null,
  worker_key text not null,
  lane_key text,
  skill_manifest_id uuid references public.hq_workforce_skill_manifests(id) on delete restrict,
  scope_type text not null,
  scope_ref jsonb not null default '{}'::jsonb,
  status text not null default 'observing' check (status in ('observing','detected','reasoning','proposed','awaiting_review','evaluated','closed','denied','escalated','failed')),
  confidence numeric(5,4) check (confidence is null or (confidence between 0 and 1)),
  predicted_outcome jsonb not null default '{}'::jsonb,
  consequential_action_performed boolean not null default false check (consequential_action_performed=false),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_shadow_runs_worker_idx on public.hq_workforce_shadow_runs(worker_key,created_at desc);
create index if not exists hq_workforce_shadow_runs_status_idx on public.hq_workforce_shadow_runs(status,created_at desc);

create table if not exists public.hq_workforce_shadow_events (
  id bigint generated always as identity primary key,
  trace_id uuid not null references public.hq_workforce_shadow_runs(trace_id) on delete restrict,
  parent_event_id bigint references public.hq_workforce_shadow_events(id) on delete restrict,
  event_kind text not null check (event_kind in ('observation','candidate_job','reasoning','skill_selection','proposed_action','authority_result','expected_outcome','verification','measurement','escalation','failure')),
  sequence_no integer not null check (sequence_no > 0),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp(),
  unique(trace_id,sequence_no)
);
create index if not exists hq_workforce_shadow_events_trace_idx on public.hq_workforce_shadow_events(trace_id,sequence_no);

create table if not exists public.hq_workforce_evidence (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.hq_workforce_shadow_runs(trace_id) on delete restrict,
  evidence_kind text not null check (evidence_kind in ('input','fact','rule','output','verification','measurement','provenance')),
  source_type text not null,
  source_ref text,
  observed_at timestamptz,
  content_hash text,
  classification text not null default 'internal',
  jurisdiction_key text,
  tenant_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_evidence_trace_idx on public.hq_workforce_evidence(trace_id,created_at);

-- Separate from the legacy HQ workforce Decision Inbox. Shadow approval is judgment only.
create table if not exists public.hq_workforce_shadow_decisions (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.hq_workforce_shadow_runs(trace_id) on delete restrict,
  decision_key text not null unique,
  proposed_action jsonb not null,
  required_authority jsonb not null default '{}'::jsonb,
  hypothetical_authority_result text not null check (hypothetical_authority_result in ('allow','deny','escalate')),
  authority_reason text not null,
  state text not null default 'proposed' check (state in ('proposed','awaiting_review','approved','rejected','revise','verified','closed')),
  human_rationale text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((state in ('approved','rejected','revise')) = (reviewed_at is not null) or state in ('proposed','awaiting_review','verified','closed'))
);
create index if not exists hq_workforce_shadow_decisions_state_idx on public.hq_workforce_shadow_decisions(state,created_at desc);

-- Shadow authority evaluation is deliberately hypothetical. It NEVER calls the consequential gateway.
create or replace function public.hq_workforce_shadow_evaluate_authority(
  p_trace_id uuid,
  p_skill_manifest_id uuid,
  p_requested_autonomy smallint,
  p_requested_risk smallint,
  p_scope_type text,
  p_scope_ref jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r public.hq_workforce_shadow_runs%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  v_decision text := 'deny';
  v_reason text := 'fail_closed';
begin
  select * into r from public.hq_workforce_shadow_runs where trace_id=p_trace_id;
  if not found then raise exception 'shadow_trace_not_found'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  select * into sm from public.hq_workforce_skill_manifests where id=p_skill_manifest_id;

  if not ec.shadow_enabled or ec.shadow_global_stop then
    v_reason := 'shadow_global_stop';
  elsif ec.runtime_execution_enabled or ec.runtime_autonomy_level>0 then
    v_reason := 'consequential_runtime_must_remain_off';
  elsif not found then
    v_reason := 'skill_not_found';
  elsif sm.certification_status <> 'certified' then
    v_reason := 'skill_uncertified';
  elsif not sm.shadow_capable then
    v_reason := 'skill_not_shadow_capable';
  elsif sm.expires_at is not null and sm.expires_at <= clock_timestamp() then
    v_reason := 'skill_expired';
  elsif p_requested_autonomy > 2 then
    v_reason := 'shadow_autonomy_ceiling_exceeded';
  elsif p_requested_risk > sm.risk_class then
    v_reason := 'skill_risk_ceiling_exceeded';
  elsif not (p_scope_type=any(sm.allowed_scope_types)) then
    v_reason := 'skill_scope_denied';
  elsif r.scope_type<>p_scope_type or r.scope_ref<>coalesce(p_scope_ref,'{}'::jsonb) then
    v_reason := 'trace_scope_mismatch';
  else
    v_decision := 'allow';
    v_reason := 'hypothetical_shadow_allow';
  end if;

  insert into public.hq_workforce_runtime_authorization_events(
    worker_key,skill_key,decision,reason_code,autonomy_level,risk_class,scope_type,scope_ref
  ) values(
    r.worker_key,coalesce(sm.skill_key,'unknown'),case when v_decision='allow' then 'allow' else 'deny' end,
    'shadow:'||v_reason,p_requested_autonomy,p_requested_risk,p_scope_type,coalesce(p_scope_ref,'{}'::jsonb)
  );

  return jsonb_build_object('mode','shadow','decision',v_decision,'reason',v_reason,'consequential_execution',false);
end $$;

-- Decision transitions are governance records only. Approval cannot execute a production action.
create or replace function public.hq_workforce_shadow_review_decision(
  p_decision_id uuid,
  p_state text,
  p_rationale text default null
) returns public.hq_workforce_shadow_decisions
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare d public.hq_workforce_shadow_decisions%rowtype;
begin
  if p_state not in ('approved','rejected','revise') then raise exception 'invalid_review_state'; end if;
  update public.hq_workforce_shadow_decisions
     set state=p_state,
         human_rationale=p_rationale,
         reviewed_by=auth.uid(),
         reviewed_at=clock_timestamp(),
         updated_at=clock_timestamp()
   where id=p_decision_id and state in ('proposed','awaiting_review')
   returning * into d;
  if not found then raise exception 'decision_not_reviewable'; end if;
  return d;
end $$;

-- Service-only storage; no direct client access.
alter table public.hq_workforce_shadow_runs enable row level security;
alter table public.hq_workforce_shadow_events enable row level security;
alter table public.hq_workforce_evidence enable row level security;
alter table public.hq_workforce_shadow_decisions enable row level security;

revoke all on table public.hq_workforce_shadow_runs from public,anon,authenticated;
revoke all on table public.hq_workforce_shadow_events from public,anon,authenticated;
revoke all on table public.hq_workforce_evidence from public,anon,authenticated;
revoke all on table public.hq_workforce_shadow_decisions from public,anon,authenticated;
grant select,insert,update on table public.hq_workforce_shadow_runs to service_role;
grant select,insert on table public.hq_workforce_shadow_events to service_role;
grant select,insert on table public.hq_workforce_evidence to service_role;
grant select,insert,update on table public.hq_workforce_shadow_decisions to service_role;
grant usage,select on sequence public.hq_workforce_shadow_events_id_seq to service_role;

revoke all on function public.hq_workforce_shadow_evaluate_authority(uuid,uuid,smallint,smallint,text,jsonb) from public,anon,authenticated;
revoke all on function public.hq_workforce_shadow_review_decision(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_shadow_evaluate_authority(uuid,uuid,smallint,smallint,text,jsonb) to service_role;
grant execute on function public.hq_workforce_shadow_review_decision(uuid,text,text) to service_role;

-- Structural invariant: shadow infrastructure cannot silently promote runtime state.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0
     or ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then
    raise exception 'WE-R1.3 migration violated fail-closed runtime boundary';
  end if;
end $$;
