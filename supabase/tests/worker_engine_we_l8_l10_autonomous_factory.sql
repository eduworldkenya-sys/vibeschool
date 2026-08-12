-- WE-L8..L10 autonomous factory acceptance. Disposable/local replay DB only.
begin;
do $$
declare g uuid; wi uuid; fr jsonb; qr jsonb; rr jsonb; w text;
begin
 insert into public.hq_workforce_gap_signals(gap_key,source_type,source_ref,lane_key,signal_type,metrics_snapshot,severity,status)
 values('auto_factory_'||gen_random_uuid(),'capacity','acceptance','operations','capacity_gap',jsonb_build_object('downstream_dependency_count',5,'verified_impact',10,'rework_rate',0,'policy_violations',0,'deterministic_automation_sufficient',false,'demand_temporary',false,'human_judgment_required',false),'high','candidate') returning id into g;
 insert into public.hq_work_items(department_key,work_type,title,approval_required) values('operations','autonomous_factory_acceptance','first autonomous generated-worker job',false) returning id into wi;
 fr:=public.hq_workforce_autonomous_factory_heartbeat(10);
 select worker_key into w from public.hq_workforce_factory_runs f join public.hq_workforce_demand_evidence d on d.id=f.demand_evidence_id where d.gap_id=g and f.decision='create_digital_worker_probation';
 if w is null or public.hq_workforce_current_lifecycle_state(w)<>'shadow' then raise exception 'TEST_FAIL: telemetry factory did not create SHADOW worker'; end if;
 qr:=public.hq_workforce_qualify_factory_workers(10);
 if public.hq_workforce_current_lifecycle_state(w)<>'active' then raise exception 'TEST_FAIL: independent qualification did not activate worker'; end if;
 rr:=public.hq_workforce_autonomous_heartbeat(20);
 if not exists(select 1 from public.hq_workforce_task_contracts t where t.worker_key=w and t.payload->>'work_item_id'=wi::text and t.status='completed' and t.verification_status='verified') then raise exception 'TEST_FAIL: autonomous generated worker did not complete+verify first job'; end if;
 if not exists(select 1 from public.hq_work_items where id=wi and status='resolved' and verification_status='verified' and action_taken->>'worker_key'=w) then raise exception 'TEST_FAIL: first job not resolved with generated-worker evidence'; end if;
end $$;
rollback;

begin;
do $$
declare g1 uuid; g2 uuid; r jsonb; q jsonb; c int; d2 text;
begin
 insert into public.hq_workforce_gap_signals(gap_key,source_type,source_ref,lane_key,signal_type,metrics_snapshot,severity,status) values('reuse1_'||gen_random_uuid(),'capacity','acceptance','operations','capacity_gap',jsonb_build_object('downstream_dependency_count',5,'verified_impact',10),'high','candidate') returning id into g1;
 r:=public.hq_workforce_autonomous_factory_heartbeat(10); q:=public.hq_workforce_qualify_factory_workers(10);
 insert into public.hq_workforce_gap_signals(gap_key,source_type,source_ref,lane_key,signal_type,metrics_snapshot,severity,status) values('reuse2_'||gen_random_uuid(),'capacity','acceptance','operations','capacity_gap',jsonb_build_object('downstream_dependency_count',5,'verified_impact',10),'high','candidate') returning id into g2;
 r:=public.hq_workforce_autonomous_factory_heartbeat(10);
 select count(*) into c from public.hq_workforce_factory_runs f join public.hq_workforce_demand_evidence d on d.id=f.demand_evidence_id where d.gap_id=g2 and f.decision='create_digital_worker_probation';
 select decision into d2 from public.hq_workforce_factory_runs f join public.hq_workforce_demand_evidence d on d.id=f.demand_evidence_id where d.gap_id=g2;
 if c<>0 or d2<>'rebalance_lanes' then raise exception 'TEST_FAIL: existing capable worker did not force reuse/rebalance'; end if;
end $$;
rollback;
