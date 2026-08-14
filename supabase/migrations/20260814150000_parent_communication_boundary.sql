begin;

create or replace function public.parent_start_conversation(
  p_student_id uuid,
  p_recipient_id uuid,
  p_context_tag text default 'general'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  school_id uuid;
  class_id uuid;
  existing_thread uuid;
  new_thread uuid;
  normalized_tag text := case when p_context_tag in ('question','general','urgent') then p_context_tag else 'general' end;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = caller and p.role = 'parent') then raise exception 'Parent access required'; end if;

  select s.class_id, c.school_id into class_id, school_id
  from public.parent_student_links psl
  join public.students s on s.id = psl.student_id
  left join public.classes c on c.id = s.class_id
  where psl.parent_id = caller
    and psl.student_id = p_student_id
    and coalesce(psl.access_level, 'full') <> 'none'
    and s.deleted_at is null
  limit 1;

  if school_id is null then raise exception 'Child access not authorized'; end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_recipient_id
      and p.school_id = school_id
      and p.role in ('teacher','admin')
  ) then raise exception 'Recipient is not an authorized school contact'; end if;

  if not exists (
    select 1 from public.school_members sm
    where sm.profile_id = p_recipient_id and sm.school_id = school_id
  ) then raise exception 'Recipient is not a current school member'; end if;

  if not exists (
    select 1 from public.profiles p where p.id = p_recipient_id and p.role = 'admin'
  ) and not exists (
    select 1 from public.teacher_classes tc where tc.teacher_id = p_recipient_id and tc.class_id = class_id
  ) then raise exception 'Teacher is not assigned to this child''s class'; end if;

  select vp1.thread_id into existing_thread
  from public.vc_participants vp1
  join public.vc_participants vp2 on vp2.thread_id = vp1.thread_id
  join public.vc_threads vt on vt.id = vp1.thread_id
  where vp1.profile_id = caller
    and vp2.profile_id = p_recipient_id
    and vt.school_id = school_id
    and vt.type = 'direct'
  order by vt.last_message_at desc nulls last
  limit 1;

  if existing_thread is not null then return existing_thread; end if;

  insert into public.vc_threads (school_id, type, created_by, context_tag)
  values (school_id, 'direct', caller, normalized_tag)
  returning id into new_thread;

  insert into public.vc_participants (thread_id, profile_id, school_id)
  values (new_thread, caller, school_id), (new_thread, p_recipient_id, school_id);

  return new_thread;
end;
$$;

revoke all on function public.parent_start_conversation(uuid, uuid, text) from public, anon;
grant execute on function public.parent_start_conversation(uuid, uuid, text) to authenticated;

comment on function public.parent_start_conversation(uuid, uuid, text) is
'Parent-only communication entry point. Derives school from an active parent-child relationship and permits only assigned teachers or school admins.';

commit;
