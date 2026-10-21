-- DB checks are run only against the synthetic PostgreSQL fixture.
DO $voice$
DECLARE
  rel oid;
BEGIN
  rel := 'public.success_wishes_voice_validations'::regclass;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=rel AND relrowsecurity)
    THEN RAISE EXCEPTION 'private voice validations must enforce RLS'; END IF;
  IF has_table_privilege('anon',rel,'SELECT')
    OR has_table_privilege('authenticated',rel,'SELECT')
    OR has_table_privilege('anon',rel,'INSERT')
    OR has_table_privilege('authenticated',rel,'INSERT')
    OR has_table_privilege('authenticated',rel,'UPDATE')
    OR has_table_privilege('authenticated',rel,'DELETE')
    THEN RAISE EXCEPTION 'a browser can access private voice validation'; END IF;
  IF NOT has_table_privilege('service_role',rel,'SELECT')
    THEN RAISE EXCEPTION 'service role missing validation grant'; END IF;
  IF has_function_privilege('anon','public.success_wishes_guard_voice_ready()','EXECUTE')
    OR has_function_privilege('authenticated','public.success_wishes_guard_voice_ready()','EXECUTE')
    THEN RAISE EXCEPTION 'voice ready guard exposed to browser roles'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='success_wishes_voice_ready_guard' AND tgenabled='O')
    THEN RAISE EXCEPTION 'voice readiness validation guard missing'; END IF;
  RAISE NOTICE 'Private voice validation ACL and readiness trigger PASS';
END $voice$;
