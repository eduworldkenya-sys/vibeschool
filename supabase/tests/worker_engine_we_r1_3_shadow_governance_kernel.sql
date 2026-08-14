\set ON_ERROR_STOP on
begin;

do $$
declare ec record;
begin
  select heartbeat_enabled,factory_enabled,runtime_execution_enabled,runtime_autonomy_level,runtime_max_risk,
         shadow_enabled,shadow_scheduler_enabled,shadow_global_stop,shadow_anomaly_paused
    into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine_contract_missing'; end if;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled then raise exception 'consequential_runtime_enabled'; end if;
  if ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then raise exception 'runtime_not_l0_r0'; end if;
  if ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop or ec.shadow_anomaly_paused then raise exception 'shadow_not_fail_closed'; end if;
end $$;

do $$
declare t text; bad integer;
begin
  foreach t in array array[
    'hq_workforce_shadow_runs','hq_workforce_shadow_events','hq_workforce_evidence','hq_workforce_shadow_decisions',
    'hq_workforce_shadow_candidates','hq_workforce_shadow_resource_usage','hq_workforce_shadow_anomalies'
  ] loop
    if to_regclass('public.'||t) is null then raise exception 'missing_table:%',t; end if;
    select count(*) into bad from pg_class c where c.oid=to_regclass('public.'||t) and not c.relrowsecurity;
    if bad<>0 then raise exception 'rls_missing:%',t; end if;
    if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'anon_privilege_leak:%',t; end if;
    if has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'authenticated_privilege_leak:%',t; end if;
  end loop;
end $$;

do $$
declare missing text[];
begin
  select array_agg(v.col) into missing
  from (values ('purpose'),('input_contract'),('resource_contract'),('preconditions'),('expected_outcome'),('verification_contract'),('failure_handling'),('retry_policy'),('escalation_contract'),('shadow_capable'),('immutable_version_key')) v(col)
  where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='hq_workforce_skill_manifests' and c.column_name=v.col);
  if missing is not null then raise exception 'skill_manifest_contract_incomplete:%',missing; end if;
end $$;

do $$
declare defs text;
begin
  select string_agg(pg_get_functiondef(p.oid),E'\n') into defs
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('hq_workforce_shadow_evaluate_authority','hq_workforce_shadow_review_decision','hq_workforce_run_shadow_cycle');
  if defs is null then raise exception 'shadow_functions_missing'; end if;
  if position('hq_workforce_tool_gateway_execute' in defs)>0 then raise exception 'shadow_invokes_consequential_gateway'; end if;
  if position('hq_workforce_execute_task_queue' in defs)>0 then raise exception 'shadow_invokes_consequential_queue'; end if;
end $$;

do $$
declare c text;
begin
  select pg_get_constraintdef(pc.oid) into c
  from pg_constraint pc
  where pc.conrelid='public.hq_workforce_shadow_runs'::regclass and pc.contype='c'
    and pg_get_constraintdef(pc.oid) like '%consequential_action_performed%';
  if c is null or c not like '%false%' then raise exception 'shadow_nonconsequential_constraint_missing'; end if;
end $$;

do $$
declare kinds text;
begin
  select pg_get_constraintdef(pc.oid) into kinds
  from pg_constraint pc
  where pc.conrelid='public.hq_workforce_shadow_events'::regclass and pc.contype='c'
    and pg_get_constraintdef(pc.oid) like '%event_kind%';
  if kinds is null then raise exception 'event_kind_contract_missing'; end if;
  if kinds not like '%observation%' or kinds not like '%candidate_job%' or kinds not like '%reasoning%' or
     kinds not like '%skill_selection%' or kinds not like '%proposed_action%' or kinds not like '%authority_result%' or
     kinds not like '%expected_outcome%' or kinds not like '%verification%' or kinds not like '%measurement%' then
    raise exception 'event_chain_incomplete:%',kinds;
  end if;
end $$;

-- Scheduler must fail closed while the migration defaults are OFF.
do $$
declare blocked boolean:=false;
begin
  begin perform public.hq_workforce_run_shadow_cycle('off-contract',1); exception when others then blocked:=true; end;
  if not blocked then raise exception 'shadow_scheduler_ran_while_off'; end if;
end $$;

-- In an isolated transaction, prove bounded detection/dedup without mutating source work.
do $$
declare wid uuid; r1 jsonb; r2 jsonb; r3 jsonb; before_status text; after_status text; n integer; anomaly_count integer; paused boolean;
begin
  insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,route,approval_required,evidence)
  values('executive','we_r1_3_acceptance','high','open','WE-R1.3 disposable shadow test','Local-only acceptance input','acceptance','/hq/workforce',false,'{}'::jsonb)
  returning id into wid;
  select status into before_status from public.hq_work_items where id=wid;

  update public.hq_workforce_engine_contract
     set shadow_enabled=true,shadow_scheduler_enabled=true,shadow_global_stop=false,
         shadow_max_cycles_per_hour=10,shadow_max_candidates_per_cycle=5,shadow_max_queue_depth=100,shadow_anomaly_paused=false
   where singleton=true;

  r1:=public.hq_workforce_run_shadow_cycle('acceptance-1',5);
  if r1->>'status'<>'completed' or (r1->>'inserted')::int<1 then raise exception 'shadow_first_cycle_failed:%',r1; end if;
  select count(*) into n from public.hq_workforce_shadow_candidates where source_work_item_id=wid;
  if n<>1 then raise exception 'candidate_expected_once_got:%',n; end if;

  r2:=public.hq_workforce_run_shadow_cycle('acceptance-2',5);
  if r2->>'status'<>'completed' or (r2->>'duplicates')::int<1 then raise exception 'shadow_dedup_failed:%',r2; end if;
  select count(*) into n from public.hq_workforce_shadow_candidates where source_work_item_id=wid;
  if n<>1 then raise exception 'duplicate_candidate_inserted:%',n; end if;

  select status into after_status from public.hq_work_items where id=wid;
  if after_status is distinct from before_status then raise exception 'shadow_mutated_source_work:%->%',before_status,after_status; end if;

  update public.hq_workforce_engine_contract set shadow_max_cycles_per_hour=2 where singleton=true;
  r3:=public.hq_workforce_run_shadow_cycle('acceptance-rate-pause',5);
  if r3->>'status'<>'paused' or r3->>'reason'<>'cycle_rate_ceiling' then raise exception 'rate_breaker_did_not_pause:%',r3; end if;
  select shadow_anomaly_paused into paused from public.hq_workforce_engine_contract where singleton=true;
  select count(*) into anomaly_count from public.hq_workforce_shadow_anomalies where anomaly_key='cycle_rate_ceiling' and resolved_at is null;
  if not paused or anomaly_count<1 then raise exception 'anomaly_pause_evidence_not_persisted'; end if;

  if exists(select 1 from public.hq_workforce_shadow_runs where consequential_action_performed) then raise exception 'consequential_shadow_write_recorded'; end if;
end $$;

rollback;
