begin;

create or replace function public.parent_find_or_create_thread(
  p_other_profile_id uuid,
  p_context_tag text default 'general'
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid := auth.uid();
  v_school_id uuid;
  v_thread_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id=caller and role='parent') then raise exception 'Parent access required'; end if;
  if p_other_profile_id is null or p_other_profile_id = caller then raise exception 'Invalid communication target'; end if;

  -- The target must be a teacher attached to one of this parent's current
  -- child classes, or an authorized school administrator for that school.
  select c.school_id into v_school_id
  from public.parent_student_links psl
  join public.students s on s.id=psl.student_id
  join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
  join public.classes c on c.id=sc.class_id
  join public.teacher_classes tc on tc.class_id=c.id and tc.teacher_id=p_other_profile_id
  where psl.parent_id=caller
    and coalesce(psl.access_level,'full')<>'none'
  limit 1;

  if v_school_id is null then
    select c.school_id into v_school_id
    from public.parent_student_links psl
    join public.students s on s.id=psl.student_id
    join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
    join public.classes c on c.id=sc.class_id
    join public.school_members sm on sm.school_id=c.school_id and sm.profile_id=p_other_profile_id
    where psl.parent_id=caller
      and coalesce(psl.access_level,'full')<>'none'
      and sm.role in ('owner','admin','headteacher')
    limit 1;
  end if;

  if v_school_id is null then raise exception 'Communication target is not authorized for this family'; end if;

  select vp1.thread_id into v_thread_id
  from public.vc_participants vp1
  join public.vc_participants vp2 on vp2.thread_id=vp1.thread_id
  where vp1.profile_id=caller and vp2.profile_id=p_other_profile_id
  limit 1;

  if v_thread_id is not null then return v_thread_id; end if;

  insert into public.vc_threads(school_id,type,created_by,context_tag)
  values(v_school_id,'direct',caller,coalesce(nullif(p_context_tag,''),'general'))
  returning id into v_thread_id;

  insert into public.vc_participants(thread_id,profile_id,school_id)
  values
    (v_thread_id,caller,v_school_id),
    (v_thread_id,p_other_profile_id,v_school_id);

  return v_thread_id;
end;
$$;

revoke all on function public.parent_find_or_create_thread(uuid,text) from public,anon;
grant execute on function public.parent_find_or_create_thread(uuid,text) to authenticated;

commit;
