-- WE-R1.3 governed shadow operations kernel.
-- Additive only. Does NOT enable runtime execution, heartbeat, Factory, cron, or consequential production actions.
-- Shadow writers are restricted to Worker Engine control/evidence tables owned by this migration.

alter table public.hq_workforce_engine_contract
  add column if not exists shadow_enabled boolean not null default false,
  add column if not exists shadow_scheduler_enabled boolean not null default false,
  add column if not exists shadow_global_stop boolean not null default true,
  add column if not exists shadow_max_cycles_per_minute integer not null default 10 check (shadow_max_cycles_per_minute between 1 and 10000),
  add column if not exists shadow_max_concurrency integer not null default 1 check (shadow_max_concurrency between 1 and 1000);

update public.hq_workforce_engine_contract
set shadow_enabled=false,
    shadow_scheduler_enabled=false,
    shadow_global_stop=true,
    runtime_execution_enabled=false,
    runtime_autonomy_level=0,
    runtime_max_risk=0,
    heartbeat_enabled=false,
    factory_enabled=false,
    updated_at=clock_timestamp()
where singleton=true;

-- R1.3.2: extend the existing immutable/versioned manifest contract with operational semantics.
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
  add column if not exists immutable_fingerprint text;

-- Existing certified execution manifests are NOT silently promoted to shadow-capable.
update public.hq_workforce_skill_manifests
set shadow_capable=false
where shadow_capable is distinct from false;

create table if not exists public.hq_workforce_shadow_runs (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null unique default gen_random_uuid(),
  parent_trace_id uuid,
  correlation_key text,
  worker_key text not null,
  lane_key text not null,
  skill_manifest_id uuid references public.hq_workforce_skill_manifests(id) on delete restrict,
  skill_key text,
  skill_version integer,
  scope_type text not null,
  scope_ref jsonb not null default '{}'::jsonb,
  jurisdiction_key text,
  tenant_key text,
  status text not null default 'observing' check (status in ('observing','detected','reasoned','proposed','awaiting_review','reviewed','verified','closed','denied','escalated','failed','paused')),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check (completed_at is null or completed_at >= started_at)
);
create index if not exists hq_workforce_shadow_runs_worker_idx on public.hq_workforce_shadow_runs(worker_key,created_at desc);
create index if not exists hq_workforce_shadow_runs_status_idx on public.hq_workforce_shadow_runs(status,created_at desc);
create index if not exists hq_workforce_shadow_runs_tenant_idx on public.hq_workforce_shadow_runs(tenant_key,created_at desc);

create table if not exists public.hq_workforce_shadow_events (
  id bigint generated always as identity primary key,
  trace_id uuid not null references public.hq_workforce_shadow_runs(trace_id) on delete cascade,
  event_type text not null check (event_type in ('observation','candidate_job','reasoning','skill_selection','proposed_action','authority_result','evidence','expected_outcome','verification','measurement','escalation','failure')),
  sequence_no integer not null check (sequence_no > 0),
  event_payload jsonb not null default '{}'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  occurred_at timestamptz not null default clock_timestamp(),
  unique(trace_id,sequence_no)
);
create index if not exists hq_workforce_shadow_events_trace_idx on public.hq_workforce_shadow_events(trace_id,sequence_no);

create table if not exists public.hq_workforce_shadow_evidence (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.hq_workforce_shadow_runs(trace_id) on delete cascade,
  evidence_kind text not null check (evidence_kind in ('fact','query_result','rule','policy','skill_contract','authority_check','human_decision','verification','measurement')),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb,
  classification text not null default 'internal' check (classification in ('public','internal','school','teacher','learner_sensitive','security_sensitive')),
  jurisdiction_key text,
  tenant_key text,
  observed_at timestamptz not null default clock_timestamp(),
  valid_until timestamptz,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text,
  created_at timestamptz not null default clock_timestamp(),
  check (valid_until is null or valid_until >= observed_at)
);
create index if not exists hq_workforce_shadow_evidence_trace_idx on public.hq_workforce_shadow_evidence(trace_id,created_at);

create table if not exists public.hq_workforce_shadow_proposals (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null unique references public.hq_workforce_shadow_runs(trace_id) on delete cascade,
  worker_key text not null,
  skill_manifest_id uuid not null references public.hq_workforce_skill_manifests(id) on delete restrict,
  proposed_action_key text not null,
  proposed_payload jsonb not null default '{}'::jsonb,
  target_resource_type text not null,
  target_scope_type text not null,
  target_scope_ref jsonb not null default '{}'::jsonb,
  risk_class smallint not null check (risk_class between 0 and 5),
  required_autonomy_level smallint not null check (required_autonomy_level between 0 and 4),
  hypothetical_authority text not null default 'pending' check (hypothetical_authority in ('pending','allow_if_authorized','deny','escalate')),
  authority_reason text,
  expected_outcome jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  consequential boolean not null default true,
  created_at timestamptz not null default clock_timestamp()
);

-- R1.3.3: first-class human decision governance. Approval is judgment only in WE-R1.3.
create table if not exists public.hq_workforce_shadow_decisions (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.hq_workforce_shadow_runs(trace_id) on delete cascade,
  proposal_id uuid not null unique references public.hq_workforce_shadow_proposals(id) on delete cascade,
  state text not null default 'proposed' check (state in ('proposed','awaiting_review','approved','rejected','revise','verified','closed')),
  requested_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  reviewer_id uuid,
  reviewer_note text,
  revision_request jsonb,
  execution_authorized boolean not null default false,
  closed_at timestamptz,
  check (execution_authorized=false)
);
create index if not exists hq_workforce_shadow_decisions_state_idx on public.hq_workforce_shadow_decisions(state,requested_at);

create table if not exists public.hq_workforce_shadow_measurements (
  id bigint generated always as identity primary key,
  trace_id uuid not null references public.hq_workforce_shadow_runs(trace_id) on delete cascade,
  metric_key text not null,
  metric_value numeric,
  metric_bool boolean,
  metric_text text,
  measured_at timestamptz not null default clock_timestamp(),
  check (num_nonnulls(metric_value,metric_bool,metric_text)=1)
);
create index if not exists hq_workforce_shadow_measurements_metric_idx on public.hq_workforce_shadow_measurements(metric_key,measured_at desc);

-- Fail-closed hypothetical authority evaluator. It never calls the production tool gateway.
create or replace function public.hq_workforce_evaluate_shadow_authority(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  p public.hq_workforce_shadow_proposals%rowtype;
  r public.hq_workforce_shadow_runs%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  decision text := 'deny';
  reason text := 'shadow_fail_closed';
begin
  select * into p from public.hq_workforce_shadow_proposals where id=p_proposal_id for update;
  if not found then raise exception 'shadow_proposal_not_found'; end if;
  select * into r from public.hq_workforce_shadow_runs where trace_id=p.trace_id;
  if not found then raise exception 'shadow_trace_not_found'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  select * into sm from public.hq_workforce_skill_manifests where id=p.skill_manifest_id;
  if not found then reason := 'skill_manifest_missing';
  elsif sm.certification_status <> 'certified' then reason := 'skill_uncertified';
  elsif not sm.shadow_capable then reason := 'skill_not_shadow_capable';
  elsif sm.expires_at is not null and sm.expires_at <= clock_timestamp() then reason := 'skill_expired';
  elsif p.worker_key <> r.worker_key then reason := 'worker_trace_mismatch';
  elsif p.target_scope_type <> r.scope_type then reason := 'scope_type_mismatch';
  elsif p.target_scope_ref <> r.scope_ref then reason := 'scope_ref_mismatch';
  elsif not (p.target_scope_type = any(sm.allowed_scope_types)) then reason := 'skill_scope_denied';
  elsif p.risk_class > sm.risk_class then reason := 'proposal_risk_exceeds_skill';
  elsif p.required_autonomy_level > sm.autonomy_required then reason := 'proposal_autonomy_exceeds_skill';
  elsif p.consequential and p.required_autonomy_level >= 3 then
    decision := 'escalate'; reason := 'shadow_never_executes_consequential_action';
  else
    decision := 'allow_if_authorized'; reason := 'shadow_hypothetical_only';
  end if;

  -- Shadow remains gated globally; an OFF state is evidence, not permission to execute.
  if not ec.shadow_enabled or ec.shadow_global_stop then
    if decision='allow_if_authorized' then decision := 'deny'; end if;
    reason := 'shadow_global_stop';
  end if;

  update public.hq_workforce_shadow_proposals
     set hypothetical_authority=decision, authority_reason=reason
   where id=p.id;

  insert into public.hq_workforce_shadow_events(trace_id,event_type,sequence_no,event_payload)
  select p.trace_id,'authority_result',coalesce(max(sequence_no),0)+1,
         jsonb_build_object('decision',decision,'reason',reason,'proposal_id',p.id,'hypothetical',true)
    from public.hq_workforce_shadow_events where trace_id=p.trace_id;

  return jsonb_build_object('decision',decision,'reason',reason,'proposal_id',p.id,'hypothetical',true,'executed',false);
end $$;

-- R1.3.4: the shadow gateway can only append evidence/control records.
create or replace function public.hq_workforce_shadow_record_proposal(
  p_trace_id uuid,
  p_worker_key text,
  p_skill_manifest_id uuid,
  p_action_key text,
  p_payload jsonb,
  p_target_resource_type text,
  p_target_scope_type text,
  p_target_scope_ref jsonb,
  p_risk_class smallint,
  p_required_autonomy smallint,
  p_expected_outcome jsonb,
  p_confidence numeric
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r public.hq_workforce_shadow_runs%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
  proposal_id uuid;
  seq integer;
begin
  select * into r from public.hq_workforce_shadow_runs where trace_id=p_trace_id for update;
  if not found then raise exception 'shadow_trace_not_found'; end if;
  if r.worker_key<>p_worker_key then raise exception 'shadow_worker_identity_mismatch'; end if;
  select * into sm from public.hq_workforce_skill_manifests where id=p_skill_manifest_id;
  if not found or sm.certification_status<>'certified' or not sm.shadow_capable then raise exception 'shadow_skill_not_certified'; end if;
  if p_target_scope_type<>r.scope_type or p_target_scope_ref<>r.scope_ref then raise exception 'shadow_scope_mismatch'; end if;
  if p_confidence<0 or p_confidence>1 then raise exception 'shadow_confidence_invalid'; end if;

  insert into public.hq_workforce_shadow_proposals(
    trace_id,worker_key,skill_manifest_id,proposed_action_key,proposed_payload,target_resource_type,
    target_scope_type,target_scope_ref,risk_class,required_autonomy_level,expected_outcome,confidence,consequential
  ) values(
    p_trace_id,p_worker_key,p_skill_manifest_id,p_action_key,coalesce(p_payload,'{}'::jsonb),p_target_resource_type,
    p_target_scope_type,coalesce(p_target_scope_ref,'{}'::jsonb),p_risk_class,p_required_autonomy,coalesce(p_expected_outcome,'{}'::jsonb),p_confidence,true
  ) returning id into proposal_id;

  select coalesce(max(sequence_no),0)+1 into seq from public.hq_workforce_shadow_events where trace_id=p_trace_id;
  insert into public.hq_workforce_shadow_events(trace_id,event_type,sequence_no,event_payload,confidence)
  values(p_trace_id,'proposed_action',seq,jsonb_build_object('proposal_id',proposal_id,'action_key',p_action_key,'consequential',true),p_confidence);

  insert into public.hq_workforce_shadow_decisions(trace_id,proposal_id,state,execution_authorized)
  values(p_trace_id,proposal_id,'awaiting_review',false);

  update public.hq_workforce_shadow_runs set status='awaiting_review',confidence=p_confidence where trace_id=p_trace_id;
  return proposal_id;
end $$;

create or replace function public.hq_workforce_shadow_review_decision(
  p_decision_id uuid,
  p_state text,
  p_reviewer_id uuid,
  p_note text default null,
  p_revision_request jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare d public.hq_workforce_shadow_decisions%rowtype;
begin
  if p_state not in ('approved','rejected','revise') then raise exception 'shadow_review_state_invalid'; end if;
  select * into d from public.hq_workforce_shadow_decisions where id=p_decision_id for update;
  if not found then raise exception 'shadow_decision_not_found'; end if;
  if d.state not in ('proposed','awaiting_review','revise') then raise exception 'shadow_decision_not_reviewable'; end if;

  update public.hq_workforce_shadow_decisions
     set state=p_state,reviewed_at=clock_timestamp(),reviewer_id=p_reviewer_id,reviewer_note=p_note,
         revision_request=p_revision_request,execution_authorized=false
   where id=p_decision_id;
  update public.hq_workforce_shadow_runs
     set status='reviewed'
   where trace_id=d.trace_id;

  return jsonb_build_object('decision_id',p_decision_id,'state',p_state,'execution_authorized',false,'executed',false);
end $$;

-- Service-only tables; application access must flow through owner/service governance paths.
alter table public.hq_workforce_shadow_runs enable row level security;
alter table public.hq_workforce_shadow_events enable row level security;
alter table public.hq_workforce_shadow_evidence enable row level security;
alter table public.hq_workforce_shadow_proposals enable row level security;
alter table public.hq_workforce_shadow_decisions enable row level security;
alter table public.hq_workforce_shadow_measurements enable row level security;

revoke all on table public.hq_workforce_shadow_runs from anon, authenticated;
revoke all on table public.hq_workforce_shadow_events from anon, authenticated;
revoke all on table public.hq_workforce_shadow_evidence from anon, authenticated;
revoke all on table public.hq_workforce_shadow_proposals from anon, authenticated;
revoke all on table public.hq_workforce_shadow_decisions from anon, authenticated;
revoke all on table public.hq_workforce_shadow_measurements from anon, authenticated;

grant select,insert,update on table public.hq_workforce_shadow_runs to service_role;
grant select,insert on table public.hq_workforce_shadow_events to service_role;
grant select,insert on table public.hq_workforce_shadow_evidence to service_role;
grant select,insert,update on table public.hq_workforce_shadow_proposals to service_role;
grant select,insert,update on table public.hq_workforce_shadow_decisions to service_role;
grant select,insert on table public.hq_workforce_shadow_measurements to service_role;
grant usage,select on all sequences in schema public to service_role;

revoke all on function public.hq_workforce_evaluate_shadow_authority(uuid) from public, anon, authenticated;
revoke all on function public.hq_workforce_shadow_record_proposal(uuid,text,uuid,text,jsonb,text,text,jsonb,smallint,smallint,jsonb,numeric) from public, anon, authenticated;
revoke all on function public.hq_workforce_shadow_review_decision(uuid,text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.hq_workforce_evaluate_shadow_authority(uuid) to service_role;
grant execute on function public.hq_workforce_shadow_record_proposal(uuid,text,uuid,text,jsonb,text,text,jsonb,smallint,smallint,jsonb,numeric) to service_role;
grant execute on function public.hq_workforce_shadow_review_decision(uuid,text,uuid,text,jsonb) to service_role;

comment on table public.hq_workforce_shadow_runs is 'WE-R1.3 trace root: one complete Observe→Detect→Reason→Propose→Verify→Measure→Human-decision chain.';
comment on function public.hq_workforce_evaluate_shadow_authority(uuid) is 'Hypothetical authority evaluation only. Never authorizes or executes a consequential production action.';
comment on function public.hq_workforce_shadow_review_decision(uuid,text,uuid,text,jsonb) is 'Human judgment capture only in WE-R1.3; approval cannot set execution_authorized=true.';
