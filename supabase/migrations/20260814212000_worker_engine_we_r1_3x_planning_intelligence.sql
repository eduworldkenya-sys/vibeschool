-- WE-R1.3X.4-.6: Planning Graph + intelligent resource selection + collaboration contracts.
-- access: service-only public.hq_workforce_objectives
-- authorization-test: public.hq_workforce_objectives denies anon/authenticated direct access; service_role manages shadow objectives.
-- access: service-only public.hq_workforce_plans
-- authorization-test: public.hq_workforce_plans denies anon/authenticated direct access; service_role manages shadow plans.
-- access: service-only public.hq_workforce_plan_steps
-- authorization-test: public.hq_workforce_plan_steps denies anon/authenticated direct access; service_role manages auditable plan DAG steps.
-- access: service-only public.hq_workforce_plan_step_dependencies
-- authorization-test: public.hq_workforce_plan_step_dependencies denies anon/authenticated direct access; service_role manages DAG edges.
-- access: service-only public.hq_workforce_collaborations
-- authorization-test: public.hq_workforce_collaborations denies anon/authenticated direct access; service_role manages shadow consultations/handoffs.

create table public.hq_workforce_objectives (
 id uuid primary key default gen_random_uuid(), trace_id uuid not null default gen_random_uuid(), objective_key text not null,
 statement text not null, scope_type text not null default 'global', scope_key text, jurisdiction text not null default 'global',
 required_competencies text[] not null default '{}'::text[], desired_outcome jsonb not null default '{}'::jsonb,
 constraints jsonb not null default '{}'::jsonb, risk_ceiling smallint not null default 2 check(risk_ceiling between 0 and 5),
 autonomy_ceiling smallint not null default 0 check(autonomy_ceiling between 0 and 4), status text not null default 'detected' check(status in ('detected','planning','planned','escalated','closed')),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(), unique(objective_key,trace_id));

create table public.hq_workforce_plans (
 id uuid primary key default gen_random_uuid(), objective_id uuid not null references public.hq_workforce_objectives(id) on delete cascade,
 plan_version integer not null default 1, strategy_key text not null, status text not null default 'draft' check(status in ('draft','simulated','recommended','rejected','superseded')),
 expected_quality numeric(5,4) check(expected_quality between 0 and 1), confidence numeric(5,4) check(confidence between 0 and 1),
 required_risk smallint not null default 0 check(required_risk between 0 and 5), required_autonomy smallint not null default 0 check(required_autonomy between 0 and 4),
 estimated_cost numeric(14,4) not null default 0, estimated_latency_ms bigint not null default 0,
 rationale jsonb not null default '{}'::jsonb, verification_contract jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default clock_timestamp(), unique(objective_id,plan_version,strategy_key));

create table public.hq_workforce_plan_steps (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.hq_workforce_plans(id) on delete cascade,
 step_key text not null, ordinal integer not null check(ordinal>0), skill_manifest_id uuid references public.hq_workforce_skill_manifests(id) on delete restrict,
 worker_key text, required_competencies text[] not null default '{}'::text[], input_contract jsonb not null default '{}'::jsonb,
 expected_output jsonb not null default '{}'::jsonb, verification_contract jsonb not null default '{}'::jsonb,
 required_risk smallint not null default 0 check(required_risk between 0 and 5), required_autonomy smallint not null default 0 check(required_autonomy between 0 and 4),
 status text not null default 'planned' check(status in ('planned','simulated','blocked','escalated','verified')),
 created_at timestamptz not null default clock_timestamp(), unique(plan_id,step_key), unique(plan_id,ordinal));

create table public.hq_workforce_plan_step_dependencies (
 plan_id uuid not null references public.hq_workforce_plans(id) on delete cascade,
 step_id uuid not null references public.hq_workforce_plan_steps(id) on delete cascade,
 depends_on_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete cascade,
 dependency_type text not null default 'requires' check(dependency_type in ('requires','evidence_from','verifies','fallback_after')),
 primary key(plan_id,step_id,depends_on_step_id), check(step_id<>depends_on_step_id));

create table public.hq_workforce_collaborations (
 id uuid primary key default gen_random_uuid(), trace_id uuid not null, plan_id uuid references public.hq_workforce_plans(id) on delete cascade,
 from_worker_key text not null, to_worker_key text not null, collaboration_type text not null check(collaboration_type in ('consult','delegate','handoff','verify')),
 requested_competencies text[] not null default '{}'::text[], authority_snapshot jsonb not null default '{}'::jsonb,
 status text not null default 'proposed' check(status in ('proposed','accepted','denied','completed','escalated')),
 created_at timestamptz not null default clock_timestamp(), check(from_worker_key<>to_worker_key));

create or replace function public.hq_workforce_select_least_powerful_plan(p_objective_id uuid)
returns uuid language sql security definer set search_path=public,pg_temp stable as $$
 select p.id from public.hq_workforce_plans p join public.hq_workforce_objectives o on o.id=p.objective_id
 where p.objective_id=p_objective_id and p.status in ('draft','simulated','recommended')
   and p.required_autonomy<=o.autonomy_ceiling and p.required_risk<=o.risk_ceiling
 order by p.required_autonomy asc,p.required_risk asc,p.estimated_cost asc,
          coalesce(p.expected_quality,0) desc,p.estimated_latency_ms asc,p.id limit 1;
$$;

create or replace function public.hq_workforce_validate_plan_dag(p_plan_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_cycle boolean; v_steps integer; v_unregistered integer; v_uncertified integer; v_authority integer;
begin
 select count(*) into v_steps from public.hq_workforce_plan_steps where plan_id=p_plan_id;
 with recursive walk(start_id,node_id,path,cycle) as (
   select d.step_id,d.depends_on_step_id,array[d.step_id,d.depends_on_step_id],false from public.hq_workforce_plan_step_dependencies d where d.plan_id=p_plan_id
   union all select w.start_id,d.depends_on_step_id,w.path||d.depends_on_step_id,d.depends_on_step_id=any(w.path)
   from walk w join public.hq_workforce_plan_step_dependencies d on d.plan_id=p_plan_id and d.step_id=w.node_id where not w.cycle
 ) select coalesce(bool_or(cycle),false) into v_cycle from walk;
 select count(*) into v_unregistered from public.hq_workforce_plan_steps s where s.plan_id=p_plan_id and s.skill_manifest_id is null;
 select count(*) into v_uncertified from public.hq_workforce_plan_steps s join public.hq_workforce_skill_manifests m on m.id=s.skill_manifest_id where s.plan_id=p_plan_id and (m.certification_status<>'certified' or not m.shadow_capable);
 select count(*) into v_authority from public.hq_workforce_plan_steps s join public.hq_workforce_objectives o on o.id=(select objective_id from public.hq_workforce_plans where id=p_plan_id) where s.plan_id=p_plan_id and (s.required_autonomy>o.autonomy_ceiling or s.required_risk>o.risk_ceiling);
 return jsonb_build_object('valid',v_steps>0 and not v_cycle and v_unregistered=0 and v_uncertified=0 and v_authority=0,'steps',v_steps,'cycle',v_cycle,'missing_capability_steps',v_unregistered,'uncertified_steps',v_uncertified,'authority_violations',v_authority);
end $$;

create or replace function public.hq_workforce_resolve_step_resources(p_step_id uuid,p_operation text default 'read',p_limit integer default 10)
returns table(resource_id uuid,resource_key text,fitness_score numeric) language sql security definer set search_path=public,pg_temp stable as $$
 select r.id,r.resource_key,
   (((r.trust_tier::numeric/5.0)*0.30)+
    (case r.health_status when 'healthy' then 1.0 when 'degraded' then 0.5 else 0 end)*0.20+
    (case when r.required_autonomy=0 then 1 else 0 end)*0.20+
    (case when r.risk_class<=1 then 1.0 when r.risk_class=2 then 0.5 else 0 end)*0.15+
    (1.0/(1.0+coalesce((r.latency_profile->>'p95_ms')::numeric,0)/1000.0))*0.10+
    (1.0/(1.0+coalesce((r.cost_profile->>'unit_cost')::numeric,0)))*0.05)::numeric as fitness_score
 from public.hq_workforce_plan_steps s
 join public.hq_workforce_skill_resources sr on sr.skill_manifest_id=s.skill_manifest_id and sr.operation=p_operation
 join public.hq_workforce_resources r on r.id=sr.resource_id
 where s.id=p_step_id and r.enabled and r.shadow_capable and r.health_status in ('healthy','degraded') and r.required_autonomy=0 and r.risk_class<=2
 order by fitness_score desc,r.trust_tier desc,r.resource_key limit greatest(1,least(coalesce(p_limit,10),100));
$$;

alter table public.hq_workforce_objectives enable row level security; alter table public.hq_workforce_plans enable row level security;
alter table public.hq_workforce_plan_steps enable row level security; alter table public.hq_workforce_plan_step_dependencies enable row level security;
alter table public.hq_workforce_collaborations enable row level security;
revoke all on public.hq_workforce_objectives,public.hq_workforce_plans,public.hq_workforce_plan_steps,public.hq_workforce_plan_step_dependencies,public.hq_workforce_collaborations from public,anon,authenticated;
grant select,insert,update on public.hq_workforce_objectives,public.hq_workforce_plans,public.hq_workforce_plan_steps,public.hq_workforce_plan_step_dependencies,public.hq_workforce_collaborations to service_role;
revoke all on function public.hq_workforce_select_least_powerful_plan(uuid),public.hq_workforce_validate_plan_dag(uuid),public.hq_workforce_resolve_step_resources(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_select_least_powerful_plan(uuid),public.hq_workforce_validate_plan_dag(uuid),public.hq_workforce_resolve_step_resources(uuid,text,integer) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin select * into ec from public.hq_workforce_engine_contract where singleton=true; if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'WE-R1.3X planning intelligence violated L0 boundary'; end if; end $$;