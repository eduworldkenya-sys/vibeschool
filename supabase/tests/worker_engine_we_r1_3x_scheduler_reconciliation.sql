-- WE-R1.3X X7 acceptance: objective-first scheduler, no heartbeat/work-item bypass, no consequential execution.
begin;

do $$ declare v jsonb; begin
  v:=public.hq_workforce_run_r1_3x_shadow_scheduler('x7-disabled-proof',10);
  if v->>'status'<>'disabled' or v->>'reason'<>'shadow_scheduler_global_stop' or coalesce((v->>'consequential_execution')::boolean,true) then raise exception 'X7 scheduler did not fail closed while Shadow is disabled: %',v; end if;
end $$;

do $$ declare v jsonb; begin
  v:=public.hq_workforce_scheduled_heartbeat();
  if v->>'status'<>'retired' or v->>'mode'<>'compatibility_tombstone' or coalesce((v->>'consequential_execution')::boolean,true) then raise exception 'X7 scheduled heartbeat compatibility boundary invalid: %',v; end if;
end $$;

do $$ declare d text; begin
  select lower(pg_get_functiondef('public.hq_workforce_run_shadow_cycle(text,integer)'::regprocedure)) into d;
  if position('hq_workforce_run_r1_3x_shadow_scheduler' in d)=0 then raise exception 'X7 legacy shadow-cycle does not delegate to canonical scheduler'; end if;
  if position('hq_work_items' in d)>0 or position('hq_workforce_autonomous_heartbeat' in d)>0 then raise exception 'X7 legacy shadow-cycle retains bypass logic'; end if;
end $$;

do $$ begin if public.hq_workforce_legacy_heartbeat_cron_present() then raise exception 'X7 legacy heartbeat cron remains installed'; end if; end $$;

insert into public.hq_workforce_capabilities(capability_key,version,display_name,purpose,risk_class,autonomy_ceiling,lifecycle_status,provenance)
values ('test.x7.scheduler.analysis',1,'X7 Scheduler Analysis','Prove objective-first scheduler orchestration',0,0,'certified','{"suite":"x7","kind":"scheduler"}');
insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select id,'scheduler.analysis',true,1,.6 from public.hq_workforce_capabilities where capability_key='test.x7.scheduler.analysis';
insert into public.hq_workforce_resources(resource_key,version,resource_kind,display_name,enabled,shadow_capable,health_status,reliability,cost_per_unit,cost_unit,latency_class,required_autonomy,risk_class,allowed_scope_types,jurisdictions,allowed_data_classifications,provenance)
values ('test.x7.deterministic.context',1,'deterministic','X7 Deterministic Context Resolver',true,true,'healthy',.99,0,'count',0,0,0,array['platform_internal'],array['global'],array['internal'],'{"suite":"x7","kind":"resource"}');
insert into public.hq_workforce_capability_resources(capability_id,resource_id,access_mode,required,minimum_reliability,priority,constraints)
select c.id,r.id,'read',true,.9,100,'{}'::jsonb from public.hq_workforce_capabilities c join public.hq_workforce_resources r on r.resource_key='test.x7.deterministic.context' where c.capability_key='test.x7.scheduler.analysis';
insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status)
values ('x7-scheduler-specialist','digital','X7 Scheduler Specialist','growth','Prove objective-first routing independent of department','active');
insert into public.hq_workforce_worker_competencies(worker_key,competency_key,version,proficiency,reliability,sample_count,certification_status,evidence,scope_types,jurisdictions)
values ('x7-scheduler-specialist','scheduler.analysis',1,.97,.96,60,'certified','{"suite":"x7"}',array['platform_internal'],array['global']);

update public.hq_workforce_engine_contract set shadow_enabled=true,shadow_scheduler_enabled=true,shadow_global_stop=false,shadow_anomaly_paused=false,heartbeat_enabled=false,factory_enabled=false,runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,shadow_max_cycles_per_hour=100,shadow_max_candidates_per_cycle=25,shadow_max_queue_depth=1000 where singleton=true;

do $$ declare oid uuid; v jsonb; begin
  oid:=public.hq_workforce_create_objective('test.x7.objective','acceptance','x7','Produce a verified scheduler reconciliation recommendation','platform_internal','{}'::jsonb,'[]'::jsonb,'[{"criterion":"objective_first_pipeline"}]'::jsonb,'[{"evidence":"scheduler_events"}]'::jsonb,90::smallint,0::smallint,null::timestamptz,'{"suite":"x7","source":"acceptance"}'::jsonb,null::uuid);
  v:=public.hq_workforce_run_shadow_cycle('x7-cycle-detect',10);
  if v->>'status'<>'completed' then raise exception 'X7 compatibility bridge did not invoke canonical scheduler: %',v; end if;
  if (select status from public.hq_workforce_objectives where id=oid)<>'context_pending' then raise exception 'X7 detected objective did not advance only to governed context stage'; end if;
  if exists(select 1 from public.hq_workforce_scheduler_events where cycle_key='x7-cycle-detect' and objective_id=oid and stage='planning') then raise exception 'X7 scheduler skipped context boundary'; end if;
end $$;

-- Scheduler tests require already-reviewed memory as fixture state. The service transport
-- constructor is intentionally unable to manufacture verified/authoritative truth after
-- R1.4.13, so create the observation through that constructor and have the database-owner
-- test harness establish the pre-reviewed fixture explicitly. This does not exercise or
-- weaken the production review RPC; X2/R1.4 tests cover that boundary separately.
do $$ declare oid uuid; mid uuid; pid uuid; sid uuid; cid uuid; begin
  select id into oid from public.hq_workforce_objectives where objective_key='test.x7.objective';
  mid:=public.hq_workforce_add_memory('test.x7.context','fact','{"condition":"scheduler_fixture_ready"}'::jsonb,'{"suite":"x7","source":"acceptance"}'::jsonb,'acceptance','x7',1::numeric,'corroborated',false);
  update public.hq_workforce_memory_records set verification_state='verified',authoritative=true where id=mid;
  perform public.hq_workforce_bind_objective_context(oid,mid,'required','Verified X7 scheduler fixture context.',3600::bigint);
  pid:=public.hq_workforce_create_plan(oid,'test.x7.plan','deterministic-analysis','{"reason":"exercise X7 orchestration"}'::jsonb,'{"required":true}'::jsonb,'{}'::jsonb,'{"suite":"x7","source":"acceptance"}'::jsonb);
  insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose,actor_mode,input_contract,expected_output,verification_contract,required_autonomy,required_risk,status) values (pid,'analyze',1,'Analyze verified scheduler fixture','unassigned','{}'::jsonb,'{"recommendation":true}'::jsonb,'{"human_review":true}'::jsonb,0,0,'planned') returning id into sid;
  select id into cid from public.hq_workforce_capabilities where capability_key='test.x7.scheduler.analysis';
  insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id,role,minimum_coverage) values(sid,cid,'required',1);
end $$;

-- Adversarial proof: context valid at bind time must be revalidated before planning.
-- Bind with a realistic freshness window, then age observed_at beyond that window while preserving X2 structural invariants.
do $$ declare oid uuid; good_mid uuid; bad_mid uuid; v jsonb; begin
  oid:=public.hq_workforce_create_objective('test.x7.context_fail_closed','acceptance','x7-invalid-context','Prove all critical context remains valid before planning','platform_internal','{}'::jsonb,'[]'::jsonb,'[{"criterion":"all_critical_context_valid"}]'::jsonb,'[{"evidence":"scheduler_events"}]'::jsonb,89::smallint,0::smallint,null::timestamptz,'{"suite":"x7","source":"adversarial"}'::jsonb,null::uuid);
  v:=public.hq_workforce_run_r1_3x_shadow_scheduler('x7-context-detect',10);
  if (select status from public.hq_workforce_objectives where id=oid)<>'context_pending' then raise exception 'X7 adversarial objective did not enter context_pending'; end if;
  good_mid:=public.hq_workforce_add_memory('test.x7.context.good','fact','{"condition":"usable"}'::jsonb,'{"suite":"x7","source":"adversarial"}'::jsonb,'acceptance','x7',1::numeric,'corroborated',false);
  bad_mid:=public.hq_workforce_add_memory('test.x7.context.bad','fact','{"condition":"must_be_fresh"}'::jsonb,'{"suite":"x7","source":"adversarial"}'::jsonb,'acceptance','x7',1::numeric,'corroborated',false);
  update public.hq_workforce_memory_records set verification_state='verified',authoritative=true where id in (good_mid,bad_mid);
  perform public.hq_workforce_bind_objective_context(oid,good_mid,'required','Usable critical context.',3600::bigint);
  perform public.hq_workforce_bind_objective_context(oid,bad_mid,'policy','Policy context is valid at bind time but must be revalidated before planning.',60::bigint);
  update public.hq_workforce_memory_records set observed_at=clock_timestamp()-interval '120 seconds' where id=bad_mid;
  v:=public.hq_workforce_run_r1_3x_shadow_scheduler('x7-context-invalid',10);
  if (select status from public.hq_workforce_objectives where id=oid)<>'context_pending' then raise exception 'X7 scheduler advanced despite invalid critical context: %',v; end if;
  if exists(select 1 from public.hq_workforce_scheduler_events where cycle_key='x7-context-invalid' and objective_id=oid and stage='planning') then raise exception 'X7 scheduler emitted planning despite invalid critical context'; end if;
  if not exists(select 1 from public.hq_workforce_scheduler_events where cycle_key='x7-context-invalid' and objective_id=oid and stage='context' and outcome='awaiting_governed_context' and (details->>'invalid_critical_context_count')::integer>0) then raise exception 'X7 scheduler did not record fail-closed invalid-context evidence'; end if;
end $$;

do $$ declare v jsonb; oid uuid; begin
  select id into oid from public.hq_workforce_objectives where objective_key='test.x7.objective';
  v:=public.hq_workforce_run_r1_3x_shadow_scheduler('x7-cycle-plan',10);
  if v->>'status'<>'completed' or v->>'mode'<>'r1_3x_objective_first_shadow' then raise exception 'X7 canonical scheduler failed: %',v; end if;
  if coalesce((v->>'consequential_execution')::boolean,true) then raise exception 'X7 scheduler reported consequential execution'; end if;
  if (select status from public.hq_workforce_objectives where id=oid)<>'shadow_ready' then raise exception 'X7 objective did not become shadow_ready: %',v; end if;
  if not exists(select 1 from public.hq_workforce_plans where objective_id=oid and status='selected') then raise exception 'X7 did not select least-sufficient plan'; end if;
  if not exists(select 1 from public.hq_workforce_plan_step_resources psr join public.hq_workforce_plan_steps ps on ps.id=psr.plan_step_id join public.hq_workforce_plans p on p.id=ps.plan_id where p.objective_id=oid and psr.required) then raise exception 'X7 did not route through canonical resource resolution'; end if;
  if not exists(select 1 from public.hq_workforce_routing_events re where re.objective_id=oid and re.routing_mode='single_worker' and re.selected_workers @> array['x7-scheduler-specialist']::text[] and re.rationale->>'department_is_hard_gate'='false') then raise exception 'X7 did not route through competency graph independent of department'; end if;
  if not exists(select 1 from public.hq_workforce_scheduler_events where objective_id=oid and stage='context' and outcome='usable_context_verified') then raise exception 'X7 context stage evidence missing'; end if;
  if not exists(select 1 from public.hq_workforce_scheduler_events where objective_id=oid and stage='resolve' and outcome='resource_selected') then raise exception 'X7 resolve stage evidence missing'; end if;
  if not exists(select 1 from public.hq_workforce_scheduler_events where objective_id=oid and stage='route' and outcome='single_worker') then raise exception 'X7 route stage evidence missing'; end if;
  if not exists(select 1 from public.hq_workforce_scheduler_events where objective_id=oid and stage='shadow' and outcome='objective_shadow_ready') then raise exception 'X7 shadow-ready evidence missing'; end if;
end $$;

-- Tamper-proofing must target known objective evidence, not depend on which scheduler cycle advanced it.
do $$ declare oid uuid; begin
  select id into oid from public.hq_workforce_objectives where objective_key='test.x7.objective';
  begin
    update public.hq_workforce_scheduler_events set outcome='tampered' where objective_id=oid;
    raise exception 'X7 scheduler evidence was mutable';
  exception when others then
    if sqlerrm='X7 scheduler evidence was mutable' then raise; end if;
    if position('worker_engine_scheduler_evidence_is_append_only' in sqlerrm)=0 then raise; end if;
  end;
end $$;

do $$ begin
  if has_table_privilege('anon','public.hq_workforce_scheduler_events','SELECT') or has_table_privilege('authenticated','public.hq_workforce_scheduler_events','SELECT') then raise exception 'X7 scheduler evidence leaked to product roles'; end if;
  if has_function_privilege('anon','public.hq_workforce_run_r1_3x_shadow_scheduler(text,integer)','EXECUTE') or has_function_privilege('authenticated','public.hq_workforce_run_r1_3x_shadow_scheduler(text,integer)','EXECUTE') then raise exception 'X7 canonical scheduler executable by product roles'; end if;
  if has_function_privilege('anon','public.hq_workforce_run_shadow_cycle(text,integer)','EXECUTE') or has_function_privilege('authenticated','public.hq_workforce_run_shadow_cycle(text,integer)','EXECUTE') then raise exception 'X7 compatibility scheduler executable by product roles'; end if;
  if has_function_privilege('anon','public.hq_workforce_legacy_heartbeat_cron_present()','EXECUTE') or has_function_privilege('authenticated','public.hq_workforce_legacy_heartbeat_cron_present()','EXECUTE') then raise exception 'X7 cron guard executable by product roles'; end if;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin select * into ec from public.hq_workforce_engine_contract where singleton=true; if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then raise exception 'X7 test crossed L0/R0 safety boundary'; end if; end $$;

rollback;
