-- WE-R1.3X X6 acceptance: route by competency/capability, never department; collaboration transfers no authority.
begin;

insert into public.hq_workforce_capabilities(capability_key,version,display_name,capability_mode,certification_status,risk_class,autonomy_ceiling,shadow_capable,enabled)
values ('test.x6.quality',1,'X6 Quality','shadow_reasoning','certified',0,0,true,true),
       ('test.x6.curriculum',1,'X6 Curriculum','shadow_reasoning','certified',0,0,true,true);

insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select id,'quality.analysis',true,1,.6 from public.hq_workforce_capabilities where capability_key='test.x6.quality'
union all
select id,'curriculum.analysis',true,1,.6 from public.hq_workforce_capabilities where capability_key='test.x6.curriculum';

-- Reuse real canonical workers if present; fixtures only enrich their competency evidence.
insert into public.hq_workforce_worker_competencies(worker_key,competency_key,proficiency,reliability,certification_status,certified_at)
values ('quality-worker-01','quality.analysis',.95,.95,'certified',clock_timestamp()),
       ('curriculum-worker-01','curriculum.analysis',.95,.95,'certified',clock_timestamp())
on conflict(worker_key,competency_key) do update set proficiency=excluded.proficiency,reliability=excluded.reliability,certification_status='certified',certified_at=excluded.certified_at;

insert into public.hq_workforce_objectives(objective_key,title,objective_type,status,priority,risk_class,autonomy_ceiling,source_kind,source_key,success_criteria,evidence_requirements)
values ('test.x6.objective','X6 multi-specialist objective','quality','planning',50,0,0,'acceptance','x6','{"done":true}','{"routing":true}');

insert into public.hq_workforce_plans(objective_id,plan_key,status,plan_rank,authority_required,risk_class)
select id,'test.x6.plan','candidate',1,0,0 from public.hq_workforce_objectives where objective_key='test.x6.objective';

insert into public.hq_workforce_plan_steps(plan_id,step_key,step_order,title,actor_mode,status,required_autonomy,required_risk)
select id,'joint-analysis',1,'Joint specialist analysis','unassigned','pending',0,0 from public.hq_workforce_plans where plan_key='test.x6.plan';

insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id,role)
select s.id,c.id,'required' from public.hq_workforce_plan_steps s cross join public.hq_workforce_capabilities c
where s.step_key='joint-analysis' and c.capability_key in ('test.x6.quality','test.x6.curriculum');

do $$ declare v jsonb; n integer; begin
 v:=public.hq_workforce_route_plan_step(
   (select id from public.hq_workforce_plan_steps where step_key='joint-analysis'),
   'Quality',
   'legacy-quality-worker'
 );
 if v->>'status'<>'team' then raise exception 'X6 expected multi-specialist team, got %',v; end if;
 if not ((v->'selected_workers') ? 'quality-worker-01') then raise exception 'X6 missing quality specialist %',v; end if;
 if not ((v->'selected_workers') ? 'curriculum-worker-01') then raise exception 'X6 missing curriculum specialist %',v; end if;
 select count(*) into n from public.hq_workforce_collaborations where objective_id=(select id from public.hq_workforce_objectives where objective_key='test.x6.objective') and authority_transfer=false;
 if n<1 then raise exception 'X6 team route failed to create no-authority-transfer collaboration'; end if;
 if exists(select 1 from public.hq_workforce_collaborations where objective_id=(select id from public.hq_workforce_objectives where objective_key='test.x6.objective') and authority_transfer) then raise exception 'X6 collaboration amplified authority'; end if;
 if not exists(select 1 from public.hq_workforce_routing_events where objective_id=(select id from public.hq_workforce_objectives where objective_key='test.x6.objective') and legacy_lane_key='Quality' and rationale->>'department_is_hard_gate'='false') then raise exception 'X6 routing evidence missing legacy comparison/non-gate proof'; end if;
end $$;

-- Append-only evidence must reject mutation.
do $$ begin
 begin
   update public.hq_workforce_routing_events set routing_mode='unresolved' where objective_id=(select id from public.hq_workforce_objectives where objective_key='test.x6.objective');
   raise exception 'X6 routing evidence was mutable';
 exception when others then
   if sqlerrm='X6 routing evidence was mutable' then raise; end if;
 end;
end $$;

-- L0/R0 fail-closed route.
update public.hq_workforce_plan_steps set required_autonomy=1 where step_key='joint-analysis';
do $$ declare v jsonb; begin
 v:=public.hq_workforce_route_plan_step((select id from public.hq_workforce_plan_steps where step_key='joint-analysis'));
 if v->>'status'<>'unresolved' or v->>'reason'<>'r13x_reconciliation_routes_l0_r0_only' then raise exception 'X6 consequential route did not fail closed %',v; end if;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then raise exception 'X6 acceptance found consequential runtime enabled'; end if;
end $$;

rollback;
