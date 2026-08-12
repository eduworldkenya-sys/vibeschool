-- WE-L3..L6 full reference-worker mission acceptance. Disposable DB only.
begin;
do $$
declare b jsonb; cc uuid; tool uuid; eligible uuid; approval_item uuid; wrong_dept uuid; v_task uuid; v_model uuid; failed boolean; i int; hb jsonb; v_reserved bigint; v_consumed bigint;
begin
 b:=public.hq_workforce_bootstrap_reference_operations_worker('operations_reference_v1'); cc:=(b->>'creation_contract_id')::uuid; tool:=(b->>'tool_contract_id')::uuid;
 failed:=false; begin perform public.hq_workforce_record_shadow_run('operations_reference_v1',tool,'{}','{}','{}','operations_reference_v1'); exception when others then failed:=true; end; if not failed then raise exception 'TEST_FAIL:self verification allowed'; end if;
 for i in 1..3 loop perform public.hq_workforce_record_shadow_run('operations_reference_v1',tool,jsonb_build_object('case',i),'{"decision":"triage"}'::jsonb,'{"decision":"triage"}'::jsonb,'independent_verifier_v1'); end loop;
 if exists(select 1 from public.hq_workforce_shadow_runs where worker_key='operations_reference_v1' and side_effects_applied) then raise exception 'TEST_FAIL: shadow side effect'; end if;
 perform public.hq_workforce_transition_worker('operations_reference_v1','certification_pending','shadow passed',cc); perform public.hq_workforce_issue_certification('operations_reference_v1',cc,'independent_verifier_v1',3,interval '1 day'); perform public.hq_workforce_transition_worker('operations_reference_v1','certified','certified',cc); perform public.hq_workforce_transition_worker('operations_reference_v1','active','activated',cc);
 insert into public.hq_workforce_identities(worker_key,identity_key,expires_at) values('operations_reference_v1','operations_reference_v1_id',clock_timestamp()+interval '1 day');
 insert into public.hq_workforce_capability_grants(worker_key,capability_key,operation,resource_type,granted_by_contract_id,expires_at) values('operations_reference_v1','work_item.triage','update','hq_work_items',cc,clock_timestamp()+interval '1 day');
 insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end) values('operations_reference_v1','tool_calls','tool_call',20,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day');
 insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end) values('operations_reference_v1','model_tokens','model_token',100,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day');
 insert into public.hq_work_items(department_key,work_type,title,approval_required) values('operations','reference_test','eligible',false) returning id into eligible;
 insert into public.hq_work_items(department_key,work_type,title,approval_required) values('operations','reference_test','approval required',true) returning id into approval_item;
 insert into public.hq_work_items(department_key,work_type,title,approval_required) values('content','reference_test','wrong dept',false) returning id into wrong_dept;
 hb:=public.hq_workforce_autonomous_heartbeat(20);
 select id into v_task from public.hq_workforce_task_contracts where idempotency_key='ops:'||eligible::text;
 if v_task is null or not exists(select 1 from public.hq_workforce_task_contracts where id=v_task and status='completed' and verification_status='verified') then raise exception 'TEST_FAIL: eligible work not completed+verified'; end if;
 if not exists(select 1 from public.hq_work_items where id=eligible and status='resolved' and verification_status='verified' and action_taken->>'worker_key'='operations_reference_v1') then raise exception 'TEST_FAIL: verified work item not resolved'; end if;
 if exists(select 1 from public.hq_workforce_task_contracts where idempotency_key in ('ops:'||approval_item::text,'ops:'||wrong_dept::text)) then raise exception 'TEST_FAIL: detector crossed approval/department boundary'; end if;
 failed:=false; begin update public.hq_workforce_task_contracts set payload='{}'::jsonb where id=v_task; exception when others then failed:=true; end; if not failed then raise exception 'TEST_FAIL: task contract mutable'; end if;
 failed:=false; begin perform public.hq_workforce_authorize_model_call('operations_reference_v1',v_task,'semantic_ambiguity','{}'::jsonb,'bounded_model',10); exception when others then failed:=true; end; if not failed then raise exception 'TEST_FAIL: AI allowed without deterministic failure evidence'; end if;
 v_model:=public.hq_workforce_authorize_model_call('operations_reference_v1',v_task,'semantic_ambiguity','{"deterministic_rule":"ambiguous_input"}'::jsonb,'bounded_model',10); perform public.hq_workforce_finalize_model_call(v_model,false);
 select reserved_amount,consumed_amount into v_reserved,v_consumed from public.hq_workforce_execution_budgets where worker_key='operations_reference_v1' and budget_key='model_tokens'; if v_reserved<>0 or v_consumed<>0 then raise exception 'TEST_FAIL: failed model accounting'; end if;
 v_model:=public.hq_workforce_authorize_model_call('operations_reference_v1',v_task,'novel_classification','{"deterministic_rule":"no_rule_match"}'::jsonb,'bounded_model',10); perform public.hq_workforce_finalize_model_call(v_model,true);
 select reserved_amount,consumed_amount into v_reserved,v_consumed from public.hq_workforce_execution_budgets where worker_key='operations_reference_v1' and budget_key='model_tokens'; if v_reserved<>0 or v_consumed<>10 then raise exception 'TEST_FAIL: successful model accounting'; end if;
 perform public.hq_workforce_suspend_for_remediation('operations_reference_v1','adversarial remediation',cc); if public.hq_workforce_current_lifecycle_state('operations_reference_v1')<>'remediation' then raise exception 'TEST_FAIL: remediation transition'; end if;
 failed:=false; begin perform public.hq_workforce_assert_identity('operations_reference_v1'); exception when others then failed:=true; end; if not failed then raise exception 'TEST_FAIL: suspended worker retained identity'; end if;
 for i in 1..3 loop perform public.hq_workforce_record_shadow_run('operations_reference_v1',tool,jsonb_build_object('remediation_case',i),'{"decision":"triage"}'::jsonb,'{"decision":"triage"}'::jsonb,'independent_verifier_v1'); end loop;
 perform public.hq_workforce_transition_worker('operations_reference_v1','certification_pending','remediation evidence passed',cc); perform public.hq_workforce_issue_certification('operations_reference_v1',cc,'independent_verifier_v1',3,interval '1 day'); perform public.hq_workforce_transition_worker('operations_reference_v1','certified','recertified',cc); perform public.hq_workforce_transition_worker('operations_reference_v1','active','reactivated',cc);
 insert into public.hq_workforce_identities(worker_key,identity_key,expires_at) values('operations_reference_v1','operations_reference_v1_id2',clock_timestamp()+interval '1 day');
 insert into public.hq_workforce_capability_grants(worker_key,capability_key,operation,resource_type,granted_by_contract_id,expires_at) values('operations_reference_v1','work_item.triage','update','hq_work_items',cc,clock_timestamp()+interval '1 day');
 insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end) values('operations_reference_v1','tool_calls','tool_call',5,clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 day');
 insert into public.hq_work_items(department_key,work_type,title,approval_required) values('operations','reference_test','post remediation work',false) returning id into eligible;
 hb:=public.hq_workforce_autonomous_heartbeat(20);
 if not exists(select 1 from public.hq_workforce_task_contracts t join public.hq_work_items wi on wi.id=(t.payload->>'work_item_id')::uuid where wi.id=eligible and t.verification_status='verified' and wi.status='resolved') then raise exception 'TEST_FAIL: recertified worker failed post-remediation work'; end if;
end $$;
rollback;

-- Separate scope/budget attack fixture.
begin;
do $$
declare b jsonb; cc uuid; tool uuid; w1 uuid; w2 uuid; bad_task uuid; i int; hb jsonb;
begin
 b:=public.hq_workforce_bootstrap_reference_operations_worker('operations_reference_v1'); cc:=(b->>'creation_contract_id')::uuid; tool:=(b->>'tool_contract_id')::uuid;
 for i in 1..3 loop perform public.hq_workforce_record_shadow_run('operations_reference_v1',tool,jsonb_build_object('case',i),'{"decision":"triage"}'::jsonb,'{"decision":"triage"}'::jsonb,'independent_verifier_v1'); end loop;
 perform public.hq_workforce_transition_worker('operations_reference_v1','certification_pending','shadow passed',cc); perform public.hq_workforce_issue_certification('operations_reference_v1',cc,'independent_verifier_v1',3,interval '1 day'); perform public.hq_workforce_transition_worker('operations_reference_v1','certified','certified',cc); perform public.hq_workforce_transition_worker('operations_reference_v1','active','active',cc);
 insert into public.hq_workforce_identities(worker_key,identity_key,expires_at) values('operations_reference_v1','attack_id',clock_timestamp()+interval '1 day'); insert into public.hq_workforce_capability_grants(worker_key,capability_key,operation,resource_type,granted_by_contract_id,expires_at) values('operations_reference_v1','work_item.triage','update','hq_work_items',cc,clock_timestamp()+interval '1 day'); insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end) values('operations_reference_v1','tool_calls','tool_call',1,clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 day');
 insert into public.hq_work_items(department_key,work_type,title,approval_required) values('operations','budget_attack','budget one',false) returning id into w1; insert into public.hq_work_items(department_key,work_type,title,approval_required) values('operations','budget_attack','budget two',false) returning id into w2;
 hb:=public.hq_workforce_autonomous_heartbeat(20); if (select count(*) from public.hq_workforce_task_contracts where idempotency_key in ('ops:'||w1::text,'ops:'||w2::text) and status='completed')<>1 then raise exception 'TEST_FAIL: budget did not cap execution'; end if;
 insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,operation,resource_type,scope_type,scope_ref,payload,idempotency_key,budget_key,max_attempts) values('wrong_scope:'||gen_random_uuid(),'operations_reference_v1',tool,'work_item.triage','update','hq_work_items','global','{}',jsonb_build_object('work_item_id',w2),'wrong_scope:'||gen_random_uuid(),'tool_calls',1) returning id into bad_task;
 perform public.hq_workforce_execute_task_queue(20,60); if not exists(select 1 from public.hq_workforce_task_contracts where id=bad_task and status='dead_letter' and last_error like '%task_scope_denied%') then raise exception 'TEST_FAIL: wrong scope did not fail closed'; end if;
end $$;
rollback;
