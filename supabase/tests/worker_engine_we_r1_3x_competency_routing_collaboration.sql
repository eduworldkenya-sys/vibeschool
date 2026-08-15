-- WE-R1.3X X6 acceptance: route by competency/capability, never department; collaboration transfers no authority.
begin;

insert into public.hq_workforce_capabilities(
  capability_key,version,display_name,purpose,risk_class,autonomy_ceiling,lifecycle_status,provenance
) values
  ('test.x6.quality',1,'X6 Quality','Provide governed quality analysis',0,0,'certified','{"suite":"x6","kind":"routing"}'),
  ('test.x6.curriculum',1,'X6 Curriculum','Provide governed curriculum analysis',0,0,'certified','{"suite":"x6","kind":"routing"}');

insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select id,'quality.analysis',true,1,.6 from public.hq_workforce_capabilities where capability_key='test.x6.quality'
union all
select id,'curriculum.analysis',true,1,.6 from public.hq_workforce_capabilities where capability_key='test.x6.curriculum';

-- Deliberately place specialists in departments that do not match the supplied legacy lane.
insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status)
values
  ('x6-quality-specialist','digital','X6 Quality Specialist','product','Prove competency-based quality routing','active'),
  ('x6-curriculum-specialist','digital','X6 Curriculum Specialist','publishing','Prove competency-based curriculum routing','active');

insert into public.hq_workforce_worker_competencies(
  worker_key,competency_key,version,proficiency,reliability,sample_count,certification_status,evidence,scope_types,jurisdictions
) values
  ('x6-quality-specialist','quality.analysis',1,.95,.95,50,'certified','{"suite":"x6"}',array['platform_internal'],array['global']),
  ('x6-curriculum-specialist','curriculum.analysis',1,.95,.95,50,'certified','{"suite":"x6"}',array['platform_internal'],array['global']);

insert into public.hq_workforce_objectives(
  objective_key,source_type,source_ref,desired_outcome,scope_type,scope_ref,constraints,success_criteria,evidence_requirements,priority,risk_class,status,provenance
) values (
  'test.x6.objective','acceptance','x6','Produce a verified multi-specialist recommendation','platform_internal','{}','[]',
  '[{"criterion":"specialists_cover_all_required_competencies"}]','[{"evidence":"routing_and_collaboration"}]',50,0,'planning',
  '{"suite":"x6","source":"acceptance"}'
);

insert into public.hq_workforce_plans(
  objective_id,plan_key,version,strategy_key,status,required_autonomy,required_risk,rationale,verification_contract,compensation_contract,provenance
)
select id,'test.x6.plan',1,'multi-specialist-analysis','candidate',0,0,
       '{"reason":"exercise competency composition"}','{"required":true}','{}','{"suite":"x6"}'
from public.hq_workforce_objectives where objective_key='test.x6.objective';

insert into public.hq_workforce_plan_steps(
  plan_id,step_key,ordinal,purpose,actor_mode,status,required_autonomy,required_risk,input_contract,expected_output,verification_contract
)
select id,'joint-analysis',1,'Compose quality and curriculum analysis','unassigned','planned',0,0,'{}','{"recommendation":true}','{"human_review":true}'
from public.hq_workforce_plans where plan_key='test.x6.plan';

insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id,role)
select s.id,c.id,'required'
from public.hq_workforce_plan_steps s
cross join public.hq_workforce_capabilities c
where s.step_key='joint-analysis' and c.capability_key in ('test.x6.quality','test.x6.curriculum');

do $$ declare v jsonb; n integer; begin
 v:=public.hq_workforce_route_plan_step(
   (select id from public.hq_workforce_plan_steps where step_key='joint-analysis'),
   'Quality',
   'legacy-quality-worker'
 );
 if v->>'status'<>'team' then raise exception 'X6 expected multi-specialist team, got %',v; end if;
 if not ((v->'selected_workers') ? 'x6-quality-specialist') then raise exception 'X6 missing quality specialist %',v; end if;
 if not ((v->'selected_workers') ? 'x6-curriculum-specialist') then raise exception 'X6 missing curriculum specialist %',v; end if;
 select count(*) into n from public.hq_workforce_collaborations
 where objective_id=(select id from public.hq_workforce_objectives where objective_key='test.x6.objective') and authority_transfer=false;
 if n<1 then raise exception 'X6 team route failed to create no-authority-transfer collaboration'; end if;
 if exists(select 1 from public.hq_workforce_collaborations where objective_id=(select id from public.hq_workforce_objectives where objective_key='test.x6.objective') and authority_transfer) then raise exception 'X6 collaboration amplified authority'; end if;
 if not exists(select 1 from public.hq_workforce_routing_events
   where objective_id=(select id from public.hq_workforce_objectives where objective_key='test.x6.objective')
     and legacy_lane_key='Quality' and rationale->>'department_is_hard_gate'='false') then
   raise exception 'X6 routing evidence missing legacy comparison/non-gate proof';
 end if;
end $$;

-- Append-only evidence must reject mutation.
do $$ begin
 begin
   update public.hq_workforce_routing_events set routing_mode='unresolved'
   where objective_id=(select id from public.hq_workforce_objectives where objective_key='test.x6.objective');
   raise exception 'X6 routing evidence was mutable';
 exception when others then
   if sqlerrm='X6 routing evidence was mutable' then raise; end if;
 end;
end $$;

-- L0/R0 fail-closed route.
update public.hq_workforce_plan_steps set required_autonomy=1 where step_key='joint-analysis';
do $$ declare v jsonb; begin
 v:=public.hq_workforce_route_plan_step((select id from public.hq_workforce_plan_steps where step_key='joint-analysis'));
 if v->>'status'<>'unresolved' or v->>'reason'<>'r13x_reconciliation_routes_l0_r0_only' then
   raise exception 'X6 consequential route did not fail closed %',v;
 end if;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then
   raise exception 'X6 acceptance found consequential runtime enabled';
 end if;
end $$;

rollback;
