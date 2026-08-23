-- Canonical Laban workforce identity — NON-ACTIVATING.
-- Provides the stable commander FK identity required by the Laban command kernel.
-- This migration grants no capability authority, starts no runtime, and cannot publish/spend.

insert into public.hq_workforce_workers (
  worker_key,
  worker_kind,
  title,
  department_key,
  job_key,
  manager_worker_key,
  mission,
  status,
  reasoning_mode,
  paid_ai_allowed,
  competencies,
  permissions,
  approval_boundaries,
  kpis
)
values (
  'laban',
  'digital',
  'Laban — Governed Mission Commander',
  'operations',
  null,
  null,
  'Command and coordinate bounded VibeSchool missions through approved plans, specialist delegation, contradiction handling, evidence lineage and independent verification. Laban never self-grants authority, self-certifies, publishes, spends, bypasses Cyborg, or activates runtime.',
  'restricted',
  'deterministic',
  false,
  '["mission decomposition","governed delegation","contradiction handling","risk budgeting","evidence lineage","verifier handoff","failure recovery","post-mission learning"]'::jsonb,
  '["coordinate_governed_missions","propose_delegation","record_command_evidence","request_independent_verification","request_owner_approval"]'::jsonb,
  '["no_self_grant_authority","no_self_certification","no_independent_verifier_impersonation","no_runtime_activation","no_scheduler_activation","no_publication","no_spending","no_payments","no_cyborg_bypass","no_global_stop_bypass","consequential_actions_require_canonical_authorization"]'::jsonb,
  '{"primary_metric":"verified_mission_completion_without_bypass","publication_authority":false,"spending_authority":false,"runtime_activation_authority":false,"self_certification":false,"authority_granting":false}'::jsonb
)
on conflict (worker_key) do update set
  worker_kind = excluded.worker_kind,
  title = excluded.title,
  department_key = excluded.department_key,
  job_key = excluded.job_key,
  manager_worker_key = excluded.manager_worker_key,
  mission = excluded.mission,
  status = 'restricted',
  reasoning_mode = 'deterministic',
  paid_ai_allowed = false,
  competencies = excluded.competencies,
  permissions = excluded.permissions,
  approval_boundaries = excluded.approval_boundaries,
  kpis = excluded.kpis,
  updated_at = clock_timestamp();

-- Fail closed unless the identity is singular and remains non-activating.
do $$
declare
  v_count integer;
  ec public.hq_workforce_engine_contract%rowtype;
begin
  select count(*) into v_count
  from public.hq_workforce_workers
  where worker_key = 'laban';

  if v_count <> 1 then
    raise exception 'laban_identity_cardinality_invalid:%', v_count;
  end if;

  if exists (
    select 1
    from public.hq_workforce_workers
    where worker_key = 'laban'
      and (
        status <> 'restricted'
        or reasoning_mode <> 'deterministic'
        or paid_ai_allowed
      )
  ) then
    raise exception 'laban_identity_non_activating_contract_invalid';
  end if;

  select * into ec
  from public.hq_workforce_engine_contract
  where singleton = true;

  if not found then
    raise exception 'laban_identity_requires_engine_contract';
  end if;

  if coalesce(ec.runtime_execution_enabled, false)
     or coalesce(ec.heartbeat_enabled, false)
     or coalesce(ec.factory_enabled, false)
     or coalesce(ec.runtime_autonomy_level, 0) <> 0
     or coalesce(ec.runtime_max_risk, 0) <> 0
     or coalesce(ec.shadow_enabled, false)
     or coalesce(ec.shadow_scheduler_enabled, false)
     or not coalesce(ec.shadow_global_stop, true) then
    raise exception 'laban_identity_requires_fail_closed_runtime_posture';
  end if;

  if exists (
    select 1
    from public.hq_workforce_capability_authority_grants
    where permitted_worker_key = 'laban'
      and status = 'active'
      and expires_at > clock_timestamp()
  ) then
    raise exception 'laban_identity_must_not_receive_active_authority';
  end if;
end $$;
