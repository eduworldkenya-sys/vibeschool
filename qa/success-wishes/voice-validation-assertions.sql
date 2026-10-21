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

-- Regression: verify the ACTUAL compiled CHECK pattern accepts legitimate
-- UUID/UUID.extension paths. A doubled regex backslash incorrectly rejects
-- every voice upload despite all ACL/trigger checks passing.
DO $voice_path$
DECLARE
  v_regex text;
  v_extension text;
  v_path text;
  v_prefix text := '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002';
BEGIN
  SELECT substring(pg_get_constraintdef(c.oid) FROM $capture$object_path ~ '([^']+)'$capture$)
    INTO v_regex
  FROM pg_constraint c
  WHERE c.conrelid='public.success_wishes_voice_validations'::regclass
    AND c.contype='c' AND pg_get_constraintdef(c.oid) LIKE '%object_path ~%'
  LIMIT 1;
  IF v_regex IS NULL THEN
    RAISE EXCEPTION 'Voice object-path CHECK must exist';
  END IF;
  FOREACH v_extension IN ARRAY ARRAY['webm','m4a','mp3','ogg'] LOOP
    v_path := v_prefix || '.' || v_extension;
    IF NOT v_path ~ v_regex THEN
      RAISE EXCEPTION 'Voice object-path CHECK rejects valid extension: %',v_extension;
    END IF;
  END LOOP;
  IF v_prefix || 'xwebm' ~ v_regex
     OR 'other-folder/00000000-0000-4000-8000-000000000002.webm' ~ v_regex THEN
    RAISE EXCEPTION 'Voice object-path CHECK accepts an invalid path';
  END IF;
  RAISE NOTICE 'Voice object path constraints PASS';
END $voice_path$;
