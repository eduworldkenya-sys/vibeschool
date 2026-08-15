-- WE-R1.3X X5 Planning Graph adversarial/regression tests.
begin;

do $$ declare t text; r text; begin
 foreach t in array array['hq_workforce_plans','hq_workforce_plan_steps','hq_workforce_plan_step_capabilities','hq_workforce_plan_step_resources','hq_workforce_plan_dependencies','hq_workforce_plan_step_work_items','hq_workforce_plan_events'] loop
  if to_regclass('public.'||t) is null then raise exception 'missing table %',t; end if;
  if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||t)) then raise exception 'RLS disabled %',t; end if;
  foreach r in array array['public','anon','authenticated'] loop if has_table_privilege(r,'public.'||t,'SELECT') or has_table_privilege(r,'public.'||t,'INSERT') or has_table_privilege(r,'public.'||t,'UPDATE') or has_table_privilege(r,'public.'||t,'DELETE') then raise exception 'unexpected privilege % on %',r,t; end if; end loop;
 end loop;
end $$;

-- Build a complete safe plan and prove simulation + least-sufficient selection.
do $$ declare obj uuid; cap uuid; res uuid; p1 uuid; p2 uuid; s1 uuid; s2 uuid; out jsonb; chosen jsonb; begin
 obj:=public.hq_workforce_create_objective('X5-'||gen_random_uuid()::text,'test',null,'Resolve a governed objective using a plan DAG','platform_internal','{}','[]','["verified outcome"]','["plan evidence"]',50::smallint,0::smallint,null,'{"suite":"x5"}',null);
 perform public.hq_workforce_transition_objective(obj,'planning','Context is sufficient for test planning','system',null,'[]');
 insert into public.hq_workforce_capabilities(capability_key,display_name,purpose,lifecycle_status,provenance) values('x5.inspect-'||gen_random_uuid()::text,'Inspect safely','X5 test capability','certified','{"suite":"x5"}') returning id into cap;
 insert into public.hq_workforce_resources(resource_key,resource_kind,display_name,enabled,shadow_capable,health_status,reliability,cost_per_unit,required_autonomy,risk_class,allowed_scope_types,jurisdictions,allowed_data_classifications,provenance)
 values('x5.safe-'||gen_random_uuid()::text,'data_source','Safe facts',true,true,'healthy',.9,1,0,0,array['platform_internal'],array['global'],array['internal'],'{"suite":"x5"}') returning id into res;
 p1:=public.hq_workforce_create_plan(obj,'safe','deterministic-safe','{"reason":"least authority"}','{"evidence":true}','{}','{"suite":"x5"}');
 insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose,actor_mode,input_contract,expected_output,verification_contract) values(p1,'inspect',1,'Inspect governed facts','deterministic','{}','{}','{"evidence":true}') returning id into s1;
 insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id) values(s1,cap);
 insert into public.hq_workforce_plan_step_resources(plan_step_id,capability_id,resource_id,access_mode,required) values(s1,cap,res,'read',true);
 out:=public.hq_workforce_simulate_plan(p1); if out->>'status'<>'simulated' then raise exception 'safe plan failed simulation:%',out; end if;
 p2:=public.hq_workforce_create_plan(obj,'costly','costlier-safe','{"reason":"alternative"}','{"evidence":true}','{}','{"suite":"x5"}');
 insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose,actor_mode,input_contract,expected_output,verification_contract,estimated_cost,estimated_latency_ms) values(p2,'inspect',1,'Inspect governed facts costlier','deterministic','{}','{}','{"evidence":true}',10,1000) returning id into s2;
 insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id) values(s2,cap);
 insert into public.hq_workforce_plan_step_resources(plan_step_id,capability_id,resource_id,access_mode,required) values(s2,cap,res,'read',true);
 perform public.hq_workforce_simulate_plan(p2);
 chosen:=public.hq_workforce_select_least_sufficient_plan(obj,0::smallint,0::smallint); if (chosen->>'selected_plan_id')::uuid<>p1 then raise exception 'least-sufficient plan not selected:%',chosen; end if;
end $$;

-- Cyclic dependency must fail validation/simulation.
do $$ declare obj uuid; p uuid; a uuid; b uuid; cap uuid; res uuid; d jsonb; begin
 obj:=public.hq_workforce_create_objective('X5-CYCLE-'||gen_random_uuid()::text,'test',null,'Reject cyclic plan graph','platform_internal','{}','[]','[]','[]',50::smallint,0::smallint,null,'{"suite":"x5"}',null); perform public.hq_workforce_transition_objective(obj,'planning','cycle test','system',null,'[]');
 insert into public.hq_workforce_capabilities(capability_key,display_name,purpose,lifecycle_status,provenance) values('x5.cycle-'||gen_random_uuid()::text,'Cycle cap','Cycle test','certified','{"suite":"x5"}') returning id into cap;
 insert into public.hq_workforce_resources(resource_key,resource_kind,display_name,enabled,shadow_capable,health_status,reliability,cost_per_unit,required_autonomy,risk_class,allowed_scope_types,jurisdictions,allowed_data_classifications,provenance) values('x5.cycle-res-'||gen_random_uuid()::text,'deterministic','Cycle res',true,true,'healthy',1,0,0,0,array['platform_internal'],array['global'],array['internal'],'{"suite":"x5"}') returning id into res;
 p:=public.hq_workforce_create_plan(obj,'cycle','invalid-cycle','{}','{}','{}','{"suite":"x5"}');
 insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose) values(p,'a',1,'A') returning id into a; insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose) values(p,'b',2,'B') returning id into b;
 insert into public.hq_workforce_plan_step_capabilities values(a,cap,'required',1),(b,cap,'required',1); insert into public.hq_workforce_plan_step_resources(plan_step_id,capability_id,resource_id,access_mode,required) values(a,cap,res,'read',true),(b,cap,res,'read',true);
 insert into public.hq_workforce_plan_dependencies(plan_id,step_id,depends_on_step_id) values(p,a,b),(p,b,a);
 d:=public.hq_workforce_validate_plan_dag(p); if coalesce((d->>'valid')::boolean,true) then raise exception 'cycle accepted:%',d; end if;
end $$;

-- Missing capability/resource coverage must never simulate.
do $$ declare obj uuid; p uuid; s uuid; out jsonb; begin
 obj:=public.hq_workforce_create_objective('X5-MISSING-'||gen_random_uuid()::text,'test',null,'Reject incomplete plan','platform_internal','{}','[]','[]','[]',50::smallint,0::smallint,null,'{"suite":"x5"}',null); perform public.hq_workforce_transition_objective(obj,'planning','missing coverage test','system',null,'[]');
 p:=public.hq_workforce_create_plan(obj,'missing','incomplete','{}','{}','{}','{"suite":"x5"}'); insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose) values(p,'only',1,'Incomplete') returning id into s;
 out:=public.hq_workforce_simulate_plan(p); if out->>'status'<>'invalid' then raise exception 'incomplete plan simulated:%',out; end if;
end $$;

-- History immutable and runtime still fail-closed.
do $$ declare eid bigint; ec public.hq_workforce_engine_contract%rowtype; begin
 select id into eid from public.hq_workforce_plan_events order by id desc limit 1; begin update public.hq_workforce_plan_events set reason='tamper' where id=eid; raise exception 'plan history mutation accepted'; exception when others then if sqlerrm='plan history mutation accepted' then raise; end if; end;
 select * into ec from public.hq_workforce_engine_contract where singleton=true; if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then raise exception 'X5 changed runtime boundary'; end if;
end $$;

rollback;
