-- Fail-closed HQ authorization for restricted/anonymized profiles.
-- Keep platform_owners and hq_human_members records intact.
create or replace function public.hq_profile_is_active(p_uid uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select p_uid is not null and exists (
    select 1 from public.profiles p
    where p.id = p_uid and p.account_status::text = 'active'
      and p.is_anonymized is false
  );
$$;
revoke all on function public.hq_profile_is_active(uuid) from public, anon, authenticated;
grant execute on function public.hq_profile_is_active(uuid) to service_role;

-- Patch the existing function bodies instead of replacing unrelated
-- permissions, audit logging, bypass-for-migrations, or return contracts.
do $security$
declare
  v_name text;
  v_signature text;
  v_from text;
  v_to text;
  v_body text;
  v_oid oid;
begin
  for v_name, v_signature, v_from, v_to in
    select * from (values
      ('is_platform_owner','',
        'select auth.uid() is not null',
        'select auth.uid() is not null and public.hq_profile_is_active(auth.uid())'),
      ('hq_human_is_founder','uuid',
        'where profile_id=p_profile_id and role=',
        'where profile_id=p_profile_id and public.hq_profile_is_active(p_profile_id) and role='),
      ('hq_human_has_permission','uuid,text',
        'where profile_id=p_profile_id and status=',
        'where profile_id=p_profile_id and public.hq_profile_is_active(p_profile_id) and status='),
      ('hq_workroom_has_permission','text',
        'where hm.profile_id=auth.uid() and hm.status=',
        'where hm.profile_id=auth.uid() and public.hq_profile_is_active(auth.uid()) and hm.status='),
      ('hq_assert_owner','',
        '  IF NOT (',
        '  IF NOT public.hq_profile_is_active(v_uid) THEN RAISE EXCEPTION ''HQ access denied'' USING errcode=''42501''; END IF;' || chr(10) || '  IF NOT ('),
      ('hq_check_owner_access','text',
        '  IF coalesce(public.is_platform_owner(),false) THEN',
        '  IF NOT public.hq_profile_is_active(v_uid) THEN' || chr(10) ||
        '    INSERT INTO public.hq_access_log(attempted_email,profile_id,outcome,created_at)' || chr(10) ||
        '    VALUES(v_email,v_uid,''account_restricted'',now());' || chr(10) ||
        '    RETURN jsonb_build_object(''allowed'',false,''surface'',p_surface,''reason'',''account_restricted'',''checked_at'',now());' || chr(10) ||
        '  END IF;' || chr(10) ||
        '  IF coalesce(public.is_platform_owner(),false) THEN'),
      ('is_school_admin','uuid',
        'and sm.profile_id = auth.uid()',
        'and sm.profile_id = auth.uid() and public.hq_profile_is_active(auth.uid())')
    ) as s(name, signature, original, replacement)
  loop
    v_oid := to_regprocedure(format('public.%s(%s)',v_name,v_signature));
    -- hq_check_owner_access is a production-era optional RPC and is not
    -- created by the canonical zero-to-current migration history. Do not
    -- fabricate it in a clean build or alter any unrelated authorization.
    if v_oid is null and v_name = 'hq_check_owner_access' then continue; end if;
    if v_oid is null then raise exception 'Missing function: %(%)',v_name,v_signature; end if;
    v_body := pg_get_functiondef(v_oid);
    -- Production may already have the hotfix; rerunning must remain harmless.
    if strpos(v_body,v_to)>0 then continue; end if;
    -- A fresh rebuild still has the earlier, owner-only guard from
    -- 20260812065500. Preserve its postgres cron exception and audit trail
    -- while inserting the same active-profile gate. Production's newer
    -- HQ-membership-aware guard above remains unchanged.
    if v_name = 'hq_assert_owner' and strpos(v_body,v_from)=0 then
      v_from := '  if not coalesce(public.is_platform_owner(), false) then';
      v_to := '  if not public.hq_profile_is_active(v_uid) then raise exception ''HQ access denied'' using errcode=''42501''; end if;'
        || chr(10) || v_from;
    end if;
    if strpos(v_body,v_from)=0 then raise exception 'Signature drift: %',v_name; end if;
    if (length(v_body)-length(replace(v_body,v_from,'')))/length(v_from) <> 1 then
      raise exception 'Ambiguous replacement: %',v_name;
    end if;
    execute replace(v_body,v_from,v_to);
  end loop;
end $security$;

comment on function public.hq_profile_is_active(uuid)
is 'Privileged central profile-status gate used by HQ/owner authorization. Does not grant membership or permission.';
