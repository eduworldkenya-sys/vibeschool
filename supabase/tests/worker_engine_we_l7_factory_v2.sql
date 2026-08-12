-- WE-L7 Worker Factory V2 acceptance. Disposable/local replay database only.
begin;
do $$
declare g uuid; r jsonb; w text:='factory_'||substr(gen_random_uuid()::text,1,8); failed boolean; cc uuid; tool uuid; eligible uuid; task uuid; i int;
begin
 insert into public.hq_workforce_gap_signals(gap_key,source_type,source_ref,lane_key,signal_type,metrics_snapshot,severity,status) values('we_l7_create_'||gen_random_uuid(),'capacity','acceptance','operations','capacity_gap','{}','high','candidate') returning id into g;
 r:=public.hq_workforce_factory_cycle(g,jsonb_build_object('downstream_dependency_count',5,'verified_impact',10,'deterministic_automation_sufficient',false,'existing_worker_available',false,'existing_worker_has_skill',false,'rebalance_capacity',false,'demand_temporary',false,'human_judgment_required',false),w,'Factory Operations Worker','Bounded operations capacity','work_item.triage','update','hq_work_items');
 if coalesce((r->>'worker_created')::boolean,false)<>true or r->>'decision'<>'create_digital_worker_probation' then raise exception 'TEST_FAIL: justified demand did not create worker'; end if;
 if public.hq_workforce_current_lifecycle_state(w)<>'shadow' then raise exception 'TEST_FAIL: factory did not stop at shadow'; end if;
 if exists(select 1 from public.hq_workforce_identities where worker_key=w and status='active') or exists(select 1 from public.hq_workforce_capability_grants where worker_key=w and status='active') then raise exception 'TEST_FAIL: factory granted live authority before certification'; end if;
 cc:=(r->>'creation_contract_id')::uuid; tool:=(r->>'tool_contract_id')::uuid;
 failed:=false; begin perform public.hq_workforce_transition_worker(w,'active','illegal factory activation',cc); exception when others then failed:=true; end; if not failed then raise exception 'TEST_FAIL: factory worker bypassed certification'; end if;
 for i in 1..3 loop perform public.hq_workforce_record_shadow_run(w,tool,jsonb_build_object('case',i),'{"decision":"triage"}'::jsonb,'{"decision":"triage"}'::jsonb,'independent_factory_verifier'); end loop;
 perform public.hq_workforce_transition_worker(w,'certification_pending','factory shadow passed',cc); perform public.hq_workforce_issue_certification(w,cc,'independent_factory_verifier',3,interval '1 day'); perform public.hq_workforce_transition_worker(w,'certified','factory certified',cc); perform public.hq_workforce_transition_worker(w,'active','factory activated',cc);
 insert into public.hq_workforce_identities(worker_key,identity_key,expires_at) values(w,w||'_id',clock_timestamp()+interval '1 day');
 insert into public.hq_workforce_capability_grants(worker_key,capability_key,operation,resource_type,granted_by_contract_id,expires_at) values(w,'work_item.triage','update','hq_work_items',cc,clock_timestamp()+interval '1 day');
 insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end) values(w,'tool_calls','tool_call',5,clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 day');
 insert into public.hq_work_items(department_key,work_type,title,approval_required) values('operations','we_l7_factory_real_job','factory worker first governed job',false) returning id into eligible;
 insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,operation,resource_type,scope_type,scope_ref,payload,idempotency_key,budget_key,max_attempts) values('factory_job:'||eligible::text,w,tool,'work_item.triage','update','hq_work_items','platform_internal','{}',jsonb_build_object('work_item_id',eligible),'factory_job:'||eligible::text,'tool_calls',3) returning id into task;
 perform public.hq_workforce_execute_task_queue(20,60); perform public.hq_workforce_verify_task(task,'independent_factory_job_verifier');
 if not exists(select 1 from public.hq_workforce_task_contracts where id=task and status='completed' and verification_status='verified') then raise exception 'TEST_FAIL: first governed job not independently verified'; end if;
 if not exists(select 1 from public.hq_work_items where id=eligible and status='resolved' and verification_status='verified' and action_taken->>'worker_key'=w) then raise exception 'TEST_FAIL: first governed job not resolved'; end if;
end $$;
rollback;

begin;
do $$ declare g uuid; r jsonb; w text:='reject_'||substr(gen_random_uuid()::text,1,8); begin insert into public.hq_workforce_gap_signals(gap_key,source_type,source_ref,lane_key,signal_type,metrics_snapshot,severity,status) values('we_l7_reject_'||gen_random_uuid(),'capacity','acceptance','operations','capacity_gap','{}','low','candidate') returning id into g; r:=public.hq_workforce_factory_cycle(g,jsonb_build_object('downstream_dependency_count',0,'verified_impact',0),w,'Should Not Exist','none','work_item.triage','update','hq_work_items'); if coalesce((r->>'worker_created')::boolean,true)<>false or r->>'decision'<>'eliminate_task' then raise exception 'TEST_FAIL: unnecessary work created worker'; end if; if exists(select 1 from public.hq_workforce_workers where worker_key=w) then raise exception 'TEST_FAIL: rejected demand created worker row'; end if; end $$;
rollback;

begin;
do $$ declare g uuid; d uuid; dx uuid; failed boolean; w text:='blocked_'||substr(gen_random_uuid()::text,1,8); begin insert into public.hq_workforce_gap_signals(gap_key,source_type,source_ref,lane_key,signal_type,metrics_snapshot,severity,status) values('we_l7_train_'||gen_random_uuid(),'capacity','acceptance','operations','skill_gap','{}','medium','candidate') returning id into g; d:=public.hq_workforce_seal_demand_evidence(g,jsonb_build_object('downstream_dependency_count',2,'verified_impact',5,'existing_worker_available',true,'existing_worker_has_skill',false,'existing_worker_utilization',0.5)); dx:=public.hq_workforce_factory_diagnose(d); if (select decision from public.hq_workforce_hr_diagnoses where id=dx)<>'train_existing_worker' then raise exception 'TEST_FAIL: reuse/train decision wrong'; end if; failed:=false; begin perform public.hq_workforce_factory_create_shadow_worker(d,dx,w,'Blocked Worker','must not create','work_item.triage','update','hq_work_items'); exception when others then failed:=true; end; if not failed then raise exception 'TEST_FAIL: non-creation diagnosis bypassed'; end if; end $$;
rollback;
