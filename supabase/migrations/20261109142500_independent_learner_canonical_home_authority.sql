-- Recognise verified independent learners in the canonical auth journey without
-- creating school student rows or granting school scoped permissions.
CREATE OR REPLACE FUNCTION public.get_my_auth_access_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $$
  WITH base AS (SELECT public.get_my_auth_journey_state() AS j),
  eligible AS (
    SELECT i.grade_label
    FROM public.independent_learner_identities i
    JOIN public.profiles p ON p.id = i.user_id
    WHERE i.user_id = (SELECT auth.uid())
      AND i.account_state = 'restricted'
      AND i.learner_email_verified_at IS NOT NULL
      AND i.grade_label IS NOT NULL
      AND p.role IS NULL
      AND p.account_status::text = 'active'
      AND NOT p.is_anonymized
      AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.profile_id=i.user_id AND s.deleted_at IS NULL)
    LIMIT 1
  )
  SELECT CASE WHEN (j->>'reason_code') = 'ROLE_UNCLAIMED' AND EXISTS (SELECT 1 FROM eligible)
    THEN jsonb_build_object('authenticated',true,'role','student','account_status','active',
      'is_anonymized',false,'profile_complete',true,'authority_complete',true,
      'reason_code','INDEPENDENT_LEARNER_VERIFIED','independent',true)
    ELSE jsonb_build_object('authenticated',coalesce((j->>'authenticated')::boolean,false),
      'role',j->'role','account_status',j->'account_status',
      'is_anonymized',coalesce((j->>'is_anonymized')::boolean,false),
      'profile_complete',coalesce((j->>'profile_complete')::boolean,false),
      'authority_complete',coalesce((j->>'authority_complete')::boolean,false),
      'reason_code',j->>'reason_code')
    END
  FROM base;
$$;
CREATE OR REPLACE FUNCTION public.get_my_onboarding_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $$
  WITH base AS (SELECT public.get_my_auth_journey_state() AS j),
  eligible AS (
    SELECT i.grade_label
    FROM public.independent_learner_identities i
    JOIN public.profiles p ON p.id=i.user_id
    WHERE i.user_id=(SELECT auth.uid())
      AND i.account_state='restricted'
      AND i.learner_email_verified_at IS NOT NULL
      AND i.grade_label IS NOT NULL
      AND p.role IS NULL
      AND p.account_status::text='active'
      AND NOT p.is_anonymized
      AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.profile_id=i.user_id AND s.deleted_at IS NULL)
    LIMIT 1
  )
  SELECT CASE WHEN (j->>'reason_code')='ROLE_UNCLAIMED' AND EXISTS (SELECT 1 FROM eligible)
    THEN jsonb_build_object('authenticated',true,'role','student','state','ready',
      'destination','/student','independent',true,
      'grade_label',(SELECT grade_label FROM eligible),
      'reason_code','INDEPENDENT_LEARNER_VERIFIED')
    ELSE j END
  FROM base;
$$;
