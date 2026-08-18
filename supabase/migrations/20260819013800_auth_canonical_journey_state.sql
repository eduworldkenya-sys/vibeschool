begin;

create or replace function public.get_my_auth_journey_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  p public.profiles%rowtype;
  v_student_count integer := 0;
  v_student_id uuid;
  v_has_school boolean := false;
  v_has_class boolean := false;
  v_has_child boolean := false;
  v_has_admin boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object(
      'authenticated', false,
      'role', null,
      'account_status', null,
      'is_anonymized', false,
      'profile_complete', false,
      'authority_complete', false,
      'state', 'authentication_required',
      'destination', '/login',
      'reason_code', 'AUTHENTICATION_REQUIRED',
      'canonical_identity_id', null
    );
  end if;

  select * into p from public.profiles where id = v_uid;
  if p.id is null then
    return jsonb_build_object(
      'authenticated', true,
      'role', null,
      'account_status', null,
      'is_anonymized', false,
      'profile_complete', false,
      'authority_complete', false,
      'state', 'profile_missing',
      'destination', '/auth/error?reason=profile_missing',
      'reason_code', 'PROFILE_MISSING',
      'canonical_identity_id', null
    );
  end if;

  if p.account_status::text <> 'active' or p.is_anonymized then
    return jsonb_build_object(
      'authenticated', true,
      'role', null,
      'account_status', p.account_status::text,
      'is_anonymized', p.is_anonymized,
      'profile_complete', p.role is not null,
      'authority_complete', false,
      'state', 'account_unavailable',
      'destination', '/auth/error?reason=account_unavailable',
      'reason_code', case when p.is_anonymized then 'ACCOUNT_ANONYMIZED' else 'ACCOUNT_NOT_ACTIVE' end,
      'canonical_identity_id', null
    );
  end if;

  if p.role is null then
    return jsonb_build_object(
      'authenticated', true,
      'role', null,
      'account_status', p.account_status::text,
      'is_anonymized', false,
      'profile_complete', false,
      'authority_complete', false,
      'state', 'role_unclaimed',
      'destination', '/auth/error?reason=account_unregistered',
      'reason_code', 'ROLE_UNCLAIMED',
      'canonical_identity_id', null
    );
  end if;

  if p.role = 'student' then
    select count(*), min(s.id)
      into v_student_count, v_student_id
    from public.students s
    where s.profile_id = v_uid and s.deleted_at is null;

    if v_student_count = 0 then
      return jsonb_build_object(
        'authenticated', true, 'role', 'student', 'account_status', p.account_status::text,
        'is_anonymized', false, 'profile_complete', true, 'authority_complete', false,
        'state', 'needs_student_identity', 'destination', '/student/claim',
        'reason_code', 'STUDENT_DOMAIN_MISSING', 'canonical_identity_id', null
      );
    end if;
    if v_student_count > 1 then
      return jsonb_build_object(
        'authenticated', true, 'role', 'student', 'account_status', p.account_status::text,
        'is_anonymized', false, 'profile_complete', true, 'authority_complete', false,
        'state', 'identity_conflict', 'destination', '/auth/error?reason=identity_conflict',
        'reason_code', 'AMBIGUOUS_LEARNER_IDENTITY', 'canonical_identity_id', null
      );
    end if;
    return jsonb_build_object(
      'authenticated', true, 'role', 'student', 'account_status', p.account_status::text,
      'is_anonymized', false, 'profile_complete', true, 'authority_complete', true,
      'state', 'ready', 'destination', '/student', 'reason_code', 'OK',
      'canonical_identity_id', v_student_id
    );
  end if;

  if p.role = 'teacher' then
    select exists(
      select 1 from public.school_members sm
      where sm.profile_id = v_uid and sm.role::text = 'teacher'
    ) into v_has_school;

    if not v_has_school then
      return jsonb_build_object(
        'authenticated', true, 'role', 'teacher', 'account_status', p.account_status::text,
        'is_anonymized', false, 'profile_complete', true, 'authority_complete', true,
        'state', 'needs_school', 'destination', '/teacher/onboarding/school',
        'reason_code', 'TEACHER_SCHOOL_REQUIRED', 'canonical_identity_id', v_uid
      );
    end if;

    select exists(
      select 1
      from public.teacher_classes tc
      join public.school_members sm
        on sm.profile_id = v_uid
       and sm.school_id = tc.school_id
       and sm.role::text = 'teacher'
      where tc.teacher_id = v_uid
    ) into v_has_class;

    if not v_has_class then
      return jsonb_build_object(
        'authenticated', true, 'role', 'teacher', 'account_status', p.account_status::text,
        'is_anonymized', false, 'profile_complete', true, 'authority_complete', true,
        'state', 'needs_class', 'destination', '/teacher/onboarding/class',
        'reason_code', 'TEACHER_CLASS_REQUIRED', 'canonical_identity_id', v_uid
      );
    end if;

    return jsonb_build_object(
      'authenticated', true, 'role', 'teacher', 'account_status', p.account_status::text,
      'is_anonymized', false, 'profile_complete', true, 'authority_complete', true,
      'state', 'ready', 'destination', '/teacher/pulse', 'reason_code', 'OK',
      'canonical_identity_id', v_uid
    );
  end if;

  if p.role = 'parent' then
    select exists(
      select 1
      from public.parent_student_links psl
      join public.students s on s.id = psl.student_id and s.deleted_at is null
      where psl.parent_id = v_uid
    ) into v_has_child;

    if not v_has_child then
      return jsonb_build_object(
        'authenticated', true, 'role', 'parent', 'account_status', p.account_status::text,
        'is_anonymized', false, 'profile_complete', true, 'authority_complete', true,
        'state', 'needs_child', 'destination', '/parent/students',
        'reason_code', 'PARENT_CHILD_REQUIRED', 'canonical_identity_id', v_uid
      );
    end if;

    return jsonb_build_object(
      'authenticated', true, 'role', 'parent', 'account_status', p.account_status::text,
      'is_anonymized', false, 'profile_complete', true, 'authority_complete', true,
      'state', 'ready', 'destination', '/parent', 'reason_code', 'OK',
      'canonical_identity_id', v_uid
    );
  end if;

  if p.role = 'admin' then
    select exists(
      select 1 from public.school_members sm
      where sm.profile_id = v_uid and sm.role::text in ('admin','owner')
    ) into v_has_admin;

    if not v_has_admin then
      return jsonb_build_object(
        'authenticated', true, 'role', null, 'claimed_role', 'admin',
        'account_status', p.account_status::text, 'is_anonymized', false,
        'profile_complete', true, 'authority_complete', false,
        'state', 'authority_incomplete',
        'destination', '/auth/error?reason=admin_membership_missing',
        'reason_code', 'ADMIN_MEMBERSHIP_MISSING', 'canonical_identity_id', null
      );
    end if;

    return jsonb_build_object(
      'authenticated', true, 'role', 'admin', 'account_status', p.account_status::text,
      'is_anonymized', false, 'profile_complete', true, 'authority_complete', true,
      'state', 'ready', 'destination', '/admin', 'reason_code', 'OK',
      'canonical_identity_id', v_uid
    );
  end if;

  if p.role = 'global_user' then
    return jsonb_build_object(
      'authenticated', true, 'role', 'global_user', 'account_status', p.account_status::text,
      'is_anonymized', false, 'profile_complete', true, 'authority_complete', true,
      'state', 'ready', 'destination', '/global', 'reason_code', 'OK',
      'canonical_identity_id', v_uid
    );
  end if;

  return jsonb_build_object(
    'authenticated', true, 'role', null, 'claimed_role', p.role,
    'account_status', p.account_status::text, 'is_anonymized', false,
    'profile_complete', true, 'authority_complete', false,
    'state', 'unknown_role', 'destination', '/auth/error?reason=role_unresolved',
    'reason_code', 'UNKNOWN_ROLE', 'canonical_identity_id', null
  );
end;
$$;

revoke all on function public.get_my_auth_journey_state() from public, anon;
grant execute on function public.get_my_auth_journey_state() to authenticated, service_role;

create or replace function public.get_my_onboarding_state()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select public.get_my_auth_journey_state();
$$;
revoke all on function public.get_my_onboarding_state() from public, anon;
grant execute on function public.get_my_onboarding_state() to authenticated, service_role;

create or replace function public.get_my_auth_access_state()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'authenticated', coalesce((j->>'authenticated')::boolean,false),
    'role', j->'role',
    'account_status', j->'account_status',
    'is_anonymized', coalesce((j->>'is_anonymized')::boolean,false),
    'profile_complete', coalesce((j->>'profile_complete')::boolean,false),
    'authority_complete', coalesce((j->>'authority_complete')::boolean,false),
    'reason_code', j->>'reason_code'
  )
  from (select public.get_my_auth_journey_state() j) s;
$$;
revoke all on function public.get_my_auth_access_state() from public, anon;
grant execute on function public.get_my_auth_access_state() to authenticated, service_role;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select nullif(public.get_my_auth_journey_state()->>'role','');
$$;
revoke all on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated, service_role;

comment on function public.get_my_auth_journey_state() is
  'Canonical authenticated journey state machine: profile, role, domain identity, authority, onboarding and destination.';

notify pgrst, 'reload schema';
commit;
