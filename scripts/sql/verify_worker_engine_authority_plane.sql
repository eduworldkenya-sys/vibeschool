\set ON_ERROR_STOP on

DO $$
DECLARE
  t text;
  forbidden text[] := ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
  p text;
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

  RAISE NOTICE 'PASS: Worker Engine authority and safety control planes are read-only to service_role except narrow fail-safe revocation gateways';
END
$$;
