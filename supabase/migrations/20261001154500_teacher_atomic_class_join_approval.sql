-- Atomic teacher approval for learner class join requests.
-- Canonical enrollment is student_classes; students.class_id is compatibility only.

create or replace function public.teacher_approve_class_join_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_request public.class_join_requests%rowtype;
  v_school_id uuid;
  v_current public.student_classes%rowtype;
begin
  if v_caller is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_request
  from public.class_join_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'join_request_not_found';
  end if;

  if v_request.status = 'approved' then
    select c.school_id into v_school_id
    from public.classes c
    where c.id = v_request.class_id;

    return jsonb_build_object(
      'status','approved',
      'student_id',v_request.student_id,
      'class_id',v_request.class_id,
      'school_id',v_school_id,
      'already_approved',true
    );
  end if;

  if v_request.status <> 'pending' then
    raise exception 'join_request_not_pending';
  end if;

  select c.school_id
  into v_school_id
  from public.classes c
  where c.id = v_request.class_id
    and c.school_id is not null;

  if v_school_id is null then
    raise exception 'class_school_not_found';
  end if;

  if not exists (
    select 1
    from public.school_members sm
    where sm.school_id = v_school_id
      and sm.profile_id = v_caller
      and sm.role::text = 'teacher'
  ) then
    raise exception 'teacher_membership_required';
  end if;

  if not (
    exists (
      select 1
      from public.teacher_classes tc
      where tc.school_id = v_school_id
        and tc.class_id = v_request.class_id
        and tc.teacher_id = v_caller
        and tc.is_class_teacher = true
    )
    or exists (
      select 1
      from public.classes c
      where c.id = v_request.class_id
        and c.school_id = v_school_id
        and c.teacher_id = v_caller
        and not exists (
          select 1
          from public.teacher_classes canonical
          where canonical.school_id = v_school_id
            and canonical.class_id = v_request.class_id
            and canonical.is_class_teacher = true
        )
    )
  ) then
    raise exception 'class_teacher_required';
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = v_request.student_id
      and s.deleted_at is null
  ) then
    raise exception 'student_not_found';
  end if;

  select *
  into v_current
  from public.student_classes sc
  where sc.student_id = v_request.student_id
    and sc.is_current = true
  for update;

  if v_current.id is not null
     and (v_current.class_id <> v_request.class_id or v_current.school_id <> v_school_id) then
    raise exception 'student_has_different_current_enrollment';
  end if;

  if v_current.id is null then
    insert into public.student_classes(
      school_id, student_id, class_id, joined_at, left_at, is_current
    )
    values(
      v_school_id, v_request.student_id, v_request.class_id, clock_timestamp(), null, true
    )
    on conflict (student_id, class_id)
    do update set
      school_id = excluded.school_id,
      is_current = true,
      left_at = null;
  end if;

  insert into public.parent_student_links(
    parent_id, student_id, school_id, relationship,
    is_primary, can_pickup, receives_alerts, updated_at
  )
  values(
    v_request.parent_id, v_request.student_id, v_school_id, 'parent',
    true, true, true, clock_timestamp()
  )
  on conflict (parent_id, student_id)
  do update set
    school_id = excluded.school_id,
    receives_alerts = true,
    updated_at = clock_timestamp();

  -- Compatibility mirror only. Operational reads must never use this field.
  update public.students
  set class_id = v_request.class_id
  where id = v_request.student_id
    and class_id is distinct from v_request.class_id;

  update public.class_join_requests
  set status = 'approved'
  where id = v_request.id;

  return jsonb_build_object(
    'status','approved',
    'student_id',v_request.student_id,
    'class_id',v_request.class_id,
    'school_id',v_school_id,
    'already_approved',false
  );
end;
$$;

revoke all on function public.teacher_approve_class_join_request(uuid) from public, anon;
grant execute on function public.teacher_approve_class_join_request(uuid) to authenticated;

comment on function public.teacher_approve_class_join_request(uuid) is
  'Atomically approves a pending class join request, creates/verifies canonical current enrollment, reconciles family linkage, and only then mirrors legacy students.class_id.';
