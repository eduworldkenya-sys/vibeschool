-- WE-R1.4.11: Legacy authority closure.
-- NON-ACTIVATING: this migration must not enable runtime execution, heartbeat, Factory,
-- Shadow, autonomy, risk authority, capability authority, or any scheduler.
--
-- Purpose:
--   1. Close externally callable R1.2/R1.3/R1.3X control-plane paths that can mutate
--      Worker Engine execution, verification, decision, learning, or promotion state
--      outside the WE-R1.4 consequential execution / verification / recovery chain.
--   2. Preserve historical objects for evidence and migration compatibility while
--      removing service_role as business authority for superseded paths.
--   3. Make the production upgrade self-closing: installing WE-R1.4 also retires the
--      obsolete externally invokable authority surfaces instead of leaving two engines.

-- ---------------------------------------------------------------------------
-- Canonical rule
-- ---------------------------------------------------------------------------
-- service_role is transport privilege, not Worker Engine business authority.
-- Consequential autonomous mutation remains reachable only through the WE-R1.4 task
-- path (hq_workforce_tool_gateway_execute -> consequential execution gateway).

-- Legacy run engine: may create/execute/verify old hq_workforce_runs and mutate work.
revoke all on function public.hq_workforce_enqueue_unrouted_work() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_execute_safe_queue() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_verify_run(uuid,jsonb,jsonb,boolean,text,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_verify_assignment(uuid,jsonb,jsonb,boolean,text,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_verify_internal_review(uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_next_recovery(uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_plan_recovery(uuid,text,text,jsonb) from public,anon,authenticated,service_role;

-- Legacy decision authority: owner-gated hq_workforce_decide remains the human path.
revoke all on function public.hq_workforce_transition_decision(uuid,text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_record_revision_learning(uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_record_revision_learning(uuid,text,text) from public,anon,authenticated,service_role;

-- Legacy learning/promotion truth injection. These routines accept caller-supplied
-- approval, benchmark, execution, outcome, or actor truth and therefore cannot remain
-- externally invokable after WE-R1.4 authority closure.
revoke all on function public.hq_workforce_promote_learning(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_promote_learning_candidate(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_prepare_skill_promotion(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_record_skill_benchmark(uuid,boolean,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_finalize_skill_probation(uuid,boolean,boolean,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_record_positive_outcome(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_record_verified_outcome_memory(uuid) from public,anon,authenticated,service_role;

-- Legacy gap/workforce orchestration. These remain as historical/internal helpers but
-- cannot be directly driven by service_role as an alternate autonomous control plane.
revoke all on function public.hq_workforce_evaluate_candidate_gaps() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_create_gap_work_items() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_diagnose_gap(uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_detect_capacity_gaps() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_detect_context_gaps() from public,anon,authenticated,service_role;

-- Direct Factory scheduler is superseded by the master-gated scheduler and must not be
-- independently callable. Internal factory helpers already have no service_role EXECUTE.
revoke all on function public.hq_workforce_scheduled_factory_heartbeat() from public,anon,authenticated,service_role;

-- Runtime self-certification is evidence tooling, not authority. Prevent service_role
-- from manufacturing fresh certification rows through the legacy self-certifier.
revoke all on function public.hq_workforce_runtime_self_certify() from public,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Fail-closed compatibility wrappers
-- ---------------------------------------------------------------------------
-- Keep obsolete RPC names addressable for old callers/migrations, but make their
-- behavior explicitly non-consequential. This prevents accidental re-granting from
-- silently resurrecting the old execution engine.

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
declare
  ec public.hq_workforce_engine_contract%rowtype;
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

-- Revoke again after CREATE OR REPLACE so the intended ACL is explicit in this exact
-- migration, independent of prior default privileges.
revoke all on function public.hq_workforce_execute_safe_queue() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_transition_decision(uuid,text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_scheduled_factory_heartbeat() from public,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Structural attestation
-- ---------------------------------------------------------------------------
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
  from public.hq_workforce_capability_authority_grants
  where status='active';
  if v_active_authority<>0 then
    raise exception 'WE-R1.4.11 cannot install with active capability authority';
  end if;

  select count(*) into v_bad
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'hq_workforce_execute_safe_queue',
      'hq_workforce_enqueue_unrouted_work',
      'hq_workforce_verify_run',
      'hq_workforce_verify_assignment',
      'hq_workforce_transition_decision',
      'hq_workforce_promote_learning',
      'hq_workforce_promote_learning_candidate',
      'hq_workforce_finalize_skill_probation',
      'hq_workforce_record_skill_benchmark',
      'hq_workforce_scheduled_factory_heartbeat'
    )
    and has_function_privilege('service_role',p.oid,'EXECUTE');
  if v_bad<>0 then
    raise exception 'WE-R1.4.11 legacy service_role authority closure failed:%',v_bad;
  end if;
end $$;
