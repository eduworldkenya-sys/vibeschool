-- WE-R1.2 runtime policy kernel acceptance suite.
-- Disposable/local replay only. All configuration mutation is rolled back.
-- Executed by the dedicated Worker Engine WE-R1.2 Acceptance Gate.
begin;

do $$
declare
  v_result jsonb;
  v_failed boolean;
  v_hb boolean;
  v_factory boolean;
  v_runtime boolean;
  v_level integer;
  v_risk integer;
  v_cron_count integer:=0;
begin
  select heartbeat_enabled,factory_enabled,runtime_execution_enabled,runtime_autonomy_level,runtime_max_risk
    into v_hb,v_factory,v_runtime,v_level,v_risk
    from public.hq_workforce_engine_contract where singleton=true;

  if coalesce(v_hb,true) then raise exception 'TEST_FAIL: heartbeat must remain OFF after WE-R1.2'; end if;
  if coalesce(v_factory,true) then raise exception 'TEST_FAIL: factory must remain OFF after WE-R1.2'; end if;
  if coalesce(v_runtime,true) then raise exception 'TEST_FAIL: runtime execution must remain OFF after WE-R1.2'; end if;
  if v_level<>0 then raise exception 'TEST_FAIL: runtime autonomy must remain L0'; end if;
  if v_risk<>0 then raise exception 'TEST_FAIL: runtime risk ceiling must remain R0'; end if;

  -- Scheduler cannot bypass the new global runtime stop even if its legacy switch
  -- is accidentally enabled.
  update public.hq_workforce_engine_contract set heartbeat_enabled=true where singleton=true;
  v_result:=public.hq_workforce_scheduled_heartbeat();
  if v_result->>'status'<>'runtime_disabled' then
    raise exception 'TEST_FAIL: scheduled heartbeat bypassed global runtime stop: %',v_result;
  end if;

  -- Direct queue invocation by the function owner must fail before leases/tasks
  -- can be mutated while runtime execution is OFF.
  v_failed:=false;
  begin
    perform public.hq_workforce_execute_task_queue(1,60);
  exception when others then
    if sqlerrm like '%worker_runtime_global_stop%' then v_failed:=true; else raise; end if;
  end;
  if not v_failed then raise exception 'TEST_FAIL: direct queue invocation bypassed global stop'; end if;

  -- service_role must not retain direct positive-authority entrypoints.
  if has_function_privilege('service_role','public.hq_workforce_tool_gateway_execute(uuid)','EXECUTE') then
    raise exception 'TEST_FAIL: service_role can directly execute tool gateway';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_execute_task_queue(integer,integer)','EXECUTE') then
    raise exception 'TEST_FAIL: service_role can directly execute task queue';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_verify_task(uuid,text)','EXECUTE') then
    raise exception 'TEST_FAIL: service_role can directly execute task verifier';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_assert_runtime_task_authorized(uuid)','EXECUTE') then
    raise exception 'TEST_FAIL: service_role can directly invoke internal authorization primitive';
  end if;
  if not has_function_privilege('service_role','public.hq_workforce_scheduled_heartbeat()','EXECUTE') then
    raise exception 'TEST_FAIL: governed scheduled entrypoint is not service_role executable';
  end if;

  -- Runtime safety tables must be RLS protected and not directly writable by
  -- anon/authenticated roles.
  if exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname in (
       'hq_workforce_runtime_policies','hq_workforce_skill_manifests','hq_workforce_runtime_authorization_events'
     ) and not c.relrowsecurity
  ) then raise exception 'TEST_FAIL: WE-R1.2 safety table without RLS'; end if;

  if has_table_privilege('anon','public.hq_workforce_runtime_policies','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.hq_workforce_runtime_policies','INSERT,UPDATE,DELETE') then
    raise exception 'TEST_FAIL: runtime policies writable by product roles';
  end if;
  if has_table_privilege('anon','public.hq_workforce_skill_manifests','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.hq_workforce_skill_manifests','INSERT,UPDATE,DELETE') then
    raise exception 'TEST_FAIL: skill manifests writable by product roles';
  end if;

  -- Certified manifests must exist for every currently approved tool contract so
  -- the policy kernel is explicit rather than relying on an implicit legacy path.
  if exists(
    select 1 from public.hq_workforce_tool_contracts tc
     where tc.status='approved'
       and not exists(
         select 1 from public.hq_workforce_skill_manifests sm
          where sm.tool_contract_id=tc.id and sm.certification_status='certified'
       )
  ) then raise exception 'TEST_FAIL: approved tool without certified skill manifest'; end if;

  -- Policy hierarchy must accept all planned international-production scopes.
  if not exists(
    select 1 from pg_constraint con
     join pg_class c on c.oid=con.conrelid
     where c.relname='hq_workforce_runtime_policies'
       and pg_get_constraintdef(con.oid) like '%jurisdiction%tenant%lane%worker%skill%'
  ) then raise exception 'TEST_FAIL: runtime policy scope hierarchy incomplete'; end if;

  if to_regclass('cron.job') is not null then
    execute 'select count(*) from cron.job where jobname=$1'
      into v_cron_count using 'vibeschool-worker-engine-heartbeat';
    if v_cron_count<>0 then raise exception 'TEST_FAIL: Worker Engine cron must remain absent'; end if;
  end if;
end $$;

rollback;
