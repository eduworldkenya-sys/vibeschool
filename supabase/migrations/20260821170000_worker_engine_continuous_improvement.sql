-- Worker Engine continuous improvement: evidence-bound learning without self-promotion.
-- Runtime activation is deliberately out of scope: this migration creates no scheduler,
-- authority grant, heartbeat, shadow enablement, or consequential execution path.
-- access: service-only public.hq_workforce_improvement_incidents
-- authorization-test: public.hq_workforce_improvement_incidents denies product roles and direct service writes
-- access: service-only public.hq_workforce_regression_cases
-- authorization-test: public.hq_workforce_regression_cases denies product roles and direct service writes
-- access: service-only public.hq_workforce_improvement_candidates
-- authorization-test: public.hq_workforce_improvement_candidates denies product roles and direct state-machine bypass
-- access: service-only public.hq_workforce_health_events
-- authorization-test: public.hq_workforce_health_events denies product roles and direct service writes

create table public.hq_workforce_improvement_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null unique,
  worker_key text not null,
  run_id uuid references public.hq_workforce_runs(id),
  trace_id uuid,
  outcome text not null check (outcome in ('failed','blocked','degraded','passed')),
  severity text not null check (severity in ('info','low','medium','high','critical')),
  expected_result jsonb not null,
  actual_result jsonb not null,
  root_cause_class text not null check (root_cause_class in ('unknown','context','memory','skill','prompt','model','tool','policy','authority','data','integration','infrastructure','human_process')),
  root_cause_confidence numeric not null check (root_cause_confidence between 0 and 1),
  versions jsonb not null default '{}'::jsonb,
  impact jsonb not null default '{}'::jsonb,
  evidence_refs text[] not null default '{}',
  tenant_id uuid,
  classification text not null default 'internal' check (classification in ('public','internal','confidential','restricted')),
  detected_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);

create table public.hq_workforce_regression_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null,
  case_version integer not null check (case_version > 0),
  source_incident_id uuid references public.hq_workforce_improvement_incidents(id),
  scope_type text not null,
  scope_key text not null,
  positive_control boolean not null default false,
  evaluator_key text not null,
  evaluator_version text not null,
  fixture_hash text not null,
  expected_hash text not null,
  fixture jsonb not null,
  expected_result jsonb not null,
  status text not null default 'protected' check (status in ('protected','retired')),
  created_at timestamptz not null default now(),
  unique(case_key,case_version)
);

create table public.hq_workforce_improvement_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_key text not null unique,
  learning_candidate_id uuid references public.hq_workforce_learning_candidates(id),
  source_incident_id uuid not null references public.hq_workforce_improvement_incidents(id),
  target_type text not null check (target_type in ('skill','prompt','policy','tool','model_route','context_contract','memory_contract','worker_version')),
  target_key text not null,
  baseline_version text not null,
  candidate_version text not null,
  baseline_hash text not null,
  candidate_hash text not null,
  proposed_by text not null,
  evaluator_key text,
  status text not null default 'candidate' check (status in ('candidate','testing','rejected','assurance_pending','shadow','canary','promoted','rolled_back')),
  baseline_metrics jsonb not null default '{}'::jsonb,
  candidate_metrics jsonb not null default '{}'::jsonb,
  regression_case_ids uuid[] not null default '{}',
  evidence_refs text[] not null default '{}',
  rejection_reason text,
  rollback_target_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hq_workforce_health_events (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('engine','worker','skill','lane')),
  scope_key text not null,
  metric_contract_version text not null,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  status text not null check (status in ('healthy','degraded','unhealthy','insufficient_evidence')),
  metrics jsonb not null,
  thresholds jsonb not null,
  evidence_refs text[] not null default '{}',
  evaluated_by text not null,
  recorded_at timestamptz not null default now(),
  check (window_ended_at > window_started_at)
);

alter table public.hq_workforce_improvement_incidents enable row level security;
alter table public.hq_workforce_regression_cases enable row level security;
alter table public.hq_workforce_improvement_candidates enable row level security;
alter table public.hq_workforce_health_events enable row level security;

create or replace function public.hq_workforce_reject_evidence_mutation()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin raise exception 'worker_engine_evidence_is_append_only'; end $$;

create trigger hq_workforce_improvement_incidents_append_only before update or delete on public.hq_workforce_improvement_incidents for each row execute function public.hq_workforce_reject_evidence_mutation();
create trigger hq_workforce_regression_cases_append_only before update or delete on public.hq_workforce_regression_cases for each row execute function public.hq_workforce_reject_evidence_mutation();
create trigger hq_workforce_health_events_append_only before update or delete on public.hq_workforce_health_events for each row execute function public.hq_workforce_reject_evidence_mutation();

create or replace function public.hq_workforce_record_improvement_incident(
  p_incident_key text,p_worker_key text,p_run_id uuid,p_trace_id uuid,p_outcome text,p_severity text,
  p_expected_result jsonb,p_actual_result jsonb,p_root_cause_class text,p_root_cause_confidence numeric,
  p_versions jsonb default '{}'::jsonb,p_impact jsonb default '{}'::jsonb,p_evidence_refs text[] default '{}'
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if nullif(trim(p_incident_key),'') is null or nullif(trim(p_worker_key),'') is null then raise exception 'incident_and_worker_keys_required'; end if;
  if cardinality(p_evidence_refs)=0 then raise exception 'incident_evidence_required'; end if;
  insert into public.hq_workforce_improvement_incidents(incident_key,worker_key,run_id,trace_id,outcome,severity,expected_result,actual_result,root_cause_class,root_cause_confidence,versions,impact,evidence_refs)
  values(p_incident_key,p_worker_key,p_run_id,p_trace_id,p_outcome,p_severity,p_expected_result,p_actual_result,p_root_cause_class,p_root_cause_confidence,coalesce(p_versions,'{}'),coalesce(p_impact,'{}'),p_evidence_refs)
  on conflict(incident_key) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.hq_workforce_improvement_incidents where incident_key=p_incident_key; end if;
  return v_id;
end $$;

create or replace function public.hq_workforce_register_regression_case(
  p_case_key text,p_case_version integer,p_source_incident_id uuid,p_scope_type text,p_scope_key text,
  p_positive_control boolean,p_evaluator_key text,p_evaluator_version text,p_fixture jsonb,p_expected_result jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_fixture_hash text; v_expected_hash text;
begin
  if nullif(trim(p_evaluator_key),'') is null or nullif(trim(p_evaluator_version),'') is null then raise exception 'versioned_evaluator_required'; end if;
  if p_source_incident_id is null and not p_positive_control then raise exception 'negative_case_requires_incident'; end if;
  v_fixture_hash:=encode(digest(p_fixture::text,'sha256'),'hex'); v_expected_hash:=encode(digest(p_expected_result::text,'sha256'),'hex');
  insert into public.hq_workforce_regression_cases(case_key,case_version,source_incident_id,scope_type,scope_key,positive_control,evaluator_key,evaluator_version,fixture_hash,expected_hash,fixture,expected_result)
  values(p_case_key,p_case_version,p_source_incident_id,p_scope_type,p_scope_key,p_positive_control,p_evaluator_key,p_evaluator_version,v_fixture_hash,v_expected_hash,p_fixture,p_expected_result)
  returning id into v_id; return v_id;
end $$;

create or replace function public.hq_workforce_transition_improvement_candidate(
  p_candidate_id uuid,p_expected_candidate_hash text,p_next_status text,p_actor_key text,
  p_evaluator_key text default null,p_candidate_metrics jsonb default '{}'::jsonb,p_evidence_refs text[] default '{}',p_reason text default null
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.hq_workforce_improvement_candidates%rowtype; v_allowed boolean:=false;
begin
  select * into c from public.hq_workforce_improvement_candidates where id=p_candidate_id for update;
  if not found then raise exception 'improvement_candidate_not_found'; end if;
  if c.candidate_hash<>p_expected_candidate_hash then raise exception 'candidate_hash_mismatch'; end if;
  if p_next_status in ('assurance_pending','shadow','canary','promoted') and (nullif(trim(p_evaluator_key),'') is null or p_evaluator_key=c.proposed_by or p_actor_key=c.proposed_by) then raise exception 'independent_evaluator_required'; end if;
  if p_next_status in ('testing','assurance_pending','shadow','canary','promoted') and cardinality(p_evidence_refs)=0 then raise exception 'transition_evidence_required'; end if;
  if p_next_status in ('shadow','canary','promoted') and cardinality(c.regression_case_ids)=0 then raise exception 'protected_regression_suite_required'; end if;
  v_allowed := (c.status='candidate' and p_next_status in ('testing','rejected')) or (c.status='testing' and p_next_status in ('rejected','assurance_pending')) or (c.status='assurance_pending' and p_next_status in ('rejected','shadow')) or (c.status='shadow' and p_next_status in ('rejected','canary')) or (c.status='canary' and p_next_status in ('rejected','promoted')) or (c.status='promoted' and p_next_status='rolled_back');
  if not v_allowed then raise exception 'invalid_improvement_transition:%->%',c.status,p_next_status; end if;
  if p_next_status in ('rejected','rolled_back') and nullif(trim(p_reason),'') is null then raise exception 'rejection_or_rollback_reason_required'; end if;
  update public.hq_workforce_improvement_candidates set status=p_next_status,evaluator_key=coalesce(p_evaluator_key,evaluator_key),candidate_metrics=coalesce(p_candidate_metrics,'{}'),evidence_refs=p_evidence_refs,rejection_reason=case when p_next_status in ('rejected','rolled_back') then p_reason else rejection_reason end,updated_at=now() where id=p_candidate_id;
  return p_next_status;
end $$;

create or replace function public.hq_workforce_propose_improvement_candidate(
  p_candidate_key text,p_source_incident_id uuid,p_target_type text,p_target_key text,
  p_baseline_version text,p_candidate_version text,p_baseline_hash text,p_candidate_hash text,
  p_proposed_by text,p_regression_case_ids uuid[],p_learning_candidate_id uuid default null,
  p_baseline_metrics jsonb default '{}'::jsonb,p_rollback_target_version text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_count integer;
begin
  if p_baseline_hash=p_candidate_hash then raise exception 'candidate_must_change_target'; end if;
  if nullif(trim(p_proposed_by),'') is null then raise exception 'candidate_proposer_required'; end if;
  select count(*) into v_count from unnest(coalesce(p_regression_case_ids,'{}')) x(id) join public.hq_workforce_regression_cases r on r.id=x.id and r.status='protected';
  if v_count<>cardinality(coalesce(p_regression_case_ids,'{}')) or v_count=0 then raise exception 'protected_regression_suite_required'; end if;
  insert into public.hq_workforce_improvement_candidates(candidate_key,learning_candidate_id,source_incident_id,target_type,target_key,baseline_version,candidate_version,baseline_hash,candidate_hash,proposed_by,baseline_metrics,regression_case_ids,rollback_target_version)
  values(p_candidate_key,p_learning_candidate_id,p_source_incident_id,p_target_type,p_target_key,p_baseline_version,p_candidate_version,p_baseline_hash,p_candidate_hash,p_proposed_by,coalesce(p_baseline_metrics,'{}'),p_regression_case_ids,p_rollback_target_version)
  returning id into v_id; return v_id;
end $$;

create or replace function public.hq_workforce_record_health_event(
  p_scope_type text,p_scope_key text,p_metric_contract_version text,p_window_started_at timestamptz,
  p_window_ended_at timestamptz,p_status text,p_metrics jsonb,p_thresholds jsonb,p_evidence_refs text[],p_evaluated_by text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if cardinality(p_evidence_refs)=0 then raise exception 'health_evidence_required'; end if;
  if nullif(trim(p_metric_contract_version),'') is null or nullif(trim(p_evaluated_by),'') is null then raise exception 'versioned_health_evaluator_required'; end if;
  insert into public.hq_workforce_health_events(scope_type,scope_key,metric_contract_version,window_started_at,window_ended_at,status,metrics,thresholds,evidence_refs,evaluated_by)
  values(p_scope_type,p_scope_key,p_metric_contract_version,p_window_started_at,p_window_ended_at,p_status,p_metrics,p_thresholds,p_evidence_refs,p_evaluated_by)
  returning id into v_id; return v_id;
end $$;

revoke all on table public.hq_workforce_improvement_incidents,public.hq_workforce_regression_cases,public.hq_workforce_improvement_candidates,public.hq_workforce_health_events from public,anon,authenticated;
revoke insert,update,delete on table public.hq_workforce_improvement_incidents,public.hq_workforce_regression_cases,public.hq_workforce_health_events from service_role;
revoke insert,update,delete on table public.hq_workforce_improvement_candidates from service_role;
revoke all on function public.hq_workforce_reject_evidence_mutation() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_record_improvement_incident(text,text,uuid,uuid,text,text,jsonb,jsonb,text,numeric,jsonb,jsonb,text[]) from public,anon,authenticated;
revoke all on function public.hq_workforce_register_regression_case(text,integer,uuid,text,text,boolean,text,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.hq_workforce_transition_improvement_candidate(uuid,text,text,text,text,jsonb,text[],text) from public,anon,authenticated;
revoke all on function public.hq_workforce_propose_improvement_candidate(text,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_record_health_event(text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,text[],text) from public,anon,authenticated;
grant select on table public.hq_workforce_improvement_incidents,public.hq_workforce_regression_cases,public.hq_workforce_improvement_candidates,public.hq_workforce_health_events to service_role;
grant execute on function public.hq_workforce_record_improvement_incident(text,text,uuid,uuid,text,text,jsonb,jsonb,text,numeric,jsonb,jsonb,text[]) to service_role;
grant execute on function public.hq_workforce_register_regression_case(text,integer,uuid,text,text,boolean,text,text,jsonb,jsonb) to service_role;
grant execute on function public.hq_workforce_transition_improvement_candidate(uuid,text,text,text,text,jsonb,text[],text) to service_role;
grant execute on function public.hq_workforce_propose_improvement_candidate(text,uuid,text,text,text,text,text,text,text,uuid[],uuid,jsonb,text) to service_role;
grant execute on function public.hq_workforce_record_health_event(text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,text[],text) to service_role;
