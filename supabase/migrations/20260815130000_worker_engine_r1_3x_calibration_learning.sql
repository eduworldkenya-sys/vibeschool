-- WE-R1.3X X9: empirical calibration, verification and institutional learning. NON-ACTIVATING.
-- Static confidence remains only as an explicitly labelled prior until enough verified evidence exists.
-- access: service-only public.hq_workforce_calibration_observations
-- authorization-test: calibration evidence denies anon/authenticated direct access and is append-only.

update public.hq_workforce_engine_contract
set heartbeat_enabled=false,factory_enabled=false,runtime_execution_enabled=false,
    runtime_autonomy_level=0,runtime_max_risk=0,shadow_enabled=false,
    shadow_scheduler_enabled=false,shadow_global_stop=true,updated_at=clock_timestamp()
where singleton=true;

create table public.hq_workforce_calibration_observations (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid references public.hq_workforce_shadow_traces(trace_id) on delete restrict,
  objective_id uuid references public.hq_workforce_objectives(id) on delete restrict,
  plan_id uuid references public.hq_workforce_plans(id) on delete restrict,
  routing_event_id bigint references public.hq_workforce_routing_events(id) on delete restrict,
  subject_kind text not null check(subject_kind in ('plan','capability','worker','team','routing')),
  subject_ref text not null check(char_length(btrim(subject_ref)) between 1 and 300),
  predicted_probability numeric(5,4) not null check(predicted_probability between 0 and 1),
  outcome_value numeric(5,4) not null check(outcome_value between 0 and 1),
  verification_evidence_id uuid not null references public.hq_workforce_evidence(id) on delete restrict,
  human_decision_id uuid references public.hq_workforce_shadow_decisions(id) on delete restrict,
  verification_method text not null check(char_length(btrim(verification_method)) between 3 and 200),
  independent_verification boolean not null default true,
  provenance jsonb not null check(jsonb_typeof(provenance)='object' and provenance<>'{}'::jsonb),
  created_at timestamptz not null default clock_timestamp(),
  unique(subject_kind,subject_ref,verification_evidence_id)
);
create index hq_workforce_calibration_subject_idx
  on public.hq_workforce_calibration_observations(subject_kind,subject_ref,created_at desc);

create or replace function public.hq_workforce_calibration_observations_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin raise exception 'worker_engine_calibration_evidence_is_append_only'; end $$;
create trigger trg_hq_workforce_calibration_observations_immutable
before update or delete on public.hq_workforce_calibration_observations
for each row execute function public.hq_workforce_calibration_observations_immutable();

create or replace function public.hq_workforce_record_verified_outcome(
  p_subject_kind text,
  p_subject_ref text,
  p_predicted_probability numeric,
  p_outcome_value numeric,
  p_verification_evidence_id uuid,
  p_verification_method text,
  p_trace_id uuid default null,
  p_objective_id uuid default null,
  p_plan_id uuid default null,
  p_routing_event_id bigint default null,
  p_human_decision_id uuid default null,
  p_independent_verification boolean default true,
  p_provenance jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_id uuid;
  ev public.hq_workforce_evidence%rowtype;
  d public.hq_workforce_shadow_decisions%rowtype;
begin
  if p_subject_kind not in ('plan','capability','worker','team','routing') then raise exception 'calibration_subject_kind_invalid'; end if;
  if char_length(btrim(coalesce(p_subject_ref,''))) not between 1 and 300 then raise exception 'calibration_subject_ref_invalid'; end if;
  if p_predicted_probability is null or p_predicted_probability<0 or p_predicted_probability>1 then raise exception 'calibration_prediction_invalid'; end if;
  if p_outcome_value is null or p_outcome_value<0 or p_outcome_value>1 then raise exception 'calibration_outcome_invalid'; end if;
  if char_length(btrim(coalesce(p_verification_method,''))) not between 3 and 200 then raise exception 'calibration_verification_method_invalid'; end if;
  if coalesce(jsonb_typeof(p_provenance),'null')<>'object' or p_provenance='{}'::jsonb then raise exception 'calibration_provenance_required'; end if;

  select * into ev from public.hq_workforce_evidence where id=p_verification_evidence_id;
  if not found then raise exception 'verification_evidence_not_found'; end if;
  if ev.evidence_kind not in ('verification','measurement') then raise exception 'calibration_requires_verification_or_measurement_evidence'; end if;
  if p_trace_id is not null and ev.trace_id<>p_trace_id then raise exception 'calibration_trace_evidence_mismatch'; end if;

  if p_human_decision_id is not null then
    select * into d from public.hq_workforce_shadow_decisions where id=p_human_decision_id;
    if not found then raise exception 'human_decision_not_found'; end if;
    if d.reviewed_at is null or d.state not in ('approved','rejected','revise','verified','closed') then raise exception 'human_decision_not_reviewed'; end if;
    if p_trace_id is not null and d.trace_id<>p_trace_id then raise exception 'calibration_trace_decision_mismatch'; end if;
  end if;

  if p_subject_kind='plan' and not exists(select 1 from public.hq_workforce_plans where id::text=p_subject_ref) then raise exception 'calibration_plan_not_found'; end if;
  if p_subject_kind='capability' and not exists(select 1 from public.hq_workforce_capabilities where id::text=p_subject_ref) then raise exception 'calibration_capability_not_found'; end if;
  if p_subject_kind='worker' and not exists(select 1 from public.hq_workforce_workers where worker_key=p_subject_ref) then raise exception 'calibration_worker_not_found'; end if;
  if p_subject_kind='routing' and not exists(select 1 from public.hq_workforce_routing_events where id::text=p_subject_ref) then raise exception 'calibration_routing_not_found'; end if;
  if p_subject_kind='team' and coalesce(jsonb_typeof(p_provenance->'workers'),'null')<>'array' then raise exception 'calibration_team_workers_required'; end if;

  insert into public.hq_workforce_calibration_observations(
    trace_id,objective_id,plan_id,routing_event_id,subject_kind,subject_ref,predicted_probability,outcome_value,
    verification_evidence_id,human_decision_id,verification_method,independent_verification,provenance
  ) values(
    p_trace_id,p_objective_id,p_plan_id,p_routing_event_id,p_subject_kind,btrim(p_subject_ref),p_predicted_probability,p_outcome_value,
    p_verification_evidence_id,p_human_decision_id,btrim(p_verification_method),p_independent_verification,p_provenance
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_workforce_calibration_summary(
  p_subject_kind text,
  p_subject_ref text
) returns jsonb
language sql security definer set search_path=public,pg_temp stable as $$
  select jsonb_build_object(
    'subject_kind',p_subject_kind,
    'subject_ref',p_subject_ref,
    'sample_count',count(*),
    'mean_prediction',coalesce(avg(predicted_probability),0),
    'empirical_success',coalesce(avg(outcome_value),0),
    'brier_score',coalesce(avg(power(predicted_probability-outcome_value,2)),0),
    'calibration_error',coalesce(abs(avg(predicted_probability)-avg(outcome_value)),0),
    'independent_sample_count',count(*) filter(where independent_verification)
  )
  from public.hq_workforce_calibration_observations
  where subject_kind=p_subject_kind and subject_ref=p_subject_ref;
$$;

create or replace function public.hq_workforce_empirical_probability(
  p_subject_kind text,
  p_subject_ref text,
  p_prior numeric,
  p_min_samples integer default 5
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp stable as $$
declare n bigint; actual numeric; brier numeric;
begin
  if p_prior is null or p_prior<0 or p_prior>1 then raise exception 'calibration_prior_invalid'; end if;
  if p_min_samples<1 then raise exception 'calibration_min_samples_invalid'; end if;
  select count(*),avg(outcome_value),avg(power(predicted_probability-outcome_value,2))
    into n,actual,brier
  from public.hq_workforce_calibration_observations
  where subject_kind=p_subject_kind and subject_ref=p_subject_ref and independent_verification;
  if n>=p_min_samples then
    return jsonb_build_object('probability',actual,'calibrated',true,'sample_count',n,'brier_score',brier,'source','verified_outcomes');
  end if;
  return jsonb_build_object('probability',p_prior,'calibrated',false,'sample_count',n,'source','declared_prior_insufficient_verified_samples');
end $$;

create or replace function public.hq_workforce_publish_verified_learning(
  p_subject_kind text,
  p_subject_ref text,
  p_reason text,
  p_min_samples integer default 5
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare s jsonb; mid uuid;
begin
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'learning_reason_required'; end if;
  if p_min_samples<1 then raise exception 'learning_min_samples_invalid'; end if;
  s:=public.hq_workforce_calibration_summary(p_subject_kind,p_subject_ref);
  if coalesce((s->>'independent_sample_count')::integer,0)<p_min_samples then raise exception 'learning_insufficient_independent_samples'; end if;
  mid:=public.hq_workforce_add_memory(
    'calibration:'||p_subject_kind||':'||p_subject_ref,
    'lesson',
    jsonb_build_object('subject_kind',p_subject_kind,'subject_ref',p_subject_ref,'calibration',s,'reason',btrim(p_reason)),
    jsonb_build_object('source','x9_calibration','sample_count',s->'sample_count','independent_sample_count',s->'independent_sample_count'),
    'worker_engine_calibration',
    p_subject_kind||':'||p_subject_ref,
    greatest(0::numeric,least(1::numeric,1-coalesce((s->>'brier_score')::numeric,1))),
    'corroborated',
    false,
    'platform_internal',
    '{}'::jsonb,
    array['internal']::text[],
    array['global']::text[],
    clock_timestamp(),
    null,
    clock_timestamp(),
    null,
    null,
    null
  );
  return mid;
end $$;

-- Replace X5's fixed/min-resource confidence with calibrated plan evidence when enough verified samples exist.
create or replace function public.hq_workforce_simulate_plan(p_plan_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  p public.hq_workforce_plans%rowtype; dag jsonb; miss_caps integer; miss_res integer;
  max_aut smallint; max_risk smallint; cost numeric; latency bigint; prior numeric; cal jsonb; confidence numeric;
begin
 select * into p from public.hq_workforce_plans where id=p_plan_id for update; if not found then raise exception 'plan_not_found'; end if;
 if p.status not in ('draft','invalid') then raise exception 'plan_not_simulatable:%',p.status; end if;
 dag:=public.hq_workforce_validate_plan_dag(p_plan_id);
 if not coalesce((dag->>'valid')::boolean,false) then
   update public.hq_workforce_plans set status='invalid',updated_at=clock_timestamp() where id=p_plan_id;
   insert into public.hq_workforce_plan_events(plan_id,event_kind,reason,payload) values(p_plan_id,'dag_validated','Plan DAG rejected.',dag);
   return jsonb_build_object('status','invalid','dag',dag,'consequential_execution',false);
 end if;
 select count(*) into miss_caps from public.hq_workforce_plan_steps s where s.plan_id=p_plan_id and not exists(select 1 from public.hq_workforce_plan_step_capabilities c where c.plan_step_id=s.id and c.role='required');
 select count(*) into miss_res from public.hq_workforce_plan_step_capabilities c join public.hq_workforce_plan_steps s on s.id=c.plan_step_id where s.plan_id=p_plan_id and c.role='required' and not exists(select 1 from public.hq_workforce_plan_step_resources r where r.plan_step_id=s.id and r.capability_id=c.capability_id and r.required);
 if miss_caps>0 or miss_res>0 then
   update public.hq_workforce_plans set status='invalid',updated_at=clock_timestamp() where id=p_plan_id;
   insert into public.hq_workforce_plan_events(plan_id,event_kind,reason,payload) values(p_plan_id,'blocked','Plan lacks complete capability/resource coverage.',jsonb_build_object('missing_capability_steps',miss_caps,'missing_resources',miss_res));
   return jsonb_build_object('status','invalid','reason','incomplete_capability_resource_coverage','missing_capability_steps',miss_caps,'missing_resources',miss_res,'dag',dag,'consequential_execution',false);
 end if;
 select coalesce(max(required_autonomy),0),coalesce(max(required_risk),0),coalesce(sum(estimated_cost),0),coalesce(sum(estimated_latency_ms),0)
   into max_aut,max_risk,cost,latency from public.hq_workforce_plan_steps where plan_id=p_plan_id;
 select coalesce(min(coalesce(r.reliability,0)),0)
   into prior
 from public.hq_workforce_plan_step_resources psr
 join public.hq_workforce_plan_steps s on s.id=psr.plan_step_id
 join public.hq_workforce_resources r on r.id=psr.resource_id
 where s.plan_id=p_plan_id and psr.required;
 cal:=public.hq_workforce_empirical_probability('plan',p_plan_id::text,prior,5);
 confidence:=(cal->>'probability')::numeric;
 update public.hq_workforce_plans
 set status='simulated',expected_success=confidence,required_autonomy=max_aut,required_risk=max_risk,
     estimated_cost=cost,estimated_latency_ms=latency,evidence_quality=case when (cal->>'calibrated')::boolean then 1 else .5 end,
     reversibility_score=case when max_risk=0 then 1 else greatest(0,1-(max_risk::numeric/5)) end,updated_at=clock_timestamp()
 where id=p_plan_id;
 insert into public.hq_workforce_plan_events(plan_id,event_kind,reason,payload)
 values(p_plan_id,'simulation','Shadow-only plan simulation completed with explicit calibration status.',
   jsonb_build_object('dag',dag,'expected_success',confidence,'calibration',cal,'required_autonomy',max_aut,'required_risk',max_risk,'estimated_cost',cost,'estimated_latency_ms',latency,'consequential_execution',false));
 return jsonb_build_object('status','simulated','plan_id',p_plan_id,'dag',dag,'expected_success',confidence,'calibration',cal,'required_autonomy',max_aut,'required_risk',max_risk,'estimated_cost',cost,'estimated_latency_ms',latency,'consequential_execution',false);
end $$;

alter table public.hq_workforce_calibration_observations enable row level security;
revoke all on table public.hq_workforce_calibration_observations from public,anon,authenticated;
grant select,insert on table public.hq_workforce_calibration_observations to service_role;
revoke all on function public.hq_workforce_calibration_observations_immutable() from public,anon,authenticated;
revoke all on function public.hq_workforce_record_verified_outcome(text,text,numeric,numeric,uuid,text,uuid,uuid,uuid,bigint,uuid,boolean,jsonb) from public,anon,authenticated;
revoke all on function public.hq_workforce_calibration_summary(text,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_empirical_probability(text,text,numeric,integer) from public,anon,authenticated;
revoke all on function public.hq_workforce_publish_verified_learning(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_record_verified_outcome(text,text,numeric,numeric,uuid,text,uuid,uuid,uuid,bigint,uuid,boolean,jsonb) to service_role;
grant execute on function public.hq_workforce_calibration_summary(text,text),public.hq_workforce_empirical_probability(text,text,numeric,integer),public.hq_workforce_publish_verified_learning(text,text,text,integer) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'X9 requires engine contract'; end if;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0
     or ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then
    raise exception 'X9 calibration violated fail-closed L0/R0 boundary';
  end if;
end $$;