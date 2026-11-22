-- Read-only publisher-facing readiness for the pre-existing independent
-- machine review path. No human signoff is required by that path, but no
-- reviewer identity, commission, receipt, approval or release is created here.
-- This RPC never bypasses the canonical release and publishing guards.
CREATE OR REPLACE FUNCTION public.ce_get_publication_auto_review_state(p_publication_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $state$
DECLARE
  v_actor uuid := auth.uid();
  v_author uuid;
  v_status text;
  v_count integer;
  v_release_approved boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING errcode='42501',message='AUTHENTICATED_PUBLISHER_REQUIRED';
  END IF;

  SELECT author_id,status INTO v_author,v_status
  FROM public.vibe_publications
  WHERE id=p_publication_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLICATION_NOT_FOUND';
  END IF;
  IF v_actor IS DISTINCT FROM v_author AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION USING errcode='42501',message='PUBLICATION_OWNER_REQUIRED';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.ce_machine_content_commissions c
  WHERE c.publication_id=p_publication_id
    AND c.revoked_at IS NULL
    AND c.expires_at>clock_timestamp()
    AND c.reviewer_user_id<>v_author
    AND c.stages @> ARRAY['teacher_guide','assessment','release']::text[];

  SELECT EXISTS(
    SELECT 1
    FROM public.publication_release_approvals a
    WHERE a.publication_id=p_publication_id
      AND a.status='approved'
      AND a.content_fingerprint=public.publication_release_fingerprint(p_publication_id)
  ) INTO v_release_approved;

  RETURN jsonb_build_object(
    'publication_status',v_status,
    'human_approval_required',false,
    'machine_review_commissioned',v_count>0,
    'exact_version_approved',v_release_approved,
    'review_state', CASE
      WHEN v_status='published' THEN 'published'
      WHEN v_release_approved THEN 'release_approved'
      WHEN v_count=0 THEN 'machine_reviewer_not_commissioned'
      ELSE 'independent_machine_review_pending'
    END
  );
END;
$state$;

REVOKE ALL ON FUNCTION public.ce_get_publication_auto_review_state(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.ce_get_publication_auto_review_state(uuid)
  TO authenticated;
