-- WE-R1.3X X5: Planning Graph foundation. NON-ACTIVATING.
-- access: service-only public.hq_workforce_plans
-- authorization-test: public.hq_workforce_plans denies anon/authenticated direct access.
-- access: service-only public.hq_workforce_plan_steps
-- authorization-test: public.hq_workforce_plan_steps denies anon/authenticated direct access.
-- access: service-only public.hq_workforce_plan_step_capabilities
-- authorization-test: public.hq_workforce_plan_step_capabilities denies anon/authenticated direct access.
-- access: service-only public.hq_workforce_plan_step_resources
-- authorization-test: public.hq_workforce_plan_step_resources denies anon/authenticated direct access.
-- access: service-only public.hq_workforce_plan_dependencies
-- authorization-test: public.hq_workforce_plan_dependencies denies anon/authenticated direct access.
-- access: service-only public.hq_workforce_plan_step_work_items
-- authorization-test: public.hq_workforce_plan_step_work_items denies anon/authenticated direct access.
-- access: service-only public.hq_workforce_plan_events
-- authorization-test: public.hq_workforce_plan_events denies anon/authenticated direct access; append-only evidence.

create table public.hq_workforce_plans (
 id uuid primary key default gen_random_uuid(), objective_id uuid not null references public.hq_workforce_objectives(id) on delete restrict,
 plan_key text not null, version integer not null default 1 check(version>0), strategy_key text not null,
 status text not null default 'draft' check(status in ('draft','invalid','simulated','candidate','selected','rejected','superseded','cancelled')),
 expected_success numeric(5,4) check(expected_success is null or expected_success between 0 and 1),
 required_autonomy smallint not null default 0 check(required_autonomy between 0 and 4), required_risk smallint not null default 0 check(required_risk between 0 and 5),
 estimated_cost numeric not null default 0 check(estimated_cost>=0), estimated_latency_ms bigint not null default 0 check(estimated_latency_ms>=0),
 reversibility_score numeric(5,4) not null default 1 check(reversibility_score between 0 and 1), evidence_quality numeric(5,4) not null default 0 check(evidence_quality between 0 and 1),
 rationale jsonb not null default '{}'::jsonb, verification_contract jsonb not null default '{}'::jsonb, compensation_contract jsonb not null default '{}'::jsonb,
 provenance jsonb not null check(jsonb_typeof(provenance)='object' and provenance<>'{}'::jsonb), created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(objective_id,plan_key,version));
create index hq_workforce_plans_objective_idx on public.hq_workforce_plans(objective_id,status,version desc);

create table public.hq_workforce_plan_steps (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.hq_workforce_plans(id) on delete restrict,
 step_key text not null, ordinal integer not null check(ordinal>0), purpose text not null,
 actor_mode text not null default 'unassigned' check(actor_mode in ('unassigned','worker','team','deterministic','worker_human','human_only')),
 worker_key text references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
 input_contract jsonb not null default '{}'::jsonb, expected_output jsonb not null default '{}'::jsonb, verification_contract jsonb not null default '{}'::jsonb,
 required_autonomy smallint not null default 0 check(required_autonomy between 0 and 4), required_risk smallint not null default 0 check(required_risk between 0 and 5),
 estimated_cost numeric not null default 0 check(estimated_cost>=0), estimated_latency_ms bigint not null default 0 check(estimated_latency_ms>=0),
 status text not null default 'planned' check(status in ('planned','resolvable','blocked','simulated','verified','cancelled')),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(), unique(plan_id,step_key),unique(plan_id,ordinal));

create table public.hq_workforce_plan_step_capabilities (
 plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict, capability_id uuid not null references public.hq_workforce_capabilities(id) on delete restrict,
 role text not null default 'required' check(role in ('required','supporting','verification','compensation')), minimum_coverage numeric(5,4) not null default 1 check(minimum_coverage>0 and minimum_coverage<=1),
 primary key(plan_step_id,capability_id,role));

create table public.hq_workforce_plan_step_resources (
 plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict, capability_id uuid not null references public.hq_workforce_capabilities(id) on delete restrict,
 resource_id uuid not null references public.hq_workforce_resources(id) on delete restrict, access_mode text not null check(access_mode in ('read','reason','invoke','write_control','review')),
 resolution_event_id bigint references public.hq_workforce_resource_resolution_events(id) on delete restrict, required boolean not null default true,
 primary key(plan_step_id,capability_id,resource_id,access_mode));

create table public.hq_workforce_plan_dependencies (
 plan_id uuid not null references public.hq_workforce_plans(id) on delete restrict, step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict,
 depends_on_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict, dependency_type text not null default 'completion' check(dependency_type in ('completion','evidence','data','authority','verification')),
 primary key(plan_id,step_id,depends_on_step_id,dependency_type),check(step_id<>depends_on_step_id));

create table public.hq_workforce_plan_step_work_items (
 plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict, work_item_id uuid not null references public.hq_work_items(id) on delete restrict,
 relationship text not null default 'implementation' check(relationship in ('implementation','verification','evidence')), primary key(plan_step_id,work_item_id,relationship));

create table public.hq_workforce_plan_events (
 id bigint generated always as identity primary key, plan_id uuid not null references public.hq_workforce_plans(id) on delete restrict,
 event_kind text not null check(event_kind in ('created','dag_validated','simulation','candidate','selected','rejected','superseded','blocked','correction')),
 reason text not null check(char_length(btrim(reason)) between 3 and 4000), payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default clock_timestamp());

create or replace function public.hq_workforce_plan_events_immutable() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin raise exception 'worker_engine_plan_history_is_append_only'; end $$;
create trigger trg_hq_workforce_plan_events_immutable before update or delete on public.hq_workforce_plan_events for each row execute function public.hq_workforce_plan_events_immutable();

create or replace function public.hq_workforce_create_plan(p_objective_id uuid,p_plan_key text,p_strategy_key text,p_rationale jsonb,p_verification_contract jsonb,p_compensation_contract jsonb default '{}'::jsonb,p_provenance jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$ declare v_id uuid; v_version integer; o public.hq_workforce_objectives%rowtype; begin
 select * into o from public.hq_workforce_objectives where id=p_objective_id for update; if not found then raise exception 'objective_not_found'; end if;
 if o.status not in ('context_pending','planning','blocked') then raise exception 'objective_not_ready_for_planning:%',o.status; end if;
 if coalesce(jsonb_typeof(p_provenance),'null')<>'object' or p_provenance='{}'::jsonb then raise exception 'plan_provenance_required'; end if;
 select coalesce(max(version),0)+1 into v_version from public.hq_workforce_plans where objective_id=p_objective_id and plan_key=btrim(p_plan_key);
 insert into public.hq_workforce_plans(objective_id,plan_key,version,strategy_key,rationale,verification_contract,compensation_contract,provenance)
 values(p_objective_id,btrim(p_plan_key),v_version,btrim(p_strategy_key),coalesce(p_rationale,'{}'),coalesce(p_verification_contract,'{}'),coalesce(p_compensation_contract,'{}'),p_provenance) returning id into v_id;
 insert into public.hq_workforce_plan_events(plan_id,event_kind,reason,payload) values(v_id,'created','Governed candidate plan created.',jsonb_build_object('objective_id',p_objective_id,'version',v_version)); return v_id; end $$;

create or replace function public.hq_workforce_validate_plan_dag(p_plan_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp stable as $$ declare n integer; cyc boolean; begin
 select count(*) into n from public.hq_workforce_plan_steps where plan_id=p_plan_id; if n=0 then return jsonb_build_object('valid',false,'reason','plan_has_no_steps'); end if;
 with recursive walk(current_id,path,cycle) as (
   select s.id,array[s.id]::uuid[],false from public.hq_workforce_plan_steps s where s.plan_id=p_plan_id
   union all select d.depends_on_step_id,w.path||d.depends_on_step_id,d.depends_on_step_id=any(w.path)
   from walk w join public.hq_workforce_plan_dependencies d on d.plan_id=p_plan_id and d.step_id=w.current_id where not w.cycle)
 select coalesce(bool_or(cycle),false) into cyc from walk;
 return jsonb_build_object('valid',not cyc,'reason',case when cyc then 'cycle_detected' else 'acyclic_dag' end,'step_count',n); end $$;

alter table public.hq_workforce_plans enable row level security; alter table public.hq_workforce_plan_steps enable row level security;
alter table public.hq_workforce_plan_step_capabilities enable row level security; alter table public.hq_workforce_plan_step_resources enable row level security;
alter table public.hq_workforce_plan_dependencies enable row level security; alter table public.hq_workforce_plan_step_work_items enable row level security; alter table public.hq_workforce_plan_events enable row level security;
revoke all on public.hq_workforce_plans,public.hq_workforce_plan_steps,public.hq_workforce_plan_step_capabilities,public.hq_workforce_plan_step_resources,public.hq_workforce_plan_dependencies,public.hq_workforce_plan_step_work_items,public.hq_workforce_plan_events from public,anon,authenticated;
grant select,insert,update on public.hq_workforce_plans,public.hq_workforce_plan_steps,public.hq_workforce_plan_step_capabilities,public.hq_workforce_plan_step_resources,public.hq_workforce_plan_dependencies,public.hq_workforce_plan_step_work_items to service_role;
grant select,insert on public.hq_workforce_plan_events to service_role; grant usage,select on sequence public.hq_workforce_plan_events_id_seq to service_role;
revoke all on function public.hq_workforce_create_plan(uuid,text,text,jsonb,jsonb,jsonb,jsonb),public.hq_workforce_validate_plan_dag(uuid),public.hq_workforce_plan_events_immutable() from public,anon,authenticated;
grant execute on function public.hq_workforce_create_plan(uuid,text,text,jsonb,jsonb,jsonb,jsonb),public.hq_workforce_validate_plan_dag(uuid) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin select * into ec from public.hq_workforce_engine_contract where singleton=true; if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then raise exception 'WE-R1.3X X5 violated fail-closed runtime boundary'; end if; end $$;
