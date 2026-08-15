-- WE-R1.3X X6: competency/capability routing + collaboration. NON-ACTIVATING.
-- Lane/department is retained as metadata and legacy comparison evidence, never a hard eligibility condition here.
-- access: service-only public.hq_workforce_capability_competencies
-- authorization-test: public.hq_workforce_capability_competencies denies anon/authenticated direct access.
-- access: service-only public.hq_workforce_routing_events
-- authorization-test: public.hq_workforce_routing_events denies anon/authenticated direct access; append-only routing evidence.
-- access: service-only public.hq_workforce_collaborations
-- authorization-test: public.hq_workforce_collaborations denies anon/authenticated direct access; no authority transfer implied.

create table public.hq_workforce_capability_competencies (
 capability_id uuid not null references public.hq_workforce_capabilities(id) on delete restrict,
 competency_key text not null, required boolean not null default true, weight numeric(5,4) not null default 1 check(weight>0 and weight<=1),
 minimum_proficiency numeric(5,4) not null default .5 check(minimum_proficiency between 0 and 1),
 primary key(capability_id,competency_key));

create table public.hq_workforce_routing_events (
 id bigint generated always as identity primary key, objective_id uuid references public.hq_workforce_objectives(id) on delete restrict,
 plan_step_id uuid references public.hq_workforce_plan_steps(id) on delete restrict, routing_mode text not null check(routing_mode in ('single_worker','team','human_only','unresolved')),
 selected_workers text[] not null default '{}'::text[], legacy_lane_key text, legacy_worker_key text,
 required_competencies text[] not null default '{}'::text[], candidate_scores jsonb not null default '[]'::jsonb,
 rationale jsonb not null default '{}'::jsonb, created_at timestamptz not null default clock_timestamp());

create table public.hq_workforce_collaborations (
 id uuid primary key default gen_random_uuid(), objective_id uuid not null references public.hq_workforce_objectives(id) on delete restrict,
 plan_id uuid references public.hq_workforce_plans(id) on delete restrict, plan_step_id uuid references public.hq_workforce_plan_steps(id) on delete restrict,
 from_worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
 to_worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
 collaboration_type text not null check(collaboration_type in ('consult','handoff','review','verify','joint_step')),
 requested_competencies text[] not null default '{}'::text[], authority_transfer boolean not null default false check(authority_transfer=false),
 status text not null default 'proposed' check(status in ('proposed','accepted','declined','completed','cancelled')),
 evidence jsonb not null default '{}'::jsonb, created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check(from_worker_key<>to_worker_key));

create or replace function public.hq_workforce_routing_events_immutable() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin raise exception 'worker_engine_routing_evidence_is_append_only'; end $$;
create trigger trg_hq_workforce_routing_events_immutable before update or delete on public.hq_workforce_routing_events for each row execute function public.hq_workforce_routing_events_immutable();

create or replace function public.hq_workforce_route_plan_step(p_plan_step_id uuid,p_legacy_lane_key text default null,p_legacy_worker_key text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hq_workforce_plan_steps%rowtype; p public.hq_workforce_plans%rowtype; req text[]; selected text[]:=array[]::text[]; candidates jsonb; mode text:='unresolved'; comp text; wk text; all_covered boolean:=true; i integer;
begin
 select * into s from public.hq_workforce_plan_steps where id=p_plan_step_id for update; if not found then raise exception 'plan_step_not_found'; end if;
 select * into p from public.hq_workforce_plans where id=s.plan_id; if not found then raise exception 'plan_not_found'; end if;
 if s.required_autonomy<>0 or s.required_risk<>0 then return jsonb_build_object('status','unresolved','reason','r13x_reconciliation_routes_l0_r0_only','consequential_execution',false); end if;
 select coalesce(array_agg(distinct cc.competency_key order by cc.competency_key),'{}'::text[]) into req
 from public.hq_workforce_plan_step_capabilities pc join public.hq_workforce_capability_competencies cc on cc.capability_id=pc.capability_id and cc.required where pc.plan_step_id=s.id and pc.role='required';
 if cardinality(req)=0 then return jsonb_build_object('status','unresolved','reason','no_competency_contract','consequential_execution',false); end if;
 with loads as (
   select w.worker_key,count(a.id) filter(where a.active)::numeric as open_load from public.hq_workforce_workers w left join public.hq_workforce_assignments a on a.worker_key=w.worker_key group by w.worker_key
 ), ranked as (
   select rw.worker_key,rw.matched_competencies,rw.coverage,rw.fit_score,coalesce(l.open_load,0) open_load,
          (rw.fit_score*0.70 + rw.coverage*0.25 - least(coalesce(l.open_load,0),20)*0.005) final_score
   from public.hq_workforce_rank_workers_by_competency(req,'platform_internal','global',100) rw join public.hq_workforce_workers w on w.worker_key=rw.worker_key
   left join loads l on l.worker_key=rw.worker_key where w.status='active'
 ) select coalesce(jsonb_agg(jsonb_build_object('worker_key',worker_key,'matched',matched_competencies,'coverage',coverage,'fit',fit_score,'open_load',open_load,'score',final_score) order by final_score desc,worker_key),'[]'::jsonb) into candidates from ranked;
 select array_agg(worker_key order by final_score desc,worker_key) into selected from (
   with loads as (select w.worker_key,count(a.id) filter(where a.active)::numeric open_load from public.hq_workforce_workers w left join public.hq_workforce_assignments a on a.worker_key=w.worker_key group by w.worker_key)
   select rw.worker_key,(rw.fit_score*0.70+rw.coverage*0.25-least(coalesce(l.open_load,0),20)*0.005) final_score from public.hq_workforce_rank_workers_by_competency(req,'platform_internal','global',100) rw left join loads l on l.worker_key=rw.worker_key join public.hq_workforce_workers w on w.worker_key=rw.worker_key where w.status='active' and rw.coverage=1 order by final_score desc,rw.worker_key limit 1) q;
 if cardinality(coalesce(selected,'{}'::text[]))=1 then mode:='single_worker'; else
   selected:=array[]::text[];
   foreach comp in array req loop
     select r.worker_key into wk from public.hq_workforce_rank_workers_by_competency(array[comp],'platform_internal','global',100) r join public.hq_workforce_workers w on w.worker_key=r.worker_key where w.status='active' and r.coverage=1 order by r.fit_score desc,r.worker_key limit 1;
     if wk is null then all_covered:=false; elsif not wk=any(selected) then selected:=array_append(selected,wk); end if;
   end loop;
   if all_covered and cardinality(selected)>0 then mode:=case when cardinality(selected)=1 then 'single_worker' else 'team' end; else mode:='unresolved'; end if;
 end if;
 if mode='single_worker' then update public.hq_workforce_plan_steps set worker_key=selected[1],actor_mode='worker',status='resolvable',updated_at=clock_timestamp() where id=s.id;
 elsif mode='team' then update public.hq_workforce_plan_steps set worker_key=selected[1],actor_mode='team',status='resolvable',updated_at=clock_timestamp() where id=s.id;
   for i in 2..cardinality(selected) loop insert into public.hq_workforce_collaborations(objective_id,plan_id,plan_step_id,from_worker_key,to_worker_key,collaboration_type,requested_competencies,evidence) values(p.objective_id,p.id,s.id,selected[1],selected[i],'joint_step',req,jsonb_build_object('routing','X6','authority_transfer',false)); end loop;
 else update public.hq_workforce_plan_steps set actor_mode='unassigned',status='blocked',updated_at=clock_timestamp() where id=s.id; end if;
 insert into public.hq_workforce_routing_events(objective_id,plan_step_id,routing_mode,selected_workers,legacy_lane_key,legacy_worker_key,required_competencies,candidate_scores,rationale)
 values(p.objective_id,s.id,mode,coalesce(selected,'{}'::text[]),p_legacy_lane_key,p_legacy_worker_key,req,candidates,jsonb_build_object('canonical','competency_capability_authority_reliability_workload','department_is_hard_gate',false,'legacy_comparison_only',true));
 return jsonb_build_object('status',mode,'selected_workers',coalesce(selected,'{}'::text[]),'required_competencies',req,'candidates',candidates,'legacy',jsonb_build_object('lane_key',p_legacy_lane_key,'worker_key',p_legacy_worker_key),'consequential_execution',false); end $$;

alter table public.hq_workforce_capability_competencies enable row level security; alter table public.hq_workforce_routing_events enable row level security; alter table public.hq_workforce_collaborations enable row level security;
revoke all on public.hq_workforce_capability_competencies,public.hq_workforce_routing_events,public.hq_workforce_collaborations from public,anon,authenticated;
grant select,insert,update on public.hq_workforce_capability_competencies,public.hq_workforce_collaborations to service_role; grant select,insert on public.hq_workforce_routing_events to service_role; grant usage,select on sequence public.hq_workforce_routing_events_id_seq to service_role;
revoke all on function public.hq_workforce_route_plan_step(uuid,text,text),public.hq_workforce_routing_events_immutable() from public,anon,authenticated; grant execute on function public.hq_workforce_route_plan_step(uuid,text,text) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin select * into ec from public.hq_workforce_engine_contract where singleton=true; if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then raise exception 'WE-R1.3X X6 violated fail-closed runtime boundary'; end if; end $$;
