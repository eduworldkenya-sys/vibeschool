\set ON_ERROR_STOP on

DO $$
DECLARE
  t text;
  forbidden text[] := ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
  p text;
  blocked boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hq_workforce_capability_grants',
    'hq_workforce_certifications',
    'hq_workforce_creation_contracts',
    'hq_workforce_runtime_policies',
    'hq_workforce_workers',
    'hq_workforce_engine_contract'
  ] LOOP
    IF NOT has_table_privilege('service_role', format('public.%I', t), 'SELECT') THEN
      RAISE EXCEPTION '%: service_role SELECT missing', t;
    END IF;

    FOREACH p IN ARRAY forbidden LOOP
      IF has_table_privilege('service_role', format('public.%I', t), p) THEN
        RAISE EXCEPTION '%: service_role still has forbidden % privilege', t, p;
      END IF;
      IF has_table_privilege('anon', format('public.%I', t), p)
         OR has_table_privilege('authenticated', format('public.%I', t), p) THEN
        RAISE EXCEPTION '%: application role has forbidden % privilege', t, p;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT has_function_privilege('service_role', 'public.hq_workforce_revoke_certification(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role narrow certification revocation gateway missing';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.hq_workforce_revoke_identity(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role narrow identity revocation gateway missing';
  END IF;

  IF has_function_privilege('service_role', 'public.hq_workforce_issue_certification(text,uuid,text,integer,interval)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role can issue worker certification';
  END IF;
  IF has_function_privilege('service_role', 'public.hq_workforce_factory_create_shadow_worker(uuid,uuid,text,text,text,text,text,text,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role can invoke worker factory creation gateway';
  END IF;
  IF has_function_privilege('service_role', 'public.hq_workforce_guard_engine_contract_activation()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role can execute engine activation trigger function directly';
  END IF;
  IF has_function_privilege('service_role', 'public.hq_workforce_guard_runtime_policy_floor()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role can execute runtime policy floor trigger function directly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.hq_workforce_runtime_policies
    WHERE scope_kind='global' AND scope_key='global' AND status='active'
  ) THEN
    RAISE EXCEPTION 'active global runtime policy floor missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.hq_workforce_engine_contract'::regclass
      AND tgname='trg_hq_workforce_guard_engine_contract_activation'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'engine activation guard trigger missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.hq_workforce_runtime_policies'::regclass
      AND tgname='trg_hq_workforce_guard_runtime_policy_floor'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'runtime policy floor guard trigger missing';
  END IF;

  -- Adversarial proof: with the seeded disabled global policy, direct runtime
  -- activation must fail closed before any consequential task can run.
  blocked := false;
  BEGIN
    UPDATE public.hq_workforce_engine_contract
       SET runtime_execution_enabled=true
     WHERE singleton=true;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'worker_runtime_global_policy_disabled' THEN
      RAISE;
    END IF;
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'runtime activation unexpectedly succeeded under disabled global policy';
  END IF;

  -- Adversarial proof: the final active global policy cannot be removed, because
  -- policy absence would otherwise become implicit permission in older kernels.
  blocked := false;
  BEGIN
    DELETE FROM public.hq_workforce_runtime_policies
     WHERE id=(
       SELECT id FROM public.hq_workforce_runtime_policies
       WHERE scope_kind='global' AND scope_key='global' AND status='active'
       ORDER BY created_at
       LIMIT 1
     );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'worker_runtime_global_policy_floor_required' THEN
      RAISE;
    END IF;
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'final active global runtime policy was removable';
  END IF;

  RAISE NOTICE 'PASS: Worker Engine authority/control planes are read-only to service_role and runtime policy absence cannot become implicit permission';
END
$$;
