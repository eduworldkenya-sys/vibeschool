-- Narrow class roster read authority for Teacher OS.
-- Keeps public.students RLS current-enrollment-only while supporting explicitly
-- authorized historical class progress after a learner leaves the class.

create or replace function public.teacher_get_class_roster(
  p_school_id uuid,
  p_class_id uuid,
  p_include_history boolean default false,
  p_student_id uuid default null
)
returns table(
  student_id uuid,
  name text,
  admission_number text,
  profile_id uuid,
  is_current boolean,
  joined_at timestamptz,
  left_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.school_members sm
    join public.teacher_classes tc
      on tc.school_id = sm.school_id
     and tc.teacher_id = sm.profile_id
    where sm.school_id = p_school_id
      and sm.profile_id = v_caller
      and sm.role::text = 'teacher'
      and tc.class_id = p_class_id
  ) then
    raise exception 'teacher_class_scope_required';
  end if;

  if not exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and c.school_id = p_school_id
  ) then
    raise exception 'class_school_mismatch';
  end if;

  return query
  select
    s.id,
    s.name,
    nullif(s.admission_number, ''),
    s.profile_id,
    sc.is_current,
    sc.joined_at,
    sc.left_at
  from public.student_classes sc
  join public.students s on s.id = sc.student_id
  where sc.school_id = p_school_id
    and sc.class_id = p_class_id
    and s.deleted_at is null
    and (p_include_history or sc.is_current)
    and (p_student_id is null or sc.student_id = p_student_id)
  order by sc.is_current desc, sc.joined_at desc, s.name asc;
end;
$$;

revoke all on function public.teacher_get_class_roster(uuid,uuid,boolean,uuid) from public, anon;
grant execute on function public.teacher_get_class_roster(uuid,uuid,boolean,uuid) to authenticated;

comment on function public.teacher_get_class_roster(uuid,uuid,boolean,uuid) is
  'Teacher-scoped canonical class roster projection. Enrollment authority is student_classes; historical identity is exposed only inside a live assigned teacher+school+class scope.';
