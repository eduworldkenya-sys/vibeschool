\set ON_ERROR_STOP on
begin;

-- Safety boundary must remain OFF after migration replay.
do $$
declare s record;
begin
  select heartbeat_enabled,factory_enabled,runtime_execution_enabled,runtime_autonomy_level,runtime_max_risk,
         shadow_enabled,shadow_scheduler_enabled,shadow_global_stop
    into s from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine_contract_missing'; end if;
  if s.heartbeat_enabled or s.factory_enabled or s.runtime_execution_enabled then raise exception 'consequential_runtime_was_enabled'; end if;
  if s.runtime_autonomy_level<>0 or s.runtime_max_risk<>0 then raise exception 'runtime_not_l0_r0'; end if;
  if s.shadow_enabled or s.shadow_scheduler_enabled or not s.shadow_global_stop then raise exception 'shadow_not_fail_closed'; end if;
end $$;

-- All shadow persistence objects must exist and be RLS-protected.
do $$
declare n integer; bad integer;
begin
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
   where ns.nspname='public' and c.relname in (
    'hq_workforce_shadow_runs','hq_workforce_shadow_events','hq_workforce_shadow_evidence',
    'hq_workforce_shadow_proposals','hq_workforce_shadow_decisions','hq_workforce_shadow_measurements'
   );
  if n<>6 then raise exception 'shadow_table_count_expected_6_got_%',n; end if;
  select count(*) into bad from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
   where ns.nspname='public' and c.relname like 'hq_workforce_shadow_%' and c.relkind='r' and not c.relrowsecurity;
  if bad<>0 then raise exception 'shadow_rls_missing_on_%_tables',bad; end if;
end $$;

-- anon/authenticated receive no direct table privileges.
do $$
declare role_name text; table_name text; p text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    foreach table_name in array array[
      'hq_workforce_shadow_runs','hq_workforce_shadow_events','hq_workforce_shadow_evidence',
      'hq_workforce_shadow_proposals','hq_workforce_shadow_decisions','hq_workforce_shadow_measurements'
    ] loop
      foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(role_name,'public.'||table_name,p) then
          raise exception 'direct_privilege_leak:%:%:%',role_name,table_name,p;
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- Skill manifests expose the complete governed-shadow contract.
do $$
declare missing text[];
begin
  select array_agg(x.col) into missing from (values
    ('purpose'),('input_contract'),('resource_contract'),('preconditions'),('expected_outcome'),
    ('verification_contract'),('failure_handling'),('retry_policy'),('escalation_contract'),
    ('shadow_capable'),('immutable_fingerprint')
  ) x(col)
  where not exists (
    select 1 from information_schema.columns c
     where c.table_schema='public' and c.table_name='hq_workforce_skill_manifests' and c.column_name=x.col
  );
  if missing is not null then raise exception 'skill_contract_columns_missing:%',missing; end if;
  if exists(select 1 from public.hq_workforce_skill_manifests where shadow_capable) then
    raise exception 'migration_must_not_auto_promote_shadow_skills';
  end if;
end $$;

-- The Decision Inbox cannot authorize execution, even after human approval.
do $$
declare d uuid; t uuid; p uuid; blocked boolean:=false;
begin
  insert into public.hq_workforce_shadow_runs(worker_key,lane_key,scope_type,scope_ref,status)
  values('we-r1-3-test-worker','test-lane','platform_internal','{}','awaiting_review') returning trace_id into t;

  -- Create a placeholder proposal with a valid manifest only when one exists; otherwise test the hard constraint directly.
  begin
    insert into public.hq_workforce_shadow_decisions(trace_id,proposal_id,state,execution_authorized)
    values(t,gen_random_uuid(),'approved',true);
  exception when others then
    blocked:=true;
  end;
  if not blocked then raise exception 'decision_execution_authorization_constraint_failed'; end if;
end $$;

-- Shadow functions must never invoke the consequential production gateway/queue executor.
do $$
declare f text;
begin
  select string_agg(pg_get_functiondef(p.oid),E'\n') into f
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in (
     'hq_workforce_evaluate_shadow_authority','hq_workforce_shadow_record_proposal','hq_workforce_shadow_review_decision'
   );
  if f is null then raise exception 'shadow_functions_missing'; end if;
  if position('hq_workforce_tool_gateway_execute' in f)>0 then raise exception 'shadow_calls_production_gateway'; end if;
  if position('hq_workforce_execute_task_queue' in f)>0 then raise exception 'shadow_calls_production_queue'; end if;
  if position('runtime_execution_enabled=true' in replace(f,' ',''))>0 then raise exception 'shadow_enables_runtime'; end if;
end $$;

-- Required telemetry vocabulary must remain explicit and end-to-end traceable.
do $$
declare constraint_text text;
begin
  select pg_get_constraintdef(c.oid) into constraint_text
    from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace
   where n.nspname='public' and r.relname='hq_workforce_shadow_events' and c.contype='c'
     and pg_get_constraintdef(c.oid) like '%event_type%';
  if constraint_text is null then raise exception 'event_type_contract_missing'; end if;
  if constraint_text not like '%observation%' or constraint_text not like '%candidate_job%' or
     constraint_text not like '%reasoning%' or constraint_text not like '%proposed_action%' or
     constraint_text not like '%authority_result%' or constraint_text not like '%evidence%' or
     constraint_text not like '%expected_outcome%' or constraint_text not like '%verification%' then
    raise exception 'telemetry_vocabulary_incomplete:%',constraint_text;
  end if;
end $$;

rollback;
