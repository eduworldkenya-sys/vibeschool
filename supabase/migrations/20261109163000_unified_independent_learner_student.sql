-- Canonical learner ID is separate from school membership. Only a verified
-- independent identity can obtain a personal students row; never create a
-- school enrollment, claim a school, or overwrite existing student data.
CREATE OR REPLACE FUNCTION public.ensure_independent_learner_student(p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_identity public.independent_learner_identities%rowtype;
  v_profile public.profiles%rowtype;
  v_student_id uuid;
  v_count integer;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_learner'; END IF;
  SELECT * INTO v_identity FROM public.independent_learner_identities
    WHERE user_id = p_user_id FOR UPDATE;
  SELECT * INTO v_profile FROM public.profiles
    WHERE id = p_user_id FOR UPDATE;
  IF v_identity.user_id IS NULL OR v_profile.id IS NULL
    OR v_identity.account_state <> 'restricted'
    OR v_identity.learner_email_verified_at IS NULL
    OR v_identity.grade_label IS NULL
    OR v_profile.account_status::text <> 'active'
    OR v_profile.is_anonymized OR v_profile.role IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM auth.users u
                    WHERE u.id = p_user_id AND u.email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'independent_learner_not_verified'; END IF;
  SELECT count(*), min(id) INTO v_count,v_student_id FROM public.students
    WHERE profile_id=p_user_id AND deleted_at IS NULL;
  IF v_count > 1 THEN RAISE EXCEPTION 'ambiguous_learner_identity'; END IF;
  IF v_count = 1 THEN
    IF EXISTS(SELECT 1 FROM public.student_classes
      WHERE student_id=v_student_id AND is_current = true)
      OR EXISTS(SELECT 1 FROM public.students WHERE id=v_student_id AND class_id IS NOT NULL)
    THEN RAISE EXCEPTION 'existing_school_identity'; END IF;
    RETURN v_student_id;
  END IF;
  INSERT INTO public.students (profile_id,name,class_id,created_by)
    VALUES (p_user_id,coalesce(nullif(btrim(v_profile.full_name),''),'Learner'),null,p_user_id)
    RETURNING id INTO v_student_id;
  RETURN v_student_id;
END
$$;
REVOKE ALL ON FUNCTION public.ensure_independent_learner_student(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_independent_learner_student(uuid) TO service_role;

-- The independent account remains an independent learner after receiving a
-- personal student ID. The school link remains absent and private.
CREATE OR REPLACE FUNCTION public.get_my_auth_access_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO public,auth,pg_temp AS $$
WITH base AS (SELECT public.get_my_auth_journey_state() AS j),
eligible AS (
 SELECT i.grade_label
 FROM public.independent_learner_identities i
 JOIN public.profiles p ON p.id=i.user_id
 WHERE i.user_id=(SELECT auth.uid()) AND i.account_state='restricted'
   AND i.learner_email_verified_at IS NOT NULL AND i.grade_label IS NOT NULL
   AND p.role IS NULL AND p.account_status::text='active' AND NOT p.is_anonymized
   AND (SELECT count(*) FROM public.students s WHERE s.profile_id=i.user_id AND s.deleted_at IS NULL) <= 1
   AND NOT EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.student_classes sc ON sc.student_id=s.id AND sc.is_current=true
      WHERE s.profile_id=i.user_id AND s.deleted_at IS NULL)
   AND NOT EXISTS (
      SELECT 1 FROM public.students s WHERE s.profile_id=i.user_id
        AND s.deleted_at IS NULL AND s.class_id IS NOT NULL)
 LIMIT 1
)
SELECT CASE WHEN (j->>'reason_code')='ROLE_UNCLAIMED' AND EXISTS(SELECT 1 FROM eligible)
 THEN jsonb_build_object('authenticated',true,'role','student','account_status','active',
   'is_anonymized',false,'profile_complete',true,'authority_complete',true,
   'reason_code','INDEPENDENT_LEARNER_VERIFIED','independent',true)
 ELSE jsonb_build_object('authenticated',coalesce((j->>'authenticated')::boolean,false),
   'role',j->'role','account_status',j->'account_status',
   'is_anonymized',coalesce((j->>'is_anonymized')::boolean,false),
   'profile_complete',coalesce((j->>'profile_complete')::boolean,false),
   'authority_complete',coalesce((j->>'authority_complete')::boolean,false),
   'reason_code',j->>'reason_code') END FROM base
$$;
CREATE OR REPLACE FUNCTION public.get_my_onboarding_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO public,auth,pg_temp AS $$
WITH base AS (SELECT public.get_my_auth_journey_state() AS j),
eligible AS (
 SELECT i.grade_label
 FROM public.independent_learner_identities i
 JOIN public.profiles p ON p.id=i.user_id
 WHERE i.user_id=(SELECT auth.uid()) AND i.account_state='restricted'
   AND i.learner_email_verified_at IS NOT NULL AND i.grade_label IS NOT NULL
   AND p.role IS NULL AND p.account_status::text='active' AND NOT p.is_anonymized
   AND (SELECT count(*) FROM public.students s WHERE s.profile_id=i.user_id AND s.deleted_at IS NULL) <= 1
   AND NOT EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.student_classes sc ON sc.student_id=s.id AND sc.is_current=true
      WHERE s.profile_id=i.user_id AND s.deleted_at IS NULL)
   AND NOT EXISTS (
      SELECT 1 FROM public.students s WHERE s.profile_id=i.user_id
        AND s.deleted_at IS NULL AND s.class_id IS NOT NULL)
 LIMIT 1
)
SELECT CASE WHEN (j->>'reason_code')='ROLE_UNCLAIMED' AND EXISTS(SELECT 1 FROM eligible)
 THEN jsonb_build_object('authenticated',true,'role','student','state','ready',
   'destination','/student','independent',true,
   'grade_label',(SELECT grade_label FROM eligible),
   'reason_code','INDEPENDENT_LEARNER_VERIFIED')
 ELSE j END FROM base
$$;
-- Backfill verified existing Google learners without generating new logins,
-- resetting progress, or claiming a school enrollment.
DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT i.user_id FROM public.independent_learner_identities i
  JOIN public.profiles p ON p.id=i.user_id
  JOIN auth.users u ON u.id=i.user_id
  WHERE i.account_state='restricted' AND i.learner_email_verified_at IS NOT NULL
    AND i.grade_label IS NOT NULL AND u.email_confirmed_at IS NOT NULL
    AND p.role IS NULL AND p.account_status::text='active' AND NOT p.is_anonymized
 LOOP
   PERFORM public.ensure_independent_learner_student(r.user_id);
 END LOOP;
END $$;
