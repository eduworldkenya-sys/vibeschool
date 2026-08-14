\set ON_ERROR_STOP on
begin;

do $$
declare ec record;
begin
 select heartbeat_enabled,factory_enabled,runtime_execution_enabled,runtime_autonomy_level,runtime_max_risk,shadow_enabled,shadow_scheduler_enabled,shadow_global_stop,shadow_anomaly_paused
 into ec from public.hq_workforce_engine_contract where singleton=true;
 if not found then raise exception 'engine_contract_missing'; end if;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then raise exception 'consequential_runtime_not_l0_off'; end if;
 if ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop or ec.shadow_anomaly_paused then raise exception 'shadow_not_fail_closed'; end if;
end $$;

do $$
declare t text;
begin
 foreach t in array array['hq_workforce_shadow_traces','hq_workforce_shadow_events','hq_workforce_evidence','hq_workforce_shadow_decisions','hq_workforce_shadow_candidates','hq_workforce_shadow_resource_usage','hq_workforce_shadow_anomalies'] loop
   if to_regclass('public.'||t) is null then raise exception 'missing_table:%',t; end if;
   if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||t)) then raise exception 'rls_missing:%',t; end if;
   if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'anon_privilege_leak:%',t; end if;
   if has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'authenticated_privilege_leak:%',t; end if;
 end loop;
 -- Legacy worker-certification shadow runs must remain intact and distinct.
 if to_regclass('public.hq_workforce_shadow_runs') is null then raise exception 'legacy_certification_shadow_runs_missing'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_shadow_runs' and column_name='verifier_key') then raise exception 'legacy_shadow_run_contract_changed'; end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_shadow_runs' and column_name='trace_id') then raise exception 'operational_trace_leaked_into_legacy_shadow_runs'; end if;
end $$;

do $$
declare defs text; c text; kinds text;
begin
 select string_agg(pg_get_functiondef(p.oid),E'\n') into defs from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('hq_workforce_shadow_evaluate_authority','hq_workforce_shadow_review_decision','hq_workforce_run_shadow_cycle','hq_workforce_shadow_recommend_candidate');
 if defs is null then raise exception 'shadow_functions_missing'; end if;
 if position('hq_workforce_tool_gateway_execute' in defs)>0 or position('hq_workforce_execute_task_queue' in defs)>0 then raise exception 'shadow_invokes_consequential_executor'; end if;
 select pg_get_constraintdef(pc.oid) into c from pg_constraint pc where pc.conrelid='public.hq_workforce_shadow_traces'::regclass and pc.contype='c' and pg_get_constraintdef(pc.oid) like '%consequential_action_performed%';
 if c is null or c not like '%false%' then raise exception 'nonconsequential_trace_constraint_missing'; end if;
 select pg_get_constraintdef(pc.oid) into kinds from pg_constraint pc where pc.conrelid='public.hq_workforce_shadow_events'::regclass and pc.contype='c' and pg_get_constraintdef(pc.oid) like '%event_kind%';
 if kinds is null or kinds not like '%observation%' or kinds not like '%candidate_job%' or kinds not like '%reasoning%' or kinds not like '%skill_selection%' or kinds not like '%proposed_action%' or kinds not like '%authority_result%' or kinds not like '%expected_outcome%' or kinds not like '%verification%' or kinds not like '%measurement%' then raise exception 'event_chain_incomplete'; end if;
end $$;

do $$
declare blocked boolean:=false;
begin
 begin perform public.hq_workforce_run_shadow_cycle('off-contract',1); exception when others then blocked:=true; end;
 if not blocked then raise exception 'shadow_scheduler_ran_while_off'; end if;
end $$;

do $$
declare wid uuid; cid uuid; tool_id uuid; rr jsonb; r1 jsonb; r2 jsonb; r3 jsonb; tr uuid; n integer; before_status text; after_status text; paused boolean;
begin
 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,route,approval_required,evidence)
 values('executive','we_r1_3_acceptance','high','open','WE-R1.3 disposable shadow test','Local-only acceptance input','acceptance','/hq/workforce',false,'{}') returning id into wid;
 select status into before_status from public.hq_work_items where id=wid;

 insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status,reasoning_mode,paid_ai_allowed)
 values('000-we-r1-3-acceptance-worker','digital','WE-R1.3 Acceptance Worker','executive','Disposable local shadow certification worker','active','deterministic',false)
 on conflict(worker_key) do update set status='active',department_key='executive';

 insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at)
 values('we_r1_3_acceptance_triage',1,'WE-R1.3 acceptance triage','work_item.triage_and_own','work_item.triage','update','hq_work_items','internal_write','approved',clock_timestamp()) returning id into tool_id;
 insert into public.hq_workforce_skill_manifests(skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,max_records_affected,max_attempts,max_runtime_ms,requires_human_approval,verification_required,compensation_strategy,owner_key,certification_status,certified_at,purpose,shadow_capable,immutable_version_key)
 values('we_r1_3_acceptance_triage',1,tool_id,2,1,array['platform_internal'],array['internal'],1,2,30000,true,true,'manual_review','platform_governance','certified',clock_timestamp(),'Disposable local proof',true,'we_r1_3_acceptance_triage@1');

 update public.hq_workforce_engine_contract set shadow_enabled=true,shadow_scheduler_enabled=true,shadow_global_stop=false,shadow_max_cycles_per_hour=10,shadow_max_candidates_per_cycle=5,shadow_max_queue_depth=100,shadow_anomaly_paused=false where singleton=true;
 r1:=public.hq_workforce_run_shadow_cycle('acceptance-1',5);
 if r1->>'status'<>'completed' or (r1->>'inserted')::int<1 then raise exception 'first_cycle_failed:%',r1; end if;
 select id into cid from public.hq_workforce_shadow_candidates where source_work_item_id=wid;
 if cid is null then raise exception 'candidate_not_created'; end if;

 rr:=public.hq_workforce_shadow_recommend_candidate(cid);
 if rr->>'status'<>'awaiting_review' or (rr->>'consequential_execution')::boolean then raise exception 'recommendation_failed:%',rr; end if;
 if rr->>'authority_decision'<>'deny' then raise exception 'uncertified_identity_or_capability_did_not_fail_closed:%',rr; end if;
 tr:=(rr->>'trace_id')::uuid;
 select count(*) into n from public.hq_workforce_shadow_events where trace_id=tr;
 if n<>7 then raise exception 'trace_event_count_expected_7_got:%',n; end if;
 if not exists(select 1 from public.hq_workforce_evidence where trace_id=tr and evidence_kind='fact') then raise exception 'trace_evidence_missing'; end if;
 if not exists(select 1 from public.hq_workforce_shadow_decisions where trace_id=tr and state='awaiting_review' and hypothetical_authority_result='deny') then raise exception 'decision_missing_or_not_denied'; end if;
 if exists(select 1 from public.hq_workforce_shadow_traces where trace_id=tr and consequential_action_performed) then raise exception 'consequential_shadow_write_recorded'; end if;

 r2:=public.hq_workforce_run_shadow_cycle('acceptance-2',5);
 if r2->>'status'<>'completed' or (r2->>'duplicates')::int<1 then raise exception 'dedup_failed:%',r2; end if;
 select count(*) into n from public.hq_workforce_shadow_candidates where source_work_item_id=wid;
 if n<>1 then raise exception 'duplicate_candidate_inserted:%',n; end if;
 select status into after_status from public.hq_work_items where id=wid;
 if after_status is distinct from before_status then raise exception 'shadow_mutated_source_work'; end if;

 update public.hq_workforce_engine_contract set shadow_max_cycles_per_hour=2 where singleton=true;
 r3:=public.hq_workforce_run_shadow_cycle('acceptance-rate-pause',5);
 if r3->>'status'<>'paused' or r3->>'reason'<>'cycle_rate_ceiling' then raise exception 'rate_breaker_failed:%',r3; end if;
 select shadow_anomaly_paused into paused from public.hq_workforce_engine_contract where singleton=true;
 if not paused or not exists(select 1 from public.hq_workforce_shadow_anomalies where anomaly_key='cycle_rate_ceiling' and resolved_at is null) then raise exception 'anomaly_pause_not_persisted'; end if;
end $$;

rollback;
