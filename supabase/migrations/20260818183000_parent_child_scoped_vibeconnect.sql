-- Parent Command Center R1: child-scoped VibeConnect authorization.
--
-- Problem closed:
--   The parent UI attempted direct vc_threads/vc_participants inserts, while
--   production RLS intentionally denies parents those generic write paths.
--   This migration keeps those broad policies closed and exposes one narrow,
--   audited parent RPC that can only create a direct thread for a canonically
--   linked child and an authorised teacher/admin for that child's school.

alter table public.vc_threads
  add column if not exists student_id uuid null references public.students(id) on delete set null;

create index if not exists vc_threads_student_id_idx
  on public.vc_threads(student_id)
  where student_id is not null;

comment on column public.vc_threads.student_id is
  'Canonical students.id context for child-scoped family/school conversations. Null preserves legacy/general threads.';

create or replace function public.parent_start_child_thread(
  p_student_id uuid,
  p_staff_id uuid,
  p_context_tag text default 'general'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_id uuid := auth.uid();
  v_class_id uuid;
  v_school_id uuid;
  v_staff_role text;
  v_thread_id uuid;
  v_context_tag text;
begin
  if v_parent_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_student_id is null or p_staff_id is null then
    raise exception 'student and staff are required' using errcode = '22004';
  end if;

  if not exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_id = v_parent_id
      and psl.student_id = p_student_id
  ) then
    raise exception 'parent is not linked to this learner' using errcode = '42501';
  end if;

  select s.class_id, c.school_id
    into v_class_id, v_school_id
  from public.students s
  join public.classes c on c.id = s.class_id
  where s.id = p_student_id;

  if v_class_id is null or v_school_id is null then
    raise exception 'learner does not have an active school class' using errcode = '23514';
  end if;

  select p.role
    into v_staff_role
  from public.profiles p
  where p.id = p_staff_id;

  if v_staff_role = 'teacher' then
    if not exists (
      select 1
      from public.teacher_classes tc
      where tc.teacher_id = p_staff_id
        and tc.class_id = v_class_id
    ) then
      raise exception 'teacher is not assigned to this learner class' using errcode = '42501';
    end if;
  elsif v_staff_role = 'admin' then
    if not exists (
      select 1
      from public.school_members sm
      where sm.profile_id = p_staff_id
        and sm.school_id = v_school_id
    ) then
      raise exception 'administrator is not a member of this learner school' using errcode = '42501';
    end if;
  else
    raise exception 'recipient is not authorised school staff' using errcode = '42501';
  end if;

  v_context_tag := case lower(coalesce(p_context_tag, 'general'))
    when 'question' then 'question'
    when 'urgent' then 'urgent'
    when 'concern' then 'concern'
    when 'enquiry' then 'enquiry'
    else 'general'
  end;

  select t.id
    into v_thread_id
  from public.vc_threads t
  where t.type = 'direct'
    and t.student_id = p_student_id
    and exists (
      select 1 from public.vc_participants vp
      where vp.thread_id = t.id and vp.profile_id = v_parent_id and vp.left_at is null
    )
    and exists (
      select 1 from public.vc_participants vp
      where vp.thread_id = t.id and vp.profile_id = p_staff_id and vp.left_at is null
    )
  order by t.created_at desc
  limit 1;

  if v_thread_id is not null then
    return v_thread_id;
  end if;

  insert into public.vc_threads (
    school_id,
    student_id,
    type,
    created_by,
    context_tag
  ) values (
    v_school_id,
    p_student_id,
    'direct',
    v_parent_id,
    v_context_tag
  )
  returning id into v_thread_id;

  insert into public.vc_participants (thread_id, profile_id, school_id)
  values
    (v_thread_id, v_parent_id, v_school_id),
    (v_thread_id, p_staff_id, v_school_id);

  return v_thread_id;
end;
$$;

revoke all on function public.parent_start_child_thread(uuid, uuid, text) from public;
revoke all on function public.parent_start_child_thread(uuid, uuid, text) from anon;
grant execute on function public.parent_start_child_thread(uuid, uuid, text) to authenticated;

comment on function public.parent_start_child_thread(uuid, uuid, text) is
  'Creates/reuses one child-scoped direct VibeConnect thread after verifying parent_student_links and teacher_classes/school_members authorization. Generic parent thread creation remains denied by RLS.';
