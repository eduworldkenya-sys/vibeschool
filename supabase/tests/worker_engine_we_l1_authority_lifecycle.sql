-- WE-L1 negative acceptance suite.
-- Intended for disposable/local replay database only. Rolls back all fixtures.
begin;

do $$
declare
  v_worker text := 'we_l1_test_' || substr(gen_random_uuid()::text,1,8);
  v_blueprint uuid;
  v_creation uuid;
  v_identity uuid;
  v_budget uuid;
  v_failed boolean;
begin
  insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status,reasoning_mode,paid_ai_allowed)
  values(v_worker,'digital','WE-L1 Test Worker','operations','test only','draft','deterministic',false);

  -- Illegal jump must fail.
  v_failed:=false;
  begin perform public.hq_workforce_transition_worker(v_worker,'active','illegal jump',null); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'TEST_FAIL: illegal lifecycle jump accepted'; end if;

  insert into public.hq_workforce_blueprints(blueprint_key,version,title,mission,status,approved_at)
  values(v_worker||'_bp',1,'Test blueprint','test','approved',now()) returning id into v_blueprint;
  insert into public.hq_workforce_creation_contracts(contract_key,worker_key,blueprint_id,expires_at)
  values(v_worker||'_creation',v_worker,v_blueprint,now()+interval '1 hour') returning id into v_creation;

  perform public.hq_workforce_transition_worker(v_worker,'requested','test',null);
  perform public.hq_workforce_transition_worker(v_worker,'instantiated','test',v_creation);
  perform public.hq_workforce_transition_worker(v_worker,'provisioned','test',v_creation);
  perform public.hq_workforce_transition_worker(v_worker,'shadow','test',v_creation);
  perform public.hq_workforce_transition_worker(v_worker,'certification_pending','test',v_creation);
  perform public.hq_workforce_transition_worker(v_worker,'certified','test',v_creation);
  perform public.hq_workforce_transition_worker(v_worker,'active','test',v_creation);

  -- Missing identity must fail capability check.
  v_failed:=false;
  begin perform public.hq_workforce_assert_capability(v_worker,'test.read','read','test_resource'); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'TEST_FAIL: capability accepted without identity'; end if;

  insert into public.hq_workforce_identities(worker_key,identity_key,expires_at)
  values(v_worker,v_worker||'_identity',now()+interval '1 hour') returning id into v_identity;

  -- Missing capability must fail.
  v_failed:=false;
  begin perform public.hq_workforce_assert_capability(v_worker,'test.read','read','test_resource'); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'TEST_FAIL: missing capability accepted'; end if;

  insert into public.hq_workforce_capability_grants(worker_key,capability_key,operation,resource_type,granted_by_contract_id,expires_at)
  values(v_worker,'test.read','read','test_resource',v_creation,now()+interval '1 hour');
  perform public.hq_workforce_assert_capability(v_worker,'test.read','read','test_resource');

  insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end)
  values(v_worker,'test_calls','tool_call',1,now()-interval '1 minute',now()+interval '1 hour');
  v_budget:=public.hq_workforce_reserve_budget(v_worker,'test_calls',1);
  perform public.hq_workforce_consume_budget(v_budget,1);

  -- Exhausted budget must fail.
  v_failed:=false;
  begin perform public.hq_workforce_reserve_budget(v_worker,'test_calls',1); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'TEST_FAIL: exhausted budget accepted'; end if;

  perform public.hq_workforce_revoke_identity(v_worker,'negative acceptance test');

  -- Revocation must immediately fail capability check.
  v_failed:=false;
  begin perform public.hq_workforce_assert_capability(v_worker,'test.read','read','test_resource'); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'TEST_FAIL: revoked identity retained capability'; end if;
end $$;

rollback;
