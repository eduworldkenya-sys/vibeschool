-- WE-L11 demand-sensor acceptance. Disposable/local replay DB only.
-- Proves real HQ backlog -> sustained signal -> worker -> verified work.
begin;
do $$
declare p uuid; i int; r jsonb; g uuid; w text;
begin
 select id into p from public.hq_workforce_demand_sensor_policies where policy_key='operations_triage_capacity_sensor' and status='approved' order by version desc limit 1;
 if p is null then raise exception 'TEST_FAIL: sensor policy missing'; end if;
 for i in 1..5 loop
   insert into public.hq_work_items(department_key,work_type,title,priority,approval_required,created_at)
   values('operations','sensor_acceptance','sustained backlog '||i,case when i=1 then 'high' else 'normal' end,false,clock_timestamp()-interval '20 minutes');
 end loop;
 -- Two prior observations represent prior scheduler ticks; the live observation is the third.
 insert into public.hq_workforce_demand_observations(policy_id,observed_bucket,open_backlog,oldest_age_seconds,weighted_impact,threshold_met,evidence,observed_at)
 values
 (p,date_trunc('minute',clock_timestamp())-interval '2 minutes',5,1200,6,true,'{"source":"acceptance_prior_tick"}',clock_timestamp()-interval '2 minutes'),
 (p,date_trunc('minute',clock_timestamp())-interval '1 minute',5,1200,6,true,'{"source":"acceptance_prior_tick"}',clock_timestamp()-interval '1 minute');
 update public.hq_workforce_engine_contract set factory_enabled=true,heartbeat_enabled=true where singleton=true;
 r:=public.hq_workforce_scheduled_heartbeat();
 select id into g from public.hq_workforce_gap_signals where source_type='workforce_sensor' and source_ref=p::text order by detected_at desc limit 1;
 if g is null then raise exception 'TEST_FAIL: sustained backlog emitted no gap'; end if;
 select fr.worker_key into w from public.hq_workforce_factory_runs fr join public.hq_workforce_demand_evidence de on de.id=fr.demand_evidence_id where de.gap_id=g and fr.decision='create_digital_worker_probation';
 if w is null or public.hq_workforce_current_lifecycle_state(w)<>'active' then raise exception 'TEST_FAIL: gap did not produce qualified active worker'; end if;
 if not exists(select 1 from public.hq_workforce_task_contracts where worker_key=w and status='completed' and verification_status='verified') then raise exception 'TEST_FAIL: generated worker completed no independently verified work'; end if;
 if (select count(*) from public.hq_work_items where work_type='sensor_acceptance' and status='resolved' and verification_status='verified')=0 then raise exception 'TEST_FAIL: generated worker resolved no backlog'; end if;
end $$;
rollback;

-- A transient/non-sustained backlog must not generate workforce demand.
begin;
do $$
declare p uuid; i int; r jsonb;
begin
 select id into p from public.hq_workforce_demand_sensor_policies where policy_key='operations_triage_capacity_sensor' and status='approved' order by version desc limit 1;
 for i in 1..5 loop insert into public.hq_work_items(department_key,work_type,title,approval_required,created_at) values('operations','sensor_spike','transient spike '||i,false,clock_timestamp()-interval '20 minutes'); end loop;
 r:=public.hq_workforce_observe_demand_sensors();
 if exists(select 1 from public.hq_workforce_gap_signals where source_type='workforce_sensor' and source_ref=p::text) then raise exception 'TEST_FAIL: one observation created workforce gap'; end if;
 if exists(select 1 from public.hq_workforce_factory_runs fr join public.hq_workforce_demand_evidence de on de.id=fr.demand_evidence_id join public.hq_workforce_gap_signals gs on gs.id=de.gap_id where gs.source_ref=p::text) then raise exception 'TEST_FAIL: transient spike created worker'; end if;
end $$;
rollback;
