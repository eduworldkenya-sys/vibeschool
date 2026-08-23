\set ON_ERROR_STOP on

-- Canonical Workforce Convergence
--
-- This test intentionally maps the six useful intents from the external
-- "Canonical Workforce Convergence" proposal onto VibeSchool's existing
-- canonical Worker Engine + Cyborg architecture. It must not introduce a
-- second admission system, model gateway, evidence ledger, or certification
-- state machine.

begin;

DO $$
DECLARE
  v_definition text;
BEGIN
  -- Closure 1: versioned contracts already live in the canonical contract stack.
  IF to_regclass('public.hq_workforce_contracts') IS NULL THEN
    RAISE EXCEPTION 'canonical_convergence_contract_registry_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hq_workforce_contracts' AND column_name='version'
  ) THEN
    RAISE EXCEPTION 'canonical_convergence_contract_version_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hq_workforce_task_contracts' AND column_name='schema_version'
  ) THEN
    RAISE EXCEPTION 'canonical_convergence_task_schema_version_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hq_workforce_tool_contracts' AND column_name='version'
  ) THEN
    RAISE EXCEPTION 'canonical_convergence_tool_version_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hq_workforce_task_contracts' AND column_name='capability_version'
  ) THEN
    RAISE EXCEPTION 'canonical_convergence_capability_version_binding_missing';
  END IF;

  -- Closure 2: admission is an atomic DB authorization decision over the exact task.
  IF to_regprocedure('public.hq_workforce_assert_runtime_task_authorized(uuid)') IS NULL THEN
    RAISE EXCEPTION 'canonical_convergence_runtime_admission_missing';
  END IF;
  IF to_regclass('public.hq_workforce_runtime_authorization_events') IS NULL THEN
    RAISE EXCEPTION 'canonical_convergence_runtime_authorization_evidence_missing';
  END IF;

  SELECT pg_get_functiondef('public.hq_workforce_assert_runtime_task_authorized_r12_internal(uuid)'::regprocedure)
    INTO v_definition;
  IF position('runtime_execution_enabled' in v_definition) = 0
     OR position('hq_workforce_assert_certification' in v_definition) = 0
     OR position('tool_contract_id' in v_definition) = 0
     OR position('hq_workforce_capability_grants' in v_definition) = 0
     OR position('task_scope_denied' in v_definition) = 0 THEN
    RAISE EXCEPTION 'canonical_convergence_runtime_admission_not_fail_closed';
  END IF;

  -- Closure 3: consequential execution remains behind the canonical gateway.
  IF to_regprocedure('public.hq_workforce_tool_gateway_execute(uuid)') IS NULL THEN
    RAISE EXCEPTION 'canonical_convergence_tool_gateway_missing';
  END IF;
  SELECT pg_get_functiondef('public.hq_workforce_tool_gateway_execute(uuid)'::regprocedure)
    INTO v_definition;
  IF position('hq_workforce_consequential_execution_gateway' in v_definition) = 0 THEN
    RAISE EXCEPTION 'canonical_convergence_tool_gateway_bypass';
  END IF;

  -- Closure 4: Cyborg is a request-bound, one-time, source-authority-bound model boundary.
  IF to_regclass('public.hq_cyborg_capabilities') IS NULL THEN
    RAISE EXCEPTION 'canonical_convergence_cyborg_capabilities_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hq_cyborg_capabilities'
      AND column_name IN ('nonce','mission_revision','request_hash','consumed_at','source_authority_kind','source_authority_ref')
    GROUP BY table_schema, table_name
    HAVING count(*) = 6
  ) THEN
    RAISE EXCEPTION 'canonical_convergence_cyborg_request_binding_incomplete';
  END IF;
  IF to_regprocedure('public.hq_cyborg_register_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,text,text,integer,text,timestamp with time zone,timestamp with time zone,timestamp with time zone)') IS NULL THEN
    RAISE EXCEPTION 'canonical_convergence_cyborg_registration_missing';
  END IF;
  IF to_regprocedure('public.hq_cyborg_consume_capability(uuid,uuid,uuid,uuid,text,text,text,text,text,integer,text,text)') IS NULL THEN
    RAISE EXCEPTION 'canonical_convergence_cyborg_consumption_missing';
  END IF;

  -- Closure 5: evidence is durable, trace-bound, hashed, classified, and payload-bearing.
  IF to_regclass('public.hq_workforce_evidence') IS NULL THEN
    RAISE EXCEPTION 'canonical_convergence_evidence_ledger_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hq_workforce_evidence'
      AND column_name IN ('trace_id','content_hash','classification','source_type','source_ref','observed_at','payload')
    GROUP BY table_schema, table_name
    HAVING count(*) = 7
  ) THEN
    RAISE EXCEPTION 'canonical_convergence_evidence_contract_incomplete';
  END IF;

  -- Closure 6: retain the durable legacy certification ledger, but certify new
  -- professional workers through the canonical independent-assurance path.
  IF to_regclass('public.hq_workforce_certifications') IS NULL THEN
    RAISE EXCEPTION 'canonical_convergence_certification_ledger_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hq_workforce_certifications'
      AND column_name IN ('worker_key','verifier_key','issued_at','expires_at','revoked_at','revocation_reason')
    GROUP BY table_schema, table_name
    HAVING count(*) = 6
  ) THEN
    RAISE EXCEPTION 'canonical_convergence_certification_contract_incomplete';
  END IF;

  IF to_regclass('public.hq_workforce_worker_assurance') IS NULL
     OR to_regclass('public.hq_workforce_qualification_evidence') IS NULL THEN
    RAISE EXCEPTION 'canonical_convergence_professional_assurance_missing';
  END IF;

  SELECT pg_get_functiondef('public.hq_workforce_record_qualification_evidence(text,text,text,text,boolean,jsonb)'::regprocedure)
    INTO v_definition;
  IF position('independent_evaluator_required' in v_definition) = 0 THEN
    RAISE EXCEPTION 'canonical_convergence_independent_evaluator_missing';
  END IF;

  SELECT pg_get_functiondef('public.hq_workforce_decide_professional_certification(text,text)'::regprocedure)
    INTO v_definition;
  IF position('creator_or_self_certification_forbidden' in v_definition) = 0
     OR position('independent' in v_definition) = 0
     OR position('adversarial' in v_definition) = 0
     OR position('global_stop' in v_definition) = 0
     OR position('authority_separation' in v_definition) = 0 THEN
    RAISE EXCEPTION 'canonical_convergence_professional_certification_incomplete';
  END IF;

  SELECT pg_get_functiondef('public.hq_workforce_guard_certification_mutation()'::regprocedure)
    INTO v_definition;
  IF position('worker_certification_immutable' in v_definition) = 0
     OR position('worker_certification_delete_forbidden' in v_definition) = 0 THEN
    RAISE EXCEPTION 'canonical_convergence_certification_immutability_missing';
  END IF;
END
$$;

-- This proof is architectural only. It must not activate runtime, schedulers,
-- publishing, payments, or any other consequential authority.
DO $$
DECLARE
  v_contract public.hq_workforce_engine_contract%rowtype;
BEGIN
  SELECT * INTO v_contract
  FROM public.hq_workforce_engine_contract
  WHERE singleton=true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'canonical_convergence_engine_contract_missing';
  END IF;
  IF v_contract.runtime_execution_enabled THEN
    RAISE EXCEPTION 'canonical_convergence_must_not_activate_runtime';
  END IF;
  IF NOT v_contract.shadow_global_stop THEN
    RAISE EXCEPTION 'canonical_convergence_global_stop_must_remain_active';
  END IF;
END
$$;

rollback;
