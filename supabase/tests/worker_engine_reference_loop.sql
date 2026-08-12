-- WE-L3..L6 adversarial acceptance. Disposable DB only.
begin;
do $$
declare w text:='ref_'||substr(gen_random_uuid()::text,1,8); b jsonb; cc uuid; tool uuid; cert uuid; failed boolean; i int;
begin
 b:=public.hq_workforce_bootstrap_reference_operations_worker(w); cc:=(b->>'creation_contract_id')::uuid; tool:=(b->>'tool_contract_id')::uuid;
 -- Shadow cannot mutate production: only evidence is recorded.
 for i in 1..3 loop perform public.hq_workforce_record_shadow_run(w,tool,jsonb_build_object('case',i),'{"decision":"triage"}'::jsonb,'{"decision":"triage"}'::jsonb,'independent_verifier_v1'); end loop;
 if exists(select 1 from public.hq_workforce_shadow_runs where worker_key=w and side_effects_applied) then raise exception 'TEST_FAIL: shadow side effect'; end if;
 perform public.hq_workforce_transition_worker(w,'certification_pending','shadow passed',cc);
 cert:=public.hq_workforce_issue_certification(w,cc,'independent_verifier_v1',3,interval '1 day');
 perform public.hq_workforce_transition_worker(w,'certified','certified',cc);
 perform public.hq_workforce_transition_worker(w,'active','activated',cc);
 insert into public.hq_workforce_identities(worker_key,identity_key,expires_at) values(w,w||'_id',now()+interval '1 day');
 insert into public.hq_workforce_capability_grants(worker_key,capability_key,operation,resource_type,granted_by_contract_id,expires_at) values(w,'work_item.triage','update','hq_work_items',cc,now()+interval '1 day');
 insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end) values(w,'tool_calls','tool_call',5,now()-interval '1 minute',now()+interval '1 day');
 insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end) values(w,'model_tokens','model_token',100,now()-interval '1 minute',now()+interval '1 day');
 perform public.hq_workforce_assert_certification(w);
 -- Model gateway must reject AI without deterministic failure evidence.
 failed:=false; begin perform public.hq_workforce_authorize_model_call(w,null,'semantic_ambiguity','{}'::jsonb,'bounded_model',10); exception when others then failed:=true; end;
 if not failed then raise exception 'TEST_FAIL: model call bypassed deterministic-first gate'; end if;
 -- Revocation must kill real execution authority immediately.
 perform public.hq_workforce_revoke_identity(w,'adversarial revocation');
 failed:=false; begin perform public.hq_workforce_assert_identity(w); exception when others then failed:=true; end;
 if not failed then raise exception 'TEST_FAIL: revoked worker retained identity'; end if;
end $$;
rollback;
