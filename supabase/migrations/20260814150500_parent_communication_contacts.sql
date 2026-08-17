begin;

create or replace function public.get_parent_message_contacts(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  school_id uuid;
  class_id uuid;
  result jsonb;
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

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'role', p.role) order by p.full_name), '[]'::jsonb)
  into result
  from public.profiles p
  join public.school_members sm on sm.profile_id = p.id and sm.school_id = school_id
  where p.school_id = school_id
    and p.id <> caller
    and (
      p.role = 'admin'
      or (p.role = 'teacher' and exists (select 1 from public.teacher_classes tc where tc.teacher_id = p.id and tc.class_id = class_id))
    );

  return result;
end;
$$;

revoke all on function public.get_parent_message_contacts(uuid) from public, anon;
grant execute on function public.get_parent_message_contacts(uuid) to authenticated;

commit;
