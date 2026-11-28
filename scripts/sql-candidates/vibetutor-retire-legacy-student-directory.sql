-- Candidate forward migration for #2174. Generate canonical migration filename
-- with Supabase CLI in the authorized release environment; do not run manually.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.vibetutor_search_students(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vibetutor_invite_student(uuid) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF has_function_privilege('authenticated','public.vibetutor_search_students(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.vibetutor_invite_student(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.vibetutor_search_students(text)','EXECUTE')
     OR has_function_privilege('anon','public.vibetutor_invite_student(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Legacy student directory privileges remain';
  END IF;
  IF NOT has_function_privilege('authenticated','public.vibetutor_create_student_invite()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.vibetutor_preview_student_invite(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.vibetutor_claim_student_invite(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.vibetutor_respond_student_invite(uuid,boolean)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.vibetutor_revoke_student_invite(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Canonical private invitation privileges missing';
  END IF;
END $$;
COMMIT;
