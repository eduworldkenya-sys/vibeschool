-- WE-R1.4.11: Legacy authority closure.
-- NON-ACTIVATING: this migration must not enable runtime execution, heartbeat, Factory,
-- Shadow, autonomy, risk authority, capability authority, or any scheduler.
--
-- service_role is transport privilege, not Worker Engine business authority.
-- Production and clean rebuild contain different historical overloads for some legacy
-- functions. Retirement is therefore name/oid-driven: every existing overload of each
-- superseded RPC loses external EXECUTE without assuming one environment's signature.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
      'hq_workforce_enqueue_unrouted_work',
      'hq_workforce_execute_safe_queue',
      'hq_workforce_verify_run',
      'hq_workforce_verify_assignment',
      'hq_workforce_verify_internal_review',
      'hq_workforce_next_recovery',
      'hq_workforce_plan_recovery',
      'hq_workforce_transition_decision',
      'hq_workforce_record_revision_learning',
      'hq_workforce_promote_learning',
      'hq_workforce_promote_learning_candidate',
      'hq_workforce_prepare_skill_promotion',
      'hq_workforce_record_skill_benchmark',
      'hq_workforce_finalize_skill_probation',
      'hq_workforce_record_positive_outcome',
      'hq_workforce_record_verified_outcome_memory',
      'hq_workforce_evaluate_candidate_gaps',
      'hq_workforce_create_gap_work_items',
      'hq_workforce_diagnose_gap',
      'hq_workforce_detect_capacity_gaps',
      'hq_workforce_detect_context_gaps',
      'hq_workforce_scheduled_factory_heartbeat',
      'hq_workforce_runtime_self_certify'
    ])
  loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
  end loop;
end $$;

-- Keep the most historically referenced obsolete entrypoint names addressable but
-- explicitly fail closed. This protects old callers from silently regaining authority if
-- a later grant is accidentally broadened.
create or replace function public.hq_workforce_execute_safe_queue()
returns integer
language plpgsql
set search_path=public,pg_temp
as $$
begin
  raise exception 'legacy_worker_execution_retired_use_we_r1_4_gateway';
end $$;

create or replace function public.hq_workforce_transition_decision(
  p_decision_id uuid,
  p_action text,
  p_revision text default null,
  p_actor uuid default null
)
returns public.hq_workforce_decisions
language plpgsql
set search_path=public,pg_temp
as $$
begin
  raise exception 'legacy_worker_decision_transition_retired_use_owner_gated_decide';
end $$;

create or replace function public.hq_workforce_scheduled_factory_heartbeat()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if not coalesce(ec.runtime_execution_enabled,false) then
    return jsonb_build_object('status','runtime_disabled','mode','deterministic','factory_executed',false);
  end if;
  if coalesce(ec.runtime_anomaly_paused,false) then
    return jsonb_build_object('status','anomaly_paused','mode','deterministic','factory_executed',false);
  end if;
  raise exception 'direct_factory_scheduler_retired_use_master_scheduled_heartbeat';
end $$;

revoke all on function public.hq_workforce_execute_safe_queue() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_transition_decision(uuid,text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_scheduled_factory_heartbeat() from public,anon,authenticated,service_role;

-- Structural attestation: no surviving overload of a retired authority surface may be
-- executable by service_role, and installation may not activate anything.
do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_active_authority integer;
  v_bad integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.11 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.11 violated fail_closed_activation_boundary';
  end if;

  select count(*) into v_active_authority
  from public.hq_workforce_capability_authority_grants where status='active';
  if v_active_authority<>0 then raise exception 'WE-R1.4.11 cannot install with active capability authority'; end if;

  select count(*) into v_bad
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname = any(array[
      'hq_workforce_execute_safe_queue','hq_workforce_enqueue_unrouted_work','hq_workforce_verify_run',
      'hq_workforce_verify_assignment','hq_workforce_verify_internal_review','hq_workforce_next_recovery',
      'hq_workforce_plan_recovery','hq_workforce_transition_decision','hq_workforce_record_revision_learning',
      'hq_workforce_promote_learning','hq_workforce_promote_learning_candidate','hq_workforce_prepare_skill_promotion',
      'hq_workforce_record_skill_benchmark','hq_workforce_finalize_skill_probation','hq_workforce_record_positive_outcome',
      'hq_workforce_record_verified_outcome_memory','hq_workforce_evaluate_candidate_gaps','hq_workforce_create_gap_work_items',
      'hq_workforce_diagnose_gap','hq_workforce_detect_capacity_gaps','hq_workforce_detect_context_gaps',
      'hq_workforce_scheduled_factory_heartbeat','hq_workforce_runtime_self_certify'
    ])
    and has_function_privilege('service_role',p.oid,'EXECUTE');
  if v_bad<>0 then raise exception 'WE-R1.4.11 legacy service_role authority closure failed:%',v_bad; end if;
end $$;
