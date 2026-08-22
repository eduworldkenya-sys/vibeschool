begin;

-- Runtime remains deliberately OFF: watchdog must not false-alarm while disabled.
update public.hq_workforce_engine_contract set heartbeat_enabled=false,factory_enabled=false,runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,shadow_enabled=false,shadow_scheduler_enabled=false,shadow_global_stop=true where singleton=true;
delete from public.hq_workforce_monitoring_alerts where alert_key in ('independent-watchdog-telemetry','independent-watchdog-heartbeat');
do $$ declare r jsonb; begin
  r:=public.hq_workforce_run_independent_watchdog(900,900);
  if (r->>'expected_telemetry')::boolean or (r->>'expected_heartbeat')::boolean then raise exception 'watchdog_false_expectation_when_runtime_off'; end if;
  if jsonb_array_length(r->'findings')<>0 then raise exception 'watchdog_false_alarm_when_runtime_off'; end if;
end $$;

-- Cooldown/dedupe must allow first claim and deny replay in-window.
delete from public.hq_workforce_trigger_firings where worker_key='test-worker' and trigger_key='test-trigger';
do $$ begin
  if not public.hq_workforce_claim_trigger('test-worker','test-trigger','same-event',3600,3600,'{}') then raise exception 'first_trigger_claim_rejected'; end if;
  if public.hq_workforce_claim_trigger('test-worker','test-trigger','same-event',3600,3600,'{}') then raise exception 'trigger_replay_not_deduped'; end if;
end $$;

-- Context sanitization recursively strips secrets and blocks over-classified handoffs.
do $$ declare r jsonb; blocked boolean:=false; begin
  r:=public.hq_workforce_sanitize_context('{"safe":"ok","secret":"x","nested":{"access_token":"y","keep":1}}','internal','internal',array['user_pii']);
  if r ? 'secret' or (r->'nested') ? 'access_token' or r->>'safe'<>'ok' then raise exception 'context_sanitization_failed'; end if;
  begin perform public.hq_workforce_sanitize_context('{"x":1}','restricted','internal','{}'); exception when others then blocked:=true; end;
  if not blocked then raise exception 'restricted_context_not_blocked'; end if;
end $$;

-- Clarification is structured and idempotent by request key.
do $$ declare a uuid; b uuid; begin
  a:=public.hq_workforce_request_clarification('test-clarification','test-worker','test-manager',null,'missing_scope','["scope_type"]','Scope is required before routing.','env-1');
  b:=public.hq_workforce_request_clarification('test-clarification','test-worker','test-manager',null,'missing_scope','["scope_type"]','Scope is required before routing.','env-1');
  if a<>b then raise exception 'clarification_not_idempotent'; end if;
end $$;

-- Fallback/authority approval persistence and escalation must be explicit.
delete from public.hq_workforce_approval_requests where request_key='test-fallback-approval';
do $$ declare v uuid; begin
  v:=public.hq_workforce_request_approval('test-fallback-approval','quality-worker-01','quality.review','fallback','human','quality_lead','founder_ceo','founder_ceo',1,jsonb_build_object('reason','deterministic_unavailable'));
  update public.hq_workforce_approval_requests set requested_at=clock_timestamp()-interval '2 hours' where id=v;
  perform public.hq_workforce_escalate_pending_approvals();
  if not exists(select 1 from public.hq_workforce_approval_requests where id=v and escalation_level=1 and approval_role='founder_ceo') then raise exception 'approval_escalation_failed'; end if;
end $$;

-- When heartbeat is expected and absent/stale, watchdog must persist an alert; rollback keeps runtime OFF.
update public.hq_workforce_engine_contract set heartbeat_enabled=true where singleton=true;
delete from public.hq_workforce_heartbeat_runs;
do $$ declare r jsonb; begin
  r:=public.hq_workforce_run_independent_watchdog(900,900);
  if not ((r->'findings') ? 'WORKER_HEARTBEAT_STALE') then raise exception 'watchdog_failed_to_detect_missing_heartbeat'; end if;
  if not exists(select 1 from public.hq_workforce_monitoring_alerts where alert_key='independent-watchdog-heartbeat' and status='open' and severity='critical') then raise exception 'watchdog_alert_not_persisted'; end if;
end $$;
update public.hq_workforce_engine_contract set heartbeat_enabled=false where singleton=true;
perform public.hq_workforce_run_independent_watchdog(900,900);

rollback;
