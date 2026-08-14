-- WE-R1.3X.7-.9: Skill Genesis + empirical evaluation/calibration + knowledge/memory fabric.
-- access: service-only public.hq_workforce_skill_candidates
-- authorization-test: public.hq_workforce_skill_candidates denies anon/authenticated direct access; service_role manages proposed capabilities only.
-- access: service-only public.hq_workforce_evaluations
-- authorization-test: public.hq_workforce_evaluations denies anon/authenticated direct access; service_role manages measured outcomes.
-- access: service-only public.hq_workforce_calibration
-- authorization-test: public.hq_workforce_calibration denies anon/authenticated direct access; service_role manages empirical confidence calibration.
-- access: service-only public.hq_workforce_memory
-- authorization-test: public.hq_workforce_memory denies anon/authenticated direct access; service_role manages scoped organisational memory.

create table public.hq_workforce_skill_candidates (
 id uuid primary key default gen_random_uuid(), candidate_key text not null unique, detected_gap jsonb not null, proposed_manifest jsonb not null,
 proposed_tests jsonb not null default '[]'::jsonb, benchmark_contract jsonb not null default '{}'::jsonb, adversarial_cases jsonb not null default '[]'::jsonb,
 evidence jsonb not null default '{}'::jsonb, status text not null default 'proposed' check(status in ('proposed','testing','tested','recommended','rejected','superseded')),
 certification_allowed boolean not null default false check(certification_allowed=false), created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp());

create table public.hq_workforce_evaluations (
 id uuid primary key default gen_random_uuid(), trace_id uuid not null, objective_id uuid references public.hq_workforce_objectives(id) on delete set null,
 plan_id uuid references public.hq_workforce_plans(id) on delete set null, worker_key text, skill_manifest_id uuid references public.hq_workforce_skill_manifests(id) on delete set null,
 resource_id uuid references public.hq_workforce_resources(id) on delete set null, predicted_confidence numeric(5,4) check(predicted_confidence between 0 and 1),
 predicted_outcome jsonb not null default '{}'::jsonb, observed_outcome jsonb not null default '{}'::jsonb, score numeric(5,4) check(score between 0 and 1),
 human_agreement boolean, latency_ms bigint, useful boolean, evaluator_key text not null, created_at timestamptz not null default clock_timestamp());

create table public.hq_workforce_calibration (
 dimension_type text not null check(dimension_type in ('worker','skill','resource','competency','lane','risk')),
 dimension_key text not null, sample_count bigint not null default 0, mean_predicted numeric(5,4), mean_observed numeric(5,4),
 calibration_error numeric(5,4), reliability numeric(5,4), last_evaluated_at timestamptz, updated_at timestamptz not null default clock_timestamp(),
 primary key(dimension_type,dimension_key));

create table public.hq_workforce_memory (
 id uuid primary key default gen_random_uuid(), memory_key text not null, version integer not null default 1, memory_type text not null check(memory_type in ('fact','decision','outcome','failure','lesson','policy_reference','hypothesis')),
 content jsonb not null, provenance jsonb not null, confidence numeric(5,4) not null check(confidence between 0 and 1),
 scope_type text not null default 'global', scope_key text, data_classifications text[] not null default array['internal']::text[], jurisdictions text[] not null default array['global']::text[],
 authoritative boolean not null default false, valid_from timestamptz not null default clock_timestamp(), valid_until timestamptz, supersedes_id uuid references public.hq_workforce_memory(id) on delete restrict,
 contradiction_group text, retention_until timestamptz, created_at timestamptz not null default clock_timestamp(), unique(memory_key,version));
create index hq_workforce_memory_lookup_idx on public.hq_workforce_memory(memory_key,scope_type,scope_key,authoritative,valid_from desc);

create or replace function public.hq_workforce_propose_skill_candidate(p_gap jsonb,p_manifest jsonb,p_tests jsonb default '[]'::jsonb,p_adversarial jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_id uuid; v_key text;
begin
 v_key='skill-candidate-'||encode(extensions.digest(coalesce(p_gap,'{}'::jsonb)::text||coalesce(p_manifest,'{}'::jsonb)::text,'sha256'),'hex');
 insert into public.hq_workforce_skill_candidates(candidate_key,detected_gap,proposed_manifest,proposed_tests,adversarial_cases)
 values(v_key,coalesce(p_gap,'{}'),coalesce(p_manifest,'{}'),coalesce(p_tests,'[]'),coalesce(p_adversarial,'[]'))
 on conflict(candidate_key) do update set updated_at=clock_timestamp() returning id into v_id;
 return v_id;
end $$;

create or replace function public.hq_workforce_refresh_calibration(p_dimension_type text,p_dimension_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n bigint; mp numeric; mo numeric; ce numeric; rel numeric;
begin
 select count(*),avg(predicted_confidence),avg(score),avg(abs(coalesce(predicted_confidence,0)-coalesce(score,0))),avg(score)
 into n,mp,mo,ce,rel from public.hq_workforce_evaluations e
 where (p_dimension_type='worker' and e.worker_key=p_dimension_key)
    or (p_dimension_type='skill' and e.skill_manifest_id::text=p_dimension_key)
    or (p_dimension_type='resource' and e.resource_id::text=p_dimension_key);
 insert into public.hq_workforce_calibration(dimension_type,dimension_key,sample_count,mean_predicted,mean_observed,calibration_error,reliability,last_evaluated_at)
 values(p_dimension_type,p_dimension_key,n,mp,mo,ce,rel,clock_timestamp())
 on conflict(dimension_type,dimension_key) do update set sample_count=excluded.sample_count,mean_predicted=excluded.mean_predicted,mean_observed=excluded.mean_observed,calibration_error=excluded.calibration_error,reliability=excluded.reliability,last_evaluated_at=excluded.last_evaluated_at,updated_at=clock_timestamp();
 return jsonb_build_object('dimension_type',p_dimension_type,'dimension_key',p_dimension_key,'samples',n,'mean_predicted',mp,'mean_observed',mo,'calibration_error',ce,'reliability',rel);
end $$;

create or replace function public.hq_workforce_recall_memory(p_memory_key text,p_scope_type text default 'global',p_scope_key text default null,p_jurisdiction text default 'global',p_limit integer default 10)
returns table(memory_id uuid,version integer,memory_type text,content jsonb,confidence numeric,authoritative boolean,stale boolean,contradictory boolean)
language sql security definer set search_path=public,pg_temp stable as $$
 select m.id,m.version,m.memory_type,m.content,m.confidence,m.authoritative,
        (m.valid_until is not null and m.valid_until<=clock_timestamp()) as stale,
        (m.contradiction_group is not null and exists(select 1 from public.hq_workforce_memory x where x.contradiction_group=m.contradiction_group and x.id<>m.id and (x.valid_until is null or x.valid_until>clock_timestamp()))) as contradictory
 from public.hq_workforce_memory m
 where m.memory_key=p_memory_key and (m.scope_type=p_scope_type or m.scope_type='global') and (m.scope_key is null or m.scope_key=p_scope_key)
   and (p_jurisdiction=any(m.jurisdictions) or 'global'=any(m.jurisdictions))
 order by m.authoritative desc,(m.valid_until is null or m.valid_until>clock_timestamp()) desc,m.version desc limit greatest(1,least(coalesce(p_limit,10),100));
$$;

alter table public.hq_workforce_skill_candidates enable row level security; alter table public.hq_workforce_evaluations enable row level security;
alter table public.hq_workforce_calibration enable row level security; alter table public.hq_workforce_memory enable row level security;
revoke all on public.hq_workforce_skill_candidates,public.hq_workforce_evaluations,public.hq_workforce_calibration,public.hq_workforce_memory from public,anon,authenticated;
grant select,insert,update on public.hq_workforce_skill_candidates,public.hq_workforce_evaluations,public.hq_workforce_calibration,public.hq_workforce_memory to service_role;
revoke all on function public.hq_workforce_propose_skill_candidate(jsonb,jsonb,jsonb,jsonb),public.hq_workforce_refresh_calibration(text,text),public.hq_workforce_recall_memory(text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_propose_skill_candidate(jsonb,jsonb,jsonb,jsonb),public.hq_workforce_refresh_calibration(text,text),public.hq_workforce_recall_memory(text,text,text,text,integer) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin select * into ec from public.hq_workforce_engine_contract where singleton=true; if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'WE-R1.3X learning/memory violated L0 boundary'; end if; end $$;