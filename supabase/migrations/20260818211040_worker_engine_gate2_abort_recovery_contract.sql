create or replace function public.hq_content_factory_r2_operator_abort_canary(
  p_session_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  s public.hq_content_factory_r2_canary_sessions%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_creation uuid;
  v_state text;
begin
  if session_user<>'postgres' then raise exception 'gate2_operator_postgres_required'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'gate2_abort_reason_required'; end if;

  select * into s from public.hq_content_factory_r2_canary_sessions where id=p_session_id for update;
  if not found then raise exception 'gate2_abort_session_not_found'; end if;
  if s.status in ('completed','failed') then
    return jsonb_build_object('status',s.status,'session_id',s.id,'already_terminal',true);
  end if;

  update public.hq_workforce_engine_contract
     set runtime_execution_enabled=false,
         runtime_autonomy_level=0,
         runtime_max_risk=0,
         runtime_max_concurrency=1,
         runtime_max_executions_per_minute=1,
         runtime_anomaly_paused=false,
         heartbeat_enabled=false,
         factory_enabled=false,
         shadow_enabled=false,
         shadow_scheduler_enabled=false,
         shadow_global_stop=true,
         updated_at=v_now
   where singleton=true;

  update public.hq_workforce_runtime_policies
     set enabled=false,status='revoked',reason=coalesce(reason,'')||' — Gate 2 aborted: '||left(p_reason,240),updated_at=v_now
   where policy_key in ('content-factory-r2-gate2-global','content-factory-r2-gate2-worker')
     and status<>'revoked';

  update public.hq_workforce_capability_grants
     set status='revoked',revoked_at=v_now,revocation_reason='Gate 2 aborted: '||left(p_reason,240)
   where worker_key=s.worker_key and status='active';

  update public.hq_workforce_capability_authority_grants
     set status='revoked',revoked_at=v_now,revocation_reason='Gate 2 aborted: '||left(p_reason,240),
         lifecycle_reason='Gate 2 aborted',
         lifecycle_evidence=coalesce(lifecycle_evidence,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('revoked_at',v_now,'actor','system:postgres','reason',left(p_reason,240)))
   where permitted_worker_key=s.worker_key and status='active';

  update public.hq_workforce_identities
     set status='revoked',revoked_at=v_now,revocation_reason='Gate 2 aborted: '||left(p_reason,240)
   where worker_key=s.worker_key and status='active';

  update public.hq_workforce_execution_budgets
     set status='closed',period_end=least(period_end,v_now)
   where worker_key=s.worker_key and status='active';

  update public.hq_workforce_workers
     set paid_ai_allowed=false,reasoning_mode='deterministic'
   where worker_key=s.worker_key;

  select id into v_creation
    from public.hq_workforce_creation_contracts
   where worker_key=s.worker_key
     and status in ('issued','consumed')
     and (expires_at is null or expires_at>v_now)
   order by issued_at desc limit 1;

  v_state:=public.hq_workforce_current_lifecycle_state(s.worker_key);
  if v_state='active' then
    perform public.hq_workforce_transition_worker(s.worker_key,'suspended','Gate 2 aborted: '||left(p_reason,180),null);
    v_state:='suspended';
  end if;
  if v_state='suspended' then
    perform public.hq_workforce_transition_worker(s.worker_key,'remediation','Gate 2 abort cleanup complete',null);
    v_state:='remediation';
  end if;
  if v_state='remediation' then
    if v_creation is null then raise exception 'gate2_abort_creation_contract_required'; end if;
    perform public.hq_workforce_transition_worker(s.worker_key,'certification_pending','Gate 2 abort returns worker to certification boundary',v_creation);
    v_state:='certification_pending';
  end if;
  if v_state='certification_pending' then
    if not exists(select 1 from public.hq_workforce_certifications where worker_key=s.worker_key and status='active' and expires_at>v_now) then
      raise exception 'gate2_abort_active_certification_required';
    end if;
    perform public.hq_workforce_transition_worker(s.worker_key,'certified','Gate 2 abort completed fail-closed with existing certification',v_creation);
  end if;

  update public.hq_content_factory_r2_canary_sessions
     set status='failed',completed_at=v_now,
         evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
           'aborted_at',v_now,
           'abort_reason',left(p_reason,500),
           'authority_revoked',true,
           'runtime_fail_closed',true,
           'publication_mutation',false
         )
   where id=s.id;

  return jsonb_build_object(
    'status','failed','session_id',s.id,'reason',left(p_reason,500),
    'runtime_fail_closed',true,'authority_revoked',true,
    'worker_lifecycle',public.hq_workforce_current_lifecycle_state(s.worker_key)
  );
exception when others then
  update public.hq_workforce_engine_contract
     set runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,
         heartbeat_enabled=false,factory_enabled=false,shadow_global_stop=true,updated_at=clock_timestamp()
   where singleton=true;
  raise;
end $$;

revoke all on function public.hq_content_factory_r2_operator_abort_canary(uuid,text) from public,anon,authenticated,service_role;
