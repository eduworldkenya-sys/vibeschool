-- WE-R1.3X X9 calibration, verification and institutional-learning adversarial tests.
begin;

do $$ declare r text; begin
 if to_regclass('public.hq_workforce_calibration_observations') is null then raise exception 'X9 calibration table missing'; end if;
 if not (select relrowsecurity from pg_class where oid=to_regclass('public.hq_workforce_calibration_observations')) then raise exception 'X9 calibration RLS disabled'; end if;
 foreach r in array array['public','anon','authenticated'] loop
   if has_table_privilege(r,'public.hq_workforce_calibration_observations','SELECT')
      or has_table_privilege(r,'public.hq_workforce_calibration_observations','INSERT')
      or has_table_privilege(r,'public.hq_workforce_calibration_observations','UPDATE')
      or has_table_privilege(r,'public.hq_workforce_calibration_observations','DELETE')
   then raise exception 'unexpected X9 calibration privilege for %',r; end if;
 end loop;
end $$;

-- Verified outcome evidence must calibrate plan probability; insufficient samples must remain explicitly uncalibrated.
do $$ declare
 obj uuid; cap uuid; res uuid; p uuid; p_uncal uuid; s uuid; su uuid; tr uuid; ev uuid; out jsonb; cal jsonb; mid uuid; i integer;
begin
 obj:=public.hq_workforce_create_objective('X9-'||gen_random_uuid()::text,'test',null,'Calibrate predictions from verified outcomes','platform_internal','{}','[]','["verified outcome"]','["calibration evidence"]',50::smallint,0::smallint,null,'{"suite":"x9"}',null);
 perform public.hq_workforce_transition_objective(obj,'planning','X9 context ready','system',null,'[]');
 insert into public.hq_workforce_capabilities(capability_key,display_name,purpose,lifecycle_status,provenance)
 values('x9.cap-'||gen_random_uuid()::text,'X9 calibrated capability','Calibration test','certified','{"suite":"x9"}') returning id into cap;
 insert into public.hq_workforce_resources(resource_key,resource_kind,display_name,enabled,shadow_capable,health_status,reliability,cost_per_unit,required_autonomy,risk_class,allowed_scope_types,jurisdictions,allowed_data_classifications,provenance)
 values('x9.res-'||gen_random_uuid()::text,'data_source','X9 resource',true,true,'healthy',.20,0,0,0,array['platform_internal'],array['global'],array['internal'],'{"suite":"x9"}') returning id into res;

 p:=public.hq_workforce_create_plan(obj,'calibrated','x9-calibrated','{}','{"verified":true}','{}','{"suite":"x9"}');
 insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose,actor_mode) values(p,'observe',1,'Observe outcome','deterministic') returning id into s;
 insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id) values(s,cap);
 insert into public.hq_workforce_plan_step_resources(plan_step_id,capability_id,resource_id,access_mode,required) values(s,cap,res,'read',true);

 insert into public.hq_workforce_shadow_traces(cycle_key,worker_key,scope_type,scope_ref,status,predicted_outcome)
 values('x9-cycle-'||gen_random_uuid()::text,'x9-verifier','platform_internal','{}','evaluated','{"suite":"x9"}') returning trace_id into tr;

 for i in 1..5 loop
   insert into public.hq_workforce_evidence(trace_id,evidence_kind,source_type,source_ref,payload)
   values(tr,'verification','x9_test','sample-'||i,jsonb_build_object('verified',true,'sample',i)) returning id into ev;
   perform public.hq_workforce_record_verified_outcome(
     'plan',p::text,.20,case when i<=4 then 1 else 0 end,ev,'independent_test_verification',
     tr,obj,p,null,null,true,jsonb_build_object('suite','x9','sample',i)
   );
 end loop;

 cal:=public.hq_workforce_calibration_summary('plan',p::text);
 if (cal->>'sample_count')::integer<>5 then raise exception 'X9 sample count wrong:%',cal; end if;
 if abs((cal->>'empirical_success')::numeric-.8)>.0001 then raise exception 'X9 empirical probability wrong:%',cal; end if;

 out:=public.hq_workforce_simulate_plan(p);
 if out->>'status'<>'simulated' then raise exception 'X9 calibrated plan failed simulation:%',out; end if;
 if not coalesce((out->'calibration'->>'calibrated')::boolean,false) then raise exception 'X9 did not use verified calibration:%',out; end if;
 if abs((out->>'expected_success')::numeric-.8)>.0001 then raise exception 'X9 simulation ignored empirical outcomes:%',out; end if;

 mid:=public.hq_workforce_publish_verified_learning('plan',p::text,'Five independently verified outcomes establish a governed calibration lesson.',5);
 if not exists(select 1 from public.hq_workforce_memory_records where id=mid and memory_type='lesson' and verification_state='corroborated' and not authoritative) then
   raise exception 'X9 learning was not stored as non-authoritative governed memory';
 end if;

 p_uncal:=public.hq_workforce_create_plan(obj,'uncalibrated','x9-prior','{}','{}','{}','{"suite":"x9"}');
 insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose,actor_mode) values(p_uncal,'observe',1,'Observe prior','deterministic') returning id into su;
 insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id) values(su,cap);
 insert into public.hq_workforce_plan_step_resources(plan_step_id,capability_id,resource_id,access_mode,required) values(su,cap,res,'read',true);
 out:=public.hq_workforce_simulate_plan(p_uncal);
 if coalesce((out->'calibration'->>'calibrated')::boolean,true) then raise exception 'X9 falsely marked prior as calibrated:%',out; end if;
 if out->'calibration'->>'source'<>'declared_prior_insufficient_verified_samples' then raise exception 'X9 prior source not explicit:%',out; end if;
end $$;

-- Wrong evidence kind must fail; calibration history must be immutable.
do $$ declare tr uuid; ev uuid; obs uuid; begin
 insert into public.hq_workforce_shadow_traces(cycle_key,worker_key,scope_type,scope_ref,status)
 values('x9-adversarial-'||gen_random_uuid()::text,'x9-verifier','platform_internal','{}','evaluated') returning trace_id into tr;
 insert into public.hq_workforce_evidence(trace_id,evidence_kind,source_type,payload)
 values(tr,'fact','x9_test','{"not_verification":true}') returning id into ev;
 begin
   perform public.hq_workforce_record_verified_outcome('team','x9-team',.5,1,ev,'bad evidence',tr,null,null,null,null,true,'{"workers":["a","b"]}');
   raise exception 'X9 accepted non-verification evidence';
 exception when others then
   if sqlerrm='X9 accepted non-verification evidence' then raise; end if;
 end;
 select id into obs from public.hq_workforce_calibration_observations order by created_at desc limit 1;
 begin
   update public.hq_workforce_calibration_observations set outcome_value=0 where id=obs;
   raise exception 'X9 calibration mutation accepted';
 exception when others then
   if sqlerrm='X9 calibration mutation accepted' then raise; end if;
 end;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0
    or ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then
   raise exception 'X9 changed fail-closed runtime boundary';
 end if;
end $$;

rollback;