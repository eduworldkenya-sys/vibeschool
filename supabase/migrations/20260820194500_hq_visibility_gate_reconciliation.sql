-- HQ visibility contract: founders and active HQ members with hq.view may use read surfaces.
-- Sensitive actions retain their explicit founder/permission checks in the individual RPCs.

CREATE OR REPLACE FUNCTION public.hq_assert_owner()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_headers json;
  v_ua text;
BEGIN
  IF v_uid IS NULL AND session_user='postgres' THEN
    RETURN;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'HQ access denied' USING errcode='42501';
  END IF;

  IF NOT (
    coalesce(public.is_platform_owner(),false)
    OR EXISTS (
      SELECT 1
      FROM public.hq_human_members hm
      WHERE hm.profile_id=v_uid
        AND hm.status='active'
        AND (hm.access_expires_at IS NULL OR hm.access_expires_at>now())
        AND (
          hm.role IN ('founder','partner_admin','hq_admin')
          OR 'hq.view'=ANY(coalesce(hm.permissions,ARRAY[]::text[]))
        )
    )
  ) THEN
    RAISE EXCEPTION 'HQ access denied' USING errcode='42501';
  END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM public.hq_access_log l
    WHERE l.profile_id=v_uid
      AND l.outcome='granted'
      AND l.created_at>now()-interval '5 minutes'
  ) THEN
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id=v_uid;
    BEGIN
      v_headers:=nullif(current_setting('request.headers',true),'')::json;
    EXCEPTION WHEN others THEN
      v_headers:=null;
    END;
    v_ua:=CASE WHEN v_headers IS NULL THEN null ELSE v_headers->>'user-agent' END;
    INSERT INTO public.hq_access_log(attempted_email,profile_id,outcome,user_agent,created_at)
    VALUES(v_email,v_uid,'granted',v_ua,now());
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION public.hq_assert_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hq_assert_owner() FROM anon;
GRANT EXECUTE ON FUNCTION public.hq_assert_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hq_assert_owner() TO service_role;
